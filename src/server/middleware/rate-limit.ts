import type { Request, Response, NextFunction } from 'express';
import type { AuditService } from '../modules/audit/audit.service.ts';

export function createRateLimiter(params: {
  windowMs: number;
  maxRequests: number;
  bucketPrefix: string;
  auditService: AuditService;
}) {
  const hits = new Map<string, number[]>();

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${params.bucketPrefix}:${ip}`;
    const now = Date.now();
    const cutoff = now - params.windowMs;

    const prev = hits.get(key) ?? [];
    const active = prev.filter((ts) => ts > cutoff);

    if (active.length >= params.maxRequests) {
      params.auditService.logSecurityEvent({
        eventType: 'RATE_LIMIT_EXCEEDED',
        severity: 'warning',
        ipAddress: ip,
        path: req.originalUrl,
        detail: `عبور از سقف مجاز نرخ درخواست (${params.maxRequests} در ${params.windowMs}ms)`,
      });
      res.status(429).json({
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'تعداد درخواست‌های ارسالی بیش از حد مجاز است. لطفاً چند لحظه صبر کنید.',
        },
      });
      return;
    }

    active.push(now);
    hits.set(key, active);
    next();
  };
}
