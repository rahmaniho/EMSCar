import { Router } from 'express';
import type { RealtimeBus } from './realtime-bus.ts';
import { requireAuth } from '../../middleware/auth.ts';

export function createEventsRouter(params: { realtimeBus: RealtimeBus }) {
  const router = Router();

  router.get('/stream', requireAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    res.write(
      `event: connected\ndata: ${JSON.stringify({
        ok: true,
        userId: req.user!.id,
        role: req.user!.role,
        connectedAt: new Date().toISOString(),
      })}\n\n`
    );

    const cleanup = params.realtimeBus.addClient({
      userId: req.user!.id,
      role: req.user!.role,
      res,
    });

    req.on('close', cleanup);
  });

  return router;
}
