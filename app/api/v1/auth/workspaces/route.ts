import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  clearSessionCookie,
  getAuthStore,
  getPrivateHeaders,
  sanitizeTenantWorkspace,
  validateCsrfOrigin,
} from '@/src/lib/server/authStore';
import {
  authenticateTenantSession,
  getRequestId,
  requireStepUpAuth,
} from '@/src/lib/server/authRequestHelper';

export const dynamic = 'force-dynamic';

const CreateWorkspaceSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  switchImmediately: z.boolean().optional().default(true),
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
      activeTenant: sanitizeTenantWorkspace(auth.tenant, auth.role),
      role: auth.role,
      tenants: store.getUserWorkspaces(auth.user.id).map((w) => sanitizeTenantWorkspace(w, w.role)),
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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON payload.', code: 'MALFORMED_JSON', requestId },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const parsed = CreateWorkspaceSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Company workspace name must be at least 2 characters.', code: 'INVALID_INPUT', requestId },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const created = store.createWorkspaceForUser({
    userId: auth.user.id,
    companyName: parsed.data.companyName,
    requestId,
  });

  if (parsed.data.switchImmediately) {
    store.switchActiveTenant(auth.session, created.tenant.tenantId, requestId);
  }

  return NextResponse.json(
    {
      ok: true,
      tenant: sanitizeTenantWorkspace(created.tenant, created.role),
      role: created.role,
      tenants: store.getUserWorkspaces(auth.user.id).map((w) => sanitizeTenantWorkspace(w, w.role)),
      requestId,
    },
    { status: 201, headers: getPrivateHeaders(requestId, created.tenant.tenantId) }
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

  const auth = authenticateTenantSession(req, requestId);
  if (!auth.ok) {
    return auth.response;
  }

  if (auth.role !== 'admin') {
    return NextResponse.json(
      { error: 'Administrator privileges required to deactivate a workspace.', code: 'FORBIDDEN_ADMIN', requestId },
      { status: 403, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const stepUpDenied = requireStepUpAuth(auth, requestId);
  if (stepUpDenied) return stepUpDenied;

  const store = getAuthStore();
  const res = store.deactivateTenantWorkspace(auth.tenant.tenantId, auth.user.email, requestId);
  if (!res.ok) {
    return NextResponse.json(
      { error: 'Workspace is already deactivated or not found.', code: 'NOT_FOUND', requestId },
      { status: 404, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const out = NextResponse.json(
    {
      ok: true,
      deactivatedTenantId: auth.tenant.tenantId,
      requestId,
    },
    { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
  );
  clearSessionCookie(out, req);
  return out;
}
