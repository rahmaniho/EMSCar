import crypto from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { AppDatabase } from '../db/connection.ts';
import type { UserRole } from '../../shared/constants.ts';
import type { AuditService } from '../modules/audit/audit.service.ts';
import { AppError } from './error-handler.ts';

export interface AuthenticatedUser {
  id: number;
  phone: string;
  fullName: string;
  role: UserRole;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function createSessionMiddleware(params: {
  db: AppDatabase;
  cookieName: string;
}) {
  return function sessionMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
  ): void {
    let rawToken: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      rawToken = authHeader.slice(7).trim();
    } else if (req.cookies && typeof req.cookies[params.cookieName] === 'string') {
      rawToken = req.cookies[params.cookieName];
    }

    if (!rawToken) {
      next();
      return;
    }

    const tokenHash = hashSessionToken(rawToken);
    const nowIso = new Date().toISOString();

    const row = params.db.get<{
      session_id: string;
      user_id: number;
      phone: string;
      full_name: string;
      role: UserRole;
      is_active: number;
      expires_at: string;
      revoked_at: string | null;
    }>(
      `SELECT
         s.id AS session_id,
         u.id AS user_id,
         u.phone,
         u.full_name,
         u.role,
         u.is_active,
         s.expires_at,
         s.revoked_at
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`,
      tokenHash
    );

    if (
      row &&
      !row.revoked_at &&
      row.is_active === 1 &&
      row.expires_at > nowIso
    ) {
      req.user = {
        id: row.user_id,
        phone: row.phone,
        fullName: row.full_name,
        role: row.role,
        sessionId: row.session_id,
      };
    }

    next();
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(
      new AppError(
        401,
        'UNAUTHORIZED',
        'برای انجام این عملیات ابتدا وارد حساب کاربری خود شوید.'
      )
    );
    return;
  }
  next();
}

export function requireRole(
  auditService: AuditService,
  ...allowedRoles: UserRole[]
): RequestHandler {
  return function roleGuard(req: Request, _res: Response, next: NextFunction): void {
    if (!req.user) {
      next(
        new AppError(
          401,
          'UNAUTHORIZED',
          'برای دسترسی به این بخش ابتدا وارد حساب کاربری شوید.'
        )
      );
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      auditService.logSecurityEvent({
        eventType: 'FORBIDDEN_ROLE_ACCESS',
        severity: 'warning',
        userId: req.user.id,
        ipAddress: req.ip,
        path: req.originalUrl,
        detail: `نقش ${req.user.role} تلاش کرد به مسیر نیازمند نقش [${allowedRoles.join(',')}] دسترسی یابد`,
      });
      next(
        new AppError(
          403,
          'FORBIDDEN',
          'شما مجوز دسترسی به این عملیات یا پنل را ندارید.'
        )
      );
      return;
    }

    next();
  };
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
): RequestHandler {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
