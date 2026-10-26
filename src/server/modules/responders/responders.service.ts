import type { AppDatabase } from '../../db/connection.ts';
import type { AuditService } from '../audit/audit.service.ts';
import type { RealtimeBus } from '../events/realtime-bus.ts';
import { AppError } from '../../middleware/error-handler.ts';
import {
  EQUIPMENT_TYPE_LABELS,
  VERIFICATION_STATUS_LABELS,
  type EquipmentType,
  type VerificationStatus,
} from '../../../shared/constants.ts';
import { isWithinIranBounds } from '../../../shared/geo-utils.ts';

const SHEBA_REGEX = /^IR\d{24}$/;

export class RespondersService {
  private readonly db: AppDatabase;
  private readonly audit: AuditService;
  private readonly realtimeBus?: RealtimeBus;

  constructor(params: {
    db: AppDatabase;
    audit: AuditService;
    realtimeBus?: RealtimeBus;
  }) {
    this.db = params.db;
    this.audit = params.audit;
    this.realtimeBus = params.realtimeBus;
  }

  getResponderByUserId(userId: number) {
    const profile = this.db.get<{
      id: number;
      user_id: number;
      verification_status: VerificationStatus;
      equipment_type: EquipmentType;
      vehicle_plate: string | null;
      has_ev_certification: number;
      availability_status: 'offline' | 'online' | 'busy';
      max_concurrent_missions: number;
      max_dispatch_radius_km: number;
      current_lat: number | null;
      current_lng: number | null;
      location_updated_at: string | null;
      sheba_number: string | null;
      rating_avg: number;
      rating_count: number;
      completed_missions_count: number;
      rejection_reason: string | null;
      verified_at: string | null;
    }>('SELECT * FROM responder_profiles WHERE user_id = ?', userId);

    if (!profile) {
      throw new AppError(404, 'RESPONDER_NOT_FOUND', 'پروفایل امدادگر یافت نشد.');
    }

    const documents = this.db.all<{
      id: number;
      doc_type: string;
      doc_number: string;
      status: string;
      review_note: string | null;
      created_at: string;
    }>(
      'SELECT id, doc_type, doc_number, status, review_note, created_at FROM responder_documents WHERE responder_id = ? ORDER BY id DESC',
      profile.id
    );

    const services = this.db.all<{
      service_id: number;
      title_fa: string;
      slug: string;
      is_authorized: number;
    }>(
      `SELECT rs.service_id, s.title_fa, s.slug, rs.is_authorized
       FROM responder_services rs
       JOIN service_catalog s ON s.id = rs.service_id
       WHERE rs.responder_id = ?`,
      profile.id
    );

    const zones = this.db.all<{
      zone_id: number;
      code: string;
      name_fa: string;
      status: string;
    }>(
      `SELECT rz.zone_id, z.code, z.name_fa, z.status
       FROM responder_zones rz
       JOIN service_zones z ON z.id = rz.zone_id
       WHERE rz.responder_id = ?`,
      profile.id
    );

    const balanceRow = this.db.get<{ balance_after_toman: number }>(
      `SELECT balance_after_toman FROM wallet_ledger_entries
       WHERE responder_id = ? ORDER BY id DESC LIMIT 1`,
      profile.id
    );

    return {
      id: profile.id,
      userId: profile.user_id,
      verificationStatus: profile.verification_status,
      verificationStatusLabel:
        VERIFICATION_STATUS_LABELS[profile.verification_status],
      equipmentType: profile.equipment_type,
      equipmentTypeLabel: EQUIPMENT_TYPE_LABELS[profile.equipment_type],
      vehiclePlate: profile.vehicle_plate,
      hasEvCertification: profile.has_ev_certification === 1,
      availabilityStatus: profile.availability_status,
      maxConcurrentMissions: profile.max_concurrent_missions,
      maxDispatchRadiusKm: profile.max_dispatch_radius_km,
      currentLocation:
        profile.current_lat !== null && profile.current_lng !== null
          ? {
              lat: profile.current_lat,
              lng: profile.current_lng,
              updatedAt: profile.location_updated_at,
            }
          : null,
      shebaNumber: profile.sheba_number,
      ratingAvg: profile.rating_avg,
      ratingCount: profile.rating_count,
      completedMissionsCount: profile.completed_missions_count,
      rejectionReason: profile.rejection_reason,
      verifiedAt: profile.verified_at,
      walletBalanceToman: balanceRow?.balance_after_toman ?? 0,
      documents,
      services,
      zones,
    };
  }

  updateResponderProfile(
    userId: number,
    updates: {
      equipmentType?: EquipmentType;
      vehiclePlate?: string;
      shebaNumber?: string;
      maxDispatchRadiusKm?: number;
    }
  ) {
    const current = this.getResponderByUserId(userId);
    if (updates.shebaNumber) {
      const normalized = updates.shebaNumber.trim().toUpperCase();
      if (!SHEBA_REGEX.test(normalized)) {
        throw new AppError(
          400,
          'INVALID_SHEBA',
          'شماره شبا باید با IR شروع شده و دقیقاً ۲۶ کاراکتر باشد.'
        );
      }
      updates.shebaNumber = normalized;
    }

    this.db.run(
      `UPDATE responder_profiles
       SET equipment_type = ?, vehicle_plate = ?, sheba_number = ?, max_dispatch_radius_km = ?, updated_at = ?
       WHERE id = ?`,
      updates.equipmentType ?? current.equipmentType,
      updates.vehiclePlate?.trim() ?? current.vehiclePlate,
      updates.shebaNumber ?? current.shebaNumber,
      updates.maxDispatchRadiusKm ?? current.maxDispatchRadiusKm,
      new Date().toISOString(),
      current.id
    );

    return this.getResponderByUserId(userId);
  }

  submitDocument(params: {
    userId: number;
    docType:
      | 'national_card'
      | 'driving_license'
      | 'technical_skill_cert'
      | 'tow_permit'
      | 'background_clearance'
      | 'ev_high_voltage_cert';
    docNumber: string;
  }) {
    const profile = this.getResponderByUserId(params.userId);
    const now = new Date().toISOString();

    this.db.transaction(() => {
      this.db.run(
        `INSERT INTO responder_documents (responder_id, doc_type, doc_number, status, created_at, updated_at)
         VALUES (?, ?, ?, 'pending', ?, ?)`,
        profile.id,
        params.docType,
        params.docNumber.trim(),
        now,
        now
      );

      if (
        profile.verificationStatus === 'pending_documents' ||
        profile.verificationStatus === 'rejected'
      ) {
        this.db.run(
          `UPDATE responder_profiles SET verification_status = 'under_review', updated_at = ? WHERE id = ?`,
          now,
          profile.id
        );
      }
    });

    return this.getResponderByUserId(params.userId);
  }

  setSpecialtiesAndZones(params: {
    userId: number;
    serviceIds: number[];
    zoneIds: number[];
  }) {
    const profile = this.getResponderByUserId(params.userId);

    this.db.transaction(() => {
      this.db.run('DELETE FROM responder_services WHERE responder_id = ?', profile.id);
      for (const sid of params.serviceIds) {
        this.db.run(
          'INSERT OR IGNORE INTO responder_services (responder_id, service_id, is_authorized) VALUES (?, ?, 1)',
          profile.id,
          sid
        );
      }

      this.db.run('DELETE FROM responder_zones WHERE responder_id = ?', profile.id);
      for (const zid of params.zoneIds) {
        this.db.run(
          'INSERT OR IGNORE INTO responder_zones (responder_id, zone_id) VALUES (?, ?)',
          profile.id,
          zid
        );
      }
    });

    return this.getResponderByUserId(params.userId);
  }

  /**
   * اعلام آمادگی امدادگر — فقط در صورت تأیید مدارک، فعال بودن حساب و احراز شرایط توسط مدیر مجاز است!
   */
  setAvailability(params: {
    userId: number;
    status: 'online' | 'offline';
    lat?: number;
    lng?: number;
  }) {
    const profile = this.getResponderByUserId(params.userId);
    const userRow = this.db.get<{ is_active: number }>(
      'SELECT is_active FROM users WHERE id = ?',
      params.userId
    );

    if (params.status === 'online') {
      if (!userRow || userRow.is_active !== 1) {
        throw new AppError(403, 'USER_INACTIVE', 'حساب کاربری شما فعال نیست.');
      }

      if (profile.verificationStatus !== 'approved') {
        this.audit.logSecurityEvent({
          eventType: 'UNAPPROVED_RESPONDER_ONLINE_BLOCKED',
          severity: 'warning',
          userId: params.userId,
          detail: `امدادگر با وضعیت ${profile.verificationStatus} تلاش کرد آنلاین شود`,
        });
        throw new AppError(
          403,
          'RESPONDER_NOT_APPROVED',
          'فعالیت عملیاتی امدادگر منوط به تأیید مدارک، احراز شرایط و فعال‌سازی حساب توسط مدیر مجاز است.'
        );
      }

      const verifiedDocs = profile.documents.filter((d) => d.status === 'verified');
      if (verifiedDocs.length === 0) {
        throw new AppError(
          403,
          'RESPONDER_DOCUMENTS_UNVERIFIED',
          'حداقل یک مدرک هویتی/فنی شما باید توسط مدیریت تأیید شده باشد.'
        );
      }

      if (profile.services.length === 0 || profile.zones.length === 0) {
        throw new AppError(
          400,
          'RESPONDER_INCOMPLETE_SETUP',
          'پیش از اعلام آمادگی، باید حداقل یک نوع خدمت تخصصی و یک محدوده فعالیت انتخاب کنید.'
        );
      }
    }

    const now = new Date().toISOString();
    if (params.lat !== undefined && params.lng !== undefined) {
      if (!isWithinIranBounds({ lat: params.lat, lng: params.lng })) {
        throw new AppError(400, 'INVALID_COORDINATES', 'مختصات مکانی معتبر نیست.');
      }
      this.db.run(
        `UPDATE responder_profiles
         SET availability_status = ?, current_lat = ?, current_lng = ?, location_updated_at = ?, updated_at = ?
         WHERE id = ?`,
        params.status,
        params.lat,
        params.lng,
        now,
        now,
        profile.id
      );
    } else {
      this.db.run(
        `UPDATE responder_profiles SET availability_status = ?, updated_at = ? WHERE id = ?`,
        params.status,
        now,
        profile.id
      );
    }

    return this.getResponderByUserId(params.userId);
  }

  updateLiveLocation(userId: number, lat: number, lng: number) {
    if (!isWithinIranBounds({ lat, lng })) {
      throw new AppError(400, 'INVALID_COORDINATES', 'مختصات مکانی خارج از محدوده مجاز است.');
    }
    const profile = this.getResponderByUserId(userId);
    const now = new Date().toISOString();
    this.db.run(
      `UPDATE responder_profiles
       SET current_lat = ?, current_lng = ?, location_updated_at = ?, updated_at = ?
       WHERE id = ?`,
      lat,
      lng,
      now,
      now,
      profile.id
    );

    if (this.realtimeBus) {
      const activeMission = this.db.get<{
        id: number;
        customer_user_id: number;
        status: string;
      }>(
        `SELECT id, customer_user_id, status
         FROM service_requests
         WHERE assigned_responder_id = ?
           AND status IN ('Accepted', 'EnRoute', 'Arrived', 'InProgress')
         ORDER BY id DESC LIMIT 1`,
        profile.id
      );

      if (activeMission) {
        this.realtimeBus.publish({
          type: 'RESPONDER_LOCATION_UPDATED',
          requestId: activeMission.id,
          customerUserId: activeMission.customer_user_id,
          responderUserId: userId,
          status: activeMission.status,
        });
      }
    }

    return { lat, lng, updatedAt: now };
  }

  /**
   * بررسی و تأیید/رد امدادگر توسط مدیر کل
   */
  adminReviewResponder(params: {
    responderId: number;
    decision: 'approved' | 'rejected' | 'suspended';
    hasEvCertification?: boolean;
    note: string;
    adminUserId: number;
    ipAddress?: string;
  }) {
    const profile = this.db.get<{ id: number; user_id: number }>(
      'SELECT id, user_id FROM responder_profiles WHERE id = ?',
      params.responderId
    );
    if (!profile) {
      throw new AppError(404, 'RESPONDER_NOT_FOUND', 'امدادگر یافت نشد.');
    }

    const now = new Date().toISOString();
    this.db.transaction(() => {
      if (params.decision === 'approved') {
        this.db.run(
          `UPDATE responder_documents
           SET status = 'verified', reviewed_by_admin_id = ?, review_note = ?, updated_at = ?
           WHERE responder_id = ? AND status = 'pending'`,
          params.adminUserId,
          params.note.trim(),
          now,
          profile.id
        );
        this.db.run(
          `UPDATE responder_profiles
           SET verification_status = 'approved',
               has_ev_certification = COALESCE(?, has_ev_certification),
               verified_by_admin_id = ?,
               verified_at = ?,
               rejection_reason = NULL,
               updated_at = ?
           WHERE id = ?`,
          params.hasEvCertification !== undefined
            ? params.hasEvCertification
              ? 1
              : 0
            : null,
          params.adminUserId,
          now,
          now,
          profile.id
        );
      } else {
        this.db.run(
          `UPDATE responder_profiles
           SET verification_status = ?,
               availability_status = 'offline',
               rejection_reason = ?,
               updated_at = ?
           WHERE id = ?`,
          params.decision,
          params.note.trim(),
          now,
          profile.id
        );
      }

      this.audit.logAdminAction({
        actorUserId: params.adminUserId,
        actorRole: 'admin',
        action: `RESPONDER_${params.decision.toUpperCase()}`,
        entityType: 'responder_profile',
        entityId: profile.id,
        summary: `تغییر وضعیت احراز صلاحیت امدادگر #${profile.id} به ${params.decision}`,
        metadata: { note: params.note, hasEvCertification: params.hasEvCertification },
        ipAddress: params.ipAddress,
      });
    });

    return this.getResponderByUserId(profile.user_id);
  }
}
