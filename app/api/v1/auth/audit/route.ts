import { NextRequest, NextResponse } from 'next/server';
import { getAuthStore, getPrivateHeaders } from '@/src/lib/server/authStore';
import { authenticateTenantSession, getRequestId } from '@/src/lib/server/authRequestHelper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  const auth = authenticateTenantSession(req, requestId);
  if (!auth.ok) {
    return auth.response;
  }
  const store = getAuthStore();

  const audit = store.getAuditLogs(auth.tenant.tenantId);

  return NextResponse.json(
    {
      tenantId: auth.tenant.tenantId,
      chainValid: audit.chainValid,
      logs: audit.logs,
      requestId,
    },
    { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
  );
}
