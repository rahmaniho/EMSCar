import { Router } from 'express';
import { z } from 'zod';
import type { AdminService } from './admin.service.ts';
import type { RespondersService } from '../responders/responders.service.ts';
import type { AuditService } from '../audit/audit.service.ts';
import { asyncHandler, requireRole } from '../../middleware/auth.ts';
import { USER_ROLES } from '../../../shared/constants.ts';

const createStaffSchema = z.object({
  phone: z.string().min(10).max(20),
  fullName: z.string().min(3).max(120),
  password: z.string().min(8).max(128),
  role: z.enum(['operator', 'admin']),
});

const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(USER_ROLES).optional(),
});

const reviewResponderSchema = z.object({
  decision: z.enum(['approved', 'rejected', 'suspended']),
  hasEvCertification: z.boolean().optional(),
  note: z.string().min(3, 'ثبت یادداشت بررسی مدارک الزامی است').max(500),
});

const updateSettingSchema = z.object({
  value: z.unknown(),
});

export function createAdminRouter(params: {
  adminService: AdminService;
  respondersService: RespondersService;
  auditService: AuditService;
}) {
  const router = Router();
  const adminOnly = requireRole(params.auditService, 'admin');

  router.get(
    '/reports/overview',
    adminOnly,
    asyncHandler((_req, res) => {
      res.json({ ok: true, ...params.adminService.getExecutiveDashboard() });
    })
  );

  router.get(
    '/users',
    adminOnly,
    asyncHandler((_req, res) => {
      res.json({ ok: true, users: params.adminService.listUsers() });
    })
  );

  router.post(
    '/users',
    adminOnly,
    asyncHandler((req, res) => {
      const body = createStaffSchema.parse(req.body);
      const created = params.adminService.createStaffUser({
        ...body,
        adminUserId: req.user!.id,
      });
      res.status(201).json({ ok: true, user: created });
    })
  );

  router.patch(
    '/users/:id',
    adminOnly,
    asyncHandler((req, res) => {
      const body = updateUserSchema.parse(req.body);
      const updated = params.adminService.updateUserRoleOrStatus({
        targetUserId: Number(req.params.id),
        ...body,
        adminUserId: req.user!.id,
      });
      res.json({ ok: true, user: updated });
    })
  );

  router.get(
    '/responders',
    adminOnly,
    asyncHandler((_req, res) => {
      res.json({
        ok: true,
        responders: params.adminService.listRespondersForReview(),
      });
    })
  );

  router.post(
    '/responders/:id/review',
    adminOnly,
    asyncHandler((req, res) => {
      const body = reviewResponderSchema.parse(req.body);
      const profile = params.respondersService.adminReviewResponder({
        responderId: Number(req.params.id),
        ...body,
        adminUserId: req.user!.id,
        ipAddress: req.ip,
      });
      res.json({ ok: true, profile });
    })
  );

  router.get(
    '/settings',
    adminOnly,
    asyncHandler((_req, res) => {
      res.json({ ok: true, settings: params.adminService.listSettings() });
    })
  );

  router.put(
    '/settings/:key',
    adminOnly,
    asyncHandler((req, res) => {
      const body = updateSettingSchema.parse(req.body);
      const updated = params.adminService.updateSetting(
        String(req.params.key),
        body.value,
        req.user!.id
      );
      res.json({ ok: true, setting: updated });
    })
  );

  router.get(
    '/audit-logs',
    adminOnly,
    asyncHandler((_req, res) => {
      res.json({ ok: true, ...params.adminService.getAuditAndSecurityLogs() });
    })
  );

  return router;
}
