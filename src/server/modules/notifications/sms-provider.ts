export interface SmsSendResult {
  status: 'sent' | 'sandbox_logged';
  providerName: string;
  providerMessageId: string;
}

export interface SmsProvider {
  readonly name: string;
  readonly isSandbox: boolean;
  sendSms(toPhone: string, message: string): Promise<SmsSendResult>;
}

/**
 * آداپتور آزمایشی شفاف — پیامک واقعی مخابراتی ارسال نمی‌کند و وضعیت را صریحاً sandbox_logged ثبت می‌نماید.
 */
export class SandboxOutboxSmsProvider implements SmsProvider {
  public readonly name = 'sandbox_outbox';
  public readonly isSandbox = true;

  async sendSms(_toPhone: string, _message: string): Promise<SmsSendResult> {
    return {
      status: 'sandbox_logged',
      providerName: this.name,
      providerMessageId: `sbx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
  }
}

/**
 * آداپتور واقعی کاوه‌نگار (نیازمند KAVENEGAR_API_KEY معتبر در محیط تولید)
 */
export class KavenegarSmsProvider implements SmsProvider {
  public readonly name = 'kavenegar';
  public readonly isSandbox = false;
  private readonly apiKey: string;
  private readonly sender: string;

  constructor(apiKey: string, sender: string) {
    this.apiKey = apiKey;
    this.sender = sender;
  }

  async sendSms(toPhone: string, message: string): Promise<SmsSendResult> {
    if (!this.apiKey) {
      throw new Error('متغیر KAVENEGAR_API_KEY تنظیم نشده است.');
    }

    const url = `https://api.kavenegar.com/v1/${encodeURIComponent(this.apiKey)}/sms/send.json`;
    const body = new URLSearchParams({
      receptor: toPhone,
      message,
      ...(this.sender ? { sender: this.sender } : {}),
    });

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!resp.ok) {
      throw new Error(`خطای سرویس پیامک کاوه‌نگار: HTTP ${resp.status}`);
    }

    const json = (await resp.json()) as {
      entries?: Array<{ messageid?: string | number }>;
    };
    const msgId = String(json.entries?.[0]?.messageid ?? `kv_${Date.now()}`);

    return {
      status: 'sent',
      providerName: this.name,
      providerMessageId: msgId,
    };
  }
}
