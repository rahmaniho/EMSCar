import type { AppDatabase } from '../../db/connection.ts';
import type { AuditService } from '../audit/audit.service.ts';
import type { RespondersService } from '../responders/responders.service.ts';
import type { PaymentsService } from '../payments/payments.service.ts';
import type { GeographyService } from '../geography/geography.service.ts';
import { hashPassword } from '../identity/password.ts';
import { normalizeIranPhone } from '../identity/identity.service.ts';
import { AppError } from '../../middleware/error-handler.ts';
import type { UserRole } from '../../../shared/constants.ts';

export class AdminService {
  private readonly db: AppDatabase;
  private readonly audit: AuditService;
  private readonly responders: RespondersService;
  private readonly payments: PaymentsService;
  private readonly geography: GeographyService;

  constructor(params: {
    db: AppDatabase;
    audit: AuditService;
    responders: RespondersService;
    payments: PaymentsService;
    geography: GeographyService;
  }) {
    this.db = params.db;
    this.audit = params.audit;
    this.responders = params.responders;
    this.payments = params.payments;
    this.geography = params.geography;
  }

  listUsers() {
    return this.db.all(
      `SELECT id, phone, full_name, national_code, email, role, is_active, created_at
       FROM users ORDER BY id DESC LIMIT 200`
    );
  }

  createStaffUser(params: {
    phone: string;
    fullName: string;
    password: string;
    role: 'operator' | 'admin';
    adminUserId: number;
  }) {
    const phone = normalizeIranPhone(params.phone);
    if (!/^09\d{9}$/.test(phone)) {
      throw new AppError(400, 'INVALID_PHONE', 'شماره موبایل معتبر نیست.');
    }
    const existing = this.db.get<{ id: number }>(
      'SELECT id FROM users WHERE phone = ?',
      phone
    );
    if (existing) {
      throw new AppError(409, 'PHONE_EXISTS', 'این شماره قبلاً ثبت شده است.');
    }

    const nowIso = new Date().toISOString();
    const res = this.db.run(
      `INSERT INTO users (phone, full_name, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      phone,
      params.fullName.trim(),
      hashPassword(params.password),
      params.role,
      nowIso,
      nowIso
    );

    this.audit.logAdminAction({
      actorUserId: params.adminUserId,
      actorRole: 'admin',
      action: 'STAFF_USER_CREATED',
      entityType: 'user',
      entityId: res.lastInsertRowid,
      summary: `ایجاد حساب ${params.role} برای ${params.fullName} (${phone})`,
    });

    return { id: res.lastInsertRowid, phone, role: params.role };
  }

  updateUserRoleOrStatus(params: {
    targetUserId: number;
    isActive?: boolean;
    role?: UserRole;
    adminUserId: number;
  }) {
    if (params.targetUserId === params.adminUserId && params.isActive === false) {
      throw new AppError(
        400,
        'CANNOT_DISABLE_SELF',
        'مدیر کل نمی‌تواند حساب فعال خود را غیرفعال کند.'
      );
    }

    const user = this.db.get<{ id: number; role: UserRole; is_active: number }>(
      'SELECT id, role, is_active FROM users WHERE id = ?',
      params.targetUserId
    );
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'کاربر یافت نشد.');
    }

    const nextActive =
      params.isActive !== undefined ? (params.isActive ? 1 : 0) : user.is_active;
    const nextRole = params.role ?? user.role;
    const nowIso = new Date().toISOString();

    this.db.transaction(() => {
      this.db.run(
        'UPDATE users SET is_active = ?, role = ?, updated_at = ? WHERE id = ?',
        nextActive,
        nextRole,
        nowIso,
        user.id
      );

      if (nextActive === 0) {
        this.db.run(
          'UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
          nowIso,
          user.id
        );
        this.db.run(
          `UPDATE responder_profiles SET availability_status = 'offline', updated_at = ? WHERE user_id = ?`,
          nowIso,
          user.id
        );
      }

      this.audit.logAdminAction({
        actorUserId: params.adminUserId,
        actorRole: 'admin',
        action: 'USER_ACCESS_UPDATED',
        entityType: 'user',
        entityId: user.id,
        summary: `تغییر دسترسی کاربر #${user.id} (فعال: ${nextActive === 1}, نقش: ${nextRole})`,
      });
    });

    return { id: user.id, isActive: nextActive === 1, role: nextRole };
  }

  listRespondersForReview() {
    const rows = this.db.all<{
      id: number;
      user_id: number;
      full_name: string;
      phone: string;
      verification_status: string;
      equipment_type: string;
      vehicle_plate: string | null;
      has_ev_certification: number;
      availability_status: string;
      rating_avg: number;
      completed_missions_count: number;
      created_at: string;
    }>(
      `SELECT rp.*, u.full_name, u.phone
       FROM responder_profiles rp
       JOIN users u ON u.id = rp.user_id
       ORDER BY
         CASE rp.verification_status WHEN 'under_review' THEN 0 WHEN 'pending_documents' THEN 1 ELSE 2 END,
         rp.id DESC`
    );

    return rows.map((r) => ({
      ...r,
      documents: this.db.all(
        'SELECT * FROM responder_documents WHERE responder_id = ? ORDER BY id DESC',
        r.id
      ),
    }));
  }

  listSettings() {
    const rows = this.db.all<{
      key: string;
      value_json: string;
      description_fa: string;
      updated_at: string;
    }>('SELECT * FROM system_settings ORDER BY key ASC');

    return rows.map((r) => ({
      key: r.key,
      value: JSON.parse(r.value_json),
      descriptionFa: r.description_fa,
      updatedAt: r.updated_at,
    }));
  }

  updateSetting(key: string, value: unknown, adminUserId: number) {
    const existing = this.db.get<{ key: string }>(
      'SELECT key FROM system_settings WHERE key = ?',
      key
    );
    if (!existing) {
      throw new AppError(404, 'SETTING_NOT_FOUND', 'کلید تنظیمات یافت نشد.');
    }

    this.db.run(
      'UPDATE system_settings SET value_json = ?, updated_by_user_id = ?, updated_at = ? WHERE key = ?',
      JSON.stringify(value),
      adminUserId,
      new Date().toISOString(),
      key
    );

    this.audit.logAdminAction({
      actorUserId: adminUserId,
      actorRole: 'admin',
      action: 'SYSTEM_SETTING_UPDATED',
      entityType: 'system_setting',
      entityId: key,
      summary: `ویرایش تنظیمات سیستمی ${key}`,
      metadata: { value },
    });

    return { key, value };
  }

  getExecutiveDashboard() {
    const requestCounts = this.db.all<{ status: string; cnt: number }>(
      'SELECT status, COUNT(*) AS cnt FROM service_requests GROUP BY status'
    );
    const totalRequests = requestCounts.reduce((acc, r) => acc + Number(r.cnt), 0);
    const completedCount = Number(
      requestCounts.find((r) => r.status === 'Completed')?.cnt ?? 0
    );
    const activeCount = requestCounts
      .filter((r) =>
        [
          'Submitted',
          'Searching',
          'Offered',
          'Accepted',
          'EnRoute',
          'Arrived',
          'InProgress',
          'UnderSupportReview',
        ].includes(r.status)
      )
      .reduce((acc, r) => acc + Number(r.cnt), 0);

    const pendingResponders = this.db.get<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM responder_profiles WHERE verification_status IN ('pending_documents', 'under_review')`
    );
    const onlineResponders = this.db.get<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM responder_profiles WHERE verification_status = 'approved' AND availability_status = 'online'`
    );
    const openTickets = this.db.get<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM support_tickets WHERE status IN ('open', 'in_progress', 'escalated_to_admin')`
    );

    return {
      operational: {
        totalRequests,
        activeMissionsCount: activeCount,
        completedMissionsCount: completedCount,
        byStatus: requestCounts,
        onlineApprovedRespondersCount: Number(onlineResponders?.cnt ?? 0),
        pendingResponderReviewsCount: Number(pendingResponders?.cnt ?? 0),
        openSupportTicketsCount: Number(openTickets?.cnt ?? 0),
      },
      financial: this.payments.getFinancialReconciliationReport().summary,
      geographyReadiness: this.geography.getOperationalReadinessReport(),
    };
  }

  getAuditAndSecurityLogs() {
    return {
      adminAuditLogs: this.db.all(
        `SELECT a.*, u.full_name AS actor_name, u.phone AS actor_phone
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_user_id
         ORDER BY a.id DESC LIMIT 100`
      ),
      securityEvents: this.db.all(
        `SELECT s.*, u.phone AS user_phone
         FROM security_events s
         LEFT JOIN users u ON u.id = s.user_id
         ORDER BY s.id DESC LIMIT 100`
      ),
    };
  }
}
