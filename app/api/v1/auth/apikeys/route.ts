import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  ApiKeyScope,
  getAuthStore,
  getPrivateHeaders,
  validateCsrfOrigin,
} from '@/src/lib/server/authStore';
import {
  authenticateTenantSession,
  getRequestId,
  requireStepUpAuth,
} from '@/src/lib/server/authRequestHelper';

export const dynamic = 'force-dynamic';

const ApiKeyActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name: z.string().trim().min(2).max(100),
    scopes: z.array(z.enum(['ingest:write', 'telemetry:read'])).min(1).default(['ingest:write', 'telemetry:read']),
    allowedCidrs: z.array(z.string().trim().min(1).max(64)).optional(),
    expiresInDays: z.number().int().min(1).max(3650).optional(),
  }),
  z.object({
    action: z.literal('rotate'),
    keyId: z.string().trim().min(1).max(128),
    graceMinutes: z.number().int().min(1).max(1440).optional(),
  }),
  z.object({
    action: z.literal('revoke'),
    keyId: z.string().trim().min(1).max(128),
  }),
]);

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const auth = authenticateTenantSession(req, requestId);
  if (!auth.ok) {
    return auth.response;
  }
  const store = getAuthStore();

  return NextResponse.json(
    {
      keys: store.listApiKeys(auth.tenant.tenantId),
      role: auth.role,
      requestId,
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

  if (auth.role !== 'admin') {
    return NextResponse.json(
      { error: 'Administrator role required to create, rotate, or revoke API keys.', code: 'FORBIDDEN_ADMIN', requestId },
      { status: 403, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON payload.', code: 'MALFORMED_JSON', requestId },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const parsed = ApiKeyActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid API key action payload.', code: 'INVALID_INPUT', requestId },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const payload = parsed.data;
  if (payload.action === 'create') {
    const expiresAt = payload.expiresInDays
      ? new Date(Date.now() + payload.expiresInDays * 86400000).toISOString()
      : undefined;
    const created = store.createApiKey({
      tenantId: auth.tenant.tenantId,
      name: payload.name,
      scopes: payload.scopes as ApiKeyScope[],
      allowedCidrs: payload.allowedCidrs,
      expiresAt,
      actorEmail: auth.user.email,
      requestId,
    });
    return NextResponse.json(
      {
        ok: true,
        key: created.record,
        plainSecret: created.plainSecret,
        keys: store.listApiKeys(auth.tenant.tenantId),
        requestId,
      },
      { status: 201, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  // Rotating or revoking API keys requires active step-up verification
  const stepUpDenied = requireStepUpAuth(auth, requestId);
  if (stepUpDenied) return stepUpDenied;

  if (payload.action === 'rotate') {
    const rotated = store.rotateApiKey({
      tenantId: auth.tenant.tenantId,
      keyId: payload.keyId,
      graceMinutes: payload.graceMinutes,
      actorEmail: auth.user.email,
      requestId,
    });
    if (!rotated) {
      return NextResponse.json(
        { error: 'Active API key not found for rotation.', code: 'NOT_FOUND', requestId },
        { status: 404, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
      );
    }
    return NextResponse.json(
      {
        ok: true,
        key: rotated.record,
        plainSecret: rotated.plainSecret,
        previousGraceExpiresAt: rotated.previousGraceExpiresAt,
        keys: store.listApiKeys(auth.tenant.tenantId),
        requestId,
      },
      { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const revoked = store.revokeApiKey(auth.tenant.tenantId, payload.keyId, auth.user.email, requestId);
  if (!revoked) {
    return NextResponse.json(
      { error: 'API key not found or already revoked.', code: 'NOT_FOUND', requestId },
      { status: 404, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }
  return NextResponse.json(
    {
      ok: true,
      keys: store.listApiKeys(auth.tenant.tenantId),
      requestId,
    },
    { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
  );
}
