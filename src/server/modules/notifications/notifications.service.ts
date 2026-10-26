import type { AppDatabase } from '../../db/connection.ts';
import type { SmsProvider } from './sms-provider.ts';
import type { RealtimeBus } from '../events/realtime-bus.ts';
import { AppError } from '../../middleware/error-handler.ts';

export class NotificationsService {
  private readonly db: AppDatabase;
  private smsProvider: SmsProvider;
  private readonly realtimeBus?: RealtimeBus;

  constructor(params: {
    db: AppDatabase;
    smsProvider: SmsProvider;
    realtimeBus?: RealtimeBus;
  }) {
    this.db = params.db;
    this.smsProvider = params.smsProvider;
    this.realtimeBus = params.realtimeBus;
  }

  setSmsProviderForTesting(provider: SmsProvider): void {
    this.smsProvider = provider;
  }

  getProviderInfo() {
    return {
      providerName: this.smsProvider.name,
      isSandbox: this.smsProvider.isSandbox,
    };
  }

  /**
   * ارسال ایمن اعلان درون‌برنامه‌ای + پیامک بدون وابسته کردن تراکنش اصلی به خطای شبکه سرویس خارجی
   */
  async notifyUser(params: {
    userId: number;
    requestId?: number | null;
    eventType: string;
    title: string;
    body: string;
    sendSms?: boolean;
    dedupBaseKey?: string;
  }): Promise<void> {
    const now = new Date().toISOString();
    const inAppDedup = params.dedupBaseKey ? `in_app:${params.dedupBaseKey}` : null;

    if (inAppDedup) {
      const exists = this.db.get<{ id: number }>(
        'SELECT id FROM notifications WHERE dedup_key = ?',
        inAppDedup
      );
      if (exists) return;
    }

    this.db.run(
      `INSERT INTO notifications (
        user_id, request_id, channel, event_type, title, body, dedup_key,
        delivery_status, provider_name, is_read, created_at, updated_at
      ) VALUES (?, ?, 'in_app', ?, ?, ?, ?, 'sent', 'internal', 0, ?, ?)`,
      params.userId,
      params.requestId ?? null,
      params.eventType,
      params.title,
      params.body,
      inAppDedup,
      now,
      now
    );

    if (this.realtimeBus) {
      const targetUser = this.db.get<{ role: string }>(
        'SELECT role FROM users WHERE id = ?',
        params.userId
      );
      this.realtimeBus.publish({
        type:
          params.eventType === 'MISSION_OFFER'
            ? 'DISPATCH_OFFERED'
            : ['PAYMENT_VERIFIED', 'PAYMENT_SANDBOX_VERIFIED'].includes(params.eventType)
              ? 'PAYMENT_UPDATED'
              : params.eventType === 'SUPPORT_REPLY'
                ? 'SUPPORT_TICKET_UPDATED'
                : 'REQUEST_UPDATED',
        requestId: params.requestId ?? undefined,
        customerUserId: targetUser?.role === 'customer' ? params.userId : undefined,
        responderUserId: targetUser?.role === 'responder' ? params.userId : undefined,
        status: params.eventType,
      });
    }

    if (!params.sendSms) return;

    const smsDedup = params.dedupBaseKey ? `sms:${params.dedupBaseKey}` : null;
    if (smsDedup) {
      const existsSms = this.db.get<{ id: number }>(
        'SELECT id FROM notifications WHERE dedup_key = ?',
        smsDedup
      );
      if (existsSms) return;
    }

    const user = this.db.get<{ phone: string }>(
      'SELECT phone FROM users WHERE id = ?',
      params.userId
    );
    if (!user) return;

    const smsInsert = this.db.run(
      `INSERT INTO notifications (
        user_id, request_id, channel, event_type, title, body, dedup_key,
        delivery_status, provider_name, retry_count, max_retries, is_read, created_at, updated_at
      ) VALUES (?, ?, 'sms', ?, ?, ?, ?, 'pending', ?, 0, 3, 0, ?, ?)`,
      params.userId,
      params.requestId ?? null,
      params.eventType,
      params.title,
      params.body,
      smsDedup,
      this.smsProvider.name,
      now,
      now
    );

    await this.attemptSmsDelivery(smsInsert.lastInsertRowid, user.phone, params.body);
  }

  private async attemptSmsDelivery(
    notificationId: number,
    toPhone: string,
    message: string
  ): Promise<{
    ok: boolean;
    status: 'provider_accepted' | 'sandbox_logged' | 'failed';
    providerName?: string;
    providerMessageId?: string | null;
    acceptedByProvider: boolean;
    simulationOnly: boolean;
  }> {
    const now = new Date().toISOString();
    try {
      const res = await this.smsProvider.sendSms(toPhone, message);
      if (
        !res.providerName ||
        (res.status === 'provider_accepted' &&
          (!res.providerMessageId || !res.providerMessageId.trim())) ||
        (this.smsProvider.isSandbox && res.status !== 'sandbox_logged') ||
        (!this.smsProvider.isSandbox && res.status !== 'provider_accepted')
      ) {
        throw new Error('پاسخ آداپتور پیامک برای پذیرش provider معتبر نیست.');
      }

      const acceptedByProvider = res.status === 'provider_accepted';
      this.db.run(
        `UPDATE notifications
         SET delivery_status = ?, provider_name = ?, provider_message_id = ?, error_message = NULL, updated_at = ?
         WHERE id = ?`,
        acceptedByProvider ? 'sent' : 'sandbox_logged',
        res.providerName,
        res.providerMessageId,
        now,
        notificationId
      );
      return {
        ok: acceptedByProvider,
        status: res.status,
        providerName: res.providerName,
        providerMessageId: res.providerMessageId,
        acceptedByProvider,
        simulationOnly: !acceptedByProvider,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'خطای ناشناخته درگاه پیامک';
      this.db.run(
        `UPDATE notifications
         SET delivery_status = 'failed', error_message = ?, updated_at = ?
         WHERE id = ?`,
        errMsg.slice(0, 300),
        now,
        notificationId
      );
      return {
        ok: false,
        status: 'failed',
        acceptedByProvider: false,
        simulationOnly: false,
      };
    }
  }

  async retryFailedSms(notificationId: number) {
    const row = this.db.get<{
      id: number;
      user_id: number;
      channel: string;
      body: string;
      delivery_status: string;
      retry_count: number;
      max_retries: number;
    }>('SELECT * FROM notifications WHERE id = ?', notificationId);

    if (!row || row.channel !== 'sms') {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'اعلان پیامکی یافت نشد.');
    }
    if (row.delivery_status !== 'failed') {
      throw new AppError(
        400,
        'NOT_FAILED',
        'فقط اعلان‌های ناموفق قابل تلاش مجدد هستند.'
      );
    }
    if (row.retry_count >= row.max_retries) {
      throw new AppError(
        422,
        'MAX_RETRIES_EXCEEDED',
        'سقف مجاز تلاش مجدد برای این پیامک به پایان رسیده است.'
      );
    }

    const user = this.db.get<{ phone: string }>(
      'SELECT phone FROM users WHERE id = ?',
      row.user_id
    );
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'کاربر گیرنده یافت نشد.');
    }

    this.db.run(
      'UPDATE notifications SET retry_count = retry_count + 1 WHERE id = ?',
      notificationId
    );
    return this.attemptSmsDelivery(notificationId, user.phone, row.body);
  }

  listUserNotifications(userId: number) {
    return this.db.all(
      `SELECT id, request_id, channel, event_type, title, body, delivery_status, is_read, created_at
       FROM notifications
       WHERE user_id = ? AND channel = 'in_app'
       ORDER BY id DESC
       LIMIT 50`,
      userId
    );
  }

  markRead(userId: number, notificationId: number): void {
    this.db.run(
      'UPDATE notifications SET is_read = 1, updated_at = ? WHERE id = ? AND user_id = ?',
      new Date().toISOString(),
      notificationId,
      userId
    );
  }

  listAllForAdmin() {
    return this.db.all(
      `SELECT n.*, u.full_name, u.phone
       FROM notifications n
       JOIN users u ON u.id = n.user_id
       ORDER BY n.id DESC
       LIMIT 100`
    );
  }
}
