import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getAuthStore,
  getPrivateHeaders,
  sanitizeUser,
  validateCsrfOrigin,
} from '@/src/lib/server/authStore';
import {
  authenticateTenantSession,
  getRequestId,
  requireStepUpAuth,
} from '@/src/lib/server/authRequestHelper';
import { validatePasswordStrength } from '@/src/lib/server/securityUtils';

export const dynamic = 'force-dynamic';

const MfaActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('setup') }),
  z.object({
    action: z.literal('confirm'),
    code: z.string().trim().min(6).max(16),
  }),
  z.object({ action: z.literal('disable') }),
  z.object({ action: z.literal('regenerate_recovery') }),
  z.object({
    action: z.literal('change_password'),
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(12).max(128),
  }),
]);

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const auth = authenticateTenantSession(req, requestId);
  if (!auth.ok) {
    return auth.response;
  }

  return NextResponse.json(
    {
      totpEnabled: Boolean(auth.user.totpEnabled),
      recoveryCodesRemaining: auth.user.recoveryCodeHashes?.length ?? 0,
      stepUpActive: getAuthStore().isStepUpActive(auth.session),
      stepUpVerifiedUntil: auth.session.stepUpVerifiedUntil ?? null,
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

  const parsed = MfaActionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || 'Invalid MFA or password action payload.',
        code: 'INVALID_INPUT',
        requestId,
      },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const payload = parsed.data;

  if (payload.action === 'setup') {
    const setup = store.beginTotpEnrollment(auth.user.id, auth.tenant.tenantId, requestId);
    if (!setup) {
      return NextResponse.json(
        { error: 'Unable to initiate TOTP setup.', code: 'NOT_FOUND', requestId },
        { status: 404, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
      );
    }
    return NextResponse.json(
      {
        ok: true,
        secret: setup.secret,
        otpauthUri: setup.otpauthUri,
        requestId,
      },
      { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  if (payload.action === 'confirm') {
    const confirmed = store.confirmTotpEnrollment(
      auth.user.id,
      auth.tenant.tenantId,
      payload.code,
      requestId
    );
    if (!confirmed.ok) {
      return NextResponse.json(
        { error: confirmed.error || 'Invalid TOTP verification code.', code: 'INVALID_TOTP', requestId },
        { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
      );
    }
    return NextResponse.json(
      {
        ok: true,
        totpEnabled: true,
        recoveryCodes: confirmed.recoveryCodes || [],
        user: sanitizeUser(store.getUserById(auth.user.id) || auth.user),
        requestId,
      },
      { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  if (payload.action === 'disable') {
    const stepUpDenied = requireStepUpAuth(auth, requestId);
    if (stepUpDenied) return stepUpDenied;

    store.disableTotp(auth.user.id, auth.tenant.tenantId, requestId);
    return NextResponse.json(
      {
        ok: true,
        totpEnabled: false,
        user: sanitizeUser(store.getUserById(auth.user.id) || auth.user),
        requestId,
      },
      { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  if (payload.action === 'regenerate_recovery') {
    const stepUpDenied = requireStepUpAuth(auth, requestId);
    if (stepUpDenied) return stepUpDenied;

    const codes = store.regenerateRecoveryCodes(auth.user.id, auth.tenant.tenantId, requestId);
    if (!codes) {
      return NextResponse.json(
        { error: 'Enable TOTP MFA before generating backup recovery codes.', code: 'MFA_NOT_ENABLED', requestId },
        { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
      );
    }
    return NextResponse.json(
      {
        ok: true,
        recoveryCodes: codes,
        recoveryCodesRemaining: codes.length,
        requestId,
      },
      { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  // change_password
  const strength = validatePasswordStrength(payload.newPassword, {
    email: auth.user.email,
    name: auth.user.name,
  });
  if (!strength.valid) {
    return NextResponse.json(
      { error: strength.reason || 'Password does not meet complexity policy.', code: 'WEAK_PASSWORD', requestId },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const changed = store.changeUserPassword({
    userId: auth.user.id,
    currentSessionId: auth.session.sessionId,
    currentPassword: payload.currentPassword,
    newPassword: payload.newPassword,
    tenantId: auth.tenant.tenantId,
    requestId,
  });

  if (!changed.ok) {
    return NextResponse.json(
      { error: changed.error || 'Unable to change password.', code: changed.code || 'INVALID_CREDENTIALS', requestId },
      { status: 401, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
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
