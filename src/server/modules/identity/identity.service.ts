import crypto from 'node:crypto';
import type { AppDatabase } from '../../db/connection.ts';
import type { AuditService } from '../audit/audit.service.ts';
import { hashPassword, verifyPassword } from './password.ts';
import { hashSessionToken } from '../../middleware/auth.ts';
import { AppError } from '../../middleware/error-handler.ts';
import type { UserRole } from '../../../shared/constants.ts';

const IRAN_MOBILE_REGEX = /^09\d{9}$/;

export function normalizeIranPhone(raw: string): string {
  const digits = raw
    .trim()
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\s\-()]/g, '');

  if (digits.startsWith('+989') && digits.length === 13) {
    return '0' + digits.slice(3);
  }
  if (digits.startsWith('989') && digits.length === 12) {
    return '0' + digits.slice(2);
  }
  return digits;
}

export class IdentityService {
  private readonly db: AppDatabase;
  private readonly audit: AuditService;
  private readonly sessionTtlHours: number;

  constructor(params: {
    db: AppDatabase;
    audit: AuditService;
    sessionTtlHours: number;
  }) {
    this.db = params.db;
    this.audit = params.audit;
    this.sessionTtlHours = params.sessionTtlHours;
  }

  registerPublicUser(params: {
    phone: string;
    fullName: string;
    password: string;
    role: 'customer' | 'responder';
    nationalCode?: string;
    equipmentType?: 'motorcycle' | 'service_van' | 'wheel_lift_tow' | 'flatbed_tow' | 'ev_specialist_unit';
    vehiclePlate?: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const phone = normalizeIranPhone(params.phone);
    if (!IRAN_MOBILE_REGEX.test(phone)) {
      throw new AppError(
        400,
        'INVALID_PHONE',
        'شماره موبایل باید به فرمت معتبر ۱۱ رقمی ایران (مانند 09123456789) وارد شود.'
      );
    }

    if (params.password.length < 8) {
      throw new AppError(
        400,
        'WEAK_PASSWORD',
        'رمز عبور باید حداقل ۸ کاراکتر باشد.'
      );
    }

    const existing = this.db.get<{ id: number }>(
      'SELECT id FROM users WHERE phone = ?',
      phone
    );
    if (existing) {
      throw new AppError(
        409,
        'PHONE_ALREADY_REGISTERED',
        'این شماره موبایل قبلاً در سامانه ثبت شده است.'
      );
    }

    const now = new Date().toISOString();
    const passHash = hashPassword(params.password);

    const userId = this.db.transaction(() => {
      const res = this.db.run(
        `INSERT INTO users (phone, full_name, national_code, password_hash, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        phone,
        params.fullName.trim(),
        params.nationalCode?.trim() || null,
        passHash,
        params.role,
        now,
        now
      );

      if (params.role === 'responder') {
        this.db.run(
          `INSERT INTO responder_profiles (
            user_id, verification_status, equipment_type, vehicle_plate,
            availability_status, created_at, updated_at
          ) VALUES (?, 'pending_documents', ?, ?, 'offline', ?, ?)`,
          res.lastInsertRowid,
          params.equipmentType ?? 'service_van',
          params.vehiclePlate?.trim() || null,
          now,
          now
        );
      }

      return res.lastInsertRowid;
    });

    const session = this.createSession(userId, params.ipAddress, params.userAgent);
    return {
      user: this.getUserProfile(userId),
      rawSessionToken: session.rawToken,
      expiresAt: session.expiresAt,
    };
  }

  login(params: {
    phone: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const phone = normalizeIranPhone(params.phone);
    const user = this.db.get<{
      id: number;
      phone: string;
      full_name: string;
      password_hash: string;
      role: UserRole;
      is_active: number;
    }>('SELECT * FROM users WHERE phone = ?', phone);

    if (!user || !verifyPassword(params.password, user.password_hash)) {
      this.audit.logSecurityEvent({
        eventType: 'LOGIN_FAILED',
        severity: 'warning',
        userId: user?.id ?? null,
        ipAddress: params.ipAddress,
        path: '/api/auth/login',
        detail: `تلاش ناموفق ورود برای شماره ${phone}`,
      });
      throw new AppError(
        401,
        'INVALID_CREDENTIALS',
        'شماره موبایل یا رمز عبور اشتباه است.'
      );
    }

    if (user.is_active !== 1) {
      this.audit.logSecurityEvent({
        eventType: 'DISABLED_ACCOUNT_LOGIN_ATTEMPT',
        severity: 'warning',
        userId: user.id,
        ipAddress: params.ipAddress,
        detail: 'تلاش برای ورود به حساب غیرفعال‌شده',
      });
      throw new AppError(
        403,
        'ACCOUNT_DISABLED',
        'حساب کاربری شما غیرفعال شده است. با پشتیبانی تماس بگیرید.'
      );
    }

    const session = this.createSession(user.id, params.ipAddress, params.userAgent);
    return {
      user: this.getUserProfile(user.id),
      rawSessionToken: session.rawToken,
      expiresAt: session.expiresAt,
    };
  }

  private createSession(userId: number, ipAddress?: string, userAgent?: string) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashSessionToken(rawToken);
    const now = new Date();
    const expires = new Date(now.getTime() + this.sessionTtlHours * 3600 * 1000);

    this.db.run(
      `INSERT INTO user_sessions (id, user_id, user_agent, ip_address, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      tokenHash,
      userId,
      userAgent?.slice(0, 255) || null,
      ipAddress || null,
      expires.toISOString(),
      now.toISOString()
    );

    return { rawToken, expiresAt: expires };
  }

  logout(sessionId: string): void {
    this.db.run(
      'UPDATE user_sessions SET revoked_at = ? WHERE id = ?',
      new Date().toISOString(),
      sessionId
    );
  }

  getUserProfile(userId: number) {
    const user = this.db.get<{
      id: number;
      phone: string;
      full_name: string;
      national_code: string | null;
      email: string | null;
      role: UserRole;
      is_active: number;
      created_at: string;
    }>(
      `SELECT id, phone, full_name, national_code, email, role, is_active, created_at
       FROM users WHERE id = ?`,
      userId
    );
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'کاربر یافت نشد.');
    }

    let responderProfile = null;
    if (user.role === 'responder') {
      responderProfile =
        this.db.get(
          `SELECT id, verification_status, equipment_type, vehicle_plate,
                  has_ev_certification, availability_status, rating_avg,
                  rating_count, completed_missions_count, rejection_reason
           FROM responder_profiles WHERE user_id = ?`,
          user.id
        ) ?? null;
    }

    return {
      id: user.id,
      phone: user.phone,
      fullName: user.full_name,
      nationalCode: user.national_code,
      email: user.email,
      role: user.role,
      isActive: user.is_active === 1,
      createdAt: user.created_at,
      responderProfile,
    };
  }

  updateProfile(
    userId: number,
    updates: { fullName?: string; nationalCode?: string; email?: string }
  ) {
    const existing = this.getUserProfile(userId);
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE users
       SET full_name = ?, national_code = ?, email = ?, updated_at = ?
       WHERE id = ?`,
      updates.fullName?.trim() || existing.fullName,
      updates.nationalCode !== undefined
        ? updates.nationalCode.trim() || null
        : existing.nationalCode,
      updates.email !== undefined ? updates.email.trim() || null : existing.email,
      now,
      userId
    );
    return this.getUserProfile(userId);
  }

  listActiveSessions(userId: number, currentSessionId: string) {
    const rows = this.db.all<{
      id: string;
      user_agent: string | null;
      ip_address: string | null;
      expires_at: string;
      created_at: string;
    }>(
      `SELECT id, user_agent, ip_address, expires_at, created_at
       FROM user_sessions
       WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
       ORDER BY created_at DESC`,
      userId,
      new Date().toISOString()
    );
    return rows.map((r) => ({
      sessionPrefix: r.id.slice(0, 12),
      isCurrent: r.id === currentSessionId,
      userAgent: r.user_agent,
      ipAddress: r.ip_address,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
    }));
  }
}
