import type { AppDatabase } from '../../db/connection.ts';
import type {
  PaymentGatewayProvider,
  SandboxGatewayProvider,
} from './gateway-provider.ts';
import type { NotificationsService } from '../notifications/notifications.service.ts';
import type { AuditService } from '../audit/audit.service.ts';
import { AppError } from '../../middleware/error-handler.ts';
import { tomanToRial } from '../../../shared/pricing-formula.ts';

export class PaymentsService {
  private readonly db: AppDatabase;
  private gateway: PaymentGatewayProvider;
  private readonly notifications: NotificationsService;
  private readonly audit: AuditService;
  private readonly allowPostpayDebtByEnvironment: boolean;

  constructor(params: {
    db: AppDatabase;
    gateway: PaymentGatewayProvider;
    notifications: NotificationsService;
    audit: AuditService;
    allowPostpayDebtByEnvironment: boolean;
  }) {
    this.db = params.db;
    this.gateway = params.gateway;
    this.notifications = params.notifications;
    this.audit = params.audit;
    this.allowPostpayDebtByEnvironment = params.allowPostpayDebtByEnvironment;
  }

  getGatewayStatus() {
    return {
      providerName: this.gateway.name,
      isSandbox: this.gateway.isSandbox,
      connectionVerified: false,
      noticeFa: this.gateway.isSandbox
        ? 'محیط شبیه‌سازی (Sandbox) فعال است — هیچ وجه واقعی بانکی جابه‌جا نمی‌شود.'
        : 'این فقط نام ارائه‌دهندهٔ انتخاب‌شده است؛ وجود کلید معتبر، اتصال زنده یا سلامت درگاه را اثبات نمی‌کند. هر پرداخت فقط پس از پاسخ معتبر استعلام سرور تأیید می‌شود.',
    };
  }

  isPostpayDebtEnabled(): boolean {
    if (!this.allowPostpayDebtByEnvironment) return false;
    const setting = this.db.get<{ value_json: string }>(
      `SELECT value_json FROM system_settings WHERE key = 'allow_postpay_debt'`
    );
    if (!setting) return false;
    try {
      return JSON.parse(setting.value_json) === true;
    } catch {
      return false;
    }
  }

  private getCurrentWalletBalance(responderId: number): number {
    const row = this.db.get<{ balance_after_toman: number }>(
      `SELECT balance_after_toman FROM wallet_ledger_entries
       WHERE responder_id = ? ORDER BY id DESC LIMIT 1`,
      responderId
    );
    return row?.balance_after_toman ?? 0;
  }

  /** Only invoice earnings linked to a verified payment of the current mode may fund a settlement. */
  private getEligibleSettlementBalance(responderId: number, isSandbox: boolean): number {
    const earnings = this.db.get<{ total: number }>(
      `SELECT COALESCE(SUM(i.responder_net_toman), 0) AS total
       FROM invoices i
       WHERE i.responder_id = ? AND i.status IN ('paid', 'refunded')
         AND EXISTS (
           SELECT 1 FROM payment_intents p
           WHERE p.request_id = i.request_id AND p.is_sandbox = ?
             AND p.status IN ('verified', 'refunded', 'partially_refunded')
         )`,
      responderId,
      isSandbox ? 1 : 0
    );
    const refundReversals = this.db.get<{ total: number }>(
      `SELECT COALESCE(SUM(-amount_toman), 0) AS total
       FROM wallet_ledger_entries
       WHERE responder_id = ? AND entry_type = 'refund_reversal' AND amount_toman < 0`,
      responderId
    );
    const committedSettlements = this.db.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total
       FROM settlements WHERE responder_id = ? AND status IN ('requested', 'approved_paid')`,
      responderId
    );

    return Math.max(
      0,
      Number(earnings?.total ?? 0) -
        Number(refundReversals?.total ?? 0) -
        Number(committedSettlements?.total ?? 0)
    );
  }

  private appendLedgerEntry(params: {
    responderId: number;
    requestId?: number | null;
    settlementId?: number | null;
    refundId?: number | null;
    entryType:
      | 'mission_earning'
      | 'refund_reversal'
      | 'settlement_payout'
      | 'manual_adjustment';
    amountToman: number;
    description: string;
  }) {
    const prev = this.getCurrentWalletBalance(params.responderId);
    const next = prev + Math.round(params.amountToman);
    this.db.run(
      `INSERT INTO wallet_ledger_entries (
        responder_id, request_id, settlement_id, refund_id,
        entry_type, amount_toman, balance_after_toman, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params.responderId,
      params.requestId ?? null,
      params.settlementId ?? null,
      params.refundId ?? null,
      params.entryType,
      Math.round(params.amountToman),
      next,
      params.description,
      new Date().toISOString()
    );
    return next;
  }

  /**
   * ایجاد سفارش پرداخت برای یک مأموریت تکمیل‌شده (یا جریمه لغو)
   */
  async createPaymentOrder(params: {
    requestId: number;
    customerUserId: number;
    callbackBaseUrl: string;
  }) {
    const reqRow = this.db.get<{
      id: number;
      tracking_code: string;
      customer_user_id: number;
      status: string;
      final_price_toman: number | null;
      estimated_price_toman: number;
      cancellation_fee_toman: number;
      customer_price_approval_required: number;
      customer_price_approved: number;
      payment_status: string;
    }>('SELECT * FROM service_requests WHERE id = ?', params.requestId);

    if (!reqRow || reqRow.customer_user_id !== params.customerUserId) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'درخواست یافت نشد.');
    }

    if (reqRow.payment_status === 'paid') {
      throw new AppError(
        409,
        'ALREADY_PAID',
        'هزینه این مأموریت قبلاً پرداخت و تأیید شده است.'
      );
    }

    let amountToman = 0;
    if (reqRow.status === 'Completed') {
      if (
        reqRow.customer_price_approval_required === 1 &&
        reqRow.customer_price_approved !== 1
      ) {
        throw new AppError(
          409,
          'PRICE_APPROVAL_REQUIRED',
          'پیش از پرداخت، ابتدا تغییر مبلغ نهایی صورتحساب را بررسی و تأیید کنید یا تیکت اعتراض ثبت نمایید.'
        );
      }
      amountToman = reqRow.final_price_toman ?? reqRow.estimated_price_toman;
    } else if (reqRow.status === 'Cancelled' && reqRow.cancellation_fee_toman > 0) {
      amountToman = reqRow.cancellation_fee_toman;
    } else {
      throw new AppError(
        409,
        'NOT_PAYABLE_YET',
        'پرداخت صورتحساب تنها پس از تکمیل خدمت و صدور مبلغ نهایی امکان‌پذیر است.'
      );
    }

    const amountRial = tomanToRial(amountToman);
    const customer = this.db.get<{ phone: string }>(
      'SELECT phone FROM users WHERE id = ?',
      params.customerUserId
    );

    const gatewayOrder = await this.gateway.createOrder({
      amountRial,
      callbackUrl: `${params.callbackBaseUrl}/api/payments/callback`,
      description: `صورتحساب مأموریت ${reqRow.tracking_code} - اورژانس خودرو`,
      mobile: customer?.phone,
    });

    const nowIso = new Date().toISOString();
    const intentId = this.db.transaction(() => {
      const res = this.db.run(
        `INSERT INTO payment_intents (
          request_id, customer_user_id, gateway_provider, authority,
          amount_toman, amount_rial, status, is_sandbox, callback_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?, ?)`,
        reqRow.id,
        params.customerUserId,
        this.gateway.name,
        gatewayOrder.authority,
        amountToman,
        amountRial,
        gatewayOrder.isSandbox ? 1 : 0,
        nowIso,
        nowIso
      );

      this.db.run(
        `UPDATE service_requests SET payment_status = 'pending_gateway', updated_at = ? WHERE id = ?`,
        nowIso,
        reqRow.id
      );

      return res.lastInsertRowid;
    });

    return {
      paymentIntentId: intentId,
      authority: gatewayOrder.authority,
      amountToman,
      amountRial,
      isSandbox: gatewayOrder.isSandbox,
      paymentRedirectUrl: gatewayOrder.paymentRedirectUrl,
      gatewayNoticeFa: this.getGatewayStatus().noticeFa,
    };
  }

  /**
   * شبیه‌سازی پرداخت در سمت سرور درگاه آزمایشی (فقط در حالت Sandbox فعال است)
   */
  simulateSandboxBankDecision(authority: string, outcome: 'approve' | 'fail') {
    if (!this.gateway.isSandbox || this.gateway.name !== 'sandbox') {
      throw new AppError(
        403,
        'SANDBOX_DISABLED',
        'شبیه‌ساز بانکی فقط در محیط آزمایشی (Sandbox) فعال است.'
      );
    }
    const sbx = this.gateway as SandboxGatewayProvider;
    sbx.simulateBankAction(authority, outcome);
    return { ok: true, authority, simulatedOutcome: outcome };
  }

  /**
   * پردازش Callback درگاه پرداخت با Verify الزامی سمت سرور و مقاومت کامل در برابر Callback تکراری (Idempotency)
   */
  async verifyPaymentCallback(params: {
    authority: string;
    browserStatusParam?: string;
  }) {
    const intent = this.db.get<{
      id: number;
      request_id: number;
      customer_user_id: number;
      gateway_provider: string;
      authority: string;
      amount_toman: number;
      amount_rial: number;
      status: string;
      ref_id: string | null;
      is_sandbox: number;
    }>(
      'SELECT * FROM payment_intents WHERE gateway_provider = ? AND authority = ?',
      this.gateway.name,
      params.authority
    );

    if (!intent) {
      this.audit.logSecurityEvent({
        eventType: 'UNKNOWN_PAYMENT_CALLBACK',
        severity: 'warning',
        detail: `دریافت Callback با Authority ناشناخته: ${params.authority}`,
      });
      throw new AppError(404, 'PAYMENT_INTENT_NOT_FOUND', 'سفارش پرداخت یافت نشد.');
    }

    // اگر قبلاً تأیید شده باشد، بدون پردازش مضاعف و بدون شارژ دوباره کیف پول امدادگر نتیجه را برمی‌گردانیم
    if (intent.status === 'verified') {
      this.db.run(
        'UPDATE payment_intents SET callback_count = callback_count + 1 WHERE id = ?',
        intent.id
      );
      return {
        paid: true,
        alreadyProcessed: true,
        requestId: intent.request_id,
        refId: intent.ref_id,
        amountToman: intent.amount_toman,
        isSandbox: intent.is_sandbox === 1,
      };
    }

    // قانون طلایی بخش ۱۴: هرگز صرفاً بر اساس Status=OK مرورگر پرداخت را موفق تلقی نکن؛ همیشه از سرور درگاه استعلام کن!
    const verification = await this.gateway.verifyOrder(
      intent.authority,
      intent.amount_rial
    );

    const nowIso = new Date().toISOString();

    if (!verification.verified || !verification.refId) {
      this.db.transaction(() => {
        this.db.run(
          `UPDATE payment_intents
           SET status = 'failed',
               failure_reason = ?,
               callback_count = callback_count + 1,
               updated_at = ?
           WHERE id = ? AND status = 'pending'`,
          verification.errorMessage ?? 'تأیید تراکنش در سرور درگاه ناموفق بود',
          nowIso,
          intent.id
        );

        const hasPaidIntent = this.db.get<{ id: number }>(
          `SELECT id FROM payment_intents WHERE request_id = ? AND status = 'verified'`,
          intent.request_id
        );
        if (!hasPaidIntent) {
          this.db.run(
            `UPDATE service_requests SET payment_status = 'failed', updated_at = ? WHERE id = ?`,
            nowIso,
            intent.request_id
          );
        }
      });

      return {
        paid: false,
        alreadyProcessed: false,
        requestId: intent.request_id,
        errorCode: verification.errorCode ?? 'PAYMENT_FAILED',
        errorMessage:
          verification.errorMessage ?? 'پرداخت توسط بانک تأیید نشد.',
        isSandbox: intent.is_sandbox === 1,
      };
    }

    // تراکنش اتمیک ثبت پرداخت موفق، تسویه فاکتور و ثبت درآمد خالص امدادگر
    const txOutcome = this.db.transaction(() => {
      const upd = this.db.run(
        `UPDATE payment_intents
         SET status = 'verified',
             ref_id = ?,
             verified_at = ?,
             callback_count = callback_count + 1,
             updated_at = ?
         WHERE id = ? AND status = 'pending'`,
        verification.refId!,
        nowIso,
        nowIso,
        intent.id
      );

      if (upd.changes !== 1) {
        return { alreadyProcessedRace: true };
      }

      this.db.run(
        `UPDATE service_requests SET payment_status = 'paid', updated_at = ? WHERE id = ?`,
        nowIso,
        intent.request_id
      );

      const invoice = this.db.get<{
        id: number;
        invoice_number: string;
        responder_id: number | null;
        responder_net_toman: number;
      }>('SELECT * FROM invoices WHERE request_id = ?', intent.request_id);

      if (invoice) {
        this.db.run(
          `UPDATE invoices SET status = 'paid', paid_at = ? WHERE id = ?`,
          nowIso,
          invoice.id
        );

        if (invoice.responder_id && invoice.responder_net_toman > 0) {
          this.appendLedgerEntry({
            responderId: invoice.responder_id,
            requestId: intent.request_id,
            entryType: 'mission_earning',
            amountToman: invoice.responder_net_toman,
            description: `سهم خالص مأموریت (فاکتور ${invoice.invoice_number} - کد مرجع ${verification.refId})`,
          });
        }
      }

      return { alreadyProcessedRace: false, invoiceNumber: invoice?.invoice_number };
    });

    if (!txOutcome.alreadyProcessedRace) {
      const isSandboxPayment = intent.is_sandbox === 1;
      await this.notifications.notifyUser({
        userId: intent.customer_user_id,
        requestId: intent.request_id,
        eventType: isSandboxPayment ? 'PAYMENT_SANDBOX_VERIFIED' : 'PAYMENT_VERIFIED',
        title: isSandboxPayment
          ? 'پرداخت شبیه‌سازی‌شده تأیید شد'
          : 'پرداخت صورتحساب تأیید شد',
        body: isSandboxPayment
          ? `تراکنش ${intent.amount_toman.toLocaleString('fa-IR')} تومان فقط در Sandbox شبیه‌سازی شد؛ هیچ وجه واقعی بانکی جابه‌جا نشده است.`
          : `پرداخت مبلغ ${intent.amount_toman.toLocaleString('fa-IR')} تومان با کد رهگیری ${verification.refId} توسط درگاه تأیید شد.`,
        sendSms: !isSandboxPayment,
        dedupBaseKey: `paid:${intent.id}`,
      });
    }

    return {
      paid: true,
      alreadyProcessed: txOutcome.alreadyProcessedRace,
      requestId: intent.request_id,
      refId: verification.refId,
      amountToman: intent.amount_toman,
      isSandbox: intent.is_sandbox === 1,
    };
  }

  /**
   * بازپرداخت در این نسخه fail-closed است: تا اتصال و آزمون provider بازپرداخت واقعی،
   * هیچ وضعیت، فاکتور، دفترکل یا اعلان مشتری تغییر نمی‌کند.
   */
  async processRefund(_params: {
    requestId: number;
    amountToman: number;
    reason: string;
    adminUserId: number;
    ipAddress?: string;
  }): Promise<never> {
    throw new AppError(
      503,
      'REFUND_PROVIDER_UNAVAILABLE',
      'بازپرداخت خودکار در این نسخه پیاده‌سازی و راستی‌آزمایی نشده است؛ هیچ وجه یا وضعیت مالی تغییر نکرد. بازپرداخت را فقط از مسیر مالی خارج از سامانه و با سند بانکی معتبر پیگیری کنید.'
    );
  }

  /**
   * ثبت بدهی مجاز فقط برای خدمت تکمیل‌شده و فاکتور صادرشده؛ این مسیر وجهی دریافت نمی‌کند.
   */
  approveEmergencyDebt(params: {
    requestId: number;
    actorUserId: number;
    actorRole: 'operator' | 'admin';
    reason: string;
  }) {
    if (!this.isPostpayDebtEnabled()) {
      throw new AppError(
        403,
        'POSTPAY_DEBT_DISABLED',
        'قابلیت ثبت بدهی پس‌پرداخت در پیکربندی سرور یا تنظیمات سامانه غیرفعال است.'
      );
    }

    const reason = params.reason.trim();
    if (reason.length < 5) {
      throw new AppError(400, 'DEBT_REASON_REQUIRED', 'ثبت دلیل معتبر برای بدهی الزامی است.');
    }

    const nowIso = new Date().toISOString();
    const amountToman = this.db.transaction(() => {
      const requestRow = this.db.get<{
        id: number;
        status: string;
        payment_status: string;
      }>(
        'SELECT id, status, payment_status FROM service_requests WHERE id = ?',
        params.requestId
      );
      if (!requestRow) {
        throw new AppError(404, 'REQUEST_NOT_FOUND', 'درخواست یافت نشد.');
      }
      if (requestRow.status !== 'Completed') {
        throw new AppError(
          409,
          'DEBT_REQUIRES_COMPLETED_SERVICE',
          'ثبت بدهی فقط پس از تکمیل خدمت و صدور صورتحساب مجاز است.'
        );
      }
      const pendingIntent = this.db.get<{ id: number }>(
        `SELECT id FROM payment_intents WHERE request_id = ? AND status = 'pending' LIMIT 1`,
        params.requestId
      );
      if (pendingIntent) {
        throw new AppError(
          409,
          'PAYMENT_ATTEMPT_IN_PROGRESS',
          'برای این مأموریت سفارش پرداخت درحال‌پردازش وجود دارد؛ ابتدا نتیجه درگاه را تعیین تکلیف کنید.'
        );
      }
      if (!['unpaid', 'failed'].includes(requestRow.payment_status)) {
        throw new AppError(
          409,
          'DEBT_NOT_ELIGIBLE',
          'وضعیت فعلی پرداخت برای ثبت بدهی مجاز نیست؛ تراکنش ناموفق یا وضعیت نهایی را بررسی کنید.'
        );
      }

      const invoice = this.db.get<{
        id: number;
        total_toman: number;
        status: string;
      }>('SELECT id, total_toman, status FROM invoices WHERE request_id = ?', params.requestId);
      if (!invoice || invoice.status !== 'issued') {
        throw new AppError(
          409,
          'ISSUED_INVOICE_REQUIRED',
          'برای ثبت بدهی، فاکتور صادرشده و پرداخت‌نشده لازم است.'
        );
      }

      const requestUpdate = this.db.run(
        `UPDATE service_requests
         SET payment_status = 'approved_debt', updated_at = ?
         WHERE id = ? AND status = 'Completed' AND payment_status IN ('unpaid', 'failed')`,
        nowIso,
        params.requestId
      );
      if (requestUpdate.changes !== 1) {
        throw new AppError(409, 'DEBT_NOT_ELIGIBLE', 'وضعیت مأموریت هم‌زمان تغییر کرده است.');
      }

      const invoiceUpdate = this.db.run(
        `UPDATE invoices SET status = 'approved_debt'
         WHERE id = ? AND status = 'issued'`,
        invoice.id
      );
      if (invoiceUpdate.changes !== 1) {
        throw new AppError(409, 'DEBT_NOT_ELIGIBLE', 'وضعیت فاکتور هم‌زمان تغییر کرده است.');
      }

      this.audit.logAdminAction({
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        action: 'APPROVED_EMERGENCY_DEBT',
        entityType: 'service_request',
        entityId: params.requestId,
        summary: `ثبت بدهی مجاز برای مأموریت #${params.requestId}`,
        metadata: { reason, amountToman: invoice.total_toman, paymentReceived: false },
      });
      return invoice.total_toman;
    });

    return {
      ok: true,
      paymentStatus: 'approved_debt',
      amountToman,
      paymentReceived: false,
    };
  }

  /**
   * کیف پول و درخواست تسویه‌حساب امدادگر
   */
  getResponderFinancialSummary(responderUserId: number) {
    const responder = this.db.get<{ id: number; sheba_number: string | null }>(
      'SELECT id, sheba_number FROM responder_profiles WHERE user_id = ?',
      responderUserId
    );
    if (!responder) {
      throw new AppError(404, 'RESPONDER_NOT_FOUND', 'امدادگر یافت نشد.');
    }

    const balanceToman = this.getCurrentWalletBalance(responder.id);
    const eligibleForSettlementToman = this.getEligibleSettlementBalance(
      responder.id,
      this.gateway.isSandbox
    );
    const ledger = this.db.all(
      'SELECT * FROM wallet_ledger_entries WHERE responder_id = ? ORDER BY id DESC LIMIT 50',
      responder.id
    );
    const settlements = this.db.all(
      'SELECT * FROM settlements WHERE responder_id = ? ORDER BY id DESC LIMIT 30',
      responder.id
    );

    return {
      responderId: responder.id,
      shebaNumber: responder.sheba_number,
      balanceToman,
      eligibleForSettlementToman,
      settlementMode: this.gateway.isSandbox ? 'sandbox_simulated' : 'manual_external',
      ledger,
      settlements,
    };
  }

  requestResponderSettlement(params: {
    responderUserId: number;
    amountToman: number;
    shebaNumber?: string;
  }) {
    return this.db.transaction(() => {
      const responder = this.db.get<{ id: number; sheba_number: string | null }>(
        'SELECT id, sheba_number FROM responder_profiles WHERE user_id = ?',
        params.responderUserId
      );
      if (!responder) {
        throw new AppError(404, 'RESPONDER_NOT_FOUND', 'امدادگر یافت نشد.');
      }

      const sheba = (params.shebaNumber ?? responder.sheba_number ?? '')
        .trim()
        .toUpperCase();
      if (!/^IR\d{24}$/.test(sheba)) {
        throw new AppError(
          400,
          'INVALID_SHEBA',
          'برای ثبت درخواست تسویه‌حساب، شماره شبای معتبر ۲۶ کاراکتری (IR...) الزامی است.'
        );
      }

      const balance = this.getCurrentWalletBalance(responder.id);
      const reqAmount = Math.round(params.amountToman);
      if (reqAmount < 50000) {
        throw new AppError(
          400,
          'MIN_SETTLEMENT_AMOUNT',
          'حداقل مبلغ درخواست تسویه‌حساب ۵۰,۰۰۰ تومان است.'
        );
      }
      if (reqAmount > balance) {
        throw new AppError(
          422,
          'INSUFFICIENT_WALLET_BALANCE',
          `موجودی دفترکل شما (${balance.toLocaleString('fa-IR')} تومان) کمتر از مبلغ درخواستی است.`
        );
      }

      const executionMode = this.gateway.isSandbox ? 'sandbox_simulated' : 'manual_external';
      const eligibleBalance = this.getEligibleSettlementBalance(
        responder.id,
        this.gateway.isSandbox
      );
      if (reqAmount > eligibleBalance) {
        throw new AppError(
          422,
          'INSUFFICIENT_VERIFIED_WALLET_BALANCE',
          `موجودی واجد شرایطِ متصل به فاکتور و پرداخت تأییدشده در این حالت (${eligibleBalance.toLocaleString('fa-IR')} تومان) کمتر از مبلغ درخواستی است.`
        );
      }

      const nowIso = new Date().toISOString();
      const setRes = this.db.run(
        `INSERT INTO settlements (
          responder_id, amount_toman, sheba_number, status, execution_mode, created_at
        ) VALUES (?, ?, ?, 'requested', ?, ?)`,
        responder.id,
        reqAmount,
        sheba,
        executionMode,
        nowIso
      );

      this.appendLedgerEntry({
        responderId: responder.id,
        settlementId: setRes.lastInsertRowid,
        entryType: 'settlement_payout',
        amountToman: -reqAmount,
        description: `کسر بابت درخواست تسویه‌حساب #${setRes.lastInsertRowid} به شبا ${sheba}`,
      });

      return {
        settlementId: setRes.lastInsertRowid,
        amountToman: reqAmount,
        remainingBalanceToman: balance - reqAmount,
        executionMode,
        simulationOnly: executionMode === 'sandbox_simulated',
      };
    });
  }

  processSettlementByAdmin(params: {
    settlementId: number;
    decision: 'approved_paid' | 'rejected';
    bankReferenceCode?: string;
    note?: string;
    externalTransferConfirmed?: boolean;
    adminUserId: number;
  }) {
    return this.db.transaction(() => {
      const settlement = this.db.get<{
        id: number;
        responder_id: number;
        amount_toman: number;
        status: string;
        execution_mode: string;
      }>('SELECT * FROM settlements WHERE id = ?', params.settlementId);

      if (!settlement) {
        throw new AppError(404, 'SETTLEMENT_NOT_FOUND', 'درخواست تسویه یافت نشد.');
      }
      if (settlement.status !== 'requested') {
        throw new AppError(
          409,
          'SETTLEMENT_ALREADY_PROCESSED',
          'این درخواست تسویه قبلاً پردازش شده است.'
        );
      }

      const expectedMode = this.gateway.isSandbox ? 'sandbox_simulated' : 'manual_external';
      if (
        params.decision === 'approved_paid' &&
        settlement.execution_mode !== expectedMode
      ) {
        throw new AppError(
          409,
          'SETTLEMENT_MODE_UNVERIFIED',
          'روش اجرای این درخواست تسویه قدیمی یا نامشخص است؛ تا تعیین مسیر واقعی انتقال وجه آن را تأیید نکنید.'
        );
      }

      const note = params.note?.trim() ?? '';
      const bankReferenceCode = params.bankReferenceCode?.trim() ?? '';
      if (params.decision === 'rejected' && note.length < 5) {
        throw new AppError(400, 'SETTLEMENT_NOTE_REQUIRED', 'ثبت دلیل معتبر برای رد تسویه الزامی است.');
      }

      if (params.decision === 'approved_paid' && settlement.execution_mode === 'manual_external') {
        if (bankReferenceCode.length < 4) {
          throw new AppError(
            400,
            'BANK_REF_REQUIRED',
            'شناسه مرجع را دقیقاً از رسید بانکی واقعی وارد کنید؛ سامانه قالب یا اصالت آن را با بانک راستی‌آزمایی نمی‌کند.'
          );
        }
        if (note.length < 5) {
          throw new AppError(
            400,
            'SETTLEMENT_NOTE_REQUIRED',
            'برای ثبت تسویه دستی، یادداشت ممیزی واقعی الزامی است.'
          );
        }
        if (params.externalTransferConfirmed !== true) {
          throw new AppError(
            409,
            'EXTERNAL_TRANSFER_CONFIRMATION_REQUIRED',
            'پیش از ثبت، انتقال بانکی را خارج از سامانه انجام دهید و تأیید صریح مشاهده رسید را ثبت کنید.'
          );
        }
      }

      const storedReference =
        params.decision === 'approved_paid' && settlement.execution_mode === 'manual_external'
          ? bankReferenceCode
          : null;
      const storedNote =
        note ||
        (settlement.execution_mode === 'sandbox_simulated'
          ? 'Sandbox: شبیه‌سازی داخلی؛ وجه واقعی جابه‌جا نشد.'
          : null);
      const nowIso = new Date().toISOString();
      const update = this.db.run(
        `UPDATE settlements
         SET status = ?, bank_reference_code = ?, processed_by_admin_id = ?, note = ?, processed_at = ?
         WHERE id = ? AND status = 'requested'`,
        params.decision,
        storedReference,
        params.adminUserId,
        storedNote,
        nowIso,
        settlement.id
      );
      if (update.changes !== 1) {
        throw new AppError(409, 'SETTLEMENT_ALREADY_PROCESSED', 'این درخواست تسویه هم‌زمان پردازش شده است.');
      }

      if (params.decision === 'rejected') {
        this.appendLedgerEntry({
          responderId: settlement.responder_id,
          settlementId: settlement.id,
          entryType: 'manual_adjustment',
          amountToman: settlement.amount_toman,
          description: `برگشت وجه به کیف پول بابت رد تسویه #${settlement.id}`,
        });
      }

      const simulationOnly =
        params.decision === 'approved_paid' &&
        settlement.execution_mode === 'sandbox_simulated';
      this.audit.logAdminAction({
        actorUserId: params.adminUserId,
        actorRole: 'admin',
        action:
          params.decision === 'rejected'
            ? 'SETTLEMENT_REJECTED'
            : simulationOnly
              ? 'SETTLEMENT_SIMULATED_APPROVED'
              : 'SETTLEMENT_MANUALLY_ATTESTED_APPROVED',
        entityType: 'settlement',
        entityId: settlement.id,
        summary:
          params.decision === 'rejected'
            ? `رد درخواست تسویه #${settlement.id} (${settlement.amount_toman} تومان) و برگشت به کیف پول.`
            : simulationOnly
              ? `شبیه‌سازی تسویه #${settlement.id} (${settlement.amount_toman} تومان)؛ وجه واقعی جابه‌جا نشد.`
              : `ثبت دستی وضعیت تسویه #${settlement.id} (${settlement.amount_toman} تومان) بر اساس تأیید مدیر؛ اتصال/استعلام بانکی خودکار وجود ندارد.`,
        metadata: {
          executionMode: settlement.execution_mode,
          bankReferenceCode: storedReference,
          externalTransferConfirmed: params.externalTransferConfirmed === true,
          bankTransferVerifiedByProvider: false,
        },
      });

      return {
        settlementId: settlement.id,
        status: params.decision,
        executionMode: settlement.execution_mode,
        simulationOnly,
        payoutExecutedByPlatform: false,
        bankTransferVerifiedByProvider: false,
      };
    });
  }

  listCustomerInvoicesAndPayments(customerUserId: number) {
    const invoices = this.db.all(
      `SELECT i.*, r.tracking_code, s.title_fa AS service_title,
         (SELECT p.is_sandbox FROM payment_intents p
          WHERE p.request_id = i.request_id AND p.status IN ('verified', 'refunded', 'partially_refunded')
          ORDER BY p.id DESC LIMIT 1) AS payment_is_sandbox,
         (SELECT COUNT(*) FROM refunds f
          WHERE f.request_id = i.request_id AND f.status = 'completed'
            AND f.verification_mode = 'provider_verified') AS provider_verified_refunds_count
       FROM invoices i
       JOIN service_requests r ON r.id = i.request_id
       JOIN service_catalog s ON s.id = r.service_id
       WHERE i.customer_user_id = ?
       ORDER BY i.id DESC`,
      customerUserId
    );
    const payments = this.db.all(
      `SELECT p.*, r.tracking_code
       FROM payment_intents p
       JOIN service_requests r ON r.id = p.request_id
       WHERE p.customer_user_id = ?
       ORDER BY p.id DESC`,
      customerUserId
    );
    return { invoices, payments };
  }

  /**
   * گزارش تطبیق مالی؛ Sandbox و رکوردهای تاریخیِ راستی‌آزمایی‌نشده جدا از جمع‌های اصلی‌اند.
   */
  getFinancialReconciliationReport() {
    const paidStatuses = "('verified', 'refunded', 'partially_refunded')";
    const grossVerifiedRow = this.db.get<{ total: number; cnt: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total, COUNT(*) AS cnt
       FROM payment_intents
       WHERE is_sandbox = 0 AND status IN ${paidStatuses}`
    );
    const sandboxPaymentsRow = this.db.get<{ total: number; cnt: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total, COUNT(*) AS cnt
       FROM payment_intents
       WHERE is_sandbox = 1 AND status IN ${paidStatuses}`
    );
    const refundsRow = this.db.get<{ total: number; cnt: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total, COUNT(*) AS cnt
       FROM refunds WHERE status = 'completed' AND verification_mode = 'provider_verified'`
    );
    const sandboxRefundsRow = this.db.get<{ total: number; cnt: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total, COUNT(*) AS cnt
       FROM refunds WHERE status = 'completed' AND verification_mode = 'sandbox_simulated'`
    );
    const legacyRefundsRow = this.db.get<{ total: number; cnt: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total, COUNT(*) AS cnt
       FROM refunds WHERE status = 'completed' AND verification_mode = 'legacy_unverified'`
    );
    const failedPaymentsRow = this.db.get<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM payment_intents WHERE status = 'failed' AND is_sandbox = 0`
    );
    const sandboxFailedPaymentsRow = this.db.get<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM payment_intents WHERE status = 'failed' AND is_sandbox = 1`
    );
    const paidInvoicesRow = this.db.get<{
      commission_total: number;
      tax_total: number;
      responder_net_total: number;
    }>(
      `SELECT
         COALESCE(SUM(i.platform_commission_toman), 0) AS commission_total,
         COALESCE(SUM(i.tax_toman), 0) AS tax_total,
         COALESCE(SUM(i.responder_net_toman), 0) AS responder_net_total
       FROM invoices i
       WHERE i.status IN ('paid', 'refunded')
         AND EXISTS (
           SELECT 1 FROM payment_intents p
           WHERE p.request_id = i.request_id AND p.is_sandbox = 0
             AND p.status IN ${paidStatuses}
         )`
    );
    const sandboxPaidInvoicesRow = this.db.get<{
      commission_total: number;
      tax_total: number;
      responder_net_total: number;
    }>(
      `SELECT
         COALESCE(SUM(i.platform_commission_toman), 0) AS commission_total,
         COALESCE(SUM(i.tax_toman), 0) AS tax_total,
         COALESCE(SUM(i.responder_net_toman), 0) AS responder_net_total
       FROM invoices i
       WHERE i.status IN ('paid', 'refunded')
         AND EXISTS (
           SELECT 1 FROM payment_intents p
           WHERE p.request_id = i.request_id AND p.is_sandbox = 1
             AND p.status IN ${paidStatuses}
         )`
    );
    const settlementsPaidRow = this.db.get<{ total: number; cnt: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total, COUNT(*) AS cnt
       FROM settlements WHERE status = 'approved_paid' AND execution_mode = 'manual_external'`
    );
    const settlementsPendingRow = this.db.get<{ total: number; cnt: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total, COUNT(*) AS cnt
       FROM settlements WHERE status = 'requested' AND execution_mode = 'manual_external'`
    );
    const sandboxSettlementsPaidRow = this.db.get<{ total: number; cnt: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total, COUNT(*) AS cnt
       FROM settlements WHERE status = 'approved_paid' AND execution_mode = 'sandbox_simulated'`
    );
    const sandboxSettlementsPendingRow = this.db.get<{ total: number; cnt: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total, COUNT(*) AS cnt
       FROM settlements WHERE status = 'requested' AND execution_mode = 'sandbox_simulated'`
    );
    const legacySettlementsPaidRow = this.db.get<{ total: number; cnt: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total, COUNT(*) AS cnt
       FROM settlements WHERE status = 'approved_paid' AND execution_mode = 'legacy_unverified'`
    );
    const legacySettlementsPendingRow = this.db.get<{ total: number; cnt: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total, COUNT(*) AS cnt
       FROM settlements WHERE status = 'requested' AND execution_mode = 'legacy_unverified'`
    );

    const grossVerifiedToman = Number(grossVerifiedRow?.total ?? 0);
    const totalRefundedToman = Number(refundsRow?.total ?? 0);
    const netCollectedToman = grossVerifiedToman - totalRefundedToman;

    const recentTransactions = this.db.all(
      `SELECT p.*, r.tracking_code, u.full_name AS customer_name
       FROM payment_intents p
       JOIN service_requests r ON r.id = p.request_id
       JOIN users u ON u.id = p.customer_user_id
       ORDER BY p.id DESC LIMIT 40`
    );

    const settlements = this.db.all(
      `SELECT st.*, u.full_name AS responder_name, u.phone AS responder_phone
       FROM settlements st
       JOIN responder_profiles rp ON rp.id = st.responder_id
       JOIN users u ON u.id = rp.user_id
       ORDER BY st.id DESC LIMIT 40`
    );

    return {
      currency: 'TOMAN' as const,
      gateway: this.getGatewayStatus(),
      summary: {
        grossVerifiedToman,
        verifiedPaymentsCount: Number(grossVerifiedRow?.cnt ?? 0),
        totalRefundedToman,
        refundsCount: Number(refundsRow?.cnt ?? 0),
        netCollectedToman,
        failedPaymentsCount: Number(failedPaymentsRow?.cnt ?? 0),
        platformCommissionToman: Number(paidInvoicesRow?.commission_total ?? 0),
        collectedTaxToman: Number(paidInvoicesRow?.tax_total ?? 0),
        responderGrossAllocatedToman: Number(paidInvoicesRow?.responder_net_total ?? 0),
        settlementsPaidToman: Number(settlementsPaidRow?.total ?? 0),
        settlementsPaidCount: Number(settlementsPaidRow?.cnt ?? 0),
        settlementsPendingToman: Number(settlementsPendingRow?.total ?? 0),
        settlementsPendingCount: Number(settlementsPendingRow?.cnt ?? 0),
      },
      sandbox: {
        grossPaymentsToman: Number(sandboxPaymentsRow?.total ?? 0),
        verifiedPaymentsCount: Number(sandboxPaymentsRow?.cnt ?? 0),
        refundsToman: Number(sandboxRefundsRow?.total ?? 0),
        refundsCount: Number(sandboxRefundsRow?.cnt ?? 0),
        failedPaymentsCount: Number(sandboxFailedPaymentsRow?.cnt ?? 0),
        platformCommissionToman: Number(sandboxPaidInvoicesRow?.commission_total ?? 0),
        collectedTaxToman: Number(sandboxPaidInvoicesRow?.tax_total ?? 0),
        responderGrossAllocatedToman: Number(sandboxPaidInvoicesRow?.responder_net_total ?? 0),
        settlementsPaidToman: Number(sandboxSettlementsPaidRow?.total ?? 0),
        settlementsPaidCount: Number(sandboxSettlementsPaidRow?.cnt ?? 0),
        settlementsPendingToman: Number(sandboxSettlementsPendingRow?.total ?? 0),
        settlementsPendingCount: Number(sandboxSettlementsPendingRow?.cnt ?? 0),
      },
      excludedUnverified: {
        legacyRefundsToman: Number(legacyRefundsRow?.total ?? 0),
        legacyRefundsCount: Number(legacyRefundsRow?.cnt ?? 0),
        legacySettlementsPaidToman: Number(legacySettlementsPaidRow?.total ?? 0),
        legacySettlementsPaidCount: Number(legacySettlementsPaidRow?.cnt ?? 0),
        legacySettlementsPendingToman: Number(legacySettlementsPendingRow?.total ?? 0),
        legacySettlementsPendingCount: Number(legacySettlementsPendingRow?.cnt ?? 0),
      },
      recentTransactions,
      settlements,
    };
  }
}
