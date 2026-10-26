import type { AppDatabase } from '../../db/connection.ts';
import type { AuditService } from '../audit/audit.service.ts';
import { AppError } from '../../middleware/error-handler.ts';
import {
  SERVICE_CATEGORY_LABELS,
  type ServiceCategory,
  type EquipmentType,
  type VehicleCategory,
} from '../../../shared/constants.ts';

interface RawServiceRow {
  id: number;
  slug: string;
  title_fa: string;
  category: ServiceCategory;
  description_fa: string;
  terms_fa: string;
  base_price_toman: number;
  included_free_km: number;
  per_km_dispatch_toman: number;
  per_km_tow_toman: number;
  requires_destination: number;
  requires_ownership_proof: number;
  required_equipment_json: string;
  requires_ev_certification: number;
  supported_vehicle_categories_json: string;
  free_cancel_before_enroute: number;
  enroute_cancel_fee_toman: number;
  estimated_duration_min: number;
  is_published: number;
  created_at: string;
  updated_at: string;
}

export class CatalogService {
  private readonly db: AppDatabase;
  private readonly audit: AuditService;

  constructor(params: { db: AppDatabase; audit: AuditService }) {
    this.db = params.db;
    this.audit = params.audit;
  }

  private mapService(row: RawServiceRow) {
    return {
      id: row.id,
      slug: row.slug,
      titleFa: row.title_fa,
      category: row.category,
      categoryLabel: SERVICE_CATEGORY_LABELS[row.category] ?? row.category,
      descriptionFa: row.description_fa,
      termsFa: row.terms_fa,
      basePriceToman: row.base_price_toman,
      includedFreeKm: row.included_free_km,
      perKmDispatchToman: row.per_km_dispatch_toman,
      perKmTowToman: row.per_km_tow_toman,
      requiresDestination: row.requires_destination === 1,
      requiresOwnershipProof: row.requires_ownership_proof === 1,
      requiredEquipment: JSON.parse(row.required_equipment_json) as EquipmentType[],
      requiresEvCertification: row.requires_ev_certification === 1,
      supportedVehicleCategories: JSON.parse(
        row.supported_vehicle_categories_json
      ) as VehicleCategory[],
      freeCancelBeforeEnroute: row.free_cancel_before_enroute === 1,
      enrouteCancelFeeToman: row.enroute_cancel_fee_toman,
      estimatedDurationMin: row.estimated_duration_min,
      isPublished: row.is_published === 1,
      updatedAt: row.updated_at,
    };
  }

  listPublishedServices(zoneId?: number) {
    if (zoneId) {
      const rows = this.db.all<RawServiceRow & { custom_base_price_toman: number | null }>(
        `SELECT s.*, zs.custom_base_price_toman
         FROM service_catalog s
         JOIN zone_services zs ON zs.service_id = s.id
         WHERE s.is_published = 1 AND zs.zone_id = ? AND zs.is_enabled = 1
         ORDER BY s.id ASC`,
        zoneId
      );
      return rows.map((r) => {
        const mapped = this.mapService(r);
        if (r.custom_base_price_toman !== null) {
          mapped.basePriceToman = r.custom_base_price_toman;
        }
        return mapped;
      });
    }

    const rows = this.db.all<RawServiceRow>(
      'SELECT * FROM service_catalog WHERE is_published = 1 ORDER BY id ASC'
    );
    return rows.map((r) => this.mapService(r));
  }

  listAllServicesForAdmin() {
    const rows = this.db.all<RawServiceRow>(
      'SELECT * FROM service_catalog ORDER BY id ASC'
    );
    return rows.map((r) => this.mapService(r));
  }

  getServiceById(serviceId: number, zoneId?: number) {
    const row = this.db.get<RawServiceRow>(
      'SELECT * FROM service_catalog WHERE id = ?',
      serviceId
    );
    if (!row) {
      throw new AppError(404, 'SERVICE_NOT_FOUND', 'خدمت انتخاب‌شده یافت نشد.');
    }
    const mapped = this.mapService(row);
    if (zoneId) {
      const zs = this.db.get<{
        is_enabled: number;
        custom_base_price_toman: number | null;
      }>(
        'SELECT is_enabled, custom_base_price_toman FROM zone_services WHERE zone_id = ? AND service_id = ?',
        zoneId,
        serviceId
      );
      if (!zs || zs.is_enabled !== 1) {
        throw new AppError(
          422,
          'SERVICE_DISABLED_IN_ZONE',
          `خدمت «${mapped.titleFa}» در محدوده جغرافیایی انتخابی فعال نیست.`
        );
      }
      if (zs.custom_base_price_toman !== null) {
        mapped.basePriceToman = zs.custom_base_price_toman;
      }
    }
    return mapped;
  }

  createService(params: {
    slug: string;
    titleFa: string;
    category: ServiceCategory;
    descriptionFa: string;
    termsFa: string;
    basePriceToman: number;
    includedFreeKm: number;
    perKmDispatchToman: number;
    perKmTowToman: number;
    requiresDestination: boolean;
    requiresOwnershipProof: boolean;
    requiredEquipment: EquipmentType[];
    requiresEvCertification: boolean;
    supportedVehicleCategories: VehicleCategory[];
    enrouteCancelFeeToman: number;
    estimatedDurationMin: number;
    isPublished: boolean;
    adminUserId: number;
  }) {
    const now = new Date().toISOString();
    const id = this.db.transaction(() => {
      const res = this.db.run(
        `INSERT INTO service_catalog (
          slug, title_fa, category, description_fa, terms_fa,
          base_price_toman, included_free_km, per_km_dispatch_toman, per_km_tow_toman,
          requires_destination, requires_ownership_proof, required_equipment_json,
          requires_ev_certification, supported_vehicle_categories_json,
          free_cancel_before_enroute, enroute_cancel_fee_toman, estimated_duration_min,
          is_published, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
        params.slug.trim().toLowerCase(),
        params.titleFa.trim(),
        params.category,
        params.descriptionFa.trim(),
        params.termsFa.trim(),
        Math.round(params.basePriceToman),
        params.includedFreeKm,
        Math.round(params.perKmDispatchToman),
        Math.round(params.perKmTowToman),
        params.requiresDestination ? 1 : 0,
        params.requiresOwnershipProof ? 1 : 0,
        JSON.stringify(params.requiredEquipment),
        params.requiresEvCertification ? 1 : 0,
        JSON.stringify(params.supportedVehicleCategories),
        Math.round(params.enrouteCancelFeeToman),
        params.estimatedDurationMin,
        params.isPublished ? 1 : 0,
        now,
        now
      );

      this.db.run(
        `INSERT INTO zone_services (zone_id, service_id, is_enabled)
         SELECT id, ?, 1 FROM service_zones`,
        res.lastInsertRowid
      );

      this.db.run(
        `INSERT INTO service_audit_logs (service_id, changed_by_user_id, change_summary, after_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        res.lastInsertRowid,
        params.adminUserId,
        `ایجاد خدمت جدید «${params.titleFa}»`,
        JSON.stringify(params),
        now
      );

      this.audit.logAdminAction({
        actorUserId: params.adminUserId,
        actorRole: 'admin',
        action: 'SERVICE_CREATED',
        entityType: 'service_catalog',
        entityId: res.lastInsertRowid,
        summary: `ایجاد خدمت «${params.titleFa}» با تعرفه پایه ${params.basePriceToman} تومان`,
      });

      return res.lastInsertRowid;
    });

    return this.getServiceById(id);
  }

  updateService(
    serviceId: number,
    updates: Partial<{
      titleFa: string;
      descriptionFa: string;
      termsFa: string;
      basePriceToman: number;
      includedFreeKm: number;
      perKmDispatchToman: number;
      perKmTowToman: number;
      enrouteCancelFeeToman: number;
      estimatedDurationMin: number;
      isPublished: boolean;
      requiredEquipment: EquipmentType[];
      supportedVehicleCategories: VehicleCategory[];
    }>,
    adminUserId: number
  ) {
    const before = this.getServiceById(serviceId);
    const now = new Date().toISOString();

    this.db.transaction(() => {
      this.db.run(
        `UPDATE service_catalog
         SET title_fa = ?,
             description_fa = ?,
             terms_fa = ?,
             base_price_toman = ?,
             included_free_km = ?,
             per_km_dispatch_toman = ?,
             per_km_tow_toman = ?,
             enroute_cancel_fee_toman = ?,
             estimated_duration_min = ?,
             is_published = ?,
             required_equipment_json = ?,
             supported_vehicle_categories_json = ?,
             updated_at = ?
         WHERE id = ?`,
        updates.titleFa?.trim() ?? before.titleFa,
        updates.descriptionFa?.trim() ?? before.descriptionFa,
        updates.termsFa?.trim() ?? before.termsFa,
        updates.basePriceToman !== undefined
          ? Math.round(updates.basePriceToman)
          : before.basePriceToman,
        updates.includedFreeKm ?? before.includedFreeKm,
        updates.perKmDispatchToman !== undefined
          ? Math.round(updates.perKmDispatchToman)
          : before.perKmDispatchToman,
        updates.perKmTowToman !== undefined
          ? Math.round(updates.perKmTowToman)
          : before.perKmTowToman,
        updates.enrouteCancelFeeToman !== undefined
          ? Math.round(updates.enrouteCancelFeeToman)
          : before.enrouteCancelFeeToman,
        updates.estimatedDurationMin ?? before.estimatedDurationMin,
        updates.isPublished !== undefined
          ? updates.isPublished
            ? 1
            : 0
          : before.isPublished
            ? 1
            : 0,
        JSON.stringify(updates.requiredEquipment ?? before.requiredEquipment),
        JSON.stringify(
          updates.supportedVehicleCategories ?? before.supportedVehicleCategories
        ),
        now,
        serviceId
      );

      const after = this.getServiceById(serviceId);
      this.db.run(
        `INSERT INTO service_audit_logs (
          service_id, changed_by_user_id, change_summary, before_json, after_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        serviceId,
        adminUserId,
        `ویرایش مشخصات/تعرفه خدمت «${after.titleFa}»`,
        JSON.stringify(before),
        JSON.stringify(after),
        now
      );

      this.audit.logAdminAction({
        actorUserId: adminUserId,
        actorRole: 'admin',
        action: 'SERVICE_UPDATED',
        entityType: 'service_catalog',
        entityId: serviceId,
        summary: `ویرایش خدمت «${after.titleFa}»`,
        metadata: { beforePrice: before.basePriceToman, afterPrice: after.basePriceToman },
      });
    });

    return this.getServiceById(serviceId);
  }

  configureZoneService(params: {
    zoneId: number;
    serviceId: number;
    isEnabled: boolean;
    customBasePriceToman: number | null;
    adminUserId: number;
  }) {
    this.db.run(
      `INSERT INTO zone_services (zone_id, service_id, is_enabled, custom_base_price_toman)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(zone_id, service_id) DO UPDATE SET
         is_enabled = excluded.is_enabled,
         custom_base_price_toman = excluded.custom_base_price_toman`,
      params.zoneId,
      params.serviceId,
      params.isEnabled ? 1 : 0,
      params.customBasePriceToman !== null ? Math.round(params.customBasePriceToman) : null
    );
    this.audit.logAdminAction({
      actorUserId: params.adminUserId,
      actorRole: 'admin',
      action: 'ZONE_SERVICE_CONFIGURED',
      entityType: 'zone_services',
      entityId: `${params.zoneId}:${params.serviceId}`,
      summary: `تنظیم وضعیت خدمت ${params.serviceId} در منطقه ${params.zoneId}`,
    });
  }

  getServiceAuditLogs() {
    return this.db.all(
      `SELECT l.id, l.service_id, s.title_fa, l.change_summary, l.created_at, u.full_name AS admin_name
       FROM service_audit_logs l
       JOIN service_catalog s ON s.id = l.service_id
       JOIN users u ON u.id = l.changed_by_user_id
       ORDER BY l.created_at DESC
       LIMIT 100`
    );
  }
}
