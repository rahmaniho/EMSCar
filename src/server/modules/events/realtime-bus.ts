import type { Response } from 'express';
import type { UserRole } from '../../../shared/constants.ts';

export interface RealtimeEventPayload {
  type:
    | 'REQUEST_UPDATED'
    | 'DISPATCH_OFFERED'
    | 'RESPONDER_LOCATION_UPDATED'
    | 'PAYMENT_UPDATED'
    | 'SUPPORT_TICKET_UPDATED';
  requestId?: number;
  responderUserId?: number;
  customerUserId?: number;
  status?: string;
  timestamp: string;
}

interface ConnectedClient {
  id: string;
  userId: number;
  role: UserRole;
  res: Response;
}

/**
 * گذرگاه رویدادهای بلادرنگ مبتنی بر Server-Sent Events (SSE)
 * با فیلتر سطح دسترسی نقش‌محور تا هیچ کاربری رویداد نامرتبط دریافت نکند.
 */
export class RealtimeBus {
  private readonly clients = new Map<string, ConnectedClient>();

  addClient(params: { userId: number; role: UserRole; res: Response }): () => void {
    const id = `${params.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.clients.set(id, { id, ...params });

    const heartbeat = setInterval(() => {
      if (!params.res.writableEnded) {
        params.res.write(`: heartbeat ${Date.now()}\n\n`);
      }
    }, 20000);
    heartbeat.unref?.();

    return () => {
      clearInterval(heartbeat);
      this.clients.delete(id);
    };
  }

  publish(event: Omit<RealtimeEventPayload, 'timestamp'>): void {
    const fullEvent: RealtimeEventPayload = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    const serialized = `event: platform_update\ndata: ${JSON.stringify(fullEvent)}\n\n`;

    for (const [id, client] of this.clients.entries()) {
      if (client.res.writableEnded) {
        this.clients.delete(id);
        continue;
      }

      const isStaff = client.role === 'operator' || client.role === 'admin';
      const isTargetCustomer =
        event.customerUserId !== undefined && client.userId === event.customerUserId;
      const isTargetResponder =
        event.responderUserId !== undefined && client.userId === event.responderUserId;
      const isBroadcastToResponders =
        event.type === 'DISPATCH_OFFERED' &&
        event.responderUserId === undefined &&
        client.role === 'responder';

      if (
        isStaff ||
        isTargetCustomer ||
        isTargetResponder ||
        isBroadcastToResponders
      ) {
        try {
          client.res.write(serialized);
        } catch {
          this.clients.delete(id);
        }
      }
    }
  }

  getConnectedCount(): number {
    return this.clients.size;
  }
}
