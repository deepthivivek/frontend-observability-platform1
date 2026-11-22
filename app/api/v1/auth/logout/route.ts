import { NextRequest, NextResponse } from 'next/server';
import {
  clearSessionCookie,
  getAuthStore,
  getPrivateHeaders,
  validateCsrfOrigin,
} from '@/src/lib/server/authStore';
import { getRequestId, rejectSpoofedInternalHeaders } from '@/src/lib/server/authRequestHelper';

export const dynamic = 'force-dynamic';

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

  const store = getAuthStore();
  const auth = store.resolveSessionFromRequest(req);
  if (auth) {
    store.revokeSession(auth.session.sessionId, requestId);
  }

  const res = NextResponse.json(
    { ok: true, authenticated: false, requestId },
    { status: 200, headers: getPrivateHeaders(requestId) }
  );
  clearSessionCookie(res, req);
  return res;
}
