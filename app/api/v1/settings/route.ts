import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getAuthStore,
  getPrivateHeaders,
  validateCsrfOrigin,
} from '@/src/lib/server/authStore';
import { authenticateTenantSession, getRequestId } from '@/src/lib/server/authRequestHelper';
import { validateOutboundWebhookUrl } from '@/src/lib/server/securityUtils';

export const dynamic = 'force-dynamic';

const SettingsUpdateSchema = z.object({
  otlpEndpoint: z.string().min(1).max(256).default('/api/v1/telemetry'),
  wsUrl: z.string().max(256).default(''),
  sseUrl: z.string().min(1).max(256).default('/api/v1/stream/telemetry'),
  latencyWarnMs: z.number().min(1).max(60000).optional(),
  latencyCritMs: z.number().min(1).max(60000).optional(),
  errorRateThresholdPct: z.number().min(0).max(100).optional(),
  ingestionPaused: z.boolean().optional(),
  ingestionRateLimitRps: z.number().int().min(10).max(100000).optional(),
  retentionTtlDays: z.number().int().min(1).max(3650).optional(),
  webhookUrl: z.string().max(512).optional(),
});

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const auth = authenticateTenantSession(req, requestId);
  if (!auth.ok) {
    return auth.response;
  }
  const store = getAuthStore();

  return NextResponse.json(
    {
      requestId,
      tenantId: auth.tenant.tenantId,
      role: auth.role,
      settings: {
        otlpEndpoint: '/api/v1/telemetry',
        wsUrl: '',
        sseUrl: '/api/v1/stream/telemetry',
        tenantId: auth.tenant.tenantId,
        latencyWarnMs: auth.tenant.latencyWarnMs,
        latencyCritMs: auth.tenant.latencyCritMs,
        errorRateThresholdPct: auth.tenant.errorRateThresholdPct,
        ingestionPaused: auth.tenant.ingestionPaused,
        ingestionRateLimitRps: auth.tenant.ingestionRateLimitRps,
        retentionTtlDays: auth.tenant.retentionTtlDays,
        hasWebhookUrl: Boolean(auth.tenant.webhookUrlEncrypted),
        maskedWebhookUrl: store.getMaskedWebhookUrl(auth.tenant),
        updatedAt: Date.now(),
      },
      timestamp: Date.now(),
    },
    { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
  );
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  if (!validateCsrfOrigin(req)) {
    return NextResponse.json(
      { error: 'Invalid CSRF request origin.', code: 'CSRF_FORBIDDEN', requestId },
      { status: 403, headers: getPrivateHeaders(requestId) }
    );
  }

  const auth = authenticateTenantSession(req, requestId);
  if (!auth.ok) {
    return auth.response;
  }
  const store = getAuthStore();

  if (auth.role === 'viewer') {
    return NextResponse.json(
      { error: 'Viewer role cannot modify workspace settings.', code: 'ROLE_FORBIDDEN', requestId },
      { status: 403, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON settings payload.', code: 'MALFORMED_JSON', requestId, tenantId: auth.tenant.tenantId },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const parsed = SettingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Settings payload validation failed.',
        code: 'INVALID_SETTINGS',
        requestId,
        tenantId: auth.tenant.tenantId,
        issues: parsed.error.issues,
      },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const isAdminOnlyMutation =
    parsed.data.ingestionPaused !== undefined ||
    parsed.data.ingestionRateLimitRps !== undefined ||
    parsed.data.retentionTtlDays !== undefined ||
    parsed.data.webhookUrl !== undefined;

  if (isAdminOnlyMutation && auth.role !== 'admin') {
    return NextResponse.json(
      {
        error: 'Administrator privileges required to change ingestion kill-switch, rate limits, retention TTL, or outbound webhooks.',
        code: 'FORBIDDEN_ADMIN',
        requestId,
      },
      { status: 403, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  if (parsed.data.webhookUrl !== undefined && parsed.data.webhookUrl.trim().length > 0) {
    const check = validateOutboundWebhookUrl(parsed.data.webhookUrl);
    if (!check.valid) {
      return NextResponse.json(
        { error: check.reason || 'Invalid outbound webhook URL.', code: 'INVALID_WEBHOOK_URL', requestId },
        { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
      );
    }
  }

  const updated = store.updateTenantConfig(
    auth.tenant.tenantId,
    auth.user.email,
    {
      ...(parsed.data.latencyWarnMs !== undefined ? { latencyWarnMs: parsed.data.latencyWarnMs } : {}),
      ...(parsed.data.latencyCritMs !== undefined ? { latencyCritMs: parsed.data.latencyCritMs } : {}),
      ...(parsed.data.errorRateThresholdPct !== undefined
        ? { errorRateThresholdPct: parsed.data.errorRateThresholdPct }
        : {}),
      ...(parsed.data.ingestionPaused !== undefined ? { ingestionPaused: parsed.data.ingestionPaused } : {}),
      ...(parsed.data.ingestionRateLimitRps !== undefined
        ? { ingestionRateLimitRps: parsed.data.ingestionRateLimitRps }
        : {}),
      ...(parsed.data.retentionTtlDays !== undefined ? { retentionTtlDays: parsed.data.retentionTtlDays } : {}),
      ...(parsed.data.webhookUrl !== undefined ? { webhookUrl: parsed.data.webhookUrl } : {}),
    },
    requestId
  );

  if (!updated) {
    return NextResponse.json(
      { error: 'Tenant not found.', code: 'NOT_FOUND', requestId },
      { status: 404, headers: getPrivateHeaders(requestId) }
    );
  }

  return NextResponse.json(
    {
      saved: true,
      requestId,
      tenantId: updated.tenantId,
      settings: {
        otlpEndpoint: parsed.data.otlpEndpoint,
        wsUrl: parsed.data.wsUrl,
        sseUrl: parsed.data.sseUrl,
        tenantId: updated.tenantId,
        latencyWarnMs: updated.latencyWarnMs,
        latencyCritMs: updated.latencyCritMs,
        errorRateThresholdPct: updated.errorRateThresholdPct,
        ingestionPaused: updated.ingestionPaused,
        ingestionRateLimitRps: updated.ingestionRateLimitRps,
        retentionTtlDays: updated.retentionTtlDays,
        hasWebhookUrl: Boolean(updated.webhookUrlEncrypted),
        maskedWebhookUrl: store.getMaskedWebhookUrl(updated),
        updatedAt: Date.now(),
      },
      timestamp: Date.now(),
    },
    { status: 200, headers: getPrivateHeaders(requestId, updated.tenantId) }
  );
}
