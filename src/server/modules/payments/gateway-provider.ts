import crypto from 'node:crypto';

export interface CreateGatewayOrderInput {
  amountRial: number;
  callbackUrl: string;
  description: string;
  mobile?: string;
}

export interface CreateGatewayOrderOutput {
  authority: string;
  paymentRedirectUrl: string;
  isSandbox: boolean;
}

export interface VerifyGatewayOutput {
  verified: boolean;
  refId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface PaymentGatewayProvider {
  readonly name: string;
  readonly isSandbox: boolean;
  createOrder(input: CreateGatewayOrderInput): Promise<CreateGatewayOrderOutput>;
  verifyOrder(authority: string, expectedAmountRial: number): Promise<VerifyGatewayOutput>;
}

interface SandboxRecord {
  expectedAmountRial: number;
  gatewayDecision: 'unconfirmed' | 'paid_on_gateway' | 'cancelled_on_gateway';
  refId?: string;
}

/**
 * درگاه آزمایشی (Sandbox) با شبیه‌سازی کامل وضعیت سمت سرور بانک.
 * حتی در محیط آزمایشی، ارسال پارامتر Status=OK در مرورگر بدون ثبت پرداخت در سمت سرور درگاه، رد می‌شود!
 */
export class SandboxGatewayProvider implements PaymentGatewayProvider {
  public readonly name = 'sandbox';
  public readonly isSandbox = true;
  private readonly records = new Map<string, SandboxRecord>();

  async createOrder(input: CreateGatewayOrderInput): Promise<CreateGatewayOrderOutput> {
    const authority = `SBX-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
    this.records.set(authority, {
      expectedAmountRial: input.amountRial,
      gatewayDecision: 'unconfirmed',
    });
    return {
      authority,
      paymentRedirectUrl: `/requests/sandbox-gateway?authority=${encodeURIComponent(authority)}`,
      isSandbox: true,
    };
  }

  /**
   * شبیه‌سازی عملیات پرداخت در صفحه شاپرک آزمایشی (پیش از بازگشت Callback)
   */
  simulateBankAction(authority: string, outcome: 'approve' | 'fail'): void {
    const rec = this.records.get(authority);
    if (!rec) {
      throw new Error('شناسه Authority در درگاه آزمایشی یافت نشد.');
    }
    if (outcome === 'approve') {
      rec.gatewayDecision = 'paid_on_gateway';
      rec.refId = `REF-SBX-${Date.now().toString().slice(-8)}`;
    } else {
      rec.gatewayDecision = 'cancelled_on_gateway';
    }
  }

  async verifyOrder(
    authority: string,
    expectedAmountRial: number
  ): Promise<VerifyGatewayOutput> {
    const rec = this.records.get(authority);
    if (!rec) {
      return {
        verified: false,
        errorCode: 'AUTHORITY_NOT_FOUND',
        errorMessage: 'شناسه تراکنش در سرور درگاه یافت نشد.',
      };
    }

    if (rec.expectedAmountRial !== expectedAmountRial) {
      return {
        verified: false,
        errorCode: 'AMOUNT_MISMATCH',
        errorMessage: 'مبلغ تراکنش با مبلغ سفارش مطابقت ندارد.',
      };
    }

    if (rec.gatewayDecision !== 'paid_on_gateway') {
      return {
        verified: false,
        errorCode: 'NOT_PAID_ON_BANK_SERVER',
        errorMessage:
          'تراکنش در سرور بانک تأیید نشده است (صرف پارامتر بازگشت مرورگر معتبر نیست).',
      };
    }

    return {
      verified: true,
      refId: rec.refId,
    };
  }
}

/**
 * درگاه واقعی زرین‌پال (شاپرک) — نیازمند ZARINPAL_MERCHANT_ID در محیط تولید
 */
export class ZarinpalGatewayProvider implements PaymentGatewayProvider {
  public readonly name = 'zarinpal';
  public readonly isSandbox: boolean;
  private readonly merchantId: string;
  private readonly baseApiUrl: string;
  private readonly baseStartPayUrl: string;

  constructor(merchantId: string, useZarinpalSandbox = false) {
    this.merchantId = merchantId;
    this.isSandbox = useZarinpalSandbox;
    const subdomain = useZarinpalSandbox ? 'sandbox' : 'payment';
    this.baseApiUrl = `https://${subdomain}.zarinpal.com/pg/v4/payment`;
    this.baseStartPayUrl = `https://${subdomain}.zarinpal.com/pg/StartPay`;
  }

  async createOrder(input: CreateGatewayOrderInput): Promise<CreateGatewayOrderOutput> {
    if (!this.merchantId || this.merchantId.length < 32) {
      throw new Error('شناسه پذیرنده ZARINPAL_MERCHANT_ID معتبر تنظیم نشده است.');
    }

    const resp = await fetch(`${this.baseApiUrl}/request.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: this.merchantId,
        amount: input.amountRial,
        callback_url: input.callbackUrl,
        description: input.description,
        metadata: input.mobile ? { mobile: input.mobile } : undefined,
      }),
    });

    const json = (await resp.json()) as {
      data?: { code?: number; authority?: string };
      errors?: { code?: number; message?: string };
    };

    if (!resp.ok || json.data?.code !== 100 || !json.data.authority) {
      throw new Error(
        `خطای ایجاد تراکنش درگاه زرین‌پال: ${json.errors?.message ?? resp.status}`
      );
    }

    return {
      authority: json.data.authority,
      paymentRedirectUrl: `${this.baseStartPayUrl}/${json.data.authority}`,
      isSandbox: this.isSandbox,
    };
  }

  async verifyOrder(
    authority: string,
    expectedAmountRial: number
  ): Promise<VerifyGatewayOutput> {
    const resp = await fetch(`${this.baseApiUrl}/verify.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: this.merchantId,
        amount: expectedAmountRial,
        authority,
      }),
    });

    const json = (await resp.json()) as {
      data?: { code?: number; ref_id?: number | string };
      errors?: { code?: number; message?: string };
    };

    if (
      resp.ok &&
      (json.data?.code === 100 || json.data?.code === 101) &&
      json.data?.ref_id
    ) {
      return {
        verified: true,
        refId: String(json.data.ref_id),
      };
    }

    return {
      verified: false,
      errorCode: String(json.errors?.code ?? 'VERIFY_FAILED'),
      errorMessage: json.errors?.message ?? 'تأیید تراکنش توسط شاپرک انجام نشد.',
    };
  }
}
