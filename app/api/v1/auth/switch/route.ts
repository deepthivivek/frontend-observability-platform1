import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getAuthStore,
  getPrivateHeaders,
  sanitizeTenantWorkspace,
  validateCsrfOrigin,
} from '@/src/lib/server/authStore';
import { authenticateTenantSession, getRequestId } from '@/src/lib/server/authRequestHelper';

export const dynamic = 'force-dynamic';

const SwitchSchema = z.object({
  tenantId: z.string().trim().min(1).max(128),
});

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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON payload.', code: 'MALFORMED_JSON', requestId },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const parsed = SwitchSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Valid target tenantId is required.', code: 'INVALID_INPUT', requestId },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const switched = store.switchActiveTenant(auth.session, parsed.data.tenantId, requestId);
  if (!switched) {
    return NextResponse.json(
      { error: 'You do not belong to the requested company workspace.', code: 'TENANT_FORBIDDEN', requestId },
      { status: 403, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      tenant: sanitizeTenantWorkspace(switched.tenant, switched.role),
      role: switched.role,
      tenants: store.getUserWorkspaces(auth.user.id).map((w) => sanitizeTenantWorkspace(w, w.role)),
      requestId,
    },
    { status: 200, headers: getPrivateHeaders(requestId, switched.tenant.tenantId) }
  );
}
