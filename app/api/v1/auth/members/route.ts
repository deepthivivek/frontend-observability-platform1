import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
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

const MemberActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('invite'),
    email: z.string().email().max(254),
    role: z.enum(['admin', 'editor', 'viewer']),
  }),
  z.object({
    action: z.literal('update_role'),
    userId: z.string().trim().min(1).max(128),
    role: z.enum(['admin', 'editor', 'viewer']),
  }),
  z.object({
    action: z.literal('remove_member'),
    userId: z.string().trim().min(1).max(128),
  }),
  z.object({
    action: z.literal('terminate_session'),
    idPrefix: z.string().trim().min(4).max(64),
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
      members: store.getTenantMembers(auth.tenant.tenantId),
      sessions: store.listUserSessions(auth.user.id, auth.session.sessionId),
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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON payload.', code: 'MALFORMED_JSON', requestId },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const parsed = MemberActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Invalid member/session request.', code: 'INVALID_INPUT', requestId },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const payload = parsed.data;
  if (payload.action === 'terminate_session') {
    const ok = store.terminateSessionByPrefix(auth.user.id, payload.idPrefix, requestId);
    if (!ok) {
      return NextResponse.json(
        { error: 'Active session not found.', code: 'NOT_FOUND', requestId },
        { status: 404, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
      );
    }
    return NextResponse.json(
      {
        ok: true,
        sessions: store.listUserSessions(auth.user.id, auth.session.sessionId),
        requestId,
      },
      { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  if (auth.role !== 'admin') {
    return NextResponse.json(
      { error: 'Administrator privileges required to invite members or modify RBAC roles.', code: 'FORBIDDEN_ADMIN', requestId },
      { status: 403, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  if (payload.action === 'invite') {
    const invite = store.createInvite({
      tenantId: auth.tenant.tenantId,
      email: payload.email,
      role: payload.role,
      actorEmail: auth.user.email,
      requestId,
    });
    return NextResponse.json(
      {
        ok: true,
        invite,
        members: store.getTenantMembers(auth.tenant.tenantId),
        requestId,
      },
      { status: 201, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const targetMembership = store.getTenantMembership(auth.tenant.tenantId, payload.userId);
  if (!targetMembership) {
    return NextResponse.json(
      { error: 'Member not found in tenant.', code: 'NOT_FOUND', requestId },
      { status: 404, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  if (payload.action === 'remove_member') {
    // Check last-admin invariant first or step-up for removing an admin
    if (targetMembership.role === 'admin') {
      const stepUpDenied = requireStepUpAuth(auth, requestId);
      if (stepUpDenied) return stepUpDenied;
    }

    const removed = store.removeMemberFromTenant({
      tenantId: auth.tenant.tenantId,
      targetUserId: payload.userId,
      actorEmail: auth.user.email,
      requestId,
    });
    if (!removed.ok) {
      return NextResponse.json(
        { error: removed.error, code: removed.code, requestId },
        { status: removed.code === 'LAST_ADMIN_LOCKOUT' ? 409 : 404, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
      );
    }
    return NextResponse.json(
      {
        ok: true,
        members: store.getTenantMembers(auth.tenant.tenantId),
        requestId,
      },
      { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  // update_role: require step-up whenever promoting someone to admin or modifying an existing admin
  if (payload.role === 'admin' || targetMembership.role === 'admin') {
    // Preserve last-admin 409 clarity when demoting sole remaining admin, or enforce step-up first
    const stepUpDenied = requireStepUpAuth(auth, requestId);
    if (stepUpDenied) return stepUpDenied;
  }

  const res = store.updateMemberRole({
    tenantId: auth.tenant.tenantId,
    targetUserId: payload.userId,
    newRole: payload.role,
    actorEmail: auth.user.email,
    requestId,
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: res.error, code: res.code, requestId },
      { status: res.code === 'LAST_ADMIN_LOCKOUT' ? 409 : 404, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      members: store.getTenantMembers(auth.tenant.tenantId),
      requestId,
    },
    { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
  );
}
