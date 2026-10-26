import { Router } from 'express';
import { z } from 'zod';
import type { RequestsService } from './requests.service.ts';
import type { DispatchService } from './dispatch.service.ts';
import type { AuditService } from '../audit/audit.service.ts';
import {
  asyncHandler,
  requireAuth,
  requireRole,
} from '../../middleware/auth.ts';
import { REQUEST_STATES } from '../../../shared/constants.ts';

const createRequestSchema = z.object({
  vehicleId: z.number().int().positive(),
  serviceId: z.number().int().positive(),
  originLat: z.number().min(24).max(40),
  originLng: z.number().min(44).max(64),
  originAddress: z.string().min(5, 'لطفاً نشانی محل توقف خودرو را وارد کنید').max(400),
  destinationLat: z.number().min(24).max(40).nullable().optional(),
  destinationLng: z.number().min(44).max(64).nullable().optional(),
  destinationAddress: z.string().max(400).nullable().optional(),
  issueDescription: z.string().min(5, 'توضیح کوتاه مشکل خودرو الزامی است').max(1000),
  ownershipConfirmed: z.boolean().default(true),
  isUrgent: z.boolean().default(false),
  discountCode: z.string().max(40).optional(),
  submitImmediately: z.boolean().default(true),
  idempotencyKey: z.string().max(120).optional(),
});

const advanceStatusSchema = z.object({
  nextStatus: z.enum(['EnRoute', 'Arrived', 'InProgress']),
  note: z.string().max(400).optional(),
  lat: z.number().min(24).max(40).optional(),
  lng: z.number().min(44).max(64).optional(),
});

const completeMissionSchema = z.object({
  summary: z.string().min(5).max(500),
  actionsTaken: z.string().min(5).max(1500),
  partsUsed: z
    .array(
      z.object({
        name: z.string().min(2).max(120),
        costToman: z.number().int().min(0).max(50000000),
      })
    )
    .default([]),
  actualTowDistanceKm: z.number().min(0).max(1000).optional(),
  priceChangeReason: z.string().max(500).optional(),
});

const cancelSchema = z.object({
  reason: z.string().min(3, 'ثبت دلیل لغو الزامی است').max(400),
});

const rejectOfferSchema = z.object({
  reason: z.string().max(300).optional(),
});

const staffAssignSchema = z.object({
  responderId: z.number().int().positive(),
});

const staffTransitionSchema = z.object({
  toStatus: z.enum(REQUEST_STATES),
  note: z.string().min(3).max(500),
});

const uploadAttachmentSchema = z.object({
  originalName: z.string().min(1).max(120),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  base64Data: z.string().min(4),
});

export function createRequestsRouter(params: {
  requestsService: RequestsService;
  dispatchService: DispatchService;
  auditService: AuditService;
}) {
  const router = Router();
  const customerOnly = requireRole(params.auditService, 'customer');
  const responderOnly = requireRole(params.auditService, 'responder');
  const staffOnly = requireRole(params.auditService, 'operator', 'admin');

  // استعلام عمومی وضعیت مأموریت با کد رهگیری (بدون افشای اطلاعات هویتی یا مکانی دقیق)
  router.get(
    '/track/:trackingCode',
    asyncHandler((req, res) => {
      const summary = params.requestsService.getPublicTrackingSummary(
        String(req.params.trackingCode)
      );
      res.json({ ok: true, summary });
    })
  );

  // فهرست درخواست‌های مشتری
  router.get(
    '/my',
    customerOnly,
    asyncHandler((req, res) => {
      res.json({
        ok: true,
        requests: params.requestsService.listCustomerRequests(req.user!.id),
      });
    })
  );

  // ثبت درخواست جدید (پیش‌نویس یا ارسال نهایی)
  router.post(
    '/',
    customerOnly,
    asyncHandler(async (req, res) => {
      const body = createRequestSchema.parse(req.body);
      const headerIdem = req.headers['idempotency-key'];
      const idempotencyKey =
        body.idempotencyKey ||
        (typeof headerIdem === 'string' ? headerIdem : undefined);

      const result = await params.requestsService.createRequest({
        customerUserId: req.user!.id,
        ...body,
        idempotencyKey,
      });

      res.status(result.deduplicated ? 200 : 201).json({
        ok: true,
        ...result,
      });
    })
  );

  // تأیید و ارسال پیش‌نویس
  router.post(
    '/:id/submit',
    customerOnly,
    asyncHandler(async (req, res) => {
      const request = await params.requestsService.submitDraftRequest(
        Number(req.params.id),
        req.user!.id
      );
      res.json({ ok: true, request });
    })
  );

  // پیشنهادهای مأموریت برای امدادگر
  router.get(
    '/responder/offers',
    responderOnly,
    asyncHandler((req, res) => {
      res.json({
        ok: true,
        offers: params.dispatchService.listResponderOffers(req.user!.id),
      });
    })
  );

  // فهرست مأموریت‌های امدادگر
  router.get(
    '/responder/missions',
    responderOnly,
    asyncHandler((req, res) => {
      res.json({
        ok: true,
        missions: params.requestsService.listResponderMissions(req.user!.id),
      });
    })
  );

  // صف مرکز پیام و مدیریت
  router.get(
    '/staff/queue',
    staffOnly,
    asyncHandler((req, res) => {
      res.json({
        ok: true,
        queue: params.requestsService.listStaffQueue({
          escalatedOnly: req.query.escalated === 'true',
          status:
            typeof req.query.status === 'string' ? req.query.status : undefined,
        }),
      });
    })
  );

  // فهرست امدادگران واجد شرایط برای یک درخواست جهت تصمیم‌گیری اپراتور
  router.get(
    '/:id/eligible-responders',
    staffOnly,
    asyncHandler((req, res) => {
      res.json({
        ok: true,
        candidates: params.dispatchService.findEligibleResponders(
          Number(req.params.id)
        ),
      });
    })
  );

  // تخصیص دستی توسط اپراتور یا مدیر
  router.post(
    '/:id/staff-assign',
    staffOnly,
    asyncHandler(async (req, res) => {
      const body = staffAssignSchema.parse(req.body);
      const result = await params.dispatchService.operatorAssignResponder({
        requestId: Number(req.params.id),
        responderId: body.responderId,
        actorUserId: req.user!.id,
        actorRole: req.user!.role as 'operator' | 'admin',
      });
      res.json({ ok: true, result });
    })
  );

  // اجرای مجدد موتور جستجوی هوشمند توسط اپراتور
  router.post(
    '/:id/redispatch',
    staffOnly,
    asyncHandler(async (req, res) => {
      const result = await params.dispatchService.dispatchSubmittedRequest(
        Number(req.params.id)
      );
      res.json({ ok: true, result });
    })
  );

  // تغییر وضعیت توسط اپراتور / مدیر
  router.post(
    '/:id/staff-transition',
    staffOnly,
    asyncHandler((req, res) => {
      const body = staffTransitionSchema.parse(req.body);
      const updated = params.requestsService.staffTransitionStatus({
        requestId: Number(req.params.id),
        actor: req.user!,
        toStatus: body.toStatus,
        note: body.note,
      });
      res.json({ ok: true, request: updated });
    })
  );

  // پذیرش مأموریت توسط امدادگر
  router.post(
    '/:id/accept',
    responderOnly,
    asyncHandler(async (req, res) => {
      await params.dispatchService.acceptMissionByResponder({
        requestId: Number(req.params.id),
        responderUserId: req.user!.id,
      });
      const request = params.requestsService.getRequestDetail(
        Number(req.params.id),
        req.user!
      );
      res.json({ ok: true, request });
    })
  );

  // رد پیشنهاد مأموریت توسط امدادگر
  router.post(
    '/:id/reject-offer',
    responderOnly,
    asyncHandler((req, res) => {
      const body = rejectOfferSchema.parse(req.body ?? {});
      const result = params.dispatchService.rejectOfferByResponder({
        requestId: Number(req.params.id),
        responderUserId: req.user!.id,
        reason: body.reason,
      });
      res.json({ ok: true, ...result });
    })
  );

  // پیشبرد وضعیت مأموریت توسط امدادگر
  router.post(
    '/:id/responder-status',
    responderOnly,
    asyncHandler(async (req, res) => {
      const body = advanceStatusSchema.parse(req.body);
      const request = await params.requestsService.advanceResponderMissionStatus({
        requestId: Number(req.params.id),
        responderUserId: req.user!.id,
        ...body,
      });
      res.json({ ok: true, request });
    })
  );

  // ثبت گزارش پایان خدمت و تکمیل مأموریت
  router.post(
    '/:id/complete',
    responderOnly,
    asyncHandler(async (req, res) => {
      const body = completeMissionSchema.parse(req.body);
      const request = await params.requestsService.completeMission({
        requestId: Number(req.params.id),
        responderUserId: req.user!.id,
        ...body,
      });
      res.json({ ok: true, request });
    })
  );

  // تأیید مبلغ نهایی تغییریافته توسط مشتری
  router.post(
    '/:id/approve-price',
    customerOnly,
    asyncHandler((req, res) => {
      const request = params.requestsService.approveFinalPriceByCustomer(
        Number(req.params.id),
        req.user!.id
      );
      res.json({ ok: true, request });
    })
  );

  // لغو درخواست
  router.post(
    '/:id/cancel',
    requireAuth,
    asyncHandler(async (req, res) => {
      const body = cancelSchema.parse(req.body);
      const request = await params.requestsService.cancelRequest({
        requestId: Number(req.params.id),
        actor: req.user!,
        reason: body.reason,
      });
      res.json({ ok: true, request });
    })
  );

  // بارگذاری تصویر/پیوست خصوصی مأموریت
  router.post(
    '/:id/attachments',
    requireAuth,
    asyncHandler((req, res) => {
      const body = uploadAttachmentSchema.parse(req.body);
      const attachment = params.requestsService.uploadPrivateAttachment({
        actor: req.user!,
        requestId: Number(req.params.id),
        ...body,
      });
      res.status(201).json({ ok: true, attachment });
    })
  );

  // دانلود فایل خصوصی با کنترل سطح دسترسی
  router.get(
    '/attachments/:attachmentId',
    requireAuth,
    asyncHandler((req, res) => {
      const file = params.requestsService.readProtectedAttachment(
        Number(req.params.attachmentId),
        req.user!
      );
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(file.originalName)}"`
      );
      res.setHeader('Cache-Control', 'private, no-store');
      res.send(file.buffer);
    })
  );

  // دریافت جزئیات کامل درخواست
  router.get(
    '/:id',
    requireAuth,
    asyncHandler((req, res) => {
      const request = params.requestsService.getRequestDetail(
        Number(req.params.id),
        req.user!
      );
      res.json({ ok: true, request });
    })
  );

  return router;
}
