import { Router } from 'express';
import { z } from 'zod';
import type { SupportService } from './support.service.ts';
import type { AuditService } from '../audit/audit.service.ts';
import {
  asyncHandler,
  requireAuth,
  requireRole,
} from '../../middleware/auth.ts';

const createTicketSchema = z.object({
  requestId: z.number().int().positive().nullable().optional(),
  category: z.enum([
    'delay',
    'pricing_dispute',
    'service_quality',
    'damage_claim',
    'payment_issue',
    'general',
  ]),
  priority: z.enum(['low', 'normal', 'high', 'critical']).optional(),
  subject: z.string().min(4).max(200),
  message: z.string().min(5).max(2000),
});

const replySchema = z.object({
  body: z.string().min(2).max(2000),
});

const internalNoteSchema = z.object({
  note: z.string().min(2).max(2000),
});

const escalateSchema = z.object({
  reason: z.string().min(4).max(500),
  placeRequestUnderReview: z.boolean().default(true),
});

const resolveSchema = z.object({
  resolutionSummary: z.string().min(5).max(1000),
});

export function createSupportRouter(params: {
  supportService: SupportService;
  auditService: AuditService;
}) {
  const router = Router();
  const staffOnly = requireRole(params.auditService, 'operator', 'admin');

  router.get(
    '/tickets',
    requireAuth,
    asyncHandler((req, res) => {
      res.json({
        ok: true,
        tickets: params.supportService.listTicketsForViewer(req.user!),
      });
    })
  );

  router.post(
    '/tickets',
    requireAuth,
    asyncHandler(async (req, res) => {
      const body = createTicketSchema.parse(req.body);
      const ticket = await params.supportService.createTicket({
        creator: req.user!,
        ...body,
      });
      res.status(201).json({ ok: true, ticket });
    })
  );

  router.get(
    '/tickets/:id',
    requireAuth,
    asyncHandler((req, res) => {
      res.json({
        ok: true,
        ticket: params.supportService.getTicketDetail(
          Number(req.params.id),
          req.user!
        ),
      });
    })
  );

  router.post(
    '/tickets/:id/messages',
    requireAuth,
    asyncHandler(async (req, res) => {
      const body = replySchema.parse(req.body);
      const ticket = await params.supportService.addMessage({
        ticketId: Number(req.params.id),
        sender: req.user!,
        body: body.body,
      });
      res.status(201).json({ ok: true, ticket });
    })
  );

  router.post(
    '/tickets/:id/internal-notes',
    staffOnly,
    asyncHandler((req, res) => {
      const body = internalNoteSchema.parse(req.body);
      params.supportService.addInternalOperatorNote({
        ticketId: Number(req.params.id),
        author: req.user!,
        note: body.note,
      });
      res.status(201).json({
        ok: true,
        ticket: params.supportService.getTicketDetail(
          Number(req.params.id),
          req.user!
        ),
      });
    })
  );

  router.post(
    '/tickets/:id/escalate',
    staffOnly,
    asyncHandler((req, res) => {
      const body = escalateSchema.parse(req.body);
      const ticket = params.supportService.escalateToAdmin({
        ticketId: Number(req.params.id),
        operator: req.user!,
        reason: body.reason,
        placeRequestUnderReview: body.placeRequestUnderReview,
      });
      res.json({ ok: true, ticket });
    })
  );

  router.post(
    '/tickets/:id/resolve',
    staffOnly,
    asyncHandler((req, res) => {
      const body = resolveSchema.parse(req.body);
      const ticket = params.supportService.resolveTicket({
        ticketId: Number(req.params.id),
        staff: req.user!,
        resolutionSummary: body.resolutionSummary,
      });
      res.json({ ok: true, ticket });
    })
  );

  return router;
}
