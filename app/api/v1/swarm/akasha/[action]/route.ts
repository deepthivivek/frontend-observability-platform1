import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { akashaOmegaCore } from '@/server/src/swarm/akashaOmegaCore';
import { AkashaConvergeSchema } from '@/server/src/middleware/productionHardening';
import { resolveUpstreamGatewayUrl } from '@/lib/upstreamProxy';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ action: string }> }
) {
  const { action } = await context.params;
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const upstream = resolveUpstreamGatewayUrl(req);

  if (upstream) {
    const res = await fetch(`${upstream}/api/v1/swarm/akasha/${action}`, {
      headers: { 'X-Request-ID': requestId, 'x-neon-chasm-proxied': '1' },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status, headers: { 'X-Request-ID': requestId } });
  }

  if (action === 'state') {
    return NextResponse.json(akashaOmegaCore.getUnifiedState(), { headers: { 'X-Request-ID': requestId } });
  }
  if (action === 'field') {
    return NextResponse.json(akashaOmegaCore.getTimelineConvergenceField(), { headers: { 'X-Request-ID': requestId } });
  }
  if (action === 'history') {
    return NextResponse.json(
      { history: akashaOmegaCore.getConvergenceHistory() },
      { headers: { 'X-Request-ID': requestId } }
    );
  }

  return NextResponse.json(
    { error: 'Unknown Akasha endpoint.', code: 'NOT_FOUND', requestId },
    { status: 404, headers: { 'X-Request-ID': requestId } }
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ action: string }> }
) {
  const { action } = await context.params;
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  if (action !== 'converge') {
    return NextResponse.json({ error: 'Unsupported action.', code: 'NOT_FOUND', requestId }, { status: 404 });
  }

  const upstream = resolveUpstreamGatewayUrl(req);
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (upstream) {
    const res = await fetch(`${upstream}/api/v1/swarm/akasha/converge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId, 'x-neon-chasm-proxied': '1' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status, headers: { 'X-Request-ID': requestId } });
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
      { status: 400, headers: { 'X-Request-ID': requestId } }
    );
  }

  const event = akashaOmegaCore.convergeOmnitemporalState({
    triggerVector: parsed.data.triggerVector,
    timelineSpanYears: parsed.data.timelineSpanYears ?? 1000,
  });
  const state = akashaOmegaCore.getUnifiedState();

  return NextResponse.json(
    { success: true, requestId, event, state },
    { status: 201, headers: { 'X-Request-ID': requestId } }
  );
}
