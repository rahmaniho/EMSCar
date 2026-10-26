import type { AppDatabase } from '../../db/connection.ts';

export class AuditService {
  private readonly db: AppDatabase;
  private readonly enabled: boolean;

  constructor(db: AppDatabase, enabled = true) {
    this.db = db;
    this.enabled = enabled;
  }

  logAdminAction(params: {
    actorUserId: number | null;
    actorRole: string;
    action: string;
    entityType: string;
    entityId?: string | number | null;
    summary: string;
    metadata?: unknown;
    ipAddress?: string;
  }): void {
    this.db.run(
      `INSERT INTO audit_logs (
        actor_user_id, actor_role, action, entity_type, entity_id, summary, metadata_json, ip_address, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params.actorUserId,
      params.actorRole,
      params.action,
      params.entityType,
      params.entityId !== undefined && params.entityId !== null
        ? String(params.entityId)
        : null,
      params.summary,
      params.metadata !== undefined ? JSON.stringify(params.metadata) : null,
      params.ipAddress ?? null,
      new Date().toISOString()
    );
  }

  logSecurityEvent(params: {
    eventType: string;
    severity: 'info' | 'warning' | 'critical';
    userId?: number | null;
    ipAddress?: string;
    path?: string;
    detail: string;
  }): void {
    if (!this.enabled) return;
    try {
      this.db.run(
        `INSERT INTO security_events (event_type, severity, user_id, ip_address, path, detail, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params.eventType,
        params.severity,
        params.userId ?? null,
        params.ipAddress ?? null,
        params.path ?? null,
        params.detail,
        new Date().toISOString()
      );
    } catch {
      // جلوگیری از اختلال جریان خطا در صورت قفل موقت پایگاه داده
    }
  }
}
