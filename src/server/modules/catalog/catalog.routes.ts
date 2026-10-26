import { Router } from 'express';
import { z } from 'zod';
import type { CatalogService } from './catalog.service.ts';
import type { AuditService } from '../audit/audit.service.ts';
import { asyncHandler, requireRole } from '../../middleware/auth.ts';
import {
  SERVICE_CATEGORIES,
  EQUIPMENT_TYPES,
  VEHICLE_CATEGORIES,
} from '../../../shared/constants.ts';

const createServiceSchema = z.object({
  slug: z.string().min(3).max(80),
  titleFa: z.string().min(3).max(120),
  category: z.enum(SERVICE_CATEGORIES),
  descriptionFa: z.string().min(10).max(1000),
  termsFa: z.string().min(5).max(1000),
  basePriceToman: z.number().int().min(0).max(50000000),
  includedFreeKm: z.number().min(0).max(100).default(5),
  perKmDispatchToman: z.number().int().min(0).max(500000).default(15000),
  perKmTowToman: z.number().int().min(0).max(500000).default(0),
  requiresDestination: z.boolean().default(false),
  requiresOwnershipProof: z.boolean().default(false),
  requiredEquipment: z.array(z.enum(EQUIPMENT_TYPES)).default(['service_van']),
  requiresEvCertification: z.boolean().default(false),
  supportedVehicleCategories: z
    .array(z.enum(VEHICLE_CATEGORIES))
    .default(['domestic', 'foreign', 'electric', 'suv_heavy']),
  enrouteCancelFeeToman: z.number().int().min(0).max(5000000).default(100000),
  estimatedDurationMin: z.number().int().min(5).max(360).default(30),
  isPublished: z.boolean().default(true),
});

const updateServiceSchema = createServiceSchema.partial();

const zoneServiceConfigSchema = z.object({
  isEnabled: z.boolean(),
  customBasePriceToman: z.number().int().min(0).max(50000000).nullable().default(null),
});

export function createCatalogRouter(params: {
  catalogService: CatalogService;
  auditService: AuditService;
}) {
  const router = Router();
  const adminOnly = requireRole(params.auditService, 'admin');

  router.get(
    '/services',
    asyncHandler((req, res) => {
      const zoneId = req.query.zoneId ? Number(req.query.zoneId) : undefined;
      res.json({
        ok: true,
        services: params.catalogService.listPublishedServices(zoneId),
      });
    })
  );

  router.get(
    '/admin/services',
    adminOnly,
    asyncHandler((_req, res) => {
      res.json({
        ok: true,
        services: params.catalogService.listAllServicesForAdmin(),
        auditLogs: params.catalogService.getServiceAuditLogs(),
      });
    })
  );

  router.post(
    '/admin/services',
    adminOnly,
    asyncHandler((req, res) => {
      const body = createServiceSchema.parse(req.body);
      const created = params.catalogService.createService({
        ...body,
        adminUserId: req.user!.id,
      });
      res.status(201).json({ ok: true, service: created });
    })
  );

  router.patch(
    '/admin/services/:id',
    adminOnly,
    asyncHandler((req, res) => {
      const body = updateServiceSchema.parse(req.body);
      const updated = params.catalogService.updateService(
        Number(req.params.id),
        body,
        req.user!.id
      );
      res.json({ ok: true, service: updated });
    })
  );

  router.put(
    '/admin/zones/:zoneId/services/:serviceId',
    adminOnly,
    asyncHandler((req, res) => {
      const body = zoneServiceConfigSchema.parse(req.body);
      params.catalogService.configureZoneService({
        zoneId: Number(req.params.zoneId),
        serviceId: Number(req.params.serviceId),
        isEnabled: body.isEnabled,
        customBasePriceToman: body.customBasePriceToman,
        adminUserId: req.user!.id,
      });
      res.json({ ok: true });
    })
  );

  return router;
}
