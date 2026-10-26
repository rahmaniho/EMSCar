import { Router } from 'express';
import { z } from 'zod';
import type { IdentityService } from './identity.service.ts';
import type { AppConfig } from '../../config/env.ts';
import { asyncHandler, requireAuth } from '../../middleware/auth.ts';
import { EQUIPMENT_TYPES } from '../../../shared/constants.ts';

const registerSchema = z.object({
  phone: z.string().min(10).max(20),
  fullName: z.string().min(3, 'نام و نام خانوادگی باید حداقل ۳ کاراکتر باشد').max(120),
  password: z.string().min(8, 'رمز عبور باید حداقل ۸ کاراکتر باشد').max(128),
  role: z.enum(['customer', 'responder']).default('customer'),
  nationalCode: z.string().max(15).optional(),
  equipmentType: z.enum(EQUIPMENT_TYPES).optional(),
  vehiclePlate: z.string().max(40).optional(),
});

const loginSchema = z.object({
  phone: z.string().min(10).max(20),
  password: z.string().min(1).max(128),
});

const updateProfileSchema = z.object({
  fullName: z.string().min(3).max(120).optional(),
  nationalCode: z.string().max(15).optional(),
  email: z.string().max(120).optional(),
});

export function createIdentityRouter(params: {
  identityService: IdentityService;
  config: AppConfig;
  authLimiter: ReturnType<typeof import('../../middleware/rate-limit.ts').createRateLimiter>;
}) {
  const router = Router();

  function setSessionCookie(
    req: import('express').Request,
    res: import('express').Response,
    rawToken: string,
    expiresAt: Date
  ) {
    const isHttps =
      req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.cookie(params.config.SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: params.config.isProduction || isHttps,
      expires: expiresAt,
      path: '/',
    });
  }

  router.post(
    '/register',
    params.authLimiter,
    asyncHandler((req, res) => {
      const body = registerSchema.parse(req.body);
      const result = params.identityService.registerPublicUser({
        ...body,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      setSessionCookie(req, res, result.rawSessionToken, result.expiresAt);
      res.status(201).json({
        ok: true,
        user: result.user,
        token: result.rawSessionToken,
      });
    })
  );

  router.post(
    '/login',
    params.authLimiter,
    asyncHandler((req, res) => {
      const body = loginSchema.parse(req.body);
      const result = params.identityService.login({
        ...body,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
      setSessionCookie(req, res, result.rawSessionToken, result.expiresAt);
      res.json({
        ok: true,
        user: result.user,
        token: result.rawSessionToken,
      });
    })
  );

  router.post(
    '/logout',
    requireAuth,
    asyncHandler((req, res) => {
      params.identityService.logout(req.user!.sessionId);
      res.clearCookie(params.config.SESSION_COOKIE_NAME, { path: '/' });
      res.json({ ok: true });
    })
  );

  router.get(
    '/me',
    asyncHandler((req, res) => {
      if (!req.user) {
        res.json({ ok: true, user: null });
        return;
      }
      const profile = params.identityService.getUserProfile(req.user.id);
      res.json({ ok: true, user: profile });
    })
  );

  router.patch(
    '/profile',
    requireAuth,
    asyncHandler((req, res) => {
      const body = updateProfileSchema.parse(req.body);
      const updated = params.identityService.updateProfile(req.user!.id, body);
      res.json({ ok: true, user: updated });
    })
  );

  router.get(
    '/sessions',
    requireAuth,
    asyncHandler((req, res) => {
      const sessions = params.identityService.listActiveSessions(
        req.user!.id,
        req.user!.sessionId
      );
      res.json({ ok: true, sessions });
    })
  );

  return router;
}
