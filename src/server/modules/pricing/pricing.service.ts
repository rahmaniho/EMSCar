import type { AppDatabase } from '../../db/connection.ts';
import type { AuditService } from '../audit/audit.service.ts';
import type { CatalogService } from '../catalog/catalog.service.ts';
import type { GeographyService } from '../geography/geography.service.ts';
import { AppError } from '../../middleware/error-handler.ts';
import {
  calculateOfficialPrice,
  type PriceBreakdown,
} from '../../../shared/pricing-formula.ts';
import {
  estimateRoadDistanceKm,
  type GeoPoint,
} from '../../../shared/geo-utils.ts';
import type { VehicleCategory } from '../../../shared/constants.ts';

export interface PricingRulesRecord {
  domesticMultiplier: number;
  foreignMultiplier: number;
  electricMultiplier: number;
  suvHeavyMultiplier: number;
  urgentNightMultiplier: number;
  nightStartHour: number;
  nightEndHour: number;
  taxRatePercent: number;
  platformCommissionPercent: number;
  priceApprovalThresholdPercent: number;
}

export class PricingService {
  private readonly db: AppDatabase;
  private readonly audit: AuditService;
  private readonly catalog: CatalogService;
  private readonly geography: GeographyService;

  constructor(params: {
    db: AppDatabase;
    audit: AuditService;
    catalog: CatalogService;
    geography: GeographyService;
  }) {
    this.db = params.db;
    this.audit = params.audit;
    this.catalog = params.catalog;
    this.geography = params.geography;
  }

  getRules(): PricingRulesRecord {
    const row = this.db.get<{
      domestic_multiplier: number;
      foreign_multiplier: number;
      electric_multiplier: number;
      suv_heavy_multiplier: number;
      urgent_night_multiplier: number;
      night_start_hour: number;
      night_end_hour: number;
      tax_rate_percent: number;
      platform_commission_percent: number;
      price_approval_threshold_percent: number;
    }>('SELECT * FROM pricing_rules WHERE id = 1');

    if (!row) {
      return {
        domesticMultiplier: 1.0,
        foreignMultiplier: 1.25,
        electricMultiplier: 1.35,
        suvHeavyMultiplier: 1.2,
        urgentNightMultiplier: 1.2,
        nightStartHour: 22,
        nightEndHour: 6,
        taxRatePercent: 10,
        platformCommissionPercent: 15,
        priceApprovalThresholdPercent: 10,
      };
    }

    return {
      domesticMultiplier: row.domestic_multiplier,
      foreignMultiplier: row.foreign_multiplier,
      electricMultiplier: row.electric_multiplier,
      suvHeavyMultiplier: row.suv_heavy_multiplier,
      urgentNightMultiplier: row.urgent_night_multiplier,
      nightStartHour: row.night_start_hour,
      nightEndHour: row.night_end_hour,
      taxRatePercent: row.tax_rate_percent,
      platformCommissionPercent: row.platform_commission_percent,
      priceApprovalThresholdPercent: row.price_approval_threshold_percent,
    };
  }

  private isNightHourInIran(atDate = new Date(), startHour = 22, endHour = 6): boolean {
    try {
      const tehranHourStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Tehran',
        hour: 'numeric',
        hour12: false,
      }).format(atDate);
      const hour = Number(tehranHourStr) % 24;
      if (startHour > endHour) {
        return hour >= startHour || hour < endHour;
      }
      return hour >= startHour && hour < endHour;
    } catch {
      return false;
    }
  }

  resolveDiscountCode(rawCode?: string) {
    if (!rawCode || !rawCode.trim()) return null;
    const code = rawCode.trim().toUpperCase();
    const row = this.db.get<{
      id: number;
      code: string;
      title_fa: string;
      percent_off: number;
      fixed_toman_off: number;
      max_discount_toman: number;
      usage_limit: number;
      used_count: number;
      is_active: number;
      expires_at: string | null;
    }>('SELECT * FROM discount_codes WHERE code = ?', code);

    if (!row || row.is_active !== 1) {
      throw new AppError(400, 'INVALID_DISCOUNT_CODE', 'کد تخفیف واردشده معتبر یا فعال نیست.');
    }
    if (row.used_count >= row.usage_limit) {
      throw new AppError(400, 'DISCOUNT_LIMIT_REACHED', 'ظرفیت استفاده از این کد تخفیف تکمیل شده است.');
    }
    if (row.expires_at && row.expires_at < new Date().toISOString()) {
      throw new AppError(400, 'DISCOUNT_EXPIRED', 'مهلت استفاده از این کد تخفیف به پایان رسیده است.');
    }
    return row;
  }

  calculateQuote(params: {
    serviceId: number;
    origin: GeoPoint;
    destination?: GeoPoint | null;
    vehicleCategory: VehicleCategory;
    isUrgent?: boolean;
    discountCode?: string;
    estimatedDispatchKmOverride?: number;
    partsCostToman?: number;
    atDate?: Date;
  }): {
    breakdown: PriceBreakdown;
    coverage: ReturnType<GeographyService['requireActiveOperationalCoverage']>;
    towDistanceKm: number;
    estimatedDispatchKm: number;
    appliedDiscountCode: string | null;
  } {
    const coverage = this.geography.requireActiveOperationalCoverage(params.origin);
    const service = this.catalog.getServiceById(params.serviceId, coverage.zoneId);

    if (!service.supportedVehicleCategories.includes(params.vehicleCategory)) {
      throw new AppError(
        422,
        'UNSUPPORTED_VEHICLE_CATEGORY',
        `خدمت «${service.titleFa}» برای دسته خودروی انتخابی تعریف نشده است.`
      );
    }

    if (service.requiresDestination && !params.destination) {
      throw new AppError(
        400,
        'DESTINATION_REQUIRED',
        `برای خدمت «${service.titleFa}» تعیین مقصد حمل خودرو روی نقشه یا آدرس الزامی است.`
      );
    }

    const towDistanceKm =
      service.requiresDestination && params.destination
        ? estimateRoadDistanceKm(params.origin, params.destination)
        : 0;

    const estimatedDispatchKm =
      params.estimatedDispatchKmOverride ?? service.includedFreeKm;

    const rules = this.getRules();
    const isNight = this.isNightHourInIran(
      params.atDate,
      rules.nightStartHour,
      rules.nightEndHour
    );
    const discount = this.resolveDiscountCode(params.discountCode);

    const breakdown = calculateOfficialPrice({
      basePriceToman: service.basePriceToman,
      dispatchDistanceKm: estimatedDispatchKm,
      includedFreeDispatchKm: service.includedFreeKm,
      perKmDispatchToman: service.perKmDispatchToman,
      towDistanceKm,
      perKmTowToman: service.perKmTowToman,
      vehicleCategory: params.vehicleCategory,
      vehicleMultipliers: {
        domestic: rules.domesticMultiplier,
        foreign: rules.foreignMultiplier,
        electric: rules.electricMultiplier,
        suv_heavy: rules.suvHeavyMultiplier,
      },
      zoneMultiplier: coverage.tariffMultiplier,
      isUrgentOrNight: Boolean(params.isUrgent) || isNight,
      urgentNightMultiplier: rules.urgentNightMultiplier,
      partsCostToman: params.partsCostToman ?? 0,
      discountPercent: discount?.percent_off,
      discountFixedToman: discount?.fixed_toman_off,
      maxDiscountToman: discount?.max_discount_toman,
      taxRatePercent: rules.taxRatePercent,
    });

    return {
      breakdown,
      coverage,
      towDistanceKm,
      estimatedDispatchKm,
      appliedDiscountCode: discount?.code ?? null,
    };
  }

  updateRules(updates: Partial<PricingRulesRecord>, adminUserId: number) {
    const current = this.getRules();
    const next = { ...current, ...updates };
    const now = new Date().toISOString();

    this.db.run(
      `UPDATE pricing_rules
       SET domestic_multiplier = ?,
           foreign_multiplier = ?,
           electric_multiplier = ?,
           suv_heavy_multiplier = ?,
           urgent_night_multiplier = ?,
           night_start_hour = ?,
           night_end_hour = ?,
           tax_rate_percent = ?,
           platform_commission_percent = ?,
           price_approval_threshold_percent = ?,
           updated_by_user_id = ?,
           updated_at = ?
       WHERE id = 1`,
      next.domesticMultiplier,
      next.foreignMultiplier,
      next.electricMultiplier,
      next.suvHeavyMultiplier,
      next.urgentNightMultiplier,
      next.nightStartHour,
      next.nightEndHour,
      next.taxRatePercent,
      next.platformCommissionPercent,
      next.priceApprovalThresholdPercent,
      adminUserId,
      now
    );

    this.audit.logAdminAction({
      actorUserId: adminUserId,
      actorRole: 'admin',
      action: 'PRICING_RULES_UPDATED',
      entityType: 'pricing_rules',
      entityId: 1,
      summary: 'به‌روزرسانی ضرایب و قوانین قیمت‌گذاری سامانه',
      metadata: { before: current, after: next },
    });

    return this.getRules();
  }

  listDiscountCodes() {
    return this.db.all('SELECT * FROM discount_codes ORDER BY id DESC');
  }

  createDiscountCode(params: {
    code: string;
    titleFa: string;
    percentOff: number;
    fixedTomanOff: number;
    maxDiscountToman: number;
    usageLimit: number;
    expiresAt?: string;
    adminUserId: number;
  }) {
    const code = params.code.trim().toUpperCase();
    const res = this.db.run(
      `INSERT INTO discount_codes (
        code, title_fa, percent_off, fixed_toman_off, max_discount_toman, usage_limit, used_count, is_active, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`,
      code,
      params.titleFa.trim(),
      params.percentOff,
      Math.round(params.fixedTomanOff),
      Math.round(params.maxDiscountToman),
      params.usageLimit,
      params.expiresAt ?? null,
      new Date().toISOString()
    );
    this.audit.logAdminAction({
      actorUserId: params.adminUserId,
      actorRole: 'admin',
      action: 'DISCOUNT_CREATED',
      entityType: 'discount_code',
      entityId: res.lastInsertRowid,
      summary: `ایجاد کد تخفیف ${code}`,
    });
    return { id: res.lastInsertRowid, code };
  }
}
