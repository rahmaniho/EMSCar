import type { AppDatabase } from '../../db/connection.ts';
import type { AuditService } from '../audit/audit.service.ts';
import { AppError } from '../../middleware/error-handler.ts';
import {
  type GeographyStatus,
  GEOGRAPHY_STATUS_LABELS,
} from '../../../shared/constants.ts';
import {
  type GeoPoint,
  isWithinIranBounds,
  isPointInPolygon,
  isPointWithinRadiusKm,
  haversineDistanceKm,
} from '../../../shared/geo-utils.ts';

export interface ResolvedOperationalCoverage {
  provinceId: number;
  provinceNameFa: string;
  provinceSlug: string;
  cityId: number | null;
  cityNameFa: string | null;
  zoneId: number;
  zoneCode: string;
  zoneNameFa: string;
  zoneType: 'urban' | 'suburban' | 'highway' | 'industrial';
  tariffMultiplier: number;
}

export class GeographyService {
  private readonly db: AppDatabase;
  private readonly audit: AuditService;

  constructor(params: { db: AppDatabase; audit: AuditService }) {
    this.db = params.db;
    this.audit = params.audit;
  }

  getPublicOverview() {
    const provinces = this.db.all<{
      id: number;
      slug: string;
      name_fa: string;
      status: GeographyStatus;
      center_lat: number;
      center_lng: number;
      boundary_json: string;
    }>('SELECT id, slug, name_fa, status, center_lat, center_lng, boundary_json FROM provinces ORDER BY id ASC');

    const cities = this.db.all<{
      id: number;
      province_id: number;
      slug: string;
      name_fa: string;
      status: GeographyStatus;
      center_lat: number;
      center_lng: number;
    }>('SELECT id, province_id, slug, name_fa, status, center_lat, center_lng FROM cities ORDER BY id ASC');

    const zones = this.db.all<{
      id: number;
      province_id: number;
      city_id: number | null;
      code: string;
      name_fa: string;
      zone_type: string;
      status: GeographyStatus;
      center_lat: number;
      center_lng: number;
      radius_km: number;
      tariff_multiplier: number;
      target_responder_capacity: number;
    }>('SELECT * FROM service_zones ORDER BY id ASC');

    return {
      provinces: provinces.map((p) => ({
        id: p.id,
        slug: p.slug,
        nameFa: p.name_fa,
        status: p.status,
        statusLabel: GEOGRAPHY_STATUS_LABELS[p.status],
        center: { lat: p.center_lat, lng: p.center_lng },
        boundary: JSON.parse(p.boundary_json) as GeoPoint[],
      })),
      cities: cities.map((c) => ({
        id: c.id,
        provinceId: c.province_id,
        slug: c.slug,
        nameFa: c.name_fa,
        status: c.status,
        statusLabel: GEOGRAPHY_STATUS_LABELS[c.status],
        center: { lat: c.center_lat, lng: c.center_lng },
      })),
      zones: zones.map((z) => ({
        id: z.id,
        provinceId: z.province_id,
        cityId: z.city_id,
        code: z.code,
        nameFa: z.name_fa,
        zoneType: z.zone_type,
        status: z.status,
        statusLabel: GEOGRAPHY_STATUS_LABELS[z.status],
        center: { lat: z.center_lat, lng: z.center_lng },
        radiusKm: z.radius_km,
        tariffMultiplier: z.tariff_multiplier,
        targetResponderCapacity: z.target_responder_capacity,
      })),
    };
  }

  /**
   * بررسی وضعیت پوشش برای مختصات انتخاب‌شده بدون ایجاد خطا (جهت پیش‌نمایش نقشه)
   */
  inspectLocationCoverage(point: GeoPoint) {
    if (!isWithinIranBounds(point)) {
      return {
        isActiveOperational: false,
        reasonCode: 'OUT_OF_IRAN_BOUNDS',
        messageFa: 'مختصات انتخابی خارج از محدوده جغرافیایی ایران است.',
        matchedProvince: null,
        matchedZone: null,
      };
    }

    const provinces = this.db.all<{
      id: number;
      slug: string;
      name_fa: string;
      status: GeographyStatus;
      boundary_json: string;
    }>('SELECT id, slug, name_fa, status, boundary_json FROM provinces');

    // ۱. ابتدا بررسی مناطق خدماتی بر اساس کمترین فاصله تا مرکز که داخل شعاع پوشش قرار گیرد
    const zones = this.db.all<{
      id: number;
      province_id: number;
      city_id: number | null;
      code: string;
      name_fa: string;
      zone_type: 'urban' | 'suburban' | 'highway' | 'industrial';
      status: GeographyStatus;
      center_lat: number;
      center_lng: number;
      radius_km: number;
      polygon_json: string | null;
      tariff_multiplier: number;
    }>('SELECT * FROM service_zones');

    const matchingZones = zones
      .map((z) => {
        const center = { lat: z.center_lat, lng: z.center_lng };
        const dist = haversineDistanceKm(point, center);
        let inZone = isPointWithinRadiusKm(point, center, z.radius_km);
        if (!inZone && z.polygon_json) {
          const poly = JSON.parse(z.polygon_json) as GeoPoint[];
          inZone = isPointInPolygon(point, poly);
        }
        return { zone: z, dist, inZone };
      })
      .filter((item) => item.inZone)
      .sort((a, b) => a.dist - b.dist);

    const bestZone = matchingZones[0]?.zone ?? null;

    let matchedProvince = bestZone
      ? provinces.find((p) => p.id === bestZone.province_id) ?? null
      : null;

    if (!matchedProvince) {
      for (const p of provinces) {
        const poly = JSON.parse(p.boundary_json) as GeoPoint[];
        if (isPointInPolygon(point, poly)) {
          matchedProvince = p;
          break;
        }
      }
    }

    if (!matchedProvince) {
      return {
        isActiveOperational: false,
        reasonCode: 'PROVINCE_NOT_COVERED',
        messageFa:
          'این موقعیت خارج از محدوده‌های تعریف‌شده است. سامانه «اورژانس خودرو» در حال حاضر صرفاً در استان قزوین فعال است.',
        matchedProvince: null,
        matchedZone: null,
      };
    }

    if (matchedProvince.status !== 'active') {
      return {
        isActiveOperational: false,
        reasonCode: 'PROVINCE_NOT_ACTIVE',
        messageFa: `استان «${matchedProvince.name_fa}» در وضعیت «${GEOGRAPHY_STATUS_LABELS[matchedProvince.status]}» قرار دارد و خدمات عملیاتی در آن فعال نشده است. در مرحله فعلی فقط استان قزوین عملیاتی است.`,
        matchedProvince: {
          id: matchedProvince.id,
          slug: matchedProvince.slug,
          nameFa: matchedProvince.name_fa,
          status: matchedProvince.status,
        },
        matchedZone: bestZone
          ? { id: bestZone.id, code: bestZone.code, nameFa: bestZone.name_fa, status: bestZone.status }
          : null,
      };
    }

    if (!bestZone) {
      return {
        isActiveOperational: false,
        reasonCode: 'NO_ZONE_IN_PROVINCE',
        messageFa: `این نقطه خارج از محدوده‌های پوشش فعال تعریف‌شده در استان ${matchedProvince.name_fa} است.`,
        matchedProvince: {
          id: matchedProvince.id,
          slug: matchedProvince.slug,
          nameFa: matchedProvince.name_fa,
          status: matchedProvince.status,
        },
        matchedZone: null,
      };
    }

    if (bestZone.status !== 'active') {
      return {
        isActiveOperational: false,
        reasonCode: 'ZONE_NOT_ACTIVE',
        messageFa: `محدوده «${bestZone.name_fa}» در حال حاضر در وضعیت «${GEOGRAPHY_STATUS_LABELS[bestZone.status]}» قرار دارد و امکان ثبت درخواست در آن وجود ندارد.`,
        matchedProvince: {
          id: matchedProvince.id,
          slug: matchedProvince.slug,
          nameFa: matchedProvince.name_fa,
          status: matchedProvince.status,
        },
        matchedZone: {
          id: bestZone.id,
          code: bestZone.code,
          nameFa: bestZone.name_fa,
          status: bestZone.status,
        },
      };
    }

    let cityRow: { id: number; name_fa: string; status: GeographyStatus } | undefined;
    if (bestZone.city_id) {
      cityRow = this.db.get(
        'SELECT id, name_fa, status FROM cities WHERE id = ?',
        bestZone.city_id
      );
      if (cityRow && cityRow.status !== 'active') {
        return {
          isActiveOperational: false,
          reasonCode: 'CITY_NOT_ACTIVE',
          messageFa: `شهر «${cityRow.name_fa}» در وضعیت «${GEOGRAPHY_STATUS_LABELS[cityRow.status]}» قرار دارد.`,
          matchedProvince: {
            id: matchedProvince.id,
            slug: matchedProvince.slug,
            nameFa: matchedProvince.name_fa,
            status: matchedProvince.status,
          },
          matchedZone: {
            id: bestZone.id,
            code: bestZone.code,
            nameFa: bestZone.name_fa,
            status: bestZone.status,
          },
        };
      }
    }

    return {
      isActiveOperational: true,
      reasonCode: 'ACTIVE',
      messageFa: `موقعیت در محدوده فعال «${bestZone.name_fa}» (${matchedProvince.name_fa}) قرار دارد.`,
      coverage: {
        provinceId: matchedProvince.id,
        provinceNameFa: matchedProvince.name_fa,
        provinceSlug: matchedProvince.slug,
        cityId: cityRow?.id ?? null,
        cityNameFa: cityRow?.name_fa ?? null,
        zoneId: bestZone.id,
        zoneCode: bestZone.code,
        zoneNameFa: bestZone.name_fa,
        zoneType: bestZone.zone_type,
        tariffMultiplier: bestZone.tariff_multiplier,
      } satisfies ResolvedOperationalCoverage,
    };
  }

  /**
   * گارد الزامی سرور برای ثبت درخواست واقعی — در صورت غیرفعال بودن استان/شهر/منطقه خطا می‌دهد.
   */
  requireActiveOperationalCoverage(point: GeoPoint): ResolvedOperationalCoverage {
    const check = this.inspectLocationCoverage(point);
    if (!check.isActiveOperational || !check.coverage) {
      throw new AppError(422, check.reasonCode, check.messageFa);
    }
    return check.coverage;
  }

  getOperationalReadinessReport() {
    const provinces = this.db.all<{
      id: number;
      slug: string;
      name_fa: string;
      status: GeographyStatus;
      min_required_responders: number;
      approved_by_admin_id: number | null;
      approved_at: string | null;
    }>('SELECT * FROM provinces ORDER BY id ASC');

    return provinces.map((p) => {
      const zones = this.db.all<{
        id: number;
        code: string;
        name_fa: string;
        status: GeographyStatus;
        target_responder_capacity: number;
      }>('SELECT id, code, name_fa, status, target_responder_capacity FROM service_zones WHERE province_id = ?', p.id);

      const zoneStats = zones.map((z) => {
        const responderCounts = this.db.get<{
          approved_total: number;
          online_total: number;
        }>(
          `SELECT
             COUNT(*) AS approved_total,
             SUM(CASE WHEN rp.availability_status = 'online' THEN 1 ELSE 0 END) AS online_total
           FROM responder_zones rz
           JOIN responder_profiles rp ON rp.id = rz.responder_id
           JOIN users u ON u.id = rp.user_id
           WHERE rz.zone_id = ? AND rp.verification_status = 'approved' AND u.is_active = 1`,
          z.id
        );
        const enabledServices = this.db.get<{ cnt: number }>(
          'SELECT COUNT(*) AS cnt FROM zone_services WHERE zone_id = ? AND is_enabled = 1',
          z.id
        );
        const approvedCount = Number(responderCounts?.approved_total ?? 0);
        const onlineCount = Number(responderCounts?.online_total ?? 0);
        return {
          zoneId: z.id,
          code: z.code,
          nameFa: z.name_fa,
          status: z.status,
          statusLabel: GEOGRAPHY_STATUS_LABELS[z.status],
          targetCapacity: z.target_responder_capacity,
          approvedResponders: approvedCount,
          onlineResponders: onlineCount,
          enabledServicesCount: Number(enabledServices?.cnt ?? 0),
          readinessPercent: Math.min(
            100,
            Math.round((approvedCount / Math.max(1, z.target_responder_capacity)) * 100)
          ),
        };
      });

      const totalApprovedInProvince = this.db.get<{ cnt: number }>(
        `SELECT COUNT(DISTINCT rp.id) AS cnt
         FROM responder_zones rz
         JOIN service_zones sz ON sz.id = rz.zone_id
         JOIN responder_profiles rp ON rp.id = rz.responder_id
         JOIN users u ON u.id = rp.user_id
         WHERE sz.province_id = ? AND rp.verification_status = 'approved' AND u.is_active = 1`,
        p.id
      );

      const approvedCount = Number(totalApprovedInProvince?.cnt ?? 0);
      const activeZonesCount = zoneStats.filter((z) => z.status === 'active').length;

      return {
        provinceId: p.id,
        slug: p.slug,
        nameFa: p.name_fa,
        status: p.status,
        statusLabel: GEOGRAPHY_STATUS_LABELS[p.status],
        minRequiredResponders: p.min_required_responders,
        approvedRespondersCount: approvedCount,
        activeZonesCount,
        isReadyForActivation:
          approvedCount >= p.min_required_responders && zones.length > 0,
        approvedAt: p.approved_at,
        zones: zoneStats,
      };
    });
  }

  /**
   * تغییر وضعیت استان — فعال‌سازی استان جدید منوط به تأیید صریح مدیر کل (admin) است.
   * تغییر وضعیت هرگز سوابق درخواست‌ها و مأموریت‌های قبلی را حذف نمی‌کند.
   */
  changeProvinceStatus(params: {
    provinceId: number;
    newStatus: GeographyStatus;
    reason: string;
    explicitAdminConfirmation: boolean;
    adminUserId: number;
    ipAddress?: string;
  }) {
    const province = this.db.get<{
      id: number;
      slug: string;
      name_fa: string;
      status: GeographyStatus;
    }>('SELECT id, slug, name_fa, status FROM provinces WHERE id = ?', params.provinceId);

    if (!province) {
      throw new AppError(404, 'PROVINCE_NOT_FOUND', 'استان موردنظر یافت نشد.');
    }

    if (params.newStatus === 'active' && !params.explicitAdminConfirmation) {
      throw new AppError(
        400,
        'ADMIN_EXPLICIT_CONFIRMATION_REQUIRED',
        'فعال‌سازی استان جدید نیازمند تأیید صریح مدیر کل (explicitAdminConfirmation = true) و ثبت علت است.'
      );
    }

    const now = new Date().toISOString();
    this.db.transaction(() => {
      if (params.newStatus === 'active') {
        this.db.run(
          `UPDATE provinces
           SET status = ?, approved_by_admin_id = ?, approved_at = ?, updated_at = ?
           WHERE id = ?`,
          params.newStatus,
          params.adminUserId,
          now,
          now,
          province.id
        );
      } else {
        this.db.run(
          `UPDATE provinces SET status = ?, updated_at = ? WHERE id = ?`,
          params.newStatus,
          now,
          province.id
        );
      }

      this.db.run(
        `INSERT INTO geography_status_history (
          entity_type, entity_id, previous_status, new_status, changed_by_user_id, reason, created_at
        ) VALUES ('province', ?, ?, ?, ?, ?, ?)`,
        province.id,
        province.status,
        params.newStatus,
        params.adminUserId,
        params.reason.trim(),
        now
      );

      this.audit.logAdminAction({
        actorUserId: params.adminUserId,
        actorRole: 'admin',
        action: 'PROVINCE_STATUS_CHANGED',
        entityType: 'province',
        entityId: province.id,
        summary: `تغییر وضعیت استان «${province.name_fa}» از ${province.status} به ${params.newStatus}`,
        metadata: {
          previousStatus: province.status,
          newStatus: params.newStatus,
          reason: params.reason.trim(),
        },
        ipAddress: params.ipAddress,
      });
    });

    return {
      provinceId: province.id,
      nameFa: province.name_fa,
      previousStatus: province.status,
      newStatus: params.newStatus,
    };
  }

  changeZoneStatus(params: {
    zoneId: number;
    newStatus: GeographyStatus;
    reason: string;
    targetResponderCapacity?: number;
    tariffMultiplier?: number;
    adminUserId: number;
    ipAddress?: string;
  }) {
    const zone = this.db.get<{
      id: number;
      code: string;
      name_fa: string;
      status: GeographyStatus;
      target_responder_capacity: number;
      tariff_multiplier: number;
    }>('SELECT * FROM service_zones WHERE id = ?', params.zoneId);

    if (!zone) {
      throw new AppError(404, 'ZONE_NOT_FOUND', 'منطقه خدماتی یافت نشد.');
    }

    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.run(
        `UPDATE service_zones
         SET status = ?, target_responder_capacity = ?, tariff_multiplier = ?, updated_at = ?
         WHERE id = ?`,
        params.newStatus,
        params.targetResponderCapacity ?? zone.target_responder_capacity,
        params.tariffMultiplier ?? zone.tariff_multiplier,
        now,
        zone.id
      );

      this.db.run(
        `INSERT INTO geography_status_history (
          entity_type, entity_id, previous_status, new_status, changed_by_user_id, reason, created_at
        ) VALUES ('zone', ?, ?, ?, ?, ?, ?)`,
        zone.id,
        zone.status,
        params.newStatus,
        params.adminUserId,
        params.reason.trim(),
        now
      );

      this.audit.logAdminAction({
        actorUserId: params.adminUserId,
        actorRole: 'admin',
        action: 'ZONE_UPDATED',
        entityType: 'service_zone',
        entityId: zone.id,
        summary: `به‌روزرسانی منطقه «${zone.name_fa}» (${zone.status} -> ${params.newStatus})`,
        metadata: params,
        ipAddress: params.ipAddress,
      });
    });

    return { zoneId: zone.id, newStatus: params.newStatus };
  }

  createZone(params: {
    provinceId: number;
    cityId?: number | null;
    code: string;
    nameFa: string;
    zoneType: 'urban' | 'suburban' | 'highway' | 'industrial';
    status: GeographyStatus;
    centerLat: number;
    centerLng: number;
    radiusKm: number;
    tariffMultiplier: number;
    targetResponderCapacity: number;
    adminUserId: number;
  }) {
    const now = new Date().toISOString();
    const zoneId = this.db.transaction(() => {
      const res = this.db.run(
        `INSERT INTO service_zones (
          province_id, city_id, code, name_fa, zone_type, status,
          center_lat, center_lng, radius_km, tariff_multiplier, target_responder_capacity,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        params.provinceId,
        params.cityId ?? null,
        params.code.trim().toUpperCase(),
        params.nameFa.trim(),
        params.zoneType,
        params.status,
        params.centerLat,
        params.centerLng,
        params.radiusKm,
        params.tariffMultiplier,
        params.targetResponderCapacity,
        now,
        now
      );

      this.db.run(
        `INSERT INTO zone_services (zone_id, service_id, is_enabled)
         SELECT ?, id, 1 FROM service_catalog`,
        res.lastInsertRowid
      );

      this.db.run(
        `INSERT INTO geography_status_history (
          entity_type, entity_id, previous_status, new_status, changed_by_user_id, reason, created_at
        ) VALUES ('zone', ?, 'none', ?, ?, 'ایجاد منطقه جدید توسط مدیر کل', ?)`,
        res.lastInsertRowid,
        params.status,
        params.adminUserId,
        now
      );

      return res.lastInsertRowid;
    });

    return { zoneId };
  }

  getHistory() {
    return this.db.all(
      `SELECT
         h.id, h.entity_type, h.entity_id, h.previous_status, h.new_status,
         h.reason, h.created_at, u.full_name AS admin_name, u.phone AS admin_phone
       FROM geography_status_history h
       JOIN users u ON u.id = h.changed_by_user_id
       ORDER BY h.created_at DESC
       LIMIT 100`
    );
  }
}
