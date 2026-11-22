import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthStore,
  getPrivateHeaders,
} from '@/src/lib/server/authStore';
import { authenticateTenantSession, getRequestId } from '@/src/lib/server/authRequestHelper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  const auth = authenticateTenantSession(req, requestId);
  if (!auth.ok) {
    return auth.response;
  }
  const store = getAuthStore();

  let body: { metric?: string; aggregation?: string } = {};
  try {
    body = (await req.json()) as { metric?: string; aggregation?: string };
  } catch {
    body = {};
  }

  const records = store.getTelemetryRecords(auth.tenant.tenantId, 500);
  const startedAt = Date.now();

  if (records.length === 0) {
    return NextResponse.json(
      {
        tenantId: auth.tenant.tenantId,
        currentValue: 0,
        dataPoints: [],
        cached: false,
        status: 'ok',
        executionTimeMs: Math.max(1, Date.now() - startedAt),
        requestId,
      },
      { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
    );
  }

  const metric = body.metric || 'http_requests_total';
  const aggregation = body.aggregation || 'avg';

  // Bucket real tenant records into 12 chronological buckets
  const minTs = Math.min(...records.map((r) => r.timestamp));
  const maxTs = Math.max(...records.map((r) => r.timestamp));
  const span = Math.max(60000, maxTs - minTs);
  const bucketSize = span / 12;

  const dataPoints = Array.from({ length: 12 }, (_, idx) => {
    const start = minTs + idx * bucketSize;
    const end = start + bucketSize;
    const slice = records.filter((r) => r.timestamp >= start && (idx === 11 ? r.timestamp <= end : r.timestamp < end));
    let val = 0;
    if (slice.length > 0) {
      if (metric === 'error_rate') {
        const errs = slice.filter((r) => r.statusCode >= 500).length;
        val = Number(((errs / slice.length) * 100).toFixed(2));
      } else if (aggregation === 'rate' || metric === 'http_requests_total' && aggregation !== 'p99') {
        val = Number((slice.length / Math.max(1, bucketSize / 1000)).toFixed(2));
      } else if (aggregation === 'p99' || aggregation === 'p95') {
        const sorted = [...slice].map((r) => r.latencyMs).sort((a, b) => a - b);
        const q = aggregation === 'p99' ? 0.99 : 0.95;
        val = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] || 0;
      } else {
        const sum = slice.reduce((acc, r) => acc + r.latencyMs, 0);
        val = Number((sum / slice.length).toFixed(2));
      }
    }
    return { timestamp: Math.round(end), value: val };
  });

  const nonZero = dataPoints.filter((d) => d.value > 0);
  const currentValue = nonZero.length > 0 ? nonZero[nonZero.length - 1].value : dataPoints[dataPoints.length - 1]?.value || 0;

  return NextResponse.json(
    {
      tenantId: auth.tenant.tenantId,
      currentValue,
      dataPoints,
      cached: false,
      status: 'ok',
      executionTimeMs: Math.max(1, Date.now() - startedAt),
      requestId,
    },
    { status: 200, headers: getPrivateHeaders(requestId, auth.tenant.tenantId) }
  );
}
