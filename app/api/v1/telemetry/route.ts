import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { TelemetryIngestSchema } from '@/server/src/middleware/productionHardening';
import { statePersistence } from '@/server/src/storage/statePersistence';
import { resolveUpstreamGatewayUrl } from '@/lib/upstreamProxy';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const tenantId = (req.headers.get('x-tenant-id') || 'default-tenant').trim() || 'default-tenant';
  const upstream = resolveUpstreamGatewayUrl(req);

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON payload.', code: 'MALFORMED_JSON', requestId, tenantId, timestamp: Date.now() },
      { status: 400, headers: { 'X-Request-ID': requestId, 'X-Tenant-ID': tenantId } }
    );
  }

  if (upstream) {
    const res = await fetch(`${upstream}/api/v1/telemetry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'X-Tenant-ID': tenantId,
        'x-neon-chasm-proxied': '1',
        ...(req.headers.get('authorization') ? { Authorization: req.headers.get('authorization')! } : {}),
      },
      body: JSON.stringify(rawBody),
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: { 'X-Request-ID': requestId, 'X-Tenant-ID': tenantId },
    });
  }

  const parsed = TelemetryIngestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Request payload failed strict schema validation.',
        code: 'INVALID_PAYLOAD',
        requestId,
        tenantId,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length > 0 ? issue.path.join('.') : 'body',
          message: issue.message,
          code: issue.code,
        })),
        timestamp: Date.now(),
      },
      { status: 400, headers: { 'X-Request-ID': requestId, 'X-Tenant-ID': tenantId } }
    );
  }

  const { logs, metrics, spans, resourceLogs, resourceMetrics, resourceSpans, source } = parsed.data;
  const traceId = req.headers.get('x-trace-id') || `trace-${requestId}`;

  const existing = statePersistence.loadSnapshot<Record<string, unknown>[]>('recent-telemetry', []);
  const buffer = Array.isArray(existing.data) ? [...existing.data] : [];

  if (Array.isArray(logs)) {
    for (let i = 0; i < logs.length; i++) {
      const rec = logs[i] as Record<string, unknown>;
      buffer.push({
        id: typeof rec.id === 'string' && rec.id ? rec.id : `otlp-${requestId}-${i}`,
        timestamp: typeof rec.timestamp === 'number' ? rec.timestamp : Date.now(),
        tenantId,
        requestId,
        method: typeof rec.method === 'string' ? rec.method : 'POST',
        endpoint: typeof rec.endpoint === 'string' ? rec.endpoint : '/api/v1/telemetry',
        statusCode: typeof rec.statusCode === 'number' ? rec.statusCode : 200,
        latencyMs: typeof rec.latencyMs === 'number' ? rec.latencyMs : 1,
        traceId: typeof rec.traceId === 'string' ? rec.traceId : traceId,
        spanId: typeof rec.spanId === 'string' ? rec.spanId : requestId.slice(0, 8),
        service: typeof rec.service === 'string' ? rec.service : source || 'otlp-http',
        level: typeof rec.level === 'string' ? rec.level : 'INFO',
        message: typeof rec.message === 'string' ? rec.message : 'OTLP telemetry record ingested',
      });
    }
  }

  if (Array.isArray(spans)) {
    for (let i = 0; i < spans.length; i++) {
      const sp = spans[i] as Record<string, unknown>;
      buffer.push({
        id: typeof sp.spanId === 'string' && sp.spanId ? `span-${sp.spanId}` : `span-${requestId}-${i}`,
        timestamp: typeof sp.timestamp === 'number' ? sp.timestamp : Date.now(),
        tenantId,
        requestId,
        method: typeof sp.method === 'string' ? sp.method : 'POST',
        endpoint: typeof sp.endpoint === 'string' ? sp.endpoint : typeof sp.name === 'string' ? sp.name : '/otlp/span',
        statusCode: typeof sp.statusCode === 'number' ? sp.statusCode : 200,
        latencyMs: typeof sp.durationMs === 'number' ? sp.durationMs : typeof sp.latencyMs === 'number' ? sp.latencyMs : 12,
        traceId: typeof sp.traceId === 'string' ? sp.traceId : traceId,
        spanId: typeof sp.spanId === 'string' ? sp.spanId : requestId.slice(0, 16),
        service: typeof sp.service === 'string' ? sp.service : source || 'otlp-span',
        level: 'INFO',
        message: typeof sp.name === 'string' ? `Span: ${sp.name}` : 'OTLP trace span ingested',
      });
    }
  }

  if (buffer.length > 0) {
    statePersistence.saveSnapshot('recent-telemetry', buffer.slice(-2000));
  }

  return NextResponse.json(
    {
      accepted: true,
      requestId,
      tenantId,
      processedLogs: (logs?.length || 0) + (resourceLogs?.length || 0),
      processedMetrics: (metrics?.length || 0) + (resourceMetrics?.length || 0),
      processedSpans: (spans?.length || 0) + (resourceSpans?.length || 0),
      traceId,
      timestamp: Date.now(),
    },
    { status: 202, headers: { 'X-Request-ID': requestId, 'X-Tenant-ID': tenantId, 'X-Trace-Id': traceId } }
  );
}
