import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getAuthStore,
  getPrivateHeaders,
  validateCsrfOrigin,
} from '@/src/lib/server/authStore';
import {
  authenticateTenantSession,
  getClientIp,
  getRequestId,
} from '@/src/lib/server/authRequestHelper';

export const dynamic = 'force-dynamic';

const StepUpSchema = z
  .object({
    password: z.string().min(1).max(128).optional(),
    totpCode: z.string().trim().min(6).max(16).optional(),
    recoveryCode: z.string().trim().min(6).max(32).optional(),
  })
  .refine((v) => Boolean(v.password || v.totpCode || v.recoveryCode), {
    message: 'Supply your password or a valid 6-digit TOTP / recovery code.',
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
  const rateKey = `stepup:${getClientIp(req)}:${auth.user.id}`;
  const rateCheck = store.checkLoginRateLimit(rateKey);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: `Too many failed step-up verification attempts. Retry in ${rateCheck.retryAfterSec}s.`,
        code: 'RATE_LIMITED',
        retryAfterSec: rateCheck.retryAfterSec,
        requestId,
      },
      {
        status: 429,
        headers: {
          ...getPrivateHeaders(requestId, auth.tenant.tenantId),
          'Retry-After': String(rateCheck.retryAfterSec),
        },
      }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON step-up payload.', code: 'MALFORMED_JSON', requestId },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const parsed = StepUpSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || 'Invalid step-up credentials payload.',
        code: 'INVALID_INPUT',
        requestId,
      },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const result = store.verifyStepUp({
    sessionId: auth.session.sessionId,
    userId: auth.user.id,
    tenantId: auth.tenant.tenantId,
    password: parsed.data.password,
    totpCode: parsed.data.totpCode,
    recoveryCode: parsed.data.recoveryCode,
    requestId,
  });

  if (!result.ok) {
    store.recordLoginFailure(rateKey);
    store.recordAuthCheck(false);
    return NextResponse.json(
      {
        error: result.error || 'Step-up re-authentication failed.',
        code: 'STEP_UP_FAILED',
        requestId,
      },
      { status: 401, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  store.clearLoginFailures(rateKey);
  return NextResponse.json(
    {
      ok: true,
      stepUpActive: true,
      stepUpVerifiedUntil: result.stepUpVerifiedUntil,
      expiresInSeconds: 300,
      requestId,
    },
    { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
  );
}
