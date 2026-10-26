import { Router } from 'express';
import { z } from 'zod';
import type { RatingsService } from './ratings.service.ts';
import type { AuditService } from '../audit/audit.service.ts';
import { asyncHandler, requireRole } from '../../middleware/auth.ts';

const submitReviewSchema = z.object({
  requestId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string().max(40)).max(8).default([]),
  comment: z.string().max(800).optional(),
});

export function createRatingsRouter(params: {
  ratingsService: RatingsService;
  auditService: AuditService;
}) {
  const router = Router();
  const customerOnly = requireRole(params.auditService, 'customer');

  router.post(
    '/',
    customerOnly,
    asyncHandler((req, res) => {
      const body = submitReviewSchema.parse(req.body);
      const result = params.ratingsService.submitReview({
        customerUserId: req.user!.id,
        ...body,
      });
      res.status(201).json({ ok: true, ...result });
    })
  );

  return router;
}
