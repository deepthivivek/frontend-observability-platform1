import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { statePersistence } from '@/server/src/storage/statePersistence';
import { resolveUpstreamGatewayUrl } from '@/lib/upstreamProxy';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const tenantId = (req.headers.get('x-tenant-id') || 'default-tenant').trim() || 'default-tenant';
  const upstream = resolveUpstreamGatewayUrl(req);

  if (upstream) {
    const res = await fetch(`${upstream}/api/v1/telemetry/recent`, {
      headers: { 'X-Request-ID': requestId, 'X-Tenant-ID': tenantId, 'x-neon-chasm-proxied': '1' },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status, headers: { 'X-Request-ID': requestId } });
  }

  const limit = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 200)));
  const snap = statePersistence.loadSnapshot<Record<string, unknown>[]>('recent-telemetry', []);
  const records = Array.isArray(snap.data) ? snap.data.slice(-limit) : [];

  return NextResponse.json(
    {
      requestId,
      tenantId,
      totalBuffered: records.length,
      records,
      timestamp: Date.now(),
    },
    { status: 200, headers: { 'X-Request-ID': requestId, 'X-Tenant-ID': tenantId } }
  );
}
