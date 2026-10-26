export interface SmsSendResult {
  /** provider_accepted means the API accepted the request; it does not prove handset delivery. */
  status: 'provider_accepted' | 'sandbox_logged';
  providerName: string;
  /** Sandbox records are local only and therefore have no provider message ID. */
  providerMessageId: string | null;
}

export interface SmsProvider {
  readonly name: string;
  readonly isSandbox: boolean;
  sendSms(toPhone: string, message: string): Promise<SmsSendResult>;
}

/**
 * آداپتور آزمایشی شفاف — پیامک واقعی مخابراتی ارسال نمی‌کند و هیچ شناسهٔ ساختگی provider نمی‌سازد.
 */
export class SandboxOutboxSmsProvider implements SmsProvider {
  public readonly name = 'sandbox_outbox';
  public readonly isSandbox = true;

  async sendSms(_toPhone: string, _message: string): Promise<SmsSendResult> {
    return {
      status: 'sandbox_logged',
      providerName: this.name,
      providerMessageId: null,
    };
  }
}

interface KavenegarSendResponse {
  return?: {
    status?: number | string;
    message?: string;
  };
  entries?: Array<{
    messageid?: string | number;
    status?: number | string;
    statustext?: string;
  }>;
}

/**
 * آداپتور کاوه‌نگار؛ «پذیرفته‌شده توسط API» را از «تحویل‌شده به گوشی» جدا نگه می‌دارد.
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

    let json: KavenegarSendResponse;
    try {
      json = (await resp.json()) as KavenegarSendResponse;
    } catch {
      throw new Error('پاسخ سرویس پیامک کاوه‌نگار JSON معتبر نیست.');
    }

    const entry = json.entries?.[0];
    const messageId = entry?.messageid;
    const normalizedMessageId =
      typeof messageId === 'number' && Number.isSafeInteger(messageId) && messageId > 0
        ? String(messageId)
        : typeof messageId === 'string' && /^\d+$/.test(messageId) && Number(messageId) > 0
          ? messageId
          : null;
    const entryStatus = Number(entry?.status);

    // return.status=200 means the Kavenegar API accepted the request. Entry statuses
    // 10/11 are cancelled/failed in Kavenegar's status model and must fail closed.
    if (
      Number(json.return?.status) !== 200 ||
      !normalizedMessageId ||
      (Number.isFinite(entryStatus) && entryStatus >= 10)
    ) {
      const providerMessage = json.return?.message || entry?.statustext;
      throw new Error(
        providerMessage
          ? `کاوه‌نگار پذیرش پیامک را تأیید نکرد: ${providerMessage}`
          : 'پاسخ کاوه‌نگار فاقد پذیرش معتبر یا شناسهٔ واقعی پیامک است.'
      );
    }

    return {
      status: 'provider_accepted',
      providerName: this.name,
      providerMessageId: normalizedMessageId,
    };
  }
}
