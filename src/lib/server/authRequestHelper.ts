import 'server-only';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  ApiKeyScope,
  TenantWorkspace,
  UserAccount,
  UserRole,
  UserSession,
  getAuthStore,
  getPrivateHeaders,
} from './authStore';

export function getRequestId(req: NextRequest): string {
  return req.headers.get('x-request-id') || crypto.randomUUID();
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export function rejectSpoofedInternalHeaders(
  req: NextRequest,
  requestId: string
): NextResponse | null {
  if (req.headers.has('x-middleware-subrequest')) {
    getAuthStore().recordAuthCheck(false);
    return NextResponse.json(
      {
        error: 'Forbidden spoofed internal subrequest header.',
        code: 'FORBIDDEN_INTERNAL_HEADER',
        requestId,
      },
      { status: 403, headers: getPrivateHeaders(requestId) }
    );
  }
  return null;
}

export function extractBearerOrApiKey(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const apiKey = req.headers.get('x-api-key')?.trim();
  return apiKey || null;
}

export type SessionGuardResult =
  | {
      ok: true;
      user: UserAccount;
      session: UserSession;
      tenant: TenantWorkspace;
      role: UserRole;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export function authenticateTenantSession(
  req: NextRequest,
  requestId: string
): SessionGuardResult {
  const spoofed = rejectSpoofedInternalHeaders(req, requestId);
  if (spoofed) {
    return { ok: false, response: spoofed };
  }

  const store = getAuthStore();
  const sessAuth = store.resolveSessionFromRequest(req);
  if (!sessAuth) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Authentication required.', code: 'UNAUTHENTICATED', requestId },
        { status: 401, headers: getPrivateHeaders(requestId) }
      ),
    };
  }

  const requestedTenantHeader = req.headers.get('x-tenant-id')?.trim();
  if (
    requestedTenantHeader &&
    requestedTenantHeader !== 'default-tenant' &&
    requestedTenantHeader !== sessAuth.tenant.tenantId
  ) {
    store.recordAuthCheck(false);
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Cross-tenant header mismatch against active authenticated workspace.',
          code: 'TENANT_FORBIDDEN',
          requestId,
        },
        { status: 403, headers: getPrivateHeaders(requestId, sessAuth.tenant.tenantId) }
      ),
    };
  }

  return {
    ok: true,
    ...sessAuth,
  };
}

export function requireStepUpAuth(
  sessAuth: Extract<SessionGuardResult, { ok: true }>,
  requestId: string
): NextResponse | null {
  const store = getAuthStore();
  if (store.isStepUpActive(sessAuth.session)) {
    return null;
  }
  store.recordAuthCheck(false);
  return NextResponse.json(
    {
      error: 'Step-up re-authentication is required before performing this privileged operation.',
      code: 'STEP_UP_REQUIRED',
      stepUpRequired: true,
      totpEnabled: Boolean(sessAuth.user.totpEnabled),
      requestId,
    },
    { status: 403, headers: getPrivateHeaders(requestId, sessAuth.tenant.tenantId) }
  );
}

export type TelemetryAuthResult =
  | {
      ok: true;
      mode: 'session';
      user: UserAccount;
      session: UserSession;
      tenant: TenantWorkspace;
      role: UserRole;
    }
  | {
      ok: true;
      mode: 'apikey';
      tenant: TenantWorkspace;
      keyPrefix: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export function authenticateSessionOrApiKey(
  req: NextRequest,
  requiredScope: ApiKeyScope,
  requestId: string
): TelemetryAuthResult {
  const spoofed = rejectSpoofedInternalHeaders(req, requestId);
  if (spoofed) {
    return { ok: false, response: spoofed };
  }

  const store = getAuthStore();
  const requestedTenantHeader = req.headers.get('x-tenant-id')?.trim() || undefined;

  // 1. Prefer session cookie when present
  const sessAuth = store.resolveSessionFromRequest(req);
  if (sessAuth) {
    // Reject cross-tenant spoofed header if explicit mismatch against active session workspace
    if (
      requestedTenantHeader &&
      requestedTenantHeader !== 'default-tenant' &&
      requestedTenantHeader !== sessAuth.tenant.tenantId
    ) {
      store.recordAuthCheck(false);
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: 'Cross-tenant header mismatch against active authenticated workspace.',
            code: 'TENANT_FORBIDDEN',
            requestId,
          },
          { status: 403, headers: getPrivateHeaders(requestId, sessAuth.tenant.tenantId) }
        ),
      };
    }

    if (requiredScope === 'ingest:write' && sessAuth.role === 'viewer') {
      store.recordAuthCheck(false);
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: 'Viewer role is read-only and cannot ingest or mutate telemetry.',
            code: 'ROLE_FORBIDDEN',
            requestId,
          },
          { status: 403, headers: getPrivateHeaders(requestId, sessAuth.tenant.tenantId) }
        ),
      };
    }

    return {
      ok: true,
      mode: 'session',
      user: sessAuth.user,
      session: sessAuth.session,
      tenant: sessAuth.tenant,
      role: sessAuth.role,
    };
  }

  // 2. Otherwise check scoped Bearer / X-API-Key
  const rawKey = extractBearerOrApiKey(req);
  if (rawKey) {
    const clientIp = getClientIp(req);
    const verified = store.verifyApiKey(
      rawKey,
      requiredScope,
      requestedTenantHeader && requestedTenantHeader !== 'default-tenant' ? requestedTenantHeader : undefined,
      clientIp
    );

    if (!verified) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: 'Invalid or revoked API key, or tenant mismatch.',
            code: 'INVALID_API_KEY',
            requestId,
          },
          { status: 401, headers: getPrivateHeaders(requestId) }
        ),
      };
    }

    if ('denied' in verified) {
      const status = verified.denied === 'EXPIRED' ? 401 : 403;
      const msg =
        verified.denied === 'SCOPE'
          ? `API key lacks required scope: ${requiredScope}.`
          : verified.denied === 'CIDR'
          ? 'Client IP address is not in API key CIDR allowlist.'
          : 'API key has expired.';
      return {
        ok: false,
        response: NextResponse.json(
          { error: msg, code: `API_KEY_${verified.denied}`, requestId },
          { status, headers: getPrivateHeaders(requestId) }
        ),
      };
    }

    return {
      ok: true,
      mode: 'apikey',
      tenant: verified.tenant,
      keyPrefix: verified.key.prefix,
    };
  }

  store.recordAuthCheck(false);
  return {
    ok: false,
    response: NextResponse.json(
      {
        error: 'Authentication required. Sign in or supply a valid scoped Bearer API key.',
        code: 'UNAUTHENTICATED',
        requestId,
      },
      { status: 401, headers: getPrivateHeaders(requestId) }
    ),
  };
}
