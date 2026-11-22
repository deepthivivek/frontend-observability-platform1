import { NextRequest, NextResponse } from 'next/server';
import { TelemetryIngestSchema } from '@/server/src/middleware/productionHardening';
import {
  TelemetryRecord,
  getAuthStore,
  getPrivateHeaders,
  validateCsrfOrigin,
} from '@/src/lib/server/authStore';
import {
  authenticateSessionOrApiKey,
  getRequestId,
} from '@/src/lib/server/authRequestHelper';
import { redactSensitivePayload } from '@/src/lib/server/securityUtils';

export const dynamic = 'force-dynamic';

const MAX_INGEST_BYTES = 1024 * 1024; // 1 MiB guardrail per batch

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);

  const contentLength = Number(req.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_INGEST_BYTES) {
    return NextResponse.json(
      {
        error: `Payload exceeds ${MAX_INGEST_BYTES} byte ingestion cap.`,
        code: 'PAYLOAD_TOO_LARGE',
        requestId,
      },
      { status: 413, headers: getPrivateHeaders(requestId) }
    );
  }

  // If browser cookie session (no Bearer key), enforce CSRF origin check
  if (!req.headers.get('authorization') && !req.headers.get('x-api-key') && !validateCsrfOrigin(req)) {
    return NextResponse.json(
      { error: 'Invalid CSRF request origin.', code: 'CSRF_FORBIDDEN', requestId },
      { status: 403, headers: getPrivateHeaders(requestId) }
    );
  }

  const auth = authenticateSessionOrApiKey(req, 'ingest:write', requestId);
  if (!auth.ok) {
    return auth.response;
  }

  const tenant = auth.tenant;
  const tenantId = tenant.tenantId;
  const store = getAuthStore();

  if (tenant.ingestionPaused) {
    return NextResponse.json(
      {
        error: 'Telemetry ingestion is currently paused for this company workspace.',
        code: 'INGESTION_PAUSED',
        tenantId,
        requestId,
      },
      {
        status: 503,
        headers: {
          ...getPrivateHeaders(requestId, tenantId),
          'Retry-After': '30',
        },
      }
    );
  }

  const rateCheck = store.consumeTenantRateLimit(tenant);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: 'Tenant ingestion rate limit exceeded.',
        code: 'RATE_LIMITED',
        tenantId,
        retryAfterSec: rateCheck.retryAfterSec,
        requestId,
      },
      {
        status: 429,
        headers: {
          ...getPrivateHeaders(requestId, tenantId),
          'Retry-After': String(rateCheck.retryAfterSec),
        },
      }
    );
  }

  let rawText = '';
  try {
    rawText = await req.text();
  } catch {
    return NextResponse.json(
      { error: 'Unable to read request body.', code: 'READ_ERROR', requestId, tenantId },
      { status: 400, headers: getPrivateHeaders(requestId, tenantId) }
    );
  }

  if (Buffer.byteLength(rawText, 'utf8') > MAX_INGEST_BYTES) {
    return NextResponse.json(
      {
        error: `Payload exceeds ${MAX_INGEST_BYTES} byte ingestion cap.`,
        code: 'PAYLOAD_TOO_LARGE',
        tenantId,
        requestId,
      },
      { status: 413, headers: getPrivateHeaders(requestId, tenantId) }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = JSON.parse(rawText);
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON payload.', code: 'MALFORMED_JSON', requestId, tenantId, timestamp: Date.now() },
      { status: 400, headers: getPrivateHeaders(requestId, tenantId) }
    );
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
      { status: 400, headers: getPrivateHeaders(requestId, tenantId) }
    );
  }

  const idempotencyKey =
    req.headers.get('x-idempotency-key')?.trim() ||
    req.headers.get('idempotency-key')?.trim() ||
    (req.headers.get('x-request-id') ? `req:${req.headers.get('x-request-id')}` : undefined);

  if (idempotencyKey && store.isDuplicateIngest(tenantId, idempotencyKey)) {
    return NextResponse.json(
      {
        accepted: true,
        deduplicated: true,
        requestId,
        tenantId,
        processedLogs: 0,
        processedMetrics: 0,
        processedSpans: 0,
        timestamp: Date.now(),
      },
      { status: 202, headers: getPrivateHeaders(requestId, tenantId) }
    );
  }

  // Recursively redact sensitive PII/credentials BEFORE creating, storing, broadcasting, or auditing records
  const { sanitized, redactedCount } = redactSensitivePayload(parsed.data);
  if (redactedCount > 0) {
    store.recordRedactedSecrets(redactedCount);
  }

  const { logs, metrics, spans, resourceLogs, resourceMetrics, resourceSpans, source } = sanitized;
  const traceId = req.headers.get('x-trace-id') || `trace-${requestId}`;
  const recordsToStore: TelemetryRecord[] = [];

  const extractAttributes = (item: Record<string, unknown>): Record<string, unknown> | undefined => {
    const attrs: Record<string, unknown> = {};
    if (item.headers && typeof item.headers === 'object' && !Array.isArray(item.headers)) {
      attrs.headers = item.headers;
    }
    if (item.requestHeaders && typeof item.requestHeaders === 'object' && !Array.isArray(item.requestHeaders)) {
      attrs.requestHeaders = item.requestHeaders;
    }
    if (item.attributes && typeof item.attributes === 'object' && !Array.isArray(item.attributes)) {
      attrs.attributes = item.attributes;
    }
    return Object.keys(attrs).length > 0 ? attrs : undefined;
  };

  if (Array.isArray(logs)) {
    for (let i = 0; i < logs.length; i++) {
      const rec = logs[i] as Record<string, unknown>;
      const attributes = extractAttributes(rec);
      recordsToStore.push({
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
        ...(attributes ? { attributes } : {}),
      });
    }
  }

  if (Array.isArray(spans)) {
    for (let i = 0; i < spans.length; i++) {
      const sp = spans[i] as Record<string, unknown>;
      const attributes = extractAttributes(sp);
      recordsToStore.push({
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
        ...(attributes ? { attributes } : {}),
      });
    }
  }

  if (recordsToStore.length > 0) {
    store.appendTelemetryRecords(tenantId, recordsToStore);
  }

  return NextResponse.json(
    {
      accepted: true,
      deduplicated: false,
      redactedCount,
      requestId,
      tenantId,
      processedLogs: (logs?.length || 0) + (resourceLogs?.length || 0),
      processedMetrics: (metrics?.length || 0) + (resourceMetrics?.length || 0),
      processedSpans: (spans?.length || 0) + (resourceSpans?.length || 0),
      traceId,
      timestamp: Date.now(),
    },
    {
      status: 202,
      headers: {
        ...getPrivateHeaders(requestId, tenantId),
        'X-Trace-Id': traceId,
      },
    }
  );
}
