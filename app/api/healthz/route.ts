import os from 'os';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { resolveUpstreamGatewayUrl } from '@/lib/upstreamProxy';

export const dynamic = 'force-dynamic';

const processStartedAt = Date.now();

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const upstream = resolveUpstreamGatewayUrl(req);

  if (upstream) {
    try {
      const res = await fetch(`${upstream}/healthz`, {
        headers: { 'x-request-id': requestId, 'x-neon-chasm-proxied': '1' },
        cache: 'no-store',
      });
      const body = await res.json();
      return NextResponse.json(body, {
        status: res.status,
        headers: { 'X-Request-ID': requestId },
      });
    } catch {
      return NextResponse.json(
        { status: 'unhealthy', error: 'UPSTREAM_GATEWAY_UNREACHABLE', requestId, timestamp: Date.now() },
        { status: 503, headers: { 'X-Request-ID': requestId } }
      );
    }
  }

  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  return NextResponse.json(
    {
      status: 'healthy',
      requestId,
      uptimeSeconds: Math.floor((Date.now() - processStartedAt) / 1000),
      pid: process.pid,
      nodeVersion: process.version,
      freeMemoryPct: totalMem > 0 ? Number(((freeMem / totalMem) * 100).toFixed(2)) : 100,
      timestamp: Date.now(),
    },
    { status: 200, headers: { 'X-Request-ID': requestId, 'Cache-Control': 'no-store' } }
  );
}
