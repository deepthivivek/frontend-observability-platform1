import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthStore,
  getPrivateHeaders,
  validateCsrfOrigin,
} from '@/src/lib/server/authStore';
import {
  authenticateSessionOrApiKey,
  authenticateTenantSession,
  getRequestId,
  requireStepUpAuth,
} from '@/src/lib/server/authRequestHelper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const auth = authenticateSessionOrApiKey(req, 'telemetry:read', requestId);
  if (!auth.ok) {
    return auth.response;
  }

  const tenantId = auth.tenant.tenantId;
  const store = getAuthStore();
  const limit = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 200)));
  const records = store.getTelemetryRecords(tenantId, limit);

  return NextResponse.json(
    {
      requestId,
      tenantId,
      totalBuffered: records.length,
      records,
      timestamp: Date.now(),
    },
    { status: 200, headers: getPrivateHeaders(requestId, tenantId) }
  );
}

export async function DELETE(req: NextRequest) {
  const requestId = getRequestId(req);
  if (!validateCsrfOrigin(req)) {
    return NextResponse.json(
      { error: 'Invalid CSRF request origin.', code: 'CSRF_FORBIDDEN', requestId },
      { status: 403, headers: getPrivateHeaders(requestId) }
    );
  }

  const store = getAuthStore();
  const sessAuth = authenticateTenantSession(req, requestId);
  if (!sessAuth.ok) {
    return sessAuth.response;
  }

  if (sessAuth.role !== 'admin') {
    return NextResponse.json(
      { error: 'Administrator privileges required to purge tenant telemetry.', code: 'FORBIDDEN_ADMIN', requestId },
      { status: 403, headers: getPrivateHeaders(requestId, sessAuth.tenant.tenantId) }
    );
  }

  const stepUpDenied = requireStepUpAuth(sessAuth, requestId);
  if (stepUpDenied) return stepUpDenied;

  const purgedCount = store.purgeTelemetryRecords(
    sessAuth.tenant.tenantId,
    sessAuth.user.email,
    requestId
  );

  return NextResponse.json(
    {
      ok: true,
      tenantId: sessAuth.tenant.tenantId,
      purgedCount,
      requestId,
    },
    { status: 200, headers: getPrivateHeaders(requestId, sessAuth.tenant.tenantId) }
  );
}
