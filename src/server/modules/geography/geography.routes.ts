import { Router } from 'express';
import { z } from 'zod';
import type { GeographyService } from './geography.service.ts';
import type { AuditService } from '../audit/audit.service.ts';
import { asyncHandler, requireRole } from '../../middleware/auth.ts';
import { GEOGRAPHY_STATUSES } from '../../../shared/constants.ts';

const checkPointSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

const changeProvinceStatusSchema = z.object({
  status: z.enum(GEOGRAPHY_STATUSES),
  reason: z.string().min(5, 'ثبت دلیل تغییر وضعیت استان الزامی است').max(500),
  explicitAdminConfirmation: z.boolean().default(false),
});

const changeZoneStatusSchema = z.object({
  status: z.enum(GEOGRAPHY_STATUSES),
  reason: z.string().min(3, 'ثبت دلیل تغییر وضعیت منطقه الزامی است').max(500),
  targetResponderCapacity: z.number().int().min(1).max(200).optional(),
  tariffMultiplier: z.number().min(0.5).max(5).optional(),
});

const createZoneSchema = z.object({
  provinceId: z.number().int().positive(),
  cityId: z.number().int().positive().nullable().optional(),
  code: z.string().min(3).max(32),
  nameFa: z.string().min(3).max(150),
  zoneType: z.enum(['urban', 'suburban', 'highway', 'industrial']).default('urban'),
  status: z.enum(GEOGRAPHY_STATUSES).default('preparing'),
  centerLat: z.number().min(24).max(40),
  centerLng: z.number().min(44).max(64),
  radiusKm: z.number().min(1).max(120).default(15),
  tariffMultiplier: z.number().min(0.5).max(5).default(1.0),
  targetResponderCapacity: z.number().int().min(1).max(200).default(3),
});

export function createGeographyRouter(params: {
  geographyService: GeographyService;
  auditService: AuditService;
}) {
  const router = Router();
  const adminOnly = requireRole(params.auditService, 'admin');
  const staffOnly = requireRole(params.auditService, 'admin', 'operator');

  router.get(
    '/overview',
    asyncHandler((_req, res) => {
      res.json({ ok: true, ...params.geographyService.getPublicOverview() });
    })
  );

  router.get(
    '/check-point',
    asyncHandler((req, res) => {
      const point = checkPointSchema.parse(req.query);
      const coverage = params.geographyService.inspectLocationCoverage(point);
      res.json({ ok: true, ...coverage });
    })
  );

  router.get(
    '/admin/readiness',
    staffOnly,
    asyncHandler((_req, res) => {
      res.json({
        ok: true,
        readiness: params.geographyService.getOperationalReadinessReport(),
      });
    })
  );

  router.get(
    '/admin/history',
    adminOnly,
    asyncHandler((_req, res) => {
      res.json({ ok: true, history: params.geographyService.getHistory() });
    })
  );

  router.post(
    '/admin/provinces/:id/status',
    adminOnly,
    asyncHandler((req, res) => {
      const body = changeProvinceStatusSchema.parse(req.body);
      const result = params.geographyService.changeProvinceStatus({
        provinceId: Number(req.params.id),
        newStatus: body.status,
        reason: body.reason,
        explicitAdminConfirmation: body.explicitAdminConfirmation,
        adminUserId: req.user!.id,
        ipAddress: req.ip,
      });
      res.json({ ok: true, result });
    })
  );

  router.patch(
    '/admin/zones/:id/status',
    adminOnly,
    asyncHandler((req, res) => {
      const body = changeZoneStatusSchema.parse(req.body);
      const result = params.geographyService.changeZoneStatus({
        zoneId: Number(req.params.id),
        newStatus: body.status,
        reason: body.reason,
        targetResponderCapacity: body.targetResponderCapacity,
        tariffMultiplier: body.tariffMultiplier,
        adminUserId: req.user!.id,
        ipAddress: req.ip,
      });
      res.json({ ok: true, result });
    })
  );

  router.post(
    '/admin/zones',
    adminOnly,
    asyncHandler((req, res) => {
      const body = createZoneSchema.parse(req.body);
      const result = params.geographyService.createZone({
        ...body,
        adminUserId: req.user!.id,
      });
      res.status(201).json({ ok: true, ...result });
    })
  );

  return router;
}
