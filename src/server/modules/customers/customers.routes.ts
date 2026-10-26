import { Router } from 'express';
import { z } from 'zod';
import type { CustomersService } from './customers.service.ts';
import type { AuditService } from '../audit/audit.service.ts';
import { asyncHandler, requireRole } from '../../middleware/auth.ts';
import { VEHICLE_CATEGORIES } from '../../../shared/constants.ts';

const addVehicleSchema = z.object({
  brand: z.string().min(2).max(60),
  model: z.string().min(1).max(80),
  manufactureYear: z.number().int().min(1350).max(2030),
  plateNumber: z.string().min(5).max(40),
  category: z.enum(VEHICLE_CATEGORIES),
  color: z.string().max(40).optional(),
  notes: z.string().max(250).optional(),
});

export function createCustomersRouter(params: {
  customersService: CustomersService;
  auditService: AuditService;
}) {
  const router = Router();
  const customerGuard = requireRole(
    params.auditService,
    'customer',
    'admin'
  );

  router.get(
    '/vehicles',
    customerGuard,
    asyncHandler((req, res) => {
      res.json({
        ok: true,
        vehicles: params.customersService.listVehicles(req.user!.id),
      });
    })
  );

  router.post(
    '/vehicles',
    customerGuard,
    asyncHandler((req, res) => {
      const body = addVehicleSchema.parse(req.body);
      const vehicle = params.customersService.addVehicle({
        customerUserId: req.user!.id,
        ...body,
      });
      res.status(201).json({ ok: true, vehicle });
    })
  );

  router.delete(
    '/vehicles/:id',
    customerGuard,
    asyncHandler((req, res) => {
      params.customersService.deactivateVehicle(
        req.user!.id,
        Number(req.params.id)
      );
      res.json({ ok: true });
    })
  );

  return router;
}
