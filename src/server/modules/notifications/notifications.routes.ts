import { Router } from 'express';
import type { NotificationsService } from './notifications.service.ts';
import type { AuditService } from '../audit/audit.service.ts';
import { asyncHandler, requireAuth, requireRole } from '../../middleware/auth.ts';

export function createNotificationsRouter(params: {
  notificationsService: NotificationsService;
  auditService: AuditService;
}) {
  const router = Router();
  const adminOnly = requireRole(params.auditService, 'admin');

  router.get(
    '/',
    requireAuth,
    asyncHandler((req, res) => {
      res.json({
        ok: true,
        notifications: params.notificationsService.listUserNotifications(req.user!.id),
      });
    })
  );

  router.post(
    '/:id/read',
    requireAuth,
    asyncHandler((req, res) => {
      params.notificationsService.markRead(req.user!.id, Number(req.params.id));
      res.json({ ok: true });
    })
  );

  router.get(
    '/admin/outbox',
    adminOnly,
    asyncHandler((_req, res) => {
      res.json({
        ok: true,
        provider: params.notificationsService.getProviderInfo(),
        logs: params.notificationsService.listAllForAdmin(),
      });
    })
  );

  router.post(
    '/admin/:id/retry',
    adminOnly,
    asyncHandler(async (req, res) => {
      const result = await params.notificationsService.retryFailedSms(
        Number(req.params.id)
      );
      const statusCode = result.acceptedByProvider ? 200 : result.simulationOnly ? 202 : 502;
      // HTTP 202 is a successful API exchange (Sandbox only), not provider acceptance.
      // Keep envelope ok=true so the shared apiFetch client returns the explicit simulation result.
      res.status(statusCode).json({
        ok: result.acceptedByProvider || result.simulationOnly,
        result,
      });
    })
  );

  return router;
}
