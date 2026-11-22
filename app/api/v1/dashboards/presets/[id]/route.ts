import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthStore,
  getPrivateHeaders,
  validateCsrfOrigin,
} from '@/src/lib/server/authStore';
import { authenticateTenantSession, getRequestId } from '@/src/lib/server/authRequestHelper';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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
      { error: 'Viewer role cannot delete custom dashboard presets.', code: 'ROLE_FORBIDDEN', requestId },
      { status: 403, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  store.deleteDashboardPreset(auth.tenant.tenantId, id, auth.user.email, requestId);

  return NextResponse.json(
    { ok: true, tenantId: auth.tenant.tenantId, requestId },
    { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
  );
}
