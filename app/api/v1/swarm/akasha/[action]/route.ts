import { NextRequest, NextResponse } from 'next/server';
import { akashaOmegaCore } from '@/server/src/swarm/akashaOmegaCore';
import { AkashaConvergeSchema } from '@/server/src/middleware/productionHardening';
import {
  getAuthStore,
  getPrivateHeaders,
  validateCsrfOrigin,
} from '@/src/lib/server/authStore';
import { authenticateTenantSession, getRequestId } from '@/src/lib/server/authRequestHelper';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ action: string }> }
) {
  const { action } = await context.params;
  const requestId = getRequestId(req);

  const auth = authenticateTenantSession(req, requestId);
  if (!auth.ok) {
    return auth.response;
  }

  const headers = getPrivateHeaders(requestId, auth.tenant.tenantId);

  if (action === 'state') {
    return NextResponse.json(akashaOmegaCore.getUnifiedState(), { headers });
  }
  if (action === 'field') {
    return NextResponse.json(akashaOmegaCore.getTimelineConvergenceField(), { headers });
  }
  if (action === 'history') {
    return NextResponse.json({ history: akashaOmegaCore.getConvergenceHistory() }, { headers });
  }

  return NextResponse.json(
    { error: 'Unknown Akasha endpoint.', code: 'NOT_FOUND', requestId },
    { status: 404, headers }
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ action: string }> }
) {
  const { action } = await context.params;
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

  if (auth.role === 'viewer') {
    return NextResponse.json(
      { error: 'Viewer role cannot execute Akasha convergence actions.', code: 'ROLE_FORBIDDEN', requestId },
      { status: 403, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  if (action !== 'converge') {
    return NextResponse.json(
      { error: 'Unsupported action.', code: 'NOT_FOUND', requestId },
      { status: 404, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = AkashaConvergeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Request payload failed strict schema validation.',
        code: 'INVALID_PAYLOAD',
        requestId,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.length > 0 ? issue.path.join('.') : 'body',
          message: issue.message,
          code: issue.code,
        })),
      },
      { status: 400, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const event = akashaOmegaCore.convergeOmnitemporalState({
    triggerVector: parsed.data.triggerVector,
    timelineSpanYears: parsed.data.timelineSpanYears ?? 1000,
  });
  const state = akashaOmegaCore.getUnifiedState();
  store.appendAudit(auth.tenant.tenantId, auth.user.email, 'AKASHA_CONVERGE', parsed.data.triggerVector || 'manual-converge', requestId);

  return NextResponse.json(
    { success: true, requestId, event, state },
    { status: 201, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
  );
}
