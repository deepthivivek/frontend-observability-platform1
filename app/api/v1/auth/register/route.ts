import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getAuthStore,
  getPrivateHeaders,
  sanitizeTenantWorkspace,
  sanitizeUser,
  setSessionCookie,
  validateCsrfOrigin,
} from '@/src/lib/server/authStore';
import { getClientIp, getRequestId, rejectSpoofedInternalHeaders } from '@/src/lib/server/authRequestHelper';
import { validatePasswordStrength } from '@/src/lib/server/securityUtils';

export const dynamic = 'force-dynamic';

const RegisterSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().trim().min(2).max(100),
  password: z.string().min(12, 'Password must be at least 12 characters long.').max(128),
  companyName: z.string().trim().min(2).max(120).optional(),
  inviteToken: z.string().trim().max(128).optional(),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const spoofed = rejectSpoofedInternalHeaders(req, requestId);
  if (spoofed) return spoofed;

  if (!validateCsrfOrigin(req)) {
    return NextResponse.json(
      { error: 'Invalid CSRF request origin.', code: 'CSRF_FORBIDDEN', requestId },
      { status: 403, headers: getPrivateHeaders(requestId) }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON registration payload.', code: 'MALFORMED_JSON', requestId },
      { status: 400, headers: getPrivateHeaders(requestId) }
    );
  }

  const parsed = RegisterSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ||
          'Invalid registration input (password must be at least 12 characters).',
        code: 'INVALID_INPUT',
        requestId,
      },
      { status: 400, headers: getPrivateHeaders(requestId) }
    );
  }

  const strength = validatePasswordStrength(parsed.data.password, {
    email: parsed.data.email,
    name: parsed.data.name,
  });
  if (!strength.valid) {
    return NextResponse.json(
      {
        error: strength.reason || 'Password does not meet security policy requirements.',
        code: 'WEAK_PASSWORD',
        requestId,
      },
      { status: 400, headers: getPrivateHeaders(requestId) }
    );
  }

  const store = getAuthStore();
  try {
    const result = store.registerUserAndWorkspace({
      email: parsed.data.email,
      name: parsed.data.name,
      password: parsed.data.password,
      companyName: parsed.data.companyName,
      inviteToken: parsed.data.inviteToken,
      requestId,
      ipAddress: getClientIp(req),
      userAgent: req.headers.get('user-agent') || undefined,
    });

    const signedCookie = store.createSignedCookieToken(result.session.sessionId);
    const workspaces = store
      .getUserWorkspaces(result.user.id)
      .map((w) => sanitizeTenantWorkspace(w, w.role));
    const sessions = store.listUserSessions(result.user.id, result.session.sessionId);

    const res = NextResponse.json(
      {
        authenticated: true,
        user: sanitizeUser(result.user),
        tenant: sanitizeTenantWorkspace(result.tenant, result.role),
        tenants: workspaces,
        role: result.role,
        stepUpActive: false,
        idleExpiresAt: result.session.idleExpiresAt,
        expiresAt: result.session.expiresAt,
        sessions,
        requestId,
      },
      { status: 201, headers: getPrivateHeaders(requestId, result.tenant.tenantId) }
    );
    setSessionCookie(res, req, signedCookie);
    return res;
  } catch (err) {
    const code = err instanceof Error ? err.message : 'REGISTRATION_FAILED';
    if (code === 'ACCOUNT_EXISTS') {
      return NextResponse.json(
        { error: 'Unable to register with the provided details.', code: 'REGISTRATION_CONFLICT', requestId },
        { status: 409, headers: getPrivateHeaders(requestId) }
      );
    }
    if (code === 'INVALID_INVITE') {
      return NextResponse.json(
        { error: 'The invitation token is invalid, expired, or does not match your email.', code: 'INVALID_INVITE', requestId },
        { status: 400, headers: getPrivateHeaders(requestId) }
      );
    }
    return NextResponse.json(
      { error: 'Registration failed.', code: 'REGISTRATION_ERROR', requestId },
      { status: 500, headers: getPrivateHeaders(requestId) }
    );
  }
}
