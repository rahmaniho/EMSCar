import { Router } from 'express';
import { z } from 'zod';
import type { PricingService } from './pricing.service.ts';
import type { AuditService } from '../audit/audit.service.ts';
import { asyncHandler, requireRole } from '../../middleware/auth.ts';
import { VEHICLE_CATEGORIES } from '../../../shared/constants.ts';

const quoteSchema = z.object({
  serviceId: z.number().int().positive(),
  originLat: z.number().min(24).max(40),
  originLng: z.number().min(44).max(64),
  destinationLat: z.number().min(24).max(40).nullable().optional(),
  destinationLng: z.number().min(44).max(64).nullable().optional(),
  vehicleCategory: z.enum(VEHICLE_CATEGORIES),
  isUrgent: z.boolean().default(false),
  discountCode: z.string().max(40).optional(),
});

const updateRulesSchema = z.object({
  domesticMultiplier: z.number().min(0.5).max(5).optional(),
  foreignMultiplier: z.number().min(0.5).max(5).optional(),
  electricMultiplier: z.number().min(0.5).max(5).optional(),
  suvHeavyMultiplier: z.number().min(0.5).max(5).optional(),
  urgentNightMultiplier: z.number().min(1).max(5).optional(),
  nightStartHour: z.number().int().min(0).max(23).optional(),
  nightEndHour: z.number().int().min(0).max(23).optional(),
  taxRatePercent: z.number().min(0).max(30).optional(),
  platformCommissionPercent: z.number().min(0).max(60).optional(),
  priceApprovalThresholdPercent: z.number().min(0).max(100).optional(),
});

const createDiscountSchema = z.object({
  code: z.string().min(3).max(30),
  titleFa: z.string().min(3).max(200),
  percentOff: z.number().min(0).max(100).default(0),
  fixedTomanOff: z.number().int().min(0).max(10000000).default(0),
  maxDiscountToman: z.number().int().min(0).max(10000000).default(200000),
  usageLimit: z.number().int().min(1).max(1000000).default(500),
  expiresAt: z.string().optional(),
});

export function createPricingRouter(params: {
  pricingService: PricingService;
  auditService: AuditService;
}) {
  const router = Router();
  const adminOnly = requireRole(params.auditService, 'admin');

  router.post(
    '/quote',
    asyncHandler((req, res) => {
      const body = quoteSchema.parse(req.body);
      const destination =
        body.destinationLat !== undefined &&
        body.destinationLat !== null &&
        body.destinationLng !== undefined &&
        body.destinationLng !== null
          ? { lat: body.destinationLat, lng: body.destinationLng }
          : null;

      const quote = params.pricingService.calculateQuote({
        serviceId: body.serviceId,
        origin: { lat: body.originLat, lng: body.originLng },
        destination,
        vehicleCategory: body.vehicleCategory,
        isUrgent: body.isUrgent,
        discountCode: body.discountCode,
      });

      res.json({ ok: true, quote });
    })
  );

  router.get(
    '/admin/rules',
    adminOnly,
    asyncHandler((_req, res) => {
      res.json({
        ok: true,
        rules: params.pricingService.getRules(),
        discounts: params.pricingService.listDiscountCodes(),
      });
    })
  );

  router.patch(
    '/admin/rules',
    adminOnly,
    asyncHandler((req, res) => {
      const body = updateRulesSchema.parse(req.body);
      const updated = params.pricingService.updateRules(body, req.user!.id);
      res.json({ ok: true, rules: updated });
    })
  );

  router.post(
    '/admin/discounts',
    adminOnly,
    asyncHandler((req, res) => {
      const body = createDiscountSchema.parse(req.body);
      const created = params.pricingService.createDiscountCode({
        ...body,
        adminUserId: req.user!.id,
      });
      res.status(201).json({ ok: true, discount: created });
    })
  );

  return router;
}
