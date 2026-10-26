import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AppDatabase } from '../../db/connection.ts';
import type { CustomersService } from '../customers/customers.service.ts';
import type { CatalogService } from '../catalog/catalog.service.ts';
import type { PricingService } from '../pricing/pricing.service.ts';
import type { DispatchService } from './dispatch.service.ts';
import type { NotificationsService } from '../notifications/notifications.service.ts';
import type { AuditService } from '../audit/audit.service.ts';
import type { AuthenticatedUser } from '../../middleware/auth.ts';
import { AppError } from '../../middleware/error-handler.ts';
import { assertValidStateTransition } from './state-machine.ts';
import {
  CANCELLABLE_BY_CUSTOMER_STATES,
  PAYMENT_STATUS_LABELS,
  REQUEST_STATE_LABELS,
  type PaymentStatus,
  type RequestState,
} from '../../../shared/constants.ts';
import { tomanToRial, type PriceBreakdown } from '../../../shared/pricing-formula.ts';

const ALLOWED_ATTACHMENT_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export interface PartUsedItem {
  name: string;
  costToman: number;
}

export class RequestsService {
  private readonly db: AppDatabase;
  private readonly customers: CustomersService;
  private readonly catalog: CatalogService;
  private readonly pricing: PricingService;
  private readonly dispatch: DispatchService;
  private readonly notifications: NotificationsService;
  private readonly audit: AuditService;
  private readonly privateStorageDir: string;
  private readonly maxUploadSizeBytes: number;

  constructor(params: {
    db: AppDatabase;
    customers: CustomersService;
    catalog: CatalogService;
    pricing: PricingService;
    dispatch: DispatchService;
    notifications: NotificationsService;
    audit: AuditService;
    privateStorageDir: string;
    maxUploadSizeBytes: number;
  }) {
    this.db = params.db;
    this.customers = params.customers;
    this.catalog = params.catalog;
    this.pricing = params.pricing;
    this.dispatch = params.dispatch;
    this.notifications = params.notifications;
    this.audit = params.audit;
    this.privateStorageDir = params.privateStorageDir;
    this.maxUploadSizeBytes = params.maxUploadSizeBytes;
    fs.mkdirSync(this.privateStorageDir, { recursive: true });
  }

  private generateTrackingCode(requestId: number): string {
    return `AE-QZV-${String(100000 + requestId)}`;
  }

  private generateInvoiceNumber(requestId: number): string {
    return `INV-1405-${String(requestId).padStart(6, '0')}`;
  }

  /**
   * ثبت پیش‌نویس یا ارسال نهایی درخواست امداد توسط مشتری (مقاوم در برابر ارسال تکراری با Idempotency-Key)
   */
  async createRequest(params: {
    customerUserId: number;
    vehicleId: number;
    serviceId: number;
    originLat: number;
    originLng: number;
    originAddress: string;
    destinationLat?: number | null;
    destinationLng?: number | null;
    destinationAddress?: string | null;
    issueDescription: string;
    ownershipConfirmed: boolean;
    isUrgent?: boolean;
    discountCode?: string;
    submitImmediately?: boolean;
    idempotencyKey?: string;
  }) {
    if (params.idempotencyKey) {
      const scopedKey = `${params.customerUserId}:${params.idempotencyKey.trim()}`;
      const existing = this.db.get<{ id: number }>(
        'SELECT id FROM service_requests WHERE idempotency_key = ?',
        scopedKey
      );
      if (existing) {
        return {
          deduplicated: true,
          request: this.getRequestDetail(existing.id, {
            id: params.customerUserId,
            role: 'customer',
            phone: '',
            fullName: '',
            sessionId: '',
          }),
        };
      }
    }

    const vehicle = this.customers.getOwnedVehicle(
      params.customerUserId,
      params.vehicleId
    );

    const destination =
      params.destinationLat !== undefined &&
      params.destinationLat !== null &&
      params.destinationLng !== undefined &&
      params.destinationLng !== null
        ? { lat: params.destinationLat, lng: params.destinationLng }
        : null;

    const quote = this.pricing.calculateQuote({
      serviceId: params.serviceId,
      origin: { lat: params.originLat, lng: params.originLng },
      destination,
      vehicleCategory: vehicle.category,
      isUrgent: params.isUrgent,
      discountCode: params.discountCode,
    });

    const service = this.catalog.getServiceById(
      params.serviceId,
      quote.coverage.zoneId
    );

    if (service.requiresOwnershipProof && !params.ownershipConfirmed) {
      throw new AppError(
        400,
        'OWNERSHIP_CONFIRMATION_REQUIRED',
        `برای خدمت «${service.titleFa}» تأیید مالکیت خودرو و همراه داشتن مدارک شناسایی الزامی است.`
      );
    }

    if (service.requiresDestination && !params.destinationAddress?.trim()) {
      throw new AppError(
        400,
        'DESTINATION_ADDRESS_REQUIRED',
        'برای خدمات حمل و یدک‌کش، وارد کردن نشانی مقصد الزامی است.'
      );
    }

    const initialStatus: RequestState =
      params.submitImmediately === false ? 'Draft' : 'Submitted';
    const nowIso = new Date().toISOString();
    const scopedIdem = params.idempotencyKey
      ? `${params.customerUserId}:${params.idempotencyKey.trim()}`
      : null;

    const requestId = this.db.transaction(() => {
      const tempCode = `TMP-${crypto.randomUUID()}`;
      const res = this.db.run(
        `INSERT INTO service_requests (
          tracking_code, idempotency_key, customer_user_id, vehicle_id, service_id,
          province_id, city_id, zone_id, status,
          origin_lat, origin_lng, origin_address,
          destination_lat, destination_lng, destination_address,
          issue_description, ownership_confirmed, is_urgent, discount_code,
          estimated_distance_km, tow_distance_km,
          estimated_price_toman, estimated_breakdown_json,
          payment_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, ?)`,
        tempCode,
        scopedIdem,
        params.customerUserId,
        vehicle.id,
        service.id,
        quote.coverage.provinceId,
        quote.coverage.cityId,
        quote.coverage.zoneId,
        initialStatus,
        params.originLat,
        params.originLng,
        params.originAddress.trim(),
        destination?.lat ?? null,
        destination?.lng ?? null,
        params.destinationAddress?.trim() || null,
        params.issueDescription.trim(),
        params.ownershipConfirmed ? 1 : 0,
        params.isUrgent ? 1 : 0,
        quote.appliedDiscountCode,
        quote.estimatedDispatchKm,
        quote.towDistanceKm,
        quote.breakdown.totalToman,
        JSON.stringify(quote.breakdown),
        nowIso,
        nowIso
      );

      const trackingCode = this.generateTrackingCode(res.lastInsertRowid);
      this.db.run(
        'UPDATE service_requests SET tracking_code = ? WHERE id = ?',
        trackingCode,
        res.lastInsertRowid
      );

      if (quote.appliedDiscountCode && initialStatus === 'Submitted') {
        this.db.run(
          'UPDATE discount_codes SET used_count = used_count + 1 WHERE code = ?',
          quote.appliedDiscountCode
        );
      }

      this.db.run(
        `INSERT INTO request_state_history (
          request_id, from_status, to_status, actor_user_id, actor_role, note, created_at
        ) VALUES (?, NULL, ?, ?, 'customer', ?, ?)`,
        res.lastInsertRowid,
        initialStatus,
        params.customerUserId,
        initialStatus === 'Submitted'
          ? 'ثبت و تأیید نهایی درخواست توسط مشتری'
          : 'ایجاد پیش‌نویس درخواست',
        nowIso
      );

      return res.lastInsertRowid;
    });

    if (initialStatus === 'Submitted') {
      await this.notifications.notifyUser({
        userId: params.customerUserId,
        requestId,
        eventType: 'REQUEST_SUBMITTED',
        title: 'درخواست امداد ثبت شد',
        body: `درخواست شما با کد رهگیری ${this.generateTrackingCode(requestId)} در محدوده ${quote.coverage.zoneNameFa} ثبت شد.`,
        sendSms: true,
        dedupBaseKey: `submitted:${requestId}`,
      });

      await this.dispatch.dispatchSubmittedRequest(requestId);
    }

    return {
      deduplicated: false,
      request: this.getRequestDetail(requestId, {
        id: params.customerUserId,
        role: 'customer',
        phone: '',
        fullName: '',
        sessionId: '',
      }),
    };
  }

  async submitDraftRequest(requestId: number, customerUserId: number) {
    const row = this.db.get<{
      id: number;
      customer_user_id: number;
      status: RequestState;
      discount_code: string | null;
    }>('SELECT id, customer_user_id, status, discount_code FROM service_requests WHERE id = ?', requestId);

    if (!row || row.customer_user_id !== customerUserId) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'درخواست یافت نشد.');
    }

    assertValidStateTransition({
      from: row.status,
      to: 'Submitted',
      actorRole: 'customer',
    });

    const nowIso = new Date().toISOString();
    this.db.transaction(() => {
      this.db.run(
        `UPDATE service_requests SET status = 'Submitted', updated_at = ? WHERE id = ?`,
        nowIso,
        requestId
      );
      if (row.discount_code) {
        this.db.run(
          'UPDATE discount_codes SET used_count = used_count + 1 WHERE code = ?',
          row.discount_code
        );
      }
      this.db.run(
        `INSERT INTO request_state_history (
          request_id, from_status, to_status, actor_user_id, actor_role, note, created_at
        ) VALUES (?, 'Draft', 'Submitted', ?, 'customer', 'تأیید و ارسال پیش‌نویس توسط مشتری', ?)`,
        requestId,
        customerUserId,
        nowIso
      );
    });

    await this.dispatch.dispatchSubmittedRequest(requestId);
    return this.getRequestDetail(requestId, {
      id: customerUserId,
      role: 'customer',
      phone: '',
      fullName: '',
      sessionId: '',
    });
  }

  /**
   * دریافت جزئیات کامل مأموریت با اعمال کنترل دسترسی سمت سرور (IDOR Guard) و حفاظت حریم خصوصی مکانی
   */
  getRequestDetail(requestId: number, viewer: AuthenticatedUser) {
    const row = this.db.get<{
      id: number;
      tracking_code: string;
      customer_user_id: number;
      customer_name: string;
      customer_phone: string;
      vehicle_id: number;
      vehicle_brand: string;
      vehicle_model: string;
      vehicle_plate: string;
      vehicle_category: string;
      service_id: number;
      service_title: string;
      service_slug: string;
      province_name: string;
      zone_name: string;
      status: RequestState;
      origin_lat: number;
      origin_lng: number;
      origin_address: string;
      destination_lat: number | null;
      destination_lng: number | null;
      destination_address: string | null;
      issue_description: string;
      is_urgent: number;
      discount_code: string | null;
      assigned_responder_id: number | null;
      estimated_distance_km: number;
      tow_distance_km: number;
      estimated_eta_minutes: number | null;
      estimated_price_toman: number;
      estimated_breakdown_json: string;
      final_price_toman: number | null;
      final_breakdown_json: string | null;
      price_change_reason: string | null;
      customer_price_approval_required: number;
      customer_price_approved: number;
      cancellation_fee_toman: number;
      cancellation_reason: string | null;
      payment_status: PaymentStatus;
      operator_escalation_required: number;
      operator_escalation_reason: string | null;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
    }>(
      `SELECT
         r.*,
         cu.full_name AS customer_name,
         cu.phone AS customer_phone,
         v.brand AS vehicle_brand,
         v.model AS vehicle_model,
         v.plate_number AS vehicle_plate,
         v.category AS vehicle_category,
         s.title_fa AS service_title,
         s.slug AS service_slug,
         p.name_fa AS province_name,
         z.name_fa AS zone_name
       FROM service_requests r
       JOIN users cu ON cu.id = r.customer_user_id
       JOIN customer_vehicles v ON v.id = r.vehicle_id
       JOIN service_catalog s ON s.id = r.service_id
       JOIN provinces p ON p.id = r.province_id
       JOIN service_zones z ON z.id = r.zone_id
       WHERE r.id = ?`,
      requestId
    );

    if (!row) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'درخواست موردنظر یافت نشد.');
    }

    // کنترل مجوز سطح رکورد (جلوگیری از IDOR):
    let redactSensitiveCustomerLocation = false;
    if (viewer.role === 'customer') {
      if (row.customer_user_id !== viewer.id) {
        this.audit.logSecurityEvent({
          eventType: 'IDOR_REQUEST_ACCESS_BLOCKED',
          severity: 'warning',
          userId: viewer.id,
          detail: `مشتری #${viewer.id} تلاش کرد به درخواست مشتری #${row.customer_user_id} دسترسی پیدا کند`,
        });
        throw new AppError(
          403,
          'FORBIDDEN',
          'شما مجوز مشاهده اطلاعات درخواست سایر کاربران را ندارید.'
        );
      }
    } else if (viewer.role === 'responder') {
      const responder = this.db.get<{ id: number }>(
        'SELECT id FROM responder_profiles WHERE user_id = ?',
        viewer.id
      );
      const isAssigned = responder && row.assigned_responder_id === responder.id;
      const hasOffer = responder
        ? Boolean(
            this.db.get<{ id: number }>(
              'SELECT id FROM mission_offers WHERE request_id = ? AND responder_id = ?',
              requestId,
              responder.id
            )
          )
        : false;

      if (!isAssigned && !hasOffer) {
        this.audit.logSecurityEvent({
          eventType: 'IDOR_RESPONDER_REQUEST_BLOCKED',
          severity: 'warning',
          userId: viewer.id,
          detail: `امدادگر غیرمرتبط تلاش کرد جزئیات مأموریت #${requestId} را مشاهده کند`,
        });
        throw new AppError(
          403,
          'FORBIDDEN',
          'این مأموریت به شما اختصاص نیافته است.'
        );
      }

      // اگر هنوز پذیرش نشده یا مأموریت پایان یافته باشد، مختصات دقیق و تلفن مشتری به حداقل می‌رسد
      const isActiveExecution = [
        'Accepted',
        'EnRoute',
        'Arrived',
        'InProgress',
      ].includes(row.status);
      if (!isAssigned || !isActiveExecution) {
        redactSensitiveCustomerLocation = true;
      }
    }

    let responderInfo = null;
    if (row.assigned_responder_id) {
      const respRow = this.db.get<{
        id: number;
        full_name: string;
        phone: string;
        equipment_type: string;
        vehicle_plate: string | null;
        rating_avg: number;
        current_lat: number | null;
        current_lng: number | null;
        location_updated_at: string | null;
      }>(
        `SELECT rp.id, u.full_name, u.phone, rp.equipment_type, rp.vehicle_plate,
                rp.rating_avg, rp.current_lat, rp.current_lng, rp.location_updated_at
         FROM responder_profiles rp
         JOIN users u ON u.id = rp.user_id
         WHERE rp.id = ?`,
        row.assigned_responder_id
      );
      if (respRow) {
        const showLiveResponderLoc = [
          'Accepted',
          'EnRoute',
          'Arrived',
          'InProgress',
        ].includes(row.status);
        responderInfo = {
          id: respRow.id,
          fullName: respRow.full_name,
          phone:
            showLiveResponderLoc ||
            viewer.role === 'admin' ||
            viewer.role === 'operator'
              ? respRow.phone
              : null,
          equipmentType: respRow.equipment_type,
          vehiclePlate: respRow.vehicle_plate,
          ratingAvg: respRow.rating_avg,
          liveLocation:
            showLiveResponderLoc &&
            respRow.current_lat !== null &&
            respRow.current_lng !== null
              ? {
                  lat: respRow.current_lat,
                  lng: respRow.current_lng,
                  updatedAt: respRow.location_updated_at,
                }
              : null,
        };
      }
    }

    const history = this.db.all<{
      id: number;
      from_status: string | null;
      to_status: RequestState;
      actor_role: string;
      note: string | null;
      created_at: string;
    }>(
      'SELECT id, from_status, to_status, actor_role, note, created_at FROM request_state_history WHERE request_id = ? ORDER BY id ASC',
      requestId
    );

    const report = this.db.get<{
      summary: string;
      actions_taken: string;
      parts_used_json: string;
      parts_total_toman: number;
      actual_tow_distance_km: number;
      created_at: string;
    }>('SELECT * FROM mission_reports WHERE request_id = ?', requestId);

    const invoice = this.db.get<{
      id: number;
      invoice_number: string;
      subtotal_toman: number;
      discount_toman: number;
      parts_toman: number;
      tax_toman: number;
      total_toman: number;
      total_rial: number;
      platform_commission_toman: number;
      responder_net_toman: number;
      status: string;
      issued_at: string;
      paid_at: string | null;
    }>('SELECT * FROM invoices WHERE request_id = ?', requestId);

    const review = this.db.get<{
      id: number;
      rating: number;
      tags_json: string;
      comment: string | null;
      created_at: string;
    }>('SELECT id, rating, tags_json, comment, created_at FROM mission_reviews WHERE request_id = ?', requestId);

    const attachments = this.db.all<{
      id: number;
      original_name: string;
      mime_type: string;
      size_bytes: number;
      created_at: string;
    }>(
      'SELECT id, original_name, mime_type, size_bytes, created_at FROM private_attachments WHERE request_id = ?',
      requestId
    );

    const priceChangeLogs = this.db.all<{
      id: number;
      previous_amount_toman: number;
      new_amount_toman: number;
      reason: string;
      requires_customer_approval: number;
      customer_approved_at: string | null;
      created_at: string;
    }>('SELECT * FROM price_change_logs WHERE request_id = ? ORDER BY id ASC', requestId);

    return {
      id: row.id,
      trackingCode: row.tracking_code,
      status: row.status,
      statusLabel: REQUEST_STATE_LABELS[row.status],
      paymentStatus: row.payment_status,
      paymentStatusLabel: PAYMENT_STATUS_LABELS[row.payment_status],
      customer: {
        id: row.customer_user_id,
        fullName: row.customer_name,
        phone: redactSensitiveCustomerLocation ? null : row.customer_phone,
      },
      vehicle: {
        id: row.vehicle_id,
        brand: row.vehicle_brand,
        model: row.vehicle_model,
        plateNumber: redactSensitiveCustomerLocation
          ? 'محافظت‌شده تا پذیرش مأموریت'
          : row.vehicle_plate,
        category: row.vehicle_category,
      },
      service: {
        id: row.service_id,
        slug: row.service_slug,
        titleFa: row.service_title,
      },
      geography: {
        provinceName: row.province_name,
        zoneName: row.zone_name,
      },
      origin: redactSensitiveCustomerLocation
        ? {
            lat: Math.round(row.origin_lat * 100) / 100,
            lng: Math.round(row.origin_lng * 100) / 100,
            address: `${row.zone_name} (نشانی دقیق پس از پذیرش مأموریت نمایش داده می‌شود)`,
          }
        : {
            lat: row.origin_lat,
            lng: row.origin_lng,
            address: row.origin_address,
          },
      destination:
        row.destination_lat !== null && row.destination_lng !== null
          ? {
              lat: row.destination_lat,
              lng: row.destination_lng,
              address: row.destination_address,
            }
          : null,
      issueDescription: row.issue_description,
      isUrgent: row.is_urgent === 1,
      discountCode: row.discount_code,
      estimatedDistanceKm: row.estimated_distance_km,
      towDistanceKm: row.tow_distance_km,
      estimatedEtaMinutes: row.estimated_eta_minutes,
      pricing: {
        currency: 'TOMAN' as const,
        estimatedPriceToman: row.estimated_price_toman,
        estimatedBreakdown: JSON.parse(
          row.estimated_breakdown_json
        ) as PriceBreakdown,
        finalPriceToman: row.final_price_toman,
        finalBreakdown: row.final_breakdown_json
          ? (JSON.parse(row.final_breakdown_json) as PriceBreakdown)
          : null,
        payableToman: row.final_price_toman ?? row.estimated_price_toman,
        priceChangeReason: row.price_change_reason,
        customerPriceApprovalRequired: row.customer_price_approval_required === 1,
        customerPriceApproved: row.customer_price_approved === 1,
        cancellationFeeToman: row.cancellation_fee_toman,
        priceChangeLogs,
      },
      responder: responderInfo,
      report: report
        ? {
            summary: report.summary,
            actionsTaken: report.actions_taken,
            partsUsed: JSON.parse(report.parts_used_json) as PartUsedItem[],
            partsTotalToman: report.parts_total_toman,
            actualTowDistanceKm: report.actual_tow_distance_km,
            createdAt: report.created_at,
          }
        : null,
      invoice: invoice
        ? {
            id: invoice.id,
            invoiceNumber: invoice.invoice_number,
            subtotalToman: invoice.subtotal_toman,
            discountToman: invoice.discount_toman,
            partsToman: invoice.parts_toman,
            taxToman: invoice.tax_toman,
            totalToman: invoice.total_toman,
            totalRial: invoice.total_rial,
            // سهم کارمزد پلتفرم فقط به امدادگر مربوطه، اپراتور و مدیر نمایش داده می‌شود
            platformCommissionToman:
              viewer.role !== 'customer'
                ? invoice.platform_commission_toman
                : undefined,
            responderNetToman:
              viewer.role !== 'customer' ? invoice.responder_net_toman : undefined,
            status: invoice.status,
            issuedAt: invoice.issued_at,
            paidAt: invoice.paid_at,
          }
        : null,
      review: review
        ? {
            id: review.id,
            rating: review.rating,
            tags: JSON.parse(review.tags_json) as string[],
            comment: review.comment,
            createdAt: review.created_at,
          }
        : null,
      attachments,
      operatorEscalationRequired: row.operator_escalation_required === 1,
      operatorEscalationReason: row.operator_escalation_reason,
      cancellationReason: row.cancellation_reason,
      history: history.map((h) => ({
        id: h.id,
        fromStatus: h.from_status,
        toStatus: h.to_status,
        toStatusLabel: REQUEST_STATE_LABELS[h.to_status],
        actorRole: h.actor_role,
        note: h.note,
        createdAt: h.created_at,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  }

  /**
   * پیشبرد مراحل عملیاتی مأموریت توسط امدادگر اختصاص‌یافته: EnRoute -> Arrived -> InProgress
   */
  async advanceResponderMissionStatus(params: {
    requestId: number;
    responderUserId: number;
    nextStatus: 'EnRoute' | 'Arrived' | 'InProgress';
    note?: string;
    lat?: number;
    lng?: number;
  }) {
    const responder = this.db.get<{ id: number; full_name: string }>(
      `SELECT rp.id, u.full_name
       FROM responder_profiles rp
       JOIN users u ON u.id = rp.user_id
       WHERE rp.user_id = ?`,
      params.responderUserId
    );
    if (!responder) {
      throw new AppError(404, 'RESPONDER_NOT_FOUND', 'پروفایل امدادگر یافت نشد.');
    }

    const reqRow = this.db.get<{
      id: number;
      tracking_code: string;
      customer_user_id: number;
      status: RequestState;
      assigned_responder_id: number | null;
    }>('SELECT * FROM service_requests WHERE id = ?', params.requestId);

    if (!reqRow) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'مأموریت یافت نشد.');
    }

    if (reqRow.assigned_responder_id !== responder.id) {
      throw new AppError(
        403,
        'NOT_ASSIGNED_RESPONDER',
        'فقط امدادگر اختصاص‌یافته به این مأموریت مجاز به ثبت تغییر وضعیت است.'
      );
    }

    assertValidStateTransition({
      from: reqRow.status,
      to: params.nextStatus,
      actorRole: 'responder',
    });

    const nowIso = new Date().toISOString();
    this.db.transaction(() => {
      if (params.lat !== undefined && params.lng !== undefined) {
        this.db.run(
          `UPDATE responder_profiles
           SET current_lat = ?, current_lng = ?, location_updated_at = ?, updated_at = ?
           WHERE id = ?`,
          params.lat,
          params.lng,
          nowIso,
          nowIso,
          responder.id
        );
      }

      this.db.run(
        'UPDATE service_requests SET status = ?, updated_at = ? WHERE id = ?',
        params.nextStatus,
        nowIso,
        params.requestId
      );

      this.db.run(
        `INSERT INTO request_state_history (
          request_id, from_status, to_status, actor_user_id, actor_role, note, created_at
        ) VALUES (?, ?, ?, ?, 'responder', ?, ?)`,
        params.requestId,
        reqRow.status,
        params.nextStatus,
        params.responderUserId,
        params.note?.trim() || `ثبت وضعیت ${REQUEST_STATE_LABELS[params.nextStatus]}`,
        nowIso
      );
    });

    const statusMsgMap: Record<'EnRoute' | 'Arrived' | 'InProgress', string> = {
      EnRoute: `امدادگر «${responder.full_name}» به سمت موقعیت شما حرکت کرد.`,
      Arrived: `امدادگر به موقعیت شما رسید.`,
      InProgress: `ارائه خدمت امدادی روی خودروی شما آغاز شد.`,
    };

    await this.notifications.notifyUser({
      userId: reqRow.customer_user_id,
      requestId: params.requestId,
      eventType: `MISSION_${params.nextStatus.toUpperCase()}`,
      title: REQUEST_STATE_LABELS[params.nextStatus],
      body: `${statusMsgMap[params.nextStatus]} (کد مأموریت: ${reqRow.tracking_code})`,
      sendSms: params.nextStatus === 'EnRoute' || params.nextStatus === 'Arrived',
      dedupBaseKey: `state:${params.requestId}:${params.nextStatus}`,
    });

    return this.getRequestDetail(params.requestId, {
      id: params.responderUserId,
      role: 'responder',
      phone: '',
      fullName: responder.full_name,
      sessionId: '',
    });
  }

  /**
   * ثبت گزارش تکمیل خدمت، محاسبه هزینه نهایی معتبر، ثبت سابقه تغییر قیمت و صدور فاکتور رسمی
   */
  async completeMission(params: {
    requestId: number;
    responderUserId: number;
    summary: string;
    actionsTaken: string;
    partsUsed: PartUsedItem[];
    actualTowDistanceKm?: number;
    priceChangeReason?: string;
  }) {
    const responder = this.db.get<{ id: number; full_name: string }>(
      `SELECT rp.id, u.full_name FROM responder_profiles rp JOIN users u ON u.id = rp.user_id WHERE rp.user_id = ?`,
      params.responderUserId
    );
    if (!responder) {
      throw new AppError(404, 'RESPONDER_NOT_FOUND', 'امدادگر یافت نشد.');
    }

    const reqRow = this.db.get<{
      id: number;
      tracking_code: string;
      customer_user_id: number;
      vehicle_id: number;
      service_id: number;
      status: RequestState;
      assigned_responder_id: number | null;
      origin_lat: number;
      origin_lng: number;
      destination_lat: number | null;
      destination_lng: number | null;
      is_urgent: number;
      discount_code: string | null;
      estimated_distance_km: number;
      tow_distance_km: number;
      estimated_price_toman: number;
      created_at: string;
    }>('SELECT * FROM service_requests WHERE id = ?', params.requestId);

    if (!reqRow) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'مأموریت یافت نشد.');
    }
    if (reqRow.assigned_responder_id !== responder.id) {
      throw new AppError(403, 'NOT_ASSIGNED_RESPONDER', 'این مأموریت متعلق به شما نیست.');
    }

    assertValidStateTransition({
      from: reqRow.status,
      to: 'Completed',
      actorRole: 'responder',
    });

    const vehicleRow = this.db.get<{ category: 'domestic' | 'foreign' | 'electric' | 'suv_heavy' }>(
      'SELECT category FROM customer_vehicles WHERE id = ?',
      reqRow.vehicle_id
    )!;

    const partsTotalToman = params.partsUsed.reduce(
      (acc, p) => acc + Math.max(0, Math.round(p.costToman)),
      0
    );

    const destination =
      reqRow.destination_lat !== null && reqRow.destination_lng !== null
        ? { lat: reqRow.destination_lat, lng: reqRow.destination_lng }
        : null;

    // محاسبه نهایی بر اساس قوانین قیمت‌گذاری سمت سرور (با در نظر گرفتن قطعات و مسافت واقعی)
    const rules = this.pricing.getRules();
    const finalQuote = this.pricing.calculateQuote({
      serviceId: reqRow.service_id,
      origin: { lat: reqRow.origin_lat, lng: reqRow.origin_lng },
      destination,
      vehicleCategory: vehicleRow.category,
      isUrgent: reqRow.is_urgent === 1,
      discountCode: undefined, // برای جلوگیری از خطای تکمیل سقف کد تخفیف قبلی، تخفیف را در ادامه لحاظ می‌کنیم
      estimatedDispatchKmOverride: reqRow.estimated_distance_km,
      partsCostToman: partsTotalToman,
      atDate: new Date(reqRow.created_at),
    });

    let finalBreakdown = finalQuote.breakdown;
    // اگر کد تخفیف در زمان ثبت درخواست اعمال شده بود، همان درصد/سقف تخفیف را حفظ می‌کنیم
    if (reqRow.discount_code) {
      const disc = this.db.get<{
        percent_off: number;
        fixed_toman_off: number;
        max_discount_toman: number;
      }>('SELECT percent_off, fixed_toman_off, max_discount_toman FROM discount_codes WHERE code = ?', reqRow.discount_code);
      if (disc) {
        const service = this.catalog.getServiceById(reqRow.service_id);
        const { calculateOfficialPrice } = await import(
          '../../../shared/pricing-formula.ts'
        );
        finalBreakdown = calculateOfficialPrice({
          basePriceToman: service.basePriceToman,
          dispatchDistanceKm: reqRow.estimated_distance_km,
          includedFreeDispatchKm: service.includedFreeKm,
          perKmDispatchToman: service.perKmDispatchToman,
          towDistanceKm: params.actualTowDistanceKm ?? reqRow.tow_distance_km,
          perKmTowToman: service.perKmTowToman,
          vehicleCategory: vehicleRow.category,
          vehicleMultipliers: {
            domestic: rules.domesticMultiplier,
            foreign: rules.foreignMultiplier,
            electric: rules.electricMultiplier,
            suv_heavy: rules.suvHeavyMultiplier,
          },
          zoneMultiplier: finalQuote.coverage.tariffMultiplier,
          isUrgentOrNight:
            finalBreakdown.urgentNightMultiplierApplied > 1,
          urgentNightMultiplier: rules.urgentNightMultiplier,
          partsCostToman: partsTotalToman,
          discountPercent: disc.percent_off,
          discountFixedToman: disc.fixed_toman_off,
          maxDiscountToman: disc.max_discount_toman,
          taxRatePercent: rules.taxRatePercent,
        });
      }
    } else if (params.actualTowDistanceKm !== undefined) {
      const service = this.catalog.getServiceById(reqRow.service_id);
      const { calculateOfficialPrice } = await import(
        '../../../shared/pricing-formula.ts'
      );
      finalBreakdown = calculateOfficialPrice({
        basePriceToman: service.basePriceToman,
        dispatchDistanceKm: reqRow.estimated_distance_km,
        includedFreeDispatchKm: service.includedFreeKm,
        perKmDispatchToman: service.perKmDispatchToman,
        towDistanceKm: params.actualTowDistanceKm,
        perKmTowToman: service.perKmTowToman,
        vehicleCategory: vehicleRow.category,
        vehicleMultipliers: {
          domestic: rules.domesticMultiplier,
          foreign: rules.foreignMultiplier,
          electric: rules.electricMultiplier,
          suv_heavy: rules.suvHeavyMultiplier,
        },
        zoneMultiplier: finalQuote.coverage.tariffMultiplier,
        isUrgentOrNight: finalBreakdown.urgentNightMultiplierApplied > 1,
        urgentNightMultiplier: rules.urgentNightMultiplier,
        partsCostToman: partsTotalToman,
        taxRatePercent: rules.taxRatePercent,
      });
    }

    const finalPriceToman = finalBreakdown.totalToman;
    const priceDiff = finalPriceToman - reqRow.estimated_price_toman;
    const diffPercent =
      reqRow.estimated_price_toman > 0
        ? (priceDiff / reqRow.estimated_price_toman) * 100
        : 0;

    if (priceDiff > 0 && (!params.priceChangeReason || params.priceChangeReason.trim().length < 3)) {
      throw new AppError(
        400,
        'PRICE_CHANGE_REASON_REQUIRED',
        'در صورت افزایش مبلغ نهایی نسبت به برآورد اولیه (بابت قطعات یا مسافت)، ثبت دلیل تغییر مبلغ الزامی است.'
      );
    }

    const requiresCustomerApproval =
      priceDiff > 0 &&
      (diffPercent > rules.priceApprovalThresholdPercent || partsTotalToman > 0);

    // محاسبه کارمزد پلتفرم صرفاً روی خالص خدمات (بدون دریافت کارمزد از بهای قطعه یا مالیات!)
    const platformCommissionToman = Math.round(
      (finalBreakdown.taxableServiceNetToman * rules.platformCommissionPercent) / 100
    );
    const responderNetToman =
      finalBreakdown.taxableServiceNetToman +
      finalBreakdown.partsCostToman -
      platformCommissionToman;

    const nowIso = new Date().toISOString();
    const invoiceNumber = this.generateInvoiceNumber(reqRow.id);

    this.db.transaction(() => {
      this.db.run(
        `INSERT INTO mission_reports (
          request_id, responder_id, summary, actions_taken,
          parts_used_json, parts_total_toman, actual_tow_distance_km, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        reqRow.id,
        responder.id,
        params.summary.trim(),
        params.actionsTaken.trim(),
        JSON.stringify(params.partsUsed),
        partsTotalToman,
        params.actualTowDistanceKm ?? reqRow.tow_distance_km,
        nowIso
      );

      this.db.run(
        `UPDATE service_requests
         SET status = 'Completed',
             final_price_toman = ?,
             final_breakdown_json = ?,
             price_change_reason = ?,
             customer_price_approval_required = ?,
             customer_price_approved = ?,
             tow_distance_km = ?,
             completed_at = ?,
             updated_at = ?
         WHERE id = ?`,
        finalPriceToman,
        JSON.stringify(finalBreakdown),
        params.priceChangeReason?.trim() || null,
        requiresCustomerApproval ? 1 : 0,
        requiresCustomerApproval ? 0 : 1,
        params.actualTowDistanceKm ?? reqRow.tow_distance_km,
        nowIso,
        nowIso,
        reqRow.id
      );

      if (priceDiff !== 0) {
        this.db.run(
          `INSERT INTO price_change_logs (
            request_id, actor_user_id, previous_amount_toman, new_amount_toman,
            reason, requires_customer_approval, customer_approved_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          reqRow.id,
          params.responderUserId,
          reqRow.estimated_price_toman,
          finalPriceToman,
          params.priceChangeReason?.trim() || 'تطبیق مسافت واقعی مأموریت',
          requiresCustomerApproval ? 1 : 0,
          requiresCustomerApproval ? null : nowIso,
          nowIso
        );
      }

      this.db.run(
        `INSERT INTO invoices (
          invoice_number, request_id, customer_user_id, responder_id,
          subtotal_toman, discount_toman, parts_toman, tax_toman,
          total_toman, total_rial, platform_commission_toman, responder_net_toman,
          status, issued_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?)`,
        invoiceNumber,
        reqRow.id,
        reqRow.customer_user_id,
        responder.id,
        finalBreakdown.serviceSubtotalBeforeDiscountToman,
        finalBreakdown.discountAmountToman,
        finalBreakdown.partsCostToman,
        finalBreakdown.taxAmountToman,
        finalPriceToman,
        tomanToRial(finalPriceToman),
        platformCommissionToman,
        responderNetToman,
        nowIso
      );

      this.db.run(
        `UPDATE responder_profiles
         SET availability_status = 'online',
             completed_missions_count = completed_missions_count + 1,
             updated_at = ?
         WHERE id = ?`,
        nowIso,
        responder.id
      );

      this.db.run(
        `INSERT INTO request_state_history (
          request_id, from_status, to_status, actor_user_id, actor_role, note, created_at
        ) VALUES (?, 'InProgress', 'Completed', ?, 'responder', ?, ?)`,
        reqRow.id,
        params.responderUserId,
        `تکمیل خدمت و صدور صورتحساب ${invoiceNumber} به مبلغ ${finalPriceToman.toLocaleString('fa-IR')} تومان`,
        nowIso
      );
    });

    await this.notifications.notifyUser({
      userId: reqRow.customer_user_id,
      requestId: reqRow.id,
      eventType: 'MISSION_COMPLETED',
      title: 'خدمت امدادی تکمیل و فاکتور صادر شد',
      body: `مأموریت ${reqRow.tracking_code} تکمیل شد. مبلغ نهایی صورتحساب: ${finalPriceToman.toLocaleString('fa-IR')} تومان.`,
      sendSms: true,
      dedupBaseKey: `completed:${reqRow.id}`,
    });

    return this.getRequestDetail(reqRow.id, {
      id: params.responderUserId,
      role: 'responder',
      phone: '',
      fullName: responder.full_name,
      sessionId: '',
    });
  }

  approveFinalPriceByCustomer(requestId: number, customerUserId: number) {
    const reqRow = this.db.get<{
      id: number;
      customer_user_id: number;
      customer_price_approval_required: number;
    }>(
      'SELECT id, customer_user_id, customer_price_approval_required FROM service_requests WHERE id = ?',
      requestId
    );
    if (!reqRow || reqRow.customer_user_id !== customerUserId) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'درخواست یافت نشد.');
    }

    const nowIso = new Date().toISOString();
    this.db.transaction(() => {
      this.db.run(
        'UPDATE service_requests SET customer_price_approved = 1, updated_at = ? WHERE id = ?',
        nowIso,
        requestId
      );
      this.db.run(
        'UPDATE price_change_logs SET customer_approved_at = ? WHERE request_id = ? AND customer_approved_at IS NULL',
        nowIso,
        requestId
      );
    });

    return this.getRequestDetail(requestId, {
      id: customerUserId,
      role: 'customer',
      phone: '',
      fullName: '',
      sessionId: '',
    });
  }

  /**
   * لغو درخواست بر اساس قوانین مصوب لغو
   */
  async cancelRequest(params: {
    requestId: number;
    actor: AuthenticatedUser;
    reason: string;
  }) {
    const reqRow = this.db.get<{
      id: number;
      tracking_code: string;
      customer_user_id: number;
      service_id: number;
      status: RequestState;
      assigned_responder_id: number | null;
    }>('SELECT * FROM service_requests WHERE id = ?', params.requestId);

    if (!reqRow) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'درخواست یافت نشد.');
    }

    if (
      params.actor.role === 'customer' &&
      reqRow.customer_user_id !== params.actor.id
    ) {
      throw new AppError(403, 'FORBIDDEN', 'مجوز لغو این درخواست را ندارید.');
    }

    if (
      params.actor.role === 'customer' &&
      !CANCELLABLE_BY_CUSTOMER_STATES.includes(reqRow.status)
    ) {
      throw new AppError(
        409,
        'CANCELLATION_NOT_ALLOWED',
        `لغو درخواست توسط مشتری در وضعیت «${REQUEST_STATE_LABELS[reqRow.status]}» مجاز نیست.`
      );
    }

    assertValidStateTransition({
      from: reqRow.status,
      to: 'Cancelled',
      actorRole: params.actor.role,
    });

    const service = this.catalog.getServiceById(reqRow.service_id);
    const responderMoved = ['EnRoute', 'Arrived'].includes(reqRow.status);
    const cancelFee =
      params.actor.role === 'customer' && responderMoved
        ? service.enrouteCancelFeeToman
        : 0;

    const nowIso = new Date().toISOString();
    this.db.transaction(() => {
      this.db.run(
        `UPDATE service_requests
         SET status = 'Cancelled',
             cancellation_fee_toman = ?,
             cancellation_reason = ?,
             cancelled_by_user_id = ?,
             operator_escalation_required = 0,
             updated_at = ?
         WHERE id = ?`,
        cancelFee,
        params.reason.trim(),
        params.actor.id,
        nowIso,
        reqRow.id
      );

      this.db.run(
        `UPDATE mission_offers SET status = 'expired', responded_at = ? WHERE request_id = ? AND status = 'pending'`,
        nowIso,
        reqRow.id
      );

      if (reqRow.assigned_responder_id) {
        this.db.run(
          `UPDATE responder_profiles SET availability_status = 'online', updated_at = ? WHERE id = ?`,
          nowIso,
          reqRow.assigned_responder_id
        );
      }

      this.db.run(
        `INSERT INTO request_state_history (
          request_id, from_status, to_status, actor_user_id, actor_role, note, created_at
        ) VALUES (?, ?, 'Cancelled', ?, ?, ?, ?)`,
        reqRow.id,
        reqRow.status,
        params.actor.id,
        params.actor.role,
        `لغو درخواست (${params.reason.trim()})${cancelFee > 0 ? ` — جریمه ایاب‌وذهاب: ${cancelFee} تومان` : ''}`,
        nowIso
      );
    });

    if (reqRow.assigned_responder_id) {
      const respUser = this.db.get<{ user_id: number }>(
        'SELECT user_id FROM responder_profiles WHERE id = ?',
        reqRow.assigned_responder_id
      );
      if (respUser) {
        await this.notifications.notifyUser({
          userId: respUser.user_id,
          requestId: reqRow.id,
          eventType: 'MISSION_CANCELLED',
          title: 'لغو مأموریت',
          body: `مأموریت ${reqRow.tracking_code} لغو شد و وضعیت شما به آماده به کار تغییر یافت.`,
          sendSms: true,
          dedupBaseKey: `cancelled_resp:${reqRow.id}`,
        });
      }
    }

    return this.getRequestDetail(reqRow.id, params.actor);
  }

  /**
   * تغییر وضعیت مدیریتی/پشتیبانی توسط اپراتور یا مدیر کل
   */
  staffTransitionStatus(params: {
    requestId: number;
    actor: AuthenticatedUser;
    toStatus: RequestState;
    note: string;
  }) {
    const reqRow = this.db.get<{ id: number; status: RequestState }>(
      'SELECT id, status FROM service_requests WHERE id = ?',
      params.requestId
    );
    if (!reqRow) {
      throw new AppError(404, 'REQUEST_NOT_FOUND', 'درخواست یافت نشد.');
    }

    assertValidStateTransition({
      from: reqRow.status,
      to: params.toStatus,
      actorRole: params.actor.role,
    });

    const nowIso = new Date().toISOString();
    this.db.transaction(() => {
      this.db.run(
        'UPDATE service_requests SET status = ?, updated_at = ? WHERE id = ?',
        params.toStatus,
        nowIso,
        params.requestId
      );
      this.db.run(
        `INSERT INTO request_state_history (
          request_id, from_status, to_status, actor_user_id, actor_role, note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params.requestId,
        reqRow.status,
        params.toStatus,
        params.actor.id,
        params.actor.role,
        params.note.trim(),
        nowIso
      );
      this.audit.logAdminAction({
        actorUserId: params.actor.id,
        actorRole: params.actor.role,
        action: 'STAFF_MISSION_TRANSITION',
        entityType: 'service_request',
        entityId: params.requestId,
        summary: `انتقال وضعیت مأموریت #${params.requestId} از ${reqRow.status} به ${params.toStatus}`,
        metadata: { note: params.note },
      });
    });

    return this.getRequestDetail(params.requestId, params.actor);
  }

  listCustomerRequests(customerUserId: number) {
    const rows = this.db.all<{
      id: number;
      tracking_code: string;
      status: RequestState;
      payment_status: PaymentStatus;
      service_title: string;
      zone_name: string;
      vehicle_brand: string;
      vehicle_model: string;
      estimated_price_toman: number;
      final_price_toman: number | null;
      created_at: string;
    }>(
      `SELECT
         r.id, r.tracking_code, r.status, r.payment_status,
         s.title_fa AS service_title, z.name_fa AS zone_name,
         v.brand AS vehicle_brand, v.model AS vehicle_model,
         r.estimated_price_toman, r.final_price_toman, r.created_at
       FROM service_requests r
       JOIN service_catalog s ON s.id = r.service_id
       JOIN service_zones z ON z.id = r.zone_id
       JOIN customer_vehicles v ON v.id = r.vehicle_id
       WHERE r.customer_user_id = ?
       ORDER BY r.id DESC`,
      customerUserId
    );
    return rows.map((r) => ({
      id: r.id,
      trackingCode: r.tracking_code,
      status: r.status,
      statusLabel: REQUEST_STATE_LABELS[r.status],
      paymentStatus: r.payment_status,
      paymentStatusLabel: PAYMENT_STATUS_LABELS[r.payment_status],
      serviceTitle: r.service_title,
      zoneName: r.zone_name,
      vehicleSummary: `${r.vehicle_brand} ${r.vehicle_model}`,
      payableToman: r.final_price_toman ?? r.estimated_price_toman,
      createdAt: r.created_at,
    }));
  }

  listResponderMissions(responderUserId: number) {
    const responder = this.db.get<{ id: number }>(
      'SELECT id FROM responder_profiles WHERE user_id = ?',
      responderUserId
    );
    if (!responder) return [];

    const rows = this.db.all<{
      id: number;
      tracking_code: string;
      status: RequestState;
      payment_status: PaymentStatus;
      service_title: string;
      zone_name: string;
      origin_address: string;
      estimated_price_toman: number;
      final_price_toman: number | null;
      created_at: string;
    }>(
      `SELECT
         r.id, r.tracking_code, r.status, r.payment_status,
         s.title_fa AS service_title, z.name_fa AS zone_name, r.origin_address,
         r.estimated_price_toman, r.final_price_toman, r.created_at
       FROM service_requests r
       JOIN service_catalog s ON s.id = r.service_id
       JOIN service_zones z ON z.id = r.zone_id
       WHERE r.assigned_responder_id = ?
       ORDER BY r.id DESC`,
      responder.id
    );
    return rows.map((r) => ({
      id: r.id,
      trackingCode: r.tracking_code,
      status: r.status,
      statusLabel: REQUEST_STATE_LABELS[r.status],
      paymentStatus: r.payment_status,
      serviceTitle: r.service_title,
      zoneName: r.zone_name,
      originAddress: ['Accepted', 'EnRoute', 'Arrived', 'InProgress'].includes(r.status)
        ? r.origin_address
        : r.zone_name,
      payableToman: r.final_price_toman ?? r.estimated_price_toman,
      createdAt: r.created_at,
    }));
  }

  listStaffQueue(filter?: { escalatedOnly?: boolean; status?: string }) {
    let sql = `
      SELECT
        r.id, r.tracking_code, r.status, r.payment_status,
        r.operator_escalation_required, r.operator_escalation_reason,
        cu.full_name AS customer_name, cu.phone AS customer_phone,
        s.title_fa AS service_title, z.name_fa AS zone_name,
        r.estimated_price_toman, r.final_price_toman,
        ru.full_name AS responder_name,
        r.created_at, r.updated_at
      FROM service_requests r
      JOIN users cu ON cu.id = r.customer_user_id
      JOIN service_catalog s ON s.id = r.service_id
      JOIN service_zones z ON z.id = r.zone_id
      LEFT JOIN responder_profiles rp ON rp.id = r.assigned_responder_id
      LEFT JOIN users ru ON ru.id = rp.user_id
      WHERE 1 = 1
    `;
    const args: Array<string | number> = [];

    if (filter?.escalatedOnly) {
      sql += ' AND r.operator_escalation_required = 1';
    }
    if (filter?.status) {
      sql += ' AND r.status = ?';
      args.push(filter.status);
    }

    sql += ' ORDER BY r.operator_escalation_required DESC, r.id DESC LIMIT 100';
    return this.db.all(sql, ...args);
  }

  /**
   * بارگذاری فایل خصوصی با بررسی نوع MIME، اندازه مجاز و ذخیره خارج از مسیر عمومی وب
   */
  uploadPrivateAttachment(params: {
    actor: AuthenticatedUser;
    requestId: number;
    originalName: string;
    mimeType: string;
    base64Data: string;
  }) {
    // ابتدا بررسی مجوز دسترسی کاربر به این درخواست
    this.getRequestDetail(params.requestId, params.actor);

    if (!ALLOWED_ATTACHMENT_MIMES.has(params.mimeType)) {
      throw new AppError(
        400,
        'UNSUPPORTED_FILE_TYPE',
        'فرمت فایل مجاز نیست. فقط تصاویر JPG/PNG/WEBP و PDF پذیرفته می‌شوند.'
      );
    }

    const cleanBase64 = params.base64Data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    if (buffer.byteLength === 0 || buffer.byteLength > this.maxUploadSizeBytes) {
      throw new AppError(
        400,
        'FILE_SIZE_INVALID',
        `حجم فایل باید بین ۱ بایت تا حداکثر ${Math.round(this.maxUploadSizeBytes / 1024 / 1024)} مگابایت باشد.`
      );
    }

    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    };
    const storageFilename = `${crypto.randomUUID()}${extMap[params.mimeType] || '.bin'}`;
    const fullPath = path.join(this.privateStorageDir, storageFilename);
    fs.writeFileSync(fullPath, buffer, { mode: 0o600 });

    const nowIso = new Date().toISOString();
    const res = this.db.run(
      `INSERT INTO private_attachments (
        owner_user_id, request_id, original_name, mime_type, size_bytes, storage_filename, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params.actor.id,
      params.requestId,
      path.basename(params.originalName).slice(0, 120),
      params.mimeType,
      buffer.byteLength,
      storageFilename,
      nowIso
    );

    return {
      id: res.lastInsertRowid,
      originalName: path.basename(params.originalName).slice(0, 120),
      mimeType: params.mimeType,
      sizeBytes: buffer.byteLength,
    };
  }

  readProtectedAttachment(attachmentId: number, viewer: AuthenticatedUser) {
    const row = this.db.get<{
      id: number;
      owner_user_id: number;
      request_id: number | null;
      original_name: string;
      mime_type: string;
      storage_filename: string;
    }>('SELECT * FROM private_attachments WHERE id = ?', attachmentId);

    if (!row) {
      throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'فایل موردنظر یافت نشد.');
    }

    if (row.request_id) {
      // این فراخوانی کنترل دسترسی سطح رکورد (ضد IDOR) را اعمال می‌کند
      this.getRequestDetail(row.request_id, viewer);
    } else if (
      row.owner_user_id !== viewer.id &&
      viewer.role !== 'admin' &&
      viewer.role !== 'operator'
    ) {
      this.audit.logSecurityEvent({
        eventType: 'IDOR_PRIVATE_FILE_BLOCKED',
        severity: 'critical',
        userId: viewer.id,
        detail: `تلاش غیرمجاز برای دانلود فایل خصوصی #${attachmentId}`,
      });
      throw new AppError(403, 'FORBIDDEN', 'مجوز دسترسی به این فایل خصوصی را ندارید.');
    }

    const fullPath = path.join(this.privateStorageDir, path.basename(row.storage_filename));
    if (!fs.existsSync(fullPath)) {
      throw new AppError(404, 'FILE_MISSING', 'فایل در مخزن خصوصی یافت نشد.');
    }

    return {
      buffer: fs.readFileSync(fullPath),
      mimeType: row.mime_type,
      originalName: row.original_name,
    };
  }
}
