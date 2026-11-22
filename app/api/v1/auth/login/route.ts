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

export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
  totpCode: z.string().trim().min(6).max(16).optional(),
  recoveryCode: z.string().trim().min(6).max(32).optional(),
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
      { error: 'Malformed JSON login payload.', code: 'MALFORMED_JSON', requestId },
      { status: 400, headers: getPrivateHeaders(requestId) }
    );
  }

  const parsed = LoginSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS', requestId },
      { status: 401, headers: getPrivateHeaders(requestId) }
    );
  }

  const clientIp = getClientIp(req);
  const store = getAuthStore();
  const rateKey = `${clientIp}:${parsed.data.email.toLowerCase().trim()}`;
  const rateCheck = store.checkLoginRateLimit(rateKey);

  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: `Too many failed sign-in attempts. Retry in ${rateCheck.retryAfterSec}s.`,
        code: 'RATE_LIMITED',
        retryAfterSec: rateCheck.retryAfterSec,
        requestId,
      },
      {
        status: 429,
        headers: {
          ...getPrivateHeaders(requestId),
          'Retry-After': String(rateCheck.retryAfterSec),
        },
      }
    );
  }

  const authResult = store.authenticateLogin({
    email: parsed.data.email,
    password: parsed.data.password,
    totpCode: parsed.data.totpCode,
    recoveryCode: parsed.data.recoveryCode,
    requestId,
    ipAddress: clientIp,
    userAgent: req.headers.get('user-agent') || undefined,
  });

  if (authResult.status === 'INVALID_CREDENTIALS') {
    store.recordLoginFailure(rateKey);
    store.recordAuthCheck(false);
    return NextResponse.json(
      { error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS', requestId },
      { status: 401, headers: getPrivateHeaders(requestId) }
    );
  }

  if (authResult.status === 'MFA_REQUIRED') {
    return NextResponse.json(
      {
        authenticated: false,
        mfaRequired: true,
        message: 'Two-factor authenticator verification required.',
        requestId,
      },
      { status: 200, headers: getPrivateHeaders(requestId) }
    );
  }

  if (authResult.status === 'INVALID_MFA') {
    store.recordLoginFailure(rateKey);
    store.recordAuthCheck(false);
    return NextResponse.json(
      {
        error: authResult.replayed
          ? 'This authenticator code was already used in the current window. Wait for a fresh code or use a recovery code.'
          : 'Invalid two-factor authentication or recovery code.',
        code: authResult.replayed ? 'TOTP_REPLAYED' : 'INVALID_MFA',
        mfaRequired: true,
        requestId,
      },
      { status: 401, headers: getPrivateHeaders(requestId) }
    );
  }

  if (authResult.status !== 'AUTHENTICATED') {
    store.recordAuthCheck(false);
    return NextResponse.json(
      { error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS', requestId },
      { status: 401, headers: getPrivateHeaders(requestId) }
    );
  }

  store.clearLoginFailures(rateKey);
  const signedCookie = store.createSignedCookieToken(authResult.session.sessionId);
  const workspaces = store
    .getUserWorkspaces(authResult.user.id)
    .map((w) => sanitizeTenantWorkspace(w, w.role));
  const sessions = store.listUserSessions(authResult.user.id, authResult.session.sessionId);

  const res = NextResponse.json(
    {
      authenticated: true,
      user: sanitizeUser(authResult.user),
      tenant: sanitizeTenantWorkspace(authResult.tenant, authResult.role),
      tenants: workspaces,
      role: authResult.role,
      stepUpActive: store.isStepUpActive(authResult.session),
      idleExpiresAt: authResult.session.idleExpiresAt,
      expiresAt: authResult.session.expiresAt,
      sessions,
      requestId,
    },
    { status: 200, headers: getPrivateHeaders(requestId, authResult.tenant.tenantId) }
  );
  setSessionCookie(res, req, signedCookie);
  return res;
}
