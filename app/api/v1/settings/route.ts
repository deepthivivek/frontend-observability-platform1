import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { statePersistence } from '@/server/src/storage/statePersistence';

export const dynamic = 'force-dynamic';

const SettingsUpdateSchema = z.object({
  otlpEndpoint: z.string().min(1).max(256).default('/api/v1/telemetry'),
  wsUrl: z.string().max(256).default(''),
  sseUrl: z.string().min(1).max(256).default('/api/v1/stream/telemetry'),
  tenantId: z.string().min(1).max(128).default('default-tenant'),
  latencyWarnMs: z.number().min(1).max(60000).default(200),
  latencyCritMs: z.number().min(1).max(60000).default(300),
  errorRateThresholdPct: z.number().min(0).max(100).default(5),
});

const DEFAULT_PERSISTED_SETTINGS = {
  otlpEndpoint: '/api/v1/telemetry',
  wsUrl: '',
  sseUrl: '/api/v1/stream/telemetry',
  tenantId: 'default-tenant',
  latencyWarnMs: 200,
  latencyCritMs: 300,
  errorRateThresholdPct: 5,
  updatedAt: 0,
};

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const tenantId = (req.headers.get('x-tenant-id') || 'default-tenant').trim() || 'default-tenant';
  const snap = statePersistence.loadSnapshot('client-settings', DEFAULT_PERSISTED_SETTINGS);

  return NextResponse.json(
    {
      requestId,
      tenantId,
      settings: snap.data,
      timestamp: Date.now(),
    },
    { status: 200, headers: { 'X-Request-ID': requestId, 'X-Tenant-ID': tenantId } }
  );
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();
  const tenantId = (req.headers.get('x-tenant-id') || 'default-tenant').trim() || 'default-tenant';

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON settings payload.', code: 'MALFORMED_JSON', requestId, tenantId },
      { status: 400, headers: { 'X-Request-ID': requestId, 'X-Tenant-ID': tenantId } }
    );
  }

  const parsed = SettingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Settings payload validation failed.',
        code: 'INVALID_SETTINGS',
        requestId,
        tenantId,
        issues: parsed.error.issues,
      },
      { status: 400, headers: { 'X-Request-ID': requestId, 'X-Tenant-ID': tenantId } }
    );
  }

  const nextSettings = {
    ...parsed.data,
    updatedAt: Date.now(),
  };

  statePersistence.saveSnapshot('client-settings', nextSettings);

  return NextResponse.json(
    {
      saved: true,
      requestId,
      tenantId,
      settings: nextSettings,
      timestamp: Date.now(),
    },
    { status: 200, headers: { 'X-Request-ID': requestId, 'X-Tenant-ID': tenantId } }
  );
}
