import { Router } from 'express';
import { z } from 'zod';
import type { RespondersService } from './responders.service.ts';
import type { AuditService } from '../audit/audit.service.ts';
import { asyncHandler, requireRole } from '../../middleware/auth.ts';
import { EQUIPMENT_TYPES } from '../../../shared/constants.ts';

const updateProfileSchema = z.object({
  equipmentType: z.enum(EQUIPMENT_TYPES).optional(),
  vehiclePlate: z.string().max(40).optional(),
  shebaNumber: z.string().max(30).optional(),
  maxDispatchRadiusKm: z.number().min(3).max(120).optional(),
});

const submitDocSchema = z.object({
  docType: z.enum([
    'national_card',
    'driving_license',
    'technical_skill_cert',
    'tow_permit',
    'background_clearance',
    'ev_high_voltage_cert',
  ]),
  docNumber: z.string().min(3).max(60),
});

const specialtiesSchema = z.object({
  serviceIds: z.array(z.number().int().positive()),
  zoneIds: z.array(z.number().int().positive()),
});

const availabilitySchema = z.object({
  status: z.enum(['online', 'offline']),
  lat: z.number().min(24).max(40).optional(),
  lng: z.number().min(44).max(64).optional(),
});

const locationSchema = z.object({
  lat: z.number().min(24).max(40),
  lng: z.number().min(44).max(64),
});

export function createRespondersRouter(params: {
  respondersService: RespondersService;
  auditService: AuditService;
}) {
  const router = Router();
  const responderOnly = requireRole(params.auditService, 'responder');

  router.get(
    '/me',
    responderOnly,
    asyncHandler((req, res) => {
      res.json({
        ok: true,
        profile: params.respondersService.getResponderByUserId(req.user!.id),
      });
    })
  );

  router.patch(
    '/me',
    responderOnly,
    asyncHandler((req, res) => {
      const body = updateProfileSchema.parse(req.body);
      const profile = params.respondersService.updateResponderProfile(
        req.user!.id,
        body
      );
      res.json({ ok: true, profile });
    })
  );

  router.post(
    '/documents',
    responderOnly,
    asyncHandler((req, res) => {
      const body = submitDocSchema.parse(req.body);
      const profile = params.respondersService.submitDocument({
        userId: req.user!.id,
        ...body,
      });
      res.status(201).json({ ok: true, profile });
    })
  );

  router.put(
    '/specialties',
    responderOnly,
    asyncHandler((req, res) => {
      const body = specialtiesSchema.parse(req.body);
      const profile = params.respondersService.setSpecialtiesAndZones({
        userId: req.user!.id,
        ...body,
      });
      res.json({ ok: true, profile });
    })
  );

  router.post(
    '/availability',
    responderOnly,
    asyncHandler((req, res) => {
      const body = availabilitySchema.parse(req.body);
      const profile = params.respondersService.setAvailability({
        userId: req.user!.id,
        ...body,
      });
      res.json({ ok: true, profile });
    })
  );

  router.post(
    '/location',
    responderOnly,
    asyncHandler((req, res) => {
      const body = locationSchema.parse(req.body);
      const loc = params.respondersService.updateLiveLocation(
        req.user!.id,
        body.lat,
        body.lng
      );
      res.json({ ok: true, location: loc });
    })
  );

  return router;
}
