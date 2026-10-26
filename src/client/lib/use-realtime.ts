import { useEffect, useRef } from 'react';

export interface PlatformRealtimeEvent {
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

/**
 * اشتراک بلادرنگ در جریان رویدادهای سرور (SSE) با مسیر نسبی `/api/events/stream`
 * سازگار با پراکسی پیش‌نمایش و همراه با قطع اتصال تمیز هنگام خروج از صفحه.
 */
export function useRealtimeEvents(
  enabled: boolean,
  onEvent: (event: PlatformRealtimeEvent) => void
) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') {
      return;
    }

    const source = new EventSource('/api/events/stream', {
      withCredentials: true,
    });

    const handleUpdate = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as PlatformRealtimeEvent;
        callbackRef.current(parsed);
      } catch {
        // ignore malformed frame
      }
    };

    source.addEventListener('platform_update', handleUpdate as EventListener);

    return () => {
      source.removeEventListener('platform_update', handleUpdate as EventListener);
      source.close();
    };
  }, [enabled]);
}
