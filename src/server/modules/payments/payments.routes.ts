import { Router } from 'express';
import { z } from 'zod';
import type { PaymentsService } from './payments.service.ts';
import type { AuditService } from '../audit/audit.service.ts';
import { asyncHandler, requireRole } from '../../middleware/auth.ts';

const createOrderSchema = z.object({
  requestId: z.number().int().positive(),
});

const sandboxSimulateSchema = z.object({
  authority: z.string().min(4).max(120),
  outcome: z.enum(['approve', 'fail']),
});

const verifyCallbackSchema = z.object({
  authority: z.string().min(4).max(120),
  status: z.string().optional(),
});

const refundSchema = z.object({
  requestId: z.number().int().positive(),
  amountToman: z.number().int().positive(),
  reason: z.string().min(5, 'ثبت دلیل بازپرداخت الزامی است').max(500),
});

const debtSchema = z.object({
  requestId: z.number().int().positive(),
  reason: z.string().min(5).max(500),
});

const settlementRequestSchema = z.object({
  amountToman: z.number().int().min(50000),
  shebaNumber: z.string().max(30).optional(),
});

const processSettlementSchema = z.object({
  decision: z.enum(['approved_paid', 'rejected']),
  bankReferenceCode: z.string().max(80).optional(),
  note: z.string().max(400).optional(),
});

export function createPaymentsRouter(params: {
  paymentsService: PaymentsService;
  auditService: AuditService;
}) {
  const router = Router();
  const customerOnly = requireRole(params.auditService, 'customer');
  const responderOnly = requireRole(params.auditService, 'responder');
  const staffOnly = requireRole(params.auditService, 'operator', 'admin');
  const adminOnly = requireRole(params.auditService, 'admin');

  router.get(
    '/gateway-info',
    asyncHandler((_req, res) => {
      res.json({ ok: true, gateway: params.paymentsService.getGatewayStatus() });
    })
  );

  router.get(
    '/customer/history',
    customerOnly,
    asyncHandler((req, res) => {
      res.json({
        ok: true,
        ...params.paymentsService.listCustomerInvoicesAndPayments(req.user!.id),
      });
    })
  );

  router.post(
    '/orders',
    customerOnly,
    asyncHandler(async (req, res) => {
      const body = createOrderSchema.parse(req.body);
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      const callbackBaseUrl = `${proto}://${host}`;

      const order = await params.paymentsService.createPaymentOrder({
        requestId: body.requestId,
        customerUserId: req.user!.id,
        callbackBaseUrl,
      });

      res.status(201).json({ ok: true, order });
    })
  );

  // شبیه‌سازی تصمیم بانک در سرور آزمایشی (صرفاً در حالت Sandbox)
  router.post(
    '/sandbox/simulate',
    customerOnly,
    asyncHandler((req, res) => {
      const body = sandboxSimulateSchema.parse(req.body);
      const result = params.paymentsService.simulateSandboxBankDecision(
        body.authority,
        body.outcome
      );
      res.json(result);
    })
  );

  // استعلام و تأیید نهایی Callback در سمت سرور (API)
  router.post(
    '/callback/verify',
    asyncHandler(async (req, res) => {
      const body = verifyCallbackSchema.parse(req.body);
      const result = await params.paymentsService.verifyPaymentCallback({
        authority: body.authority,
        browserStatusParam: body.status,
      });
      res.json({ ok: true, result });
    })
  );

  // بازگشت استاندارد مرورگر از درگاه بانکی (GET Callback)
  router.get(
    '/callback',
    asyncHandler(async (req, res) => {
      const authority = String(req.query.Authority || req.query.authority || '');
      const status = String(req.query.Status || req.query.status || '');
      if (!authority) {
        res.redirect('/?paymentError=missing_authority');
        return;
      }
      const result = await params.paymentsService.verifyPaymentCallback({
        authority,
        browserStatusParam: status,
      });
      res.redirect(
        `/requests/${result.requestId}?payment=${result.paid ? 'paid' : 'failed'}`
      );
    })
  );

  // بازپرداخت توسط مدیر کل
  router.post(
    '/admin/refunds',
    adminOnly,
    asyncHandler(async (req, res) => {
      const body = refundSchema.parse(req.body);
      const result = await params.paymentsService.processRefund({
        requestId: body.requestId,
        amountToman: body.amountToman,
        reason: body.reason,
        adminUserId: req.user!.id,
        ipAddress: req.ip,
      });
      res.status(201).json({ ok: true, result });
    })
  );

  // ثبت بدهی مجاز در شرایط خاص
  router.post(
    '/staff/approve-debt',
    staffOnly,
    asyncHandler((req, res) => {
      const body = debtSchema.parse(req.body);
      const result = params.paymentsService.approveEmergencyDebt({
        requestId: body.requestId,
        actorUserId: req.user!.id,
        actorRole: req.user!.role as 'operator' | 'admin',
        reason: body.reason,
      });
      res.json(result);
    })
  );

  // کیف پول و تسویه‌حساب امدادگر
  router.get(
    '/responder/wallet',
    responderOnly,
    asyncHandler((req, res) => {
      res.json({
        ok: true,
        ...params.paymentsService.getResponderFinancialSummary(req.user!.id),
      });
    })
  );

  router.post(
    '/responder/settlements',
    responderOnly,
    asyncHandler((req, res) => {
      const body = settlementRequestSchema.parse(req.body);
      const result = params.paymentsService.requestResponderSettlement({
        responderUserId: req.user!.id,
        ...body,
      });
      res.status(201).json({ ok: true, result });
    })
  );

  // مدیریت تسویه‌حساب‌ها و گزارش تطبیق مالی مدیر کل
  router.get(
    '/admin/reconciliation',
    adminOnly,
    asyncHandler((_req, res) => {
      res.json({
        ok: true,
        report: params.paymentsService.getFinancialReconciliationReport(),
      });
    })
  );

  router.post(
    '/admin/settlements/:id/process',
    adminOnly,
    asyncHandler((req, res) => {
      const body = processSettlementSchema.parse(req.body);
      const result = params.paymentsService.processSettlementByAdmin({
        settlementId: Number(req.params.id),
        decision: body.decision,
        bankReferenceCode: body.bankReferenceCode,
        note: body.note,
        adminUserId: req.user!.id,
      });
      res.json({ ok: true, result });
    })
  );

  return router;
}
