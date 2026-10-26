import type { AppDatabase } from '../../db/connection.ts';
import type { CatalogService } from '../catalog/catalog.service.ts';
import type { NotificationsService } from '../notifications/notifications.service.ts';
import type { AuditService } from '../audit/audit.service.ts';
import { AppError } from '../../middleware/error-handler.ts';
import {
  estimateRoadDistanceKm,
  estimateEtaMinutes,
} from '../../../shared/geo-utils.ts';
import type { EquipmentType, RequestState } from '../../../shared/constants.ts';
import { assertValidStateTransition } from './state-machine.ts';

export interface RankedResponderCandidate {
  responderId: number;
  responderUserId: number;
  fullName: string;
  equipmentType: EquipmentType;
  distanceKm: number;
  estimatedEtaMinutes: number;
  ratingAvg: number;
  completedMissionsCount: number;
  score: number;
}

export class DispatchService {
  private readonly db: AppDatabase;
  private readonly catalog: CatalogService;
  private readonly notifications: NotificationsService;
  private readonly audit: AuditService;

  constructor(params: {
    db: AppDatabase;
    catalog: CatalogService;
    notifications: NotificationsService;
    audit: AuditService;
  }) {
    this.db = params.db;
    this.catalog = params.catalog;
    this.notifications = params.notifications;
    this.audit = params.audit;
  }

  /**
   * ارزیابی چندمعیاره امدادگران واجد شرایط برای یک درخواست:
   * ۱. حساب کاربری فعال و پروفایل تأییدشده توسط مدیر (approved)
   * ۲. وضعیت آمادگی online و داشتن ظرفیت عملیاتی خالی
   * ۳. پوشش محدوده جغرافیایی درخواست (zone_id)
   * ۴. مجوز ارائه خدمت درخواستی + گواهینامه تخصصی (مانند EV در صورت نیاز)
   * ۵. داشتن وسیله و تجهیزات موردنیاز خدمت (مثلاً کفی خودروبر برای حمل خاص)
   * ۶. قرار داشتن در شعاع مجاز اعزام و محاسبه امتیاز ترکیبی (فاصله، کیفیت، سابقه، ETA)
   */
  findEligibleResponders(requestId: number): RankedResponderCandidate[] {
    const reqRow = this.db.get<{
      id: number;
      service_id: number;
      zone_id: number;
      origin_lat: number;
      origin_lng: number;
      zone_type: string;
    }>(
      `SELECT r.id, r.service_id, r.zone_id, r.origin_lat, r.origin_lng, z.zone_type
       FROM service_requests r
       JOIN service_zones z ON z.id = r.zone_id
       WHERE r.id = ?`,
      requestId
    );
    if (!reqRow) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'درخواست یافت نشد.');
    }

    const service = this.catalog.getServiceById(reqRow.service_id);

    const rows = this.db.all<{
      responder_id: number;
      user_id: number;
      full_name: string;
      equipment_type: EquipmentType;
      has_ev_certification: number;
      max_concurrent_missions: number;
      max_dispatch_radius_km: number;
      current_lat: number | null;
      current_lng: number | null;
      rating_avg: number;
      completed_missions_count: number;
      active_missions: number;
    }>(
      `SELECT
         rp.id AS responder_id,
         rp.user_id,
         u.full_name,
         rp.equipment_type,
         rp.has_ev_certification,
         rp.max_concurrent_missions,
         rp.max_dispatch_radius_km,
         rp.current_lat,
         rp.current_lng,
         rp.rating_avg,
         rp.completed_missions_count,
         (
           SELECT COUNT(*)
           FROM service_requests sr
           WHERE sr.assigned_responder_id = rp.id
             AND sr.status IN ('Accepted', 'EnRoute', 'Arrived', 'InProgress')
         ) AS active_missions
       FROM responder_profiles rp
       JOIN users u ON u.id = rp.user_id
       JOIN responder_zones rz ON rz.responder_id = rp.id AND rz.zone_id = ?
       JOIN responder_services rs ON rs.responder_id = rp.id AND rs.service_id = ? AND rs.is_authorized = 1
       WHERE u.is_active = 1
         AND rp.verification_status = 'approved'
         AND rp.availability_status = 'online'`,
      reqRow.zone_id,
      reqRow.service_id
    );

    const origin = { lat: reqRow.origin_lat, lng: reqRow.origin_lng };
    const isHighway = reqRow.zone_type === 'highway';
    const candidates: RankedResponderCandidate[] = [];

    for (const row of rows) {
      // ظرفیت عملیاتی
      if (Number(row.active_missions) >= row.max_concurrent_missions) {
        continue;
      }

      // الزام گواهینامه تخصصی خودروهای برقی
      if (service.requiresEvCertification && row.has_ev_certification !== 1) {
        continue;
      }

      // تطابق وسیله و تجهیزات موردنیاز
      if (
        service.requiredEquipment.length > 0 &&
        !service.requiredEquipment.includes(row.equipment_type)
      ) {
        continue;
      }

      // بررسی فاصله و ETA
      const responderPoint =
        row.current_lat !== null && row.current_lng !== null
          ? { lat: row.current_lat, lng: row.current_lng }
          : origin;

      const roadDistKm = estimateRoadDistanceKm(
        responderPoint,
        origin,
        isHighway ? 1.15 : 1.26
      );
      if (roadDistKm > row.max_dispatch_radius_km) {
        continue;
      }

      const etaMin = estimateEtaMinutes(roadDistKm, { isHighway });

      // امتیازدهی چندمعیاره (حداکثر ۱۰۰ امتیاز):
      // ۶۰ امتیاز نزدیکی و ETA + ۲۵ امتیاز کیفیت (امتیاز مشتریان) + ۱۵ امتیاز تجربه عملیاتی
      const proximityScore = Math.max(0, 60 - roadDistKm * 1.8);
      const qualityScore = (Math.min(5, Math.max(1, row.rating_avg)) / 5) * 25;
      const experienceScore = Math.min(15, row.completed_missions_count * 0.3);
      const totalScore =
        Math.round((proximityScore + qualityScore + experienceScore) * 100) / 100;

      candidates.push({
        responderId: row.responder_id,
        responderUserId: row.user_id,
        fullName: row.full_name,
        equipmentType: row.equipment_type,
        distanceKm: roadDistKm,
        estimatedEtaMinutes: etaMin,
        ratingAvg: row.rating_avg,
        completedMissionsCount: row.completed_missions_count,
        score: totalScore,
      });
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  /**
   * اجرای چرخه جستجو و ارسال پیشنهاد مأموریت به برترین امدادگران واجد شرایط
   */
  async dispatchSubmittedRequest(requestId: number): Promise<{
    status: RequestState;
    offersCreated: number;
    escalatedToOperator: boolean;
  }> {
    const now = new Date();
    const nowIso = now.toISOString();
    const offerExpiryMinRow = this.db.get<{ value_json: string }>(
      `SELECT value_json FROM system_settings WHERE key = 'offer_expiry_minutes'`
    );
    const offerExpiryMin = offerExpiryMinRow
      ? Number(JSON.parse(offerExpiryMinRow.value_json)) || 10
      : 10;
    const expiresIso = new Date(
      now.getTime() + offerExpiryMin * 60 * 1000
    ).toISOString();

    const reqRow = this.db.get<{
      id: number;
      tracking_code: string;
      customer_user_id: number;
      status: RequestState;
      service_title: string;
      zone_name: string;
    }>(
      `SELECT r.id, r.tracking_code, r.customer_user_id, r.status,
              s.title_fa AS service_title, z.name_fa AS zone_name
       FROM service_requests r
       JOIN service_catalog s ON s.id = r.service_id
       JOIN service_zones z ON z.id = r.zone_id
       WHERE r.id = ?`,
      requestId
    );
    if (!reqRow) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'درخواست یافت نشد.');
    }

    // اگر در وضعیت Submitted باشد، ابتدا به Searching منتقل می‌کنیم
    if (reqRow.status === 'Submitted') {
      assertValidStateTransition({
        from: 'Submitted',
        to: 'Searching',
        actorRole: 'system',
      });
      this.db.transaction(() => {
        this.db.run(
          `UPDATE service_requests SET status = 'Searching', updated_at = ? WHERE id = ?`,
          nowIso,
          requestId
        );
        this.db.run(
          `INSERT INTO request_state_history (request_id, from_status, to_status, actor_role, note, created_at)
           VALUES (?, 'Submitted', 'Searching', 'system', 'آغاز جستجوی هوشمند امدادگر واجد شرایط', ?)`,
          requestId,
          nowIso
        );
      });
    }

    const candidates = this.findEligibleResponders(requestId);
    const topCandidates = candidates.slice(0, 3);

    if (topCandidates.length === 0) {
      // عدم وجود امدادگر آزاد: نگهداری صادقانه در وضعیت انتظار (Searching) و ارجاع به صف اپراتور
      this.db.run(
        `UPDATE service_requests
         SET status = 'Searching',
             estimated_eta_minutes = NULL,
             operator_escalation_required = 1,
             operator_escalation_reason = 'در لحظه ثبت، امدادگر آزاد منطبق در محدوده یافت نشد؛ ارجاع به مرکز پیام جهت هماهنگی دستی',
             updated_at = ?
         WHERE id = ?`,
        nowIso,
        requestId
      );

      await this.notifications.notifyUser({
        userId: reqRow.customer_user_id,
        requestId,
        eventType: 'REQUEST_WAITING_QUEUE',
        title: 'درخواست در صف اولویت مرکز پیام قزوین',
        body: `درخواست ${reqRow.tracking_code} ثبت شد. در این لحظه تمام واحدهای هم‌تخصص در محدوده مشغول مأموریت هستند و اپراتور مرکز پیام در حال هماهنگی نزدیک‌ترین واحد است.`,
        sendSms: true,
        dedupBaseKey: `waiting:${requestId}`,
      });

      return {
        status: 'Searching',
        offersCreated: 0,
        escalatedToOperator: true,
      };
    }

    this.db.transaction(() => {
      // منقضی کردن پیشنهادهای باز قدیمی در صورت Dispatch مجدد
      this.db.run(
        `UPDATE mission_offers SET status = 'expired' WHERE request_id = ? AND status = 'pending'`,
        requestId
      );

      for (const c of topCandidates) {
        this.db.run(
          `INSERT INTO mission_offers (
            request_id, responder_id, score, distance_km, estimated_eta_minutes, status, expires_at, created_at
          ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
          requestId,
          c.responderId,
          c.score,
          c.distanceKm,
          c.estimatedEtaMinutes,
          expiresIso,
          nowIso
        );
      }

      this.db.run(
        `UPDATE service_requests
         SET status = 'Offered',
             estimated_eta_minutes = ?,
             operator_escalation_required = 0,
             operator_escalation_reason = NULL,
             updated_at = ?
         WHERE id = ?`,
        topCandidates[0].estimatedEtaMinutes,
        nowIso,
        requestId
      );

      this.db.run(
        `INSERT INTO request_state_history (request_id, from_status, to_status, actor_role, note, created_at)
         VALUES (?, 'Searching', 'Offered', 'system', ?, ?)`,
        requestId,
        `ارسال پیشنهاد مأموریت به ${topCandidates.length} امدادگر واجد شرایط`,
        nowIso
      );
    });

    for (const c of topCandidates) {
      await this.notifications.notifyUser({
        userId: c.responderUserId,
        requestId,
        eventType: 'MISSION_OFFERED',
        title: `پیشنهاد مأموریت جدید (${reqRow.service_title})`,
        body: `مأموریت ${reqRow.tracking_code} در ${reqRow.zone_name} با فاصله تقریبی ${c.distanceKm} کیلومتر برای شما ارسال شد.`,
        sendSms: true,
        dedupBaseKey: `offer:${requestId}:${c.responderId}:${nowIso.slice(0, 16)}`,
      });
    }

    return {
      status: 'Offered',
      offersCreated: topCandidates.length,
      escalatedToOperator: false,
    };
  }

  /**
   * پذیرش مأموریت توسط امدادگر با قفل اتمیک ضد رقابت هم‌زمان (Race-Condition Safe)
   * تضمین می‌کند دو امدادگر هرگز نتوانند هم‌زمان یک مأموریت را بپذیرند.
   */
  async acceptMissionByResponder(params: {
    requestId: number;
    responderUserId: number;
  }) {
    const nowIso = new Date().toISOString();

    const acceptedInfo = this.db.transaction(() => {
      const responder = this.db.get<{
        id: number;
        user_id: number;
        verification_status: string;
        availability_status: string;
        max_concurrent_missions: number;
        is_active: number;
        full_name: string;
      }>(
        `SELECT rp.id, rp.user_id, rp.verification_status, rp.availability_status,
                rp.max_concurrent_missions, u.is_active, u.full_name
         FROM responder_profiles rp
         JOIN users u ON u.id = rp.user_id
         WHERE rp.user_id = ?`,
        params.responderUserId
      );

      if (
        !responder ||
        responder.is_active !== 1 ||
        responder.verification_status !== 'approved'
      ) {
        this.audit.logSecurityEvent({
          eventType: 'UNAPPROVED_RESPONDER_ACCEPT_BLOCKED',
          severity: 'critical',
          userId: params.responderUserId,
          detail: `تلاش امدادگر تأییدنشده برای پذیرش مأموریت #${params.requestId}`,
        });
        throw new AppError(
          403,
          'RESPONDER_NOT_APPROVED',
          'حساب امدادگری شما تأییدشده یا فعال نیست و مجاز به پذیرش مأموریت نمی‌باشید.'
        );
      }

      const activeCountRow = this.db.get<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM service_requests
         WHERE assigned_responder_id = ?
           AND status IN ('Accepted', 'EnRoute', 'Arrived', 'InProgress')`,
        responder.id
      );
      if (Number(activeCountRow?.cnt ?? 0) >= responder.max_concurrent_missions) {
        throw new AppError(
          409,
          'RESPONDER_AT_CAPACITY',
          'شما هم‌اکنون یک مأموریت فعال در دست انجام دارید و ظرفیت پذیرش مأموریت هم‌زمان تکمیل است.'
        );
      }

      const offer = this.db.get<{
        id: number;
        distance_km: number;
        estimated_eta_minutes: number;
        status: string;
        expires_at: string;
      }>(
        `SELECT id, distance_km, estimated_eta_minutes, status, expires_at
         FROM mission_offers
         WHERE request_id = ? AND responder_id = ?
         ORDER BY id DESC LIMIT 1`,
        params.requestId,
        responder.id
      );

      if (!offer || offer.status !== 'pending') {
        throw new AppError(
          409,
          'OFFER_NOT_AVAILABLE',
          'پیشنهاد فعالی برای این مأموریت جهت حساب شما وجود ندارد یا قبلاً تعیین تکلیف شده است.'
        );
      }

      if (offer.expires_at < nowIso) {
        this.db.run(
          `UPDATE mission_offers SET status = 'expired' WHERE id = ?`,
          offer.id
        );
        throw new AppError(
          409,
          'OFFER_EXPIRED',
          'مهلت زمانی پذیرش این پیشنهاد به پایان رسیده است.'
        );
      }

      const currentReq = this.db.get<{
        id: number;
        tracking_code: string;
        customer_user_id: number;
        status: RequestState;
        assigned_responder_id: number | null;
      }>(
        `SELECT id, tracking_code, customer_user_id, status, assigned_responder_id
         FROM service_requests WHERE id = ?`,
        params.requestId
      );

      if (!currentReq) {
        throw new AppError(404, 'REQUEST_NOT_FOUND', 'مأموریت یافت نشد.');
      }

      // قفل اتمیک شرطی روی ردیف مأموریت:
      const updateRes = this.db.run(
        `UPDATE service_requests
         SET status = 'Accepted',
             assigned_responder_id = ?,
             estimated_distance_km = ?,
             estimated_eta_minutes = ?,
             operator_escalation_required = 0,
             operator_escalation_reason = NULL,
             updated_at = ?
         WHERE id = ?
           AND assigned_responder_id IS NULL
           AND status IN ('Searching', 'Offered')`,
        responder.id,
        offer.distance_km,
        offer.estimated_eta_minutes,
        nowIso,
        params.requestId
      );

      if (updateRes.changes !== 1) {
        throw new AppError(
          409,
          'MISSION_ALREADY_ASSIGNED',
          'این مأموریت قبلاً توسط امدادگر دیگری پذیرفته شده است.'
        );
      }

      this.db.run(
        `UPDATE mission_offers SET status = 'accepted', responded_at = ? WHERE id = ?`,
        nowIso,
        offer.id
      );
      this.db.run(
        `UPDATE mission_offers
         SET status = 'superseded', responded_at = ?
         WHERE request_id = ? AND id != ? AND status = 'pending'`,
        nowIso,
        params.requestId,
        offer.id
      );

      if (Number(activeCountRow?.cnt ?? 0) + 1 >= responder.max_concurrent_missions) {
        this.db.run(
          `UPDATE responder_profiles SET availability_status = 'busy', updated_at = ? WHERE id = ?`,
          nowIso,
          responder.id
        );
      }

      this.db.run(
        `INSERT INTO request_state_history (
          request_id, from_status, to_status, actor_user_id, actor_role, note, created_at
        ) VALUES (?, ?, 'Accepted', ?, 'responder', ?, ?)`,
        params.requestId,
        currentReq.status,
        params.responderUserId,
        `پذیرش مأموریت توسط امدادگر ${responder.full_name}`,
        nowIso
      );

      return {
        customerUserId: currentReq.customer_user_id,
        trackingCode: currentReq.tracking_code,
        responderName: responder.full_name,
        etaMinutes: offer.estimated_eta_minutes,
      };
    });

    await this.notifications.notifyUser({
      userId: acceptedInfo.customerUserId,
      requestId: params.requestId,
      eventType: 'MISSION_ACCEPTED',
      title: 'امدادگر مأموریت شما را پذیرفت',
      body: `امدادگر «${acceptedInfo.responderName}» مأموریت ${acceptedInfo.trackingCode} را پذیرفت. زمان تقریبی رسیدن: حدود ${acceptedInfo.etaMinutes} دقیقه.`,
      sendSms: true,
      dedupBaseKey: `accepted:${params.requestId}`,
    });

    return acceptedInfo;
  }

  /**
   * رد پیشنهاد مأموریت توسط امدادگر — در صورت رد همه پیشنهادهای فعال، درخواست به صف اپراتور ارجاع می‌شود.
   */
  rejectOfferByResponder(params: {
    requestId: number;
    responderUserId: number;
    reason?: string;
  }) {
    const nowIso = new Date().toISOString();
    return this.db.transaction(() => {
      const responder = this.db.get<{ id: number }>(
        'SELECT id FROM responder_profiles WHERE user_id = ?',
        params.responderUserId
      );
      if (!responder) {
        throw new AppError(404, 'RESPONDER_NOT_FOUND', 'پروفایل امدادگر یافت نشد.');
      }

      const res = this.db.run(
        `UPDATE mission_offers
         SET status = 'rejected', rejection_reason = ?, responded_at = ?
         WHERE request_id = ? AND responder_id = ? AND status = 'pending'`,
        params.reason?.trim() || 'عدم امکان پذیرش در این لحظه',
        nowIso,
        params.requestId,
        responder.id
      );

      if (res.changes === 0) {
        throw new AppError(409, 'OFFER_NOT_PENDING', 'پیشنهاد فعالی برای رد کردن یافت نشد.');
      }

      const remaining = this.db.get<{ cnt: number }>(
        `SELECT COUNT(*) AS cnt FROM mission_offers
         WHERE request_id = ? AND status = 'pending'`,
        params.requestId
      );

      if (Number(remaining?.cnt ?? 0) === 0) {
        const reqRow = this.db.get<{ status: RequestState }>(
          'SELECT status FROM service_requests WHERE id = ?',
          params.requestId
        );
        if (reqRow && reqRow.status === 'Offered') {
          this.db.run(
            `UPDATE service_requests
             SET status = 'Searching',
                 estimated_eta_minutes = NULL,
                 operator_escalation_required = 1,
                 operator_escalation_reason = 'پیشنهادهای اولیه توسط امدادگران رد شد؛ نیازمند تخصیص اپراتور مرکز پیام',
                 updated_at = ?
             WHERE id = ?`,
            nowIso,
            params.requestId
          );
          this.db.run(
            `INSERT INTO request_state_history (
              request_id, from_status, to_status, actor_user_id, actor_role, note, created_at
            ) VALUES (?, 'Offered', 'Searching', ?, 'responder', 'رد آخرین پیشنهاد فعال و بازگشت به صف انتظار اپراتور', ?)`,
            params.requestId,
            params.responderUserId,
            nowIso
          );
        }
      }

      return { remainingPendingOffers: Number(remaining?.cnt ?? 0) };
    });
  }

  /**
   * تخصیص دستی امدادگر تأییدشده توسط اپراتور یا مدیر کل در شرایط صف انتظار
   */
  async operatorAssignResponder(params: {
    requestId: number;
    responderId: number;
    actorUserId: number;
    actorRole: 'operator' | 'admin';
  }) {
    const nowIso = new Date().toISOString();
    const info = this.db.transaction(() => {
      const responder = this.db.get<{
        id: number;
        user_id: number;
        verification_status: string;
        is_active: number;
        full_name: string;
        current_lat: number | null;
        current_lng: number | null;
      }>(
        `SELECT rp.id, rp.user_id, rp.verification_status, u.is_active, u.full_name, rp.current_lat, rp.current_lng
         FROM responder_profiles rp
         JOIN users u ON u.id = rp.user_id
         WHERE rp.id = ?`,
        params.responderId
      );

      if (
        !responder ||
        responder.is_active !== 1 ||
        responder.verification_status !== 'approved'
      ) {
        throw new AppError(
          422,
          'RESPONDER_NOT_ELIGIBLE',
          'امدادگر انتخابی تأییدشده یا فعال نیست.'
        );
      }

      const reqRow = this.db.get<{
        id: number;
        tracking_code: string;
        customer_user_id: number;
        status: RequestState;
        origin_lat: number;
        origin_lng: number;
      }>('SELECT * FROM service_requests WHERE id = ?', params.requestId);

      if (!reqRow) {
        throw new AppError(404, 'REQUEST_NOT_FOUND', 'درخواست یافت نشد.');
      }

      const distKm =
        responder.current_lat !== null && responder.current_lng !== null
          ? estimateRoadDistanceKm(
              { lat: responder.current_lat, lng: responder.current_lng },
              { lat: reqRow.origin_lat, lng: reqRow.origin_lng }
            )
          : 5;
      const etaMin = estimateEtaMinutes(distKm);

      const upd = this.db.run(
        `UPDATE service_requests
         SET status = 'Accepted',
             assigned_responder_id = ?,
             estimated_distance_km = ?,
             estimated_eta_minutes = ?,
             operator_escalation_required = 0,
             operator_escalation_reason = NULL,
             updated_at = ?
         WHERE id = ?
           AND assigned_responder_id IS NULL
           AND status IN ('Submitted', 'Searching', 'Offered', 'UnderSupportReview')`,
        responder.id,
        distKm,
        etaMin,
        nowIso,
        params.requestId
      );

      if (upd.changes !== 1) {
        throw new AppError(
          409,
          'CANNOT_ASSIGN',
          'این درخواست قبلاً تخصیص یافته یا در وضعیت قابل تخصیص نیست.'
        );
      }

      this.db.run(
        `UPDATE mission_offers SET status = 'superseded', responded_at = ? WHERE request_id = ? AND status = 'pending'`,
        nowIso,
        params.requestId
      );
      this.db.run(
        `UPDATE responder_profiles SET availability_status = 'busy', updated_at = ? WHERE id = ?`,
        nowIso,
        responder.id
      );

      this.db.run(
        `INSERT INTO request_state_history (
          request_id, from_status, to_status, actor_user_id, actor_role, note, created_at
        ) VALUES (?, ?, 'Accepted', ?, ?, ?, ?)`,
        params.requestId,
        reqRow.status,
        params.actorUserId,
        params.actorRole,
        `تخصیص دستی مرکز پیام به امدادگر ${responder.full_name}`,
        nowIso
      );

      this.audit.logAdminAction({
        actorUserId: params.actorUserId,
        actorRole: params.actorRole,
        action: 'MANUAL_DISPATCH_ASSIGNMENT',
        entityType: 'service_request',
        entityId: params.requestId,
        summary: `تخصیص مأموریت ${reqRow.tracking_code} به امدادگر ${responder.full_name}`,
      });

      return {
        customerUserId: reqRow.customer_user_id,
        responderUserId: responder.user_id,
        responderName: responder.full_name,
        trackingCode: reqRow.tracking_code,
        etaMin,
      };
    });

    await this.notifications.notifyUser({
      userId: info.customerUserId,
      requestId: params.requestId,
      eventType: 'MISSION_ASSIGNED_BY_OPERATOR',
      title: 'تخصیص واحد امدادی توسط مرکز پیام',
      body: `مرکز پیام قزوین امدادگر «${info.responderName}» را به درخواست ${info.trackingCode} اختصاص داد. زمان تقریبی رسیدن: ${info.etaMin} دقیقه.`,
      sendSms: true,
      dedupBaseKey: `op_assign_cust:${params.requestId}`,
    });

    await this.notifications.notifyUser({
      userId: info.responderUserId,
      requestId: params.requestId,
      eventType: 'MISSION_ASSIGNED_BY_OPERATOR',
      title: 'ابلاغ مأموریت از مرکز پیام',
      body: `مأموریت ${info.trackingCode} توسط مرکز پیام به شما اختصاص یافت.`,
      sendSms: true,
      dedupBaseKey: `op_assign_resp:${params.requestId}`,
    });

    return info;
  }

  listResponderOffers(responderUserId: number) {
    const responder = this.db.get<{ id: number }>(
      'SELECT id FROM responder_profiles WHERE user_id = ?',
      responderUserId
    );
    if (!responder) return [];

    const nowIso = new Date().toISOString();
    // توجه به حریم خصوصی (بخش ۱۲): در مرحله پیشنهاد، آدرس دقیق و شماره تلفن مشتری افشا نمی‌شود؛ فقط نام محدوده و مختصات تقریبی ارائه می‌شود.
    const rows = this.db.all<{
      offer_id: number;
      request_id: number;
      tracking_code: string;
      score: number;
      distance_km: number;
      estimated_eta_minutes: number;
      expires_at: string;
      service_title: string;
      zone_name: string;
      vehicle_brand: string;
      vehicle_model: string;
      vehicle_category: string;
      estimated_price_toman: number;
      issue_description: string;
      origin_lat: number;
      origin_lng: number;
    }>(
      `SELECT
         mo.id AS offer_id,
         mo.request_id,
         r.tracking_code,
         mo.score,
         mo.distance_km,
         mo.estimated_eta_minutes,
         mo.expires_at,
         s.title_fa AS service_title,
         z.name_fa AS zone_name,
         v.brand AS vehicle_brand,
         v.model AS vehicle_model,
         v.category AS vehicle_category,
         r.estimated_price_toman,
         r.issue_description,
         r.origin_lat,
         r.origin_lng
       FROM mission_offers mo
       JOIN service_requests r ON r.id = mo.request_id
       JOIN service_catalog s ON s.id = r.service_id
       JOIN service_zones z ON z.id = r.zone_id
       JOIN customer_vehicles v ON v.id = r.vehicle_id
       WHERE mo.responder_id = ?
         AND mo.status = 'pending'
         AND mo.expires_at > ?
         AND r.status IN ('Searching', 'Offered')
       ORDER BY mo.id DESC`,
      responder.id,
      nowIso
    );

    return rows.map((r) => ({
      offerId: r.offer_id,
      requestId: r.request_id,
      trackingCode: r.tracking_code,
      serviceTitle: r.service_title,
      zoneName: r.zone_name,
      vehicleSummary: `${r.vehicle_brand} ${r.vehicle_model}`,
      vehicleCategory: r.vehicle_category,
      distanceKm: r.distance_km,
      estimatedEtaMinutes: r.estimated_eta_minutes,
      estimatedPriceToman: r.estimated_price_toman,
      issueDescription: r.issue_description,
      approximateLocation: {
        lat: Math.round(r.origin_lat * 100) / 100,
        lng: Math.round(r.origin_lng * 100) / 100,
      },
      expiresAt: r.expires_at,
    }));
  }
}
