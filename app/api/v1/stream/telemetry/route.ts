import { NextRequest, NextResponse } from 'next/server';
import { getAuthStore, getPrivateHeaders } from '@/src/lib/server/authStore';
import { authenticateTenantSession, getRequestId } from '@/src/lib/server/authRequestHelper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const auth = authenticateTenantSession(req, requestId);
  if (!auth.ok) {
    return auth.response;
  }

  const store = getAuthStore();
  const tenantId = auth.tenant.tenantId;
  const encoder = new TextEncoder();

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let unsubscribeTelemetry: (() => void) | null = null;
  let cleanedUp = false;
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (unsubscribeTelemetry) {
      unsubscribeTelemetry();
      unsubscribeTelemetry = null;
    }
    if (req.signal) {
      req.signal.removeEventListener('abort', cleanup);
    }
    if (streamController) {
      try {
        streamController.close();
      } catch {
        // Stream already closed
      }
      streamController = null;
    }
  };

  // Pre-verify SSE subscriber capacity before returning 200 OK stream
  let subscribed = false;
  let subscriptionListener: ((records: import('@/src/lib/server/authStore').TelemetryRecord[]) => void) | null = null;

  const subCheck = store.subscribeTenantTelemetry(tenantId, (records) => {
    if (subscriptionListener) {
      subscriptionListener(records);
    }
  });

  if (!subCheck.ok) {
    return NextResponse.json(
      {
        error:
          subCheck.reason === 'TENANT_SSE_LIMIT'
            ? 'Maximum active SSE stream connections reached for this workspace.'
            : 'Global SSE stream connection limit reached.',
        code: 'TOO_MANY_STREAMS',
        requestId,
      },
      {
        status: 429,
        headers: {
          ...getPrivateHeaders(requestId, tenantId),
          'Retry-After': '5',
        },
      }
    );
  }

  subscribed = true;
  unsubscribeTelemetry = subCheck.unsubscribe;

  if (req.signal) {
    req.signal.addEventListener('abort', cleanup, { once: true });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      if (req.signal?.aborted) {
        cleanup();
        return;
      }

      const handshake = JSON.stringify({
        type: 'handshake_ack',
        payload: { tenantId, role: auth.role, requestId },
        timestamp: Date.now(),
      });
      controller.enqueue(encoder.encode(`event: handshake_ack\ndata: ${handshake}\n\n`));

      subscriptionListener = (records) => {
        if (cleanedUp) return;
        try {
          const tick = JSON.stringify({
            type: 'telemetry_tick',
            payload: {
              tenantId,
              processedLogs: records.length,
              traceId: records[0]?.traceId || `trace-${Date.now()}`,
              throughputEstimateRps: records.length,
              records,
            },
            timestamp: Date.now(),
          });
          controller.enqueue(encoder.encode(`event: telemetry_tick\ndata: ${tick}\n\n`));
        } catch {
          cleanup();
        }
      };

      heartbeatTimer = setInterval(() => {
        if (cleanedUp) return;
        try {
          const pong = JSON.stringify({
            type: 'pong',
            payload: { tenantId, ts: Date.now() },
            timestamp: Date.now(),
          });
          controller.enqueue(encoder.encode(`event: pong\ndata: ${pong}\n\n`));
        } catch {
          cleanup();
        }
      }, 15000);
    },
    cancel() {
      cleanup();
    },
  });

  if (!subscribed) {
    cleanup();
  }

  return new NextResponse(stream, {
    status: 200,
    headers: {
      ...getPrivateHeaders(requestId, tenantId),
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      Connection: 'keep-alive',
    },
  });
}
