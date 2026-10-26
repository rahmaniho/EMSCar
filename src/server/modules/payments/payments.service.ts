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

  constructor(params: {
    db: AppDatabase;
    gateway: PaymentGatewayProvider;
    notifications: NotificationsService;
    audit: AuditService;
  }) {
    this.db = params.db;
    this.gateway = params.gateway;
    this.notifications = params.notifications;
    this.audit = params.audit;
  }

  getGatewayStatus() {
    return {
      providerName: this.gateway.name,
      isSandbox: this.gateway.isSandbox,
      noticeFa: this.gateway.isSandbox
        ? 'محیط آزمایشی (Sandbox) فعال است — هیچ وجه واقعی بانکی جابه‌جا نمی‌شود.'
        : 'متصل به درگاه پرداخت شاپرک',
    };
  }

  private getCurrentWalletBalance(responderId: number): number {
    const row = this.db.get<{ balance_after_toman: number }>(
      `SELECT balance_after_toman FROM wallet_ledger_entries
       WHERE responder_id = ? ORDER BY id DESC LIMIT 1`,
      responderId
    );
    return row?.balance_after_toman ?? 0;
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
        isSandbox: this.gateway.isSandbox,
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
        isSandbox: this.gateway.isSandbox,
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
      await this.notifications.notifyUser({
        userId: intent.customer_user_id,
        requestId: intent.request_id,
        eventType: 'PAYMENT_VERIFIED',
        title: 'پرداخت صورتحساب تأیید شد',
        body: `پرداخت مبلغ ${intent.amount_toman.toLocaleString('fa-IR')} تومان با کد رهگیری ${verification.refId} تأیید شد.`,
        sendSms: true,
        dedupBaseKey: `paid:${intent.id}`,
      });
    }

    return {
      paid: true,
      alreadyProcessed: txOutcome.alreadyProcessedRace,
      requestId: intent.request_id,
      refId: verification.refId,
      amountToman: intent.amount_toman,
      isSandbox: this.gateway.isSandbox,
    };
  }

  /**
   * بازپرداخت کامل یا جزئی (Refund) با برگشت حسابداری متناظر و ثبت ممیزی مدیریت
   */
  async processRefund(params: {
    requestId: number;
    amountToman: number;
    reason: string;
    adminUserId: number;
    ipAddress?: string;
  }) {
    const intent = this.db.get<{
      id: number;
      request_id: number;
      customer_user_id: number;
      amount_toman: number;
      status: string;
    }>(
      `SELECT * FROM payment_intents
       WHERE request_id = ? AND status IN ('verified', 'partially_refunded')
       ORDER BY id DESC LIMIT 1`,
      params.requestId
    );

    if (!intent) {
      throw new AppError(
        404,
        'PAID_TRANSACTION_NOT_FOUND',
        'تراکنش پرداخت‌شده معتبری برای این مأموریت یافت نشد.'
      );
    }

    const refundedSoFarRow = this.db.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total
       FROM refunds WHERE payment_intent_id = ? AND status = 'completed'`,
      intent.id
    );
    const refundedSoFar = Number(refundedSoFarRow?.total ?? 0);
    const maxRefundable = intent.amount_toman - refundedSoFar;

    const refundToman = Math.round(params.amountToman);
    if (refundToman <= 0 || refundToman > maxRefundable) {
      throw new AppError(
        422,
        'INVALID_REFUND_AMOUNT',
        `مبلغ بازپرداخت باید بین ۱ تا حداکثر ${maxRefundable.toLocaleString('fa-IR')} تومان باشد.`
      );
    }

    const isFullRefund = refundedSoFar + refundToman === intent.amount_toman;
    const nowIso = new Date().toISOString();

    const refundId = this.db.transaction(() => {
      const res = this.db.run(
        `INSERT INTO refunds (
          payment_intent_id, request_id, amount_toman, reason, approved_by_admin_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, 'completed', ?)`,
        intent.id,
        intent.request_id,
        refundToman,
        params.reason.trim(),
        params.adminUserId,
        nowIso
      );

      this.db.run(
        `UPDATE payment_intents SET status = ?, updated_at = ? WHERE id = ?`,
        isFullRefund ? 'refunded' : 'partially_refunded',
        nowIso,
        intent.id
      );

      this.db.run(
        `UPDATE service_requests SET payment_status = ?, updated_at = ? WHERE id = ?`,
        isFullRefund ? 'refunded' : 'partially_refunded',
        nowIso,
        intent.request_id
      );

      const invoice = this.db.get<{
        id: number;
        total_toman: number;
        responder_id: number | null;
        responder_net_toman: number;
      }>('SELECT * FROM invoices WHERE request_id = ?', intent.request_id);

      if (invoice) {
        if (isFullRefund) {
          this.db.run(`UPDATE invoices SET status = 'refunded' WHERE id = ?`, invoice.id);
        }

        // کسر متناسب از دفتر کل امدادگر در صورت ثبت قبلی درآمد
        if (invoice.responder_id && invoice.total_toman > 0) {
          const reversalRatio = refundToman / invoice.total_toman;
          const responderDeduction = Math.round(
            invoice.responder_net_toman * reversalRatio
          );
          if (responderDeduction > 0) {
            this.appendLedgerEntry({
              responderId: invoice.responder_id,
              requestId: intent.request_id,
              refundId: res.lastInsertRowid,
              entryType: 'refund_reversal',
              amountToman: -responderDeduction,
              description: `اصلاح حساب بابت بازپرداخت به مشتری (${params.reason.trim()})`,
            });
          }
        }
      }

      this.audit.logAdminAction({
        actorUserId: params.adminUserId,
        actorRole: 'admin',
        action: 'PAYMENT_REFUNDED',
        entityType: 'refund',
        entityId: res.lastInsertRowid,
        summary: `بازپرداخت ${refundToman.toLocaleString('fa-IR')} تومان برای مأموریت #${intent.request_id}`,
        metadata: { reason: params.reason, isFullRefund },
        ipAddress: params.ipAddress,
      });

      return res.lastInsertRowid;
    });

    await this.notifications.notifyUser({
      userId: intent.customer_user_id,
      requestId: intent.request_id,
      eventType: 'PAYMENT_REFUNDED',
      title: 'بازپرداخت وجه ثبت شد',
      body: `مبلغ ${refundToman.toLocaleString('fa-IR')} تومان بابت مأموریت #${intent.request_id} بازپرداخت شد.`,
      sendSms: true,
      dedupBaseKey: `refund:${refundId}`,
    });

    return { refundId, refundToman, isFullRefund };
  }

  /**
   * ثبت وضعیت بدهی مجاز (Approved Post-Pay Debt) در شرایط خاص جاده‌ای با مجوز اپراتور/مدیر
   */
  approveEmergencyDebt(params: {
    requestId: number;
    actorUserId: number;
    actorRole: 'operator' | 'admin';
    reason: string;
  }) {
    const setting = this.db.get<{ value_json: string }>(
      `SELECT value_json FROM system_settings WHERE key = 'allow_postpay_debt'`
    );
    const allowed = setting ? Boolean(JSON.parse(setting.value_json)) : false;
    if (!allowed) {
      throw new AppError(
        403,
        'POSTPAY_DEBT_DISABLED',
        'امکان ثبت بدهی مجاز در تنظیمات سامانه غیرفعال است.'
      );
    }

    const nowIso = new Date().toISOString();
    this.db.transaction(() => {
      this.db.run(
        `UPDATE service_requests SET payment_status = 'approved_debt', updated_at = ? WHERE id = ?`,
        nowIso,
        params.requestId
      );
      this.db.run(
        `UPDATE invoices SET status = 'approved_debt' WHERE request_id = ?`,
        params.requestId
      );
      this.audit.logAdminAction({
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        action: 'APPROVED_EMERGENCY_DEBT',
        entityType: 'service_request',
        entityId: params.requestId,
        summary: `ثبت بدهی مجاز برای مأموریت #${params.requestId}`,
        metadata: { reason: params.reason },
      });
    });

    return { ok: true };
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
          `موجودی قابل برداشت شما (${balance.toLocaleString('fa-IR')} تومان) کمتر از مبلغ درخواستی است.`
        );
      }

      const nowIso = new Date().toISOString();
      const setRes = this.db.run(
        `INSERT INTO settlements (responder_id, amount_toman, sheba_number, status, created_at)
         VALUES (?, ?, ?, 'requested', ?)`,
        responder.id,
        reqAmount,
        sheba,
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
      };
    });
  }

  processSettlementByAdmin(params: {
    settlementId: number;
    decision: 'approved_paid' | 'rejected';
    bankReferenceCode?: string;
    note?: string;
    adminUserId: number;
  }) {
    return this.db.transaction(() => {
      const settlement = this.db.get<{
        id: number;
        responder_id: number;
        amount_toman: number;
        status: string;
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

      if (
        params.decision === 'approved_paid' &&
        (!params.bankReferenceCode || params.bankReferenceCode.trim().length < 4)
      ) {
        throw new AppError(
          400,
          'BANK_REF_REQUIRED',
          'ثبت شناسه مرجع پایا/ساتنا برای تأیید واریز تسویه‌حساب الزامی است.'
        );
      }

      const nowIso = new Date().toISOString();
      this.db.run(
        `UPDATE settlements
         SET status = ?, bank_reference_code = ?, processed_by_admin_id = ?, note = ?, processed_at = ?
         WHERE id = ?`,
        params.decision,
        params.bankReferenceCode?.trim() || null,
        params.adminUserId,
        params.note?.trim() || null,
        nowIso,
        settlement.id
      );

      if (params.decision === 'rejected') {
        this.appendLedgerEntry({
          responderId: settlement.responder_id,
          settlementId: settlement.id,
          entryType: 'manual_adjustment',
          amountToman: settlement.amount_toman,
          description: `برگشت وجه به کیف پول بابت رد تسویه #${settlement.id}`,
        });
      }

      this.audit.logAdminAction({
        actorUserId: params.adminUserId,
        actorRole: 'admin',
        action: `SETTLEMENT_${params.decision.toUpperCase()}`,
        entityType: 'settlement',
        entityId: settlement.id,
        summary: `تعیین وضعیت تسویه‌حساب #${settlement.id} (${settlement.amount_toman} تومان): ${params.decision}`,
      });

      return { settlementId: settlement.id, status: params.decision };
    });
  }

  listCustomerInvoicesAndPayments(customerUserId: number) {
    const invoices = this.db.all(
      `SELECT i.*, r.tracking_code, s.title_fa AS service_title
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
   * گزارش جامع مالی و تطبیق تراکنش‌ها (Reconciliation) برای مدیر کل
   */
  getFinancialReconciliationReport() {
    const grossVerifiedRow = this.db.get<{ total: number; cnt: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total, COUNT(*) AS cnt
       FROM payment_intents WHERE status IN ('verified', 'refunded', 'partially_refunded')`
    );
    const refundsRow = this.db.get<{ total: number; cnt: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total, COUNT(*) AS cnt
       FROM refunds WHERE status = 'completed'`
    );
    const failedPaymentsRow = this.db.get<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM payment_intents WHERE status = 'failed'`
    );
    const paidInvoicesRow = this.db.get<{
      commission_total: number;
      tax_total: number;
      responder_net_total: number;
    }>(
      `SELECT
         COALESCE(SUM(platform_commission_toman), 0) AS commission_total,
         COALESCE(SUM(tax_toman), 0) AS tax_total,
         COALESCE(SUM(responder_net_toman), 0) AS responder_net_total
       FROM invoices WHERE status IN ('paid', 'refunded')`
    );
    const settlementsPaidRow = this.db.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total
       FROM settlements WHERE status = 'approved_paid'`
    );
    const settlementsPendingRow = this.db.get<{ total: number }>(
      `SELECT COALESCE(SUM(amount_toman), 0) AS total
       FROM settlements WHERE status = 'requested'`
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
        responderGrossAllocatedToman: Number(
          paidInvoicesRow?.responder_net_total ?? 0
        ),
        settlementsPaidToman: Number(settlementsPaidRow?.total ?? 0),
        settlementsPendingToman: Number(settlementsPendingRow?.total ?? 0),
      },
      recentTransactions,
      settlements,
    };
  }
}
