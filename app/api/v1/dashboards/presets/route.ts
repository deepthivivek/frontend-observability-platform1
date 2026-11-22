import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthStore,
  getPrivateHeaders,
  validateCsrfOrigin,
} from '@/src/lib/server/authStore';
import { authenticateTenantSession, getRequestId } from '@/src/lib/server/authRequestHelper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const auth = authenticateTenantSession(req, requestId);
  if (!auth.ok) {
    return auth.response;
  }
  const store = getAuthStore();

  return NextResponse.json(
    {
      tenantId: auth.tenant.tenantId,
      presets: store.getDashboardPresets(auth.tenant.tenantId),
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

  if (auth.role === 'viewer') {
    return NextResponse.json(
      { error: 'Viewer role cannot save custom dashboard presets.', code: 'ROLE_FORBIDDEN', requestId },
      { status: 403, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON preset payload.', code: 'MALFORMED_JSON', requestId },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json(
      { error: 'Invalid dashboard preset payload.', code: 'INVALID_INPUT', requestId },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const presets = store.saveDashboardPreset(
    auth.tenant.tenantId,
    body as Record<string, unknown>,
    auth.user.email,
    requestId
  );

  return NextResponse.json(
    { ok: true, tenantId: auth.tenant.tenantId, presets, requestId },
    { status: 201, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
  );
}
