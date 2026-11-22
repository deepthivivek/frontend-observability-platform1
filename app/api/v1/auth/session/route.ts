import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthStore,
  getPrivateHeaders,
  sanitizeTenantWorkspace,
  sanitizeUser,
} from '@/src/lib/server/authStore';
import { getRequestId, rejectSpoofedInternalHeaders } from '@/src/lib/server/authRequestHelper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const spoofed = rejectSpoofedInternalHeaders(req, requestId);
  if (spoofed) return spoofed;

  const store = getAuthStore();
  const hasUsers = store.hasAnyUsers();
  const auth = store.resolveSessionFromRequest(req);

  if (!auth) {
    return NextResponse.json(
      {
        authenticated: false,
        hasUsers,
        user: null,
        tenant: null,
        tenants: [],
        role: null,
        stepUpActive: false,
        stepUpVerifiedUntil: null,
        idleExpiresAt: null,
        expiresAt: null,
        sessions: [],
        requestId,
      },
      { status: 200, headers: getPrivateHeaders(requestId) }
    );
  }

  const workspaces = store
    .getUserWorkspaces(auth.user.id)
    .map((w) => sanitizeTenantWorkspace(w, w.role));
  const sessions = store.listUserSessions(auth.user.id, auth.session.sessionId);

  return NextResponse.json(
    {
      authenticated: true,
      hasUsers,
      user: sanitizeUser(auth.user),
      tenant: sanitizeTenantWorkspace(auth.tenant, auth.role),
      tenants: workspaces,
      role: auth.role,
      stepUpActive: store.isStepUpActive(auth.session),
      stepUpVerifiedUntil: auth.session.stepUpVerifiedUntil ?? null,
      idleExpiresAt: auth.session.idleExpiresAt,
      expiresAt: auth.session.expiresAt,
      sessions,
      requestId,
    },
    { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
  );
}
