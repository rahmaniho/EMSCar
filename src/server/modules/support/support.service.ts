import type { AppDatabase } from '../../db/connection.ts';
import type { NotificationsService } from '../notifications/notifications.service.ts';
import type { AuditService } from '../audit/audit.service.ts';
import type { AuthenticatedUser } from '../../middleware/auth.ts';
import { AppError } from '../../middleware/error-handler.ts';
import {
  TICKET_STATUS_LABELS,
  type RequestState,
  type TicketStatus,
} from '../../../shared/constants.ts';
import { assertValidStateTransition } from '../requests/state-machine.ts';

export class SupportService {
  private readonly db: AppDatabase;
  private readonly notifications: NotificationsService;
  private readonly audit: AuditService;

  constructor(params: {
    db: AppDatabase;
    notifications: NotificationsService;
    audit: AuditService;
  }) {
    this.db = params.db;
    this.notifications = params.notifications;
    this.audit = params.audit;
  }

  async createTicket(params: {
    creator: AuthenticatedUser;
    requestId?: number | null;
    category:
      | 'delay'
      | 'pricing_dispute'
      | 'service_quality'
      | 'damage_claim'
      | 'payment_issue'
      | 'general';
    priority?: 'low' | 'normal' | 'high' | 'critical';
    subject: string;
    message: string;
  }) {
    if (params.requestId) {
      const reqRow = this.db.get<{
        id: number;
        customer_user_id: number;
        assigned_responder_id: number | null;
      }>('SELECT id, customer_user_id, assigned_responder_id FROM service_requests WHERE id = ?', params.requestId);

      if (!reqRow) {
        throw new AppError(404, 'REQUEST_NOT_FOUND', 'مأموریت مرتبط یافت نشد.');
      }

      if (
        params.creator.role === 'customer' &&
        reqRow.customer_user_id !== params.creator.id
      ) {
        throw new AppError(403, 'FORBIDDEN', 'مجوز ثبت شکایت برای مأموریت دیگران را ندارید.');
      }
    }

    const nowIso = new Date().toISOString();
    const ticketId = this.db.transaction(() => {
      const tempNum = `TMP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const res = this.db.run(
        `INSERT INTO support_tickets (
          ticket_number, creator_user_id, request_id, category, priority,
          subject, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
        tempNum,
        params.creator.id,
        params.requestId ?? null,
        params.category,
        params.priority ??
          (params.category === 'damage_claim' ? 'critical' : 'normal'),
        params.subject.trim(),
        nowIso,
        nowIso
      );

      const ticketNum = `TKT-${String(10000 + res.lastInsertRowid)}`;
      this.db.run(
        'UPDATE support_tickets SET ticket_number = ? WHERE id = ?',
        ticketNum,
        res.lastInsertRowid
      );

      this.db.run(
        `INSERT INTO ticket_messages (ticket_id, sender_user_id, body, created_at)
         VALUES (?, ?, ?, ?)`,
        res.lastInsertRowid,
        params.creator.id,
        params.message.trim(),
        nowIso
      );

      return res.lastInsertRowid;
    });

    return this.getTicketDetail(ticketId, params.creator);
  }

  listTicketsForViewer(viewer: AuthenticatedUser) {
    if (viewer.role === 'operator' || viewer.role === 'admin') {
      const rows = this.db.all<{
        id: number;
        ticket_number: string;
        request_id: number | null;
        tracking_code: string | null;
        category: string;
        priority: string;
        subject: string;
        status: TicketStatus;
        creator_name: string;
        creator_phone: string;
        created_at: string;
        updated_at: string;
      }>(
        `SELECT
           t.*, u.full_name AS creator_name, u.phone AS creator_phone,
           r.tracking_code
         FROM support_tickets t
         JOIN users u ON u.id = t.creator_user_id
         LEFT JOIN service_requests r ON r.id = t.request_id
         ORDER BY
           CASE t.status WHEN 'escalated_to_admin' THEN 0 WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END,
           t.id DESC`
      );
      return rows.map((r) => ({
        ...r,
        statusLabel: TICKET_STATUS_LABELS[r.status],
      }));
    }

    const rows = this.db.all<{
      id: number;
      ticket_number: string;
      request_id: number | null;
      tracking_code: string | null;
      category: string;
      priority: string;
      subject: string;
      status: TicketStatus;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT t.id, t.ticket_number, t.request_id, r.tracking_code,
              t.category, t.priority, t.subject, t.status, t.created_at, t.updated_at
       FROM support_tickets t
       LEFT JOIN service_requests r ON r.id = t.request_id
       WHERE t.creator_user_id = ?
       ORDER BY t.id DESC`,
      viewer.id
    );
    return rows.map((r) => ({
      ...r,
      statusLabel: TICKET_STATUS_LABELS[r.status],
    }));
  }

  getTicketDetail(ticketId: number, viewer: AuthenticatedUser) {
    const ticket = this.db.get<{
      id: number;
      ticket_number: string;
      creator_user_id: number;
      creator_name: string;
      creator_phone: string;
      request_id: number | null;
      tracking_code: string | null;
      category: string;
      priority: string;
      subject: string;
      status: TicketStatus;
      escalated_reason: string | null;
      resolution_summary: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT t.*, u.full_name AS creator_name, u.phone AS creator_phone, r.tracking_code
       FROM support_tickets t
       JOIN users u ON u.id = t.creator_user_id
       LEFT JOIN service_requests r ON r.id = t.request_id
       WHERE t.id = ?`,
      ticketId
    );

    if (!ticket) {
      throw new AppError(404, 'TICKET_NOT_FOUND', 'تیکت پشتیبانی یافت نشد.');
    }

    const isStaff = viewer.role === 'operator' || viewer.role === 'admin';
    if (!isStaff && ticket.creator_user_id !== viewer.id) {
      this.audit.logSecurityEvent({
        eventType: 'IDOR_TICKET_ACCESS_BLOCKED',
        severity: 'warning',
        userId: viewer.id,
        detail: `تلاش کاربر #${viewer.id} برای مشاهده تیکت #${ticketId}`,
      });
      throw new AppError(403, 'FORBIDDEN', 'مجوز مشاهده این تیکت را ندارید.');
    }

    const messages = this.db.all(
      `SELECT m.id, m.body, m.created_at, u.full_name AS sender_name, u.role AS sender_role
       FROM ticket_messages m
       JOIN users u ON u.id = m.sender_user_id
       WHERE m.ticket_id = ?
       ORDER BY m.id ASC`,
      ticketId
    );

    // یادداشت‌های داخلی اپراتور مطلقاً فقط به اپراتور و مدیر برگردانده می‌شوند!
    const internalNotes = isStaff
      ? this.db.all(
          `SELECT n.id, n.note, n.created_at, u.full_name AS author_name, u.role AS author_role
           FROM internal_operator_notes n
           JOIN users u ON u.id = n.author_user_id
           WHERE n.ticket_id = ?
           ORDER BY n.id ASC`,
          ticketId
        )
      : undefined;

    return {
      id: ticket.id,
      ticketNumber: ticket.ticket_number,
      requestId: ticket.request_id,
      trackingCode: ticket.tracking_code,
      category: ticket.category,
      priority: ticket.priority,
      subject: ticket.subject,
      status: ticket.status,
      statusLabel: TICKET_STATUS_LABELS[ticket.status],
      creator: {
        id: ticket.creator_user_id,
        fullName: ticket.creator_name,
        phone: isStaff ? ticket.creator_phone : undefined,
      },
      escalatedReason: isStaff ? ticket.escalated_reason : undefined,
      resolutionSummary: ticket.resolution_summary,
      messages,
      ...(isStaff ? { internalNotes } : {}),
      createdAt: ticket.created_at,
      updatedAt: ticket.updated_at,
    };
  }

  async addMessage(params: {
    ticketId: number;
    sender: AuthenticatedUser;
    body: string;
  }) {
    const detail = this.getTicketDetail(params.ticketId, params.sender);
    const nowIso = new Date().toISOString();

    this.db.transaction(() => {
      this.db.run(
        `INSERT INTO ticket_messages (ticket_id, sender_user_id, body, created_at)
         VALUES (?, ?, ?, ?)`,
        params.ticketId,
        params.sender.id,
        params.body.trim(),
        nowIso
      );

      if (
        (params.sender.role === 'operator' || params.sender.role === 'admin') &&
        detail.status === 'open'
      ) {
        this.db.run(
          `UPDATE support_tickets SET status = 'in_progress', assigned_operator_id = ?, updated_at = ? WHERE id = ?`,
          params.sender.id,
          nowIso,
          params.ticketId
        );
      } else {
        this.db.run(
          'UPDATE support_tickets SET updated_at = ? WHERE id = ?',
          nowIso,
          params.ticketId
        );
      }
    });

    if (params.sender.id !== detail.creator.id) {
      await this.notifications.notifyUser({
        userId: detail.creator.id,
        requestId: detail.requestId,
        eventType: 'SUPPORT_REPLY',
        title: `پاسخ پشتیبانی به تیکت ${detail.ticketNumber}`,
        body: `پاسخ جدیدی برای تیکت «${detail.subject}» ثبت شد.`,
        sendSms: false,
      });
    }

    return this.getTicketDetail(params.ticketId, params.sender);
  }

  addInternalOperatorNote(params: {
    ticketId?: number;
    requestId?: number;
    author: AuthenticatedUser;
    note: string;
  }) {
    const res = this.db.run(
      `INSERT INTO internal_operator_notes (ticket_id, request_id, author_user_id, note, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      params.ticketId ?? null,
      params.requestId ?? null,
      params.author.id,
      params.note.trim(),
      new Date().toISOString()
    );
    return { id: res.lastInsertRowid };
  }

  escalateToAdmin(params: {
    ticketId: number;
    operator: AuthenticatedUser;
    reason: string;
    placeRequestUnderReview: boolean;
  }) {
    const detail = this.getTicketDetail(params.ticketId, params.operator);
    const nowIso = new Date().toISOString();

    this.db.transaction(() => {
      this.db.run(
        `UPDATE support_tickets
         SET status = 'escalated_to_admin', escalated_reason = ?, updated_at = ?
         WHERE id = ?`,
        params.reason.trim(),
        nowIso,
        params.ticketId
      );

      if (params.placeRequestUnderReview && detail.requestId) {
        const reqRow = this.db.get<{ status: RequestState }>(
          'SELECT status FROM service_requests WHERE id = ?',
          detail.requestId
        );
        if (reqRow && reqRow.status !== 'UnderSupportReview') {
          assertValidStateTransition({
            from: reqRow.status,
            to: 'UnderSupportReview',
            actorRole: params.operator.role,
          });
          this.db.run(
            `UPDATE service_requests SET status = 'UnderSupportReview', updated_at = ? WHERE id = ?`,
            nowIso,
            detail.requestId
          );
          this.db.run(
            `INSERT INTO request_state_history (
              request_id, from_status, to_status, actor_user_id, actor_role, note, created_at
            ) VALUES (?, ?, 'UnderSupportReview', ?, ?, ?, ?)`,
            detail.requestId,
            reqRow.status,
            params.operator.id,
            params.operator.role,
            `ارجاع پرونده به بررسی پشتیبانی/مدیریت: ${params.reason.trim()}`,
            nowIso
          );
        }
      }

      this.audit.logAdminAction({
        actorUserId: params.operator.id,
        actorRole: params.operator.role,
        action: 'TICKET_ESCALATED_TO_ADMIN',
        entityType: 'support_ticket',
        entityId: params.ticketId,
        summary: `ارجاع تیکت ${detail.ticketNumber} به مدیر کل`,
        metadata: { reason: params.reason, requestId: detail.requestId },
      });
    });

    return this.getTicketDetail(params.ticketId, params.operator);
  }

  resolveTicket(params: {
    ticketId: number;
    staff: AuthenticatedUser;
    resolutionSummary: string;
  }) {
    const detail = this.getTicketDetail(params.ticketId, params.staff);
    const nowIso = new Date().toISOString();
    this.db.run(
      `UPDATE support_tickets
       SET status = 'resolved', resolution_summary = ?, updated_at = ?
       WHERE id = ?`,
      params.resolutionSummary.trim(),
      nowIso,
      detail.id
    );
    return this.getTicketDetail(params.ticketId, params.staff);
  }
}
