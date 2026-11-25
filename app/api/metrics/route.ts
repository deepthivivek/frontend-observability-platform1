import { NextRequest, NextResponse } from 'next/server';
import {
  DashboardMetricsSchema,
  TimeframeSchema,
  type DashboardMetrics,
  type Timeframe,
} from '@/src/lib/metrics';

export const dynamic = 'force-dynamic';

const SERIES_BY_TIMEFRAME: Record<Timeframe, DashboardMetrics['performanceData']> = {
  '15m': [
    { timestamp: '2026-11-24T11:15:00Z', label: '11:15', latencyMs: 112, requests: 1420, errorRate: 0.4 },
    { timestamp: '2026-11-24T11:17:00Z', label: '11:17', latencyMs: 118, requests: 1560, errorRate: 0.5 },
    { timestamp: '2026-11-24T11:19:00Z', label: '11:19', latencyMs: 141, requests: 1710, errorRate: 0.9 },
    { timestamp: '2026-11-24T11:21:00Z', label: '11:21', latencyMs: 129, requests: 1640, errorRate: 0.7 },
    { timestamp: '2026-11-24T11:23:00Z', label: '11:23', latencyMs: 109, requests: 1580, errorRate: 0.4 },
    { timestamp: '2026-11-24T11:25:00Z', label: '11:25', latencyMs: 124, requests: 1690, errorRate: 0.6 },
    { timestamp: '2026-11-24T11:27:00Z', label: '11:27', latencyMs: 116, requests: 1625, errorRate: 0.5 },
  ],
  '1h': [
    { timestamp: '2026-11-24T10:30:00Z', label: '10:30', latencyMs: 128, requests: 5820, errorRate: 0.6 },
    { timestamp: '2026-11-24T10:40:00Z', label: '10:40', latencyMs: 134, requests: 6140, errorRate: 0.7 },
    { timestamp: '2026-11-24T10:50:00Z', label: '10:50', latencyMs: 156, requests: 6890, errorRate: 1.2 },
    { timestamp: '2026-11-24T11:00:00Z', label: '11:00', latencyMs: 142, requests: 6410, errorRate: 0.8 },
    { timestamp: '2026-11-24T11:10:00Z', label: '11:10', latencyMs: 121, requests: 6120, errorRate: 0.5 },
    { timestamp: '2026-11-24T11:20:00Z', label: '11:20', latencyMs: 118, requests: 6350, errorRate: 0.4 },
    { timestamp: '2026-11-24T11:30:00Z', label: '11:30', latencyMs: 116, requests: 6480, errorRate: 0.5 },
  ],
  '24h': [
    { timestamp: '2026-11-23T12:00:00Z', label: '12:00', latencyMs: 142, requests: 42100, errorRate: 0.8 },
    { timestamp: '2026-11-23T16:00:00Z', label: '16:00', latencyMs: 168, requests: 54900, errorRate: 1.1 },
    { timestamp: '2026-11-23T20:00:00Z', label: '20:00', latencyMs: 154, requests: 49300, errorRate: 0.9 },
    { timestamp: '2026-11-24T00:00:00Z', label: '00:00', latencyMs: 108, requests: 28400, errorRate: 0.3 },
    { timestamp: '2026-11-24T04:00:00Z', label: '04:00', latencyMs: 102, requests: 24900, errorRate: 0.3 },
    { timestamp: '2026-11-24T08:00:00Z', label: '08:00', latencyMs: 139, requests: 51200, errorRate: 0.7 },
    { timestamp: '2026-11-24T11:30:00Z', label: '11:30', latencyMs: 124, requests: 58600, errorRate: 0.5 },
  ],
  '7d': [
    { timestamp: '2026-11-18T00:00:00Z', label: 'Mon', latencyMs: 149, requests: 312000, errorRate: 0.9 },
    { timestamp: '2026-11-19T00:00:00Z', label: 'Tue', latencyMs: 144, requests: 329000, errorRate: 0.8 },
    { timestamp: '2026-11-20T00:00:00Z', label: 'Wed', latencyMs: 162, requests: 358000, errorRate: 1.2 },
    { timestamp: '2026-11-21T00:00:00Z', label: 'Thu', latencyMs: 138, requests: 341000, errorRate: 0.7 },
    { timestamp: '2026-11-22T00:00:00Z', label: 'Fri', latencyMs: 131, requests: 336000, errorRate: 0.6 },
    { timestamp: '2026-11-23T00:00:00Z', label: 'Sat', latencyMs: 112, requests: 248000, errorRate: 0.4 },
    { timestamp: '2026-11-24T00:00:00Z', label: 'Sun', latencyMs: 119, requests: 265000, errorRate: 0.5 },
  ],
};

const SYNTHETIC_ENDPOINTS: DashboardMetrics['endpoints'] = [
  {
    id: 'ep-auth-token',
    name: 'Identity Token Exchange',
    method: 'POST',
    path: '/api/v1/auth/login',
    status: 'Healthy',
    responseTimeMs: 48,
    uptimePercent: 99.98,
    lastChecked: '2026-11-24T11:27:45Z',
  },
  {
    id: 'ep-otlp-ingest',
    name: 'OTLP Span Collector',
    method: 'POST',
    path: '/api/v1/telemetry',
    status: 'Healthy',
    responseTimeMs: 74,
    uptimePercent: 99.95,
    lastChecked: '2026-11-24T11:27:42Z',
  },
  {
    id: 'ep-checkout-settlement',
    name: 'Checkout Ledger Settlement',
    method: 'POST',
    path: '/api/v2/payments/settle',
    status: 'Failed',
    responseTimeMs: 842,
    uptimePercent: 96.4,
    lastChecked: '2026-11-24T11:27:39Z',
  },
  {
    id: 'ep-search-index',
    name: 'Vector Trace Search',
    method: 'GET',
    path: '/api/v1/traces/query',
    status: 'Warning',
    responseTimeMs: 318,
    uptimePercent: 99.12,
    lastChecked: '2026-11-24T11:27:35Z',
  },
  {
    id: 'ep-webhook-dispatch',
    name: 'Alert Webhook Dispatcher',
    method: 'PUT',
    path: '/api/v1/alerts/webhooks',
    status: 'Healthy',
    responseTimeMs: 92,
    uptimePercent: 99.91,
    lastChecked: '2026-11-24T11:27:30Z',
  },
  {
    id: 'ep-slo-burn',
    name: 'SLO Error Budget Evaluator',
    method: 'GET',
    path: '/api/v1/slo/burn-rate',
    status: 'Healthy',
    responseTimeMs: 61,
    uptimePercent: 99.99,
    lastChecked: '2026-11-24T11:27:26Z',
  },
  {
    id: 'ep-billing-sync',
    name: 'Usage Metering Reconciler',
    method: 'PATCH',
    path: '/api/v1/tenants/quota',
    status: 'Warning',
    responseTimeMs: 265,
    uptimePercent: 99.34,
    lastChecked: '2026-11-24T11:27:22Z',
  },
  {
    id: 'ep-session-revoke',
    name: 'Session Revocation Sweep',
    method: 'DELETE',
    path: '/api/v1/auth/sessions',
    status: 'Failed',
    responseTimeMs: 615,
    uptimePercent: 97.85,
    lastChecked: '2026-11-24T11:27:18Z',
  },
];

const STATS_BY_TIMEFRAME: Record<Timeframe, DashboardMetrics['stats']> = {
  '15m': [
    { id: 'throughput', label: 'Request Throughput', value: 1625, unit: 'req/m', changePercent: 6.4, higherIsBetter: true },
    { id: 'latency', label: 'Avg Response Latency', value: 116, unit: 'ms', changePercent: -4.8, higherIsBetter: false },
    { id: 'error-rate', label: 'Error Rate', value: 0.5, unit: '%', changePercent: -12.5, higherIsBetter: false },
    { id: 'availability', label: 'Cluster Availability', value: 99.92, unit: '%', changePercent: 0.1, higherIsBetter: true },
  ],
  '1h': [
    { id: 'throughput', label: 'Request Throughput', value: 6480, unit: 'req/h', changePercent: 8.2, higherIsBetter: true },
    { id: 'latency', label: 'Avg Response Latency', value: 130, unit: 'ms', changePercent: -3.1, higherIsBetter: false },
    { id: 'error-rate', label: 'Error Rate', value: 0.67, unit: '%', changePercent: 4.5, higherIsBetter: false },
    { id: 'availability', label: 'Cluster Availability', value: 99.84, unit: '%', changePercent: 0.0, higherIsBetter: true },
  ],
  '24h': [
    { id: 'throughput', label: 'Total Requests (24h)', value: 309.4, unit: 'k', changePercent: 11.8, higherIsBetter: true },
    { id: 'latency', label: 'P95 Response Latency', value: 134, unit: 'ms', changePercent: -6.2, higherIsBetter: false },
    { id: 'error-rate', label: '5xx Error Rate', value: 0.66, unit: '%', changePercent: 9.4, higherIsBetter: false },
    { id: 'availability', label: 'SLA Uptime', value: 99.45, unit: '%', changePercent: -0.2, higherIsBetter: true },
  ],
  '7d': [
    { id: 'throughput', label: 'Weekly Volume', value: 2.19, unit: 'M', changePercent: 14.3, higherIsBetter: true },
    { id: 'latency', label: 'Median Latency', value: 137, unit: 'ms', changePercent: -8.9, higherIsBetter: false },
    { id: 'error-rate', label: 'Incident Error Rate', value: 0.73, unit: '%', changePercent: -14.1, higherIsBetter: false },
    { id: 'availability', label: 'Fleet Availability', value: 99.61, unit: '%', changePercent: 0.4, higherIsBetter: true },
  ],
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const simulateError = searchParams.get('simulateError') === '1';
  const isEmpty = searchParams.get('empty') === '1';
  const rawTimeframe = searchParams.get('timeframe');
  const parsedTimeframe = TimeframeSchema.safeParse(rawTimeframe);
  const timeframe: Timeframe = parsedTimeframe.success ? parsedTimeframe.data : '24h';

  if (simulateError) {
    return NextResponse.json(
      {
        error: 'Simulated telemetry service failure (HTTP 500)',
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }

  const payload: DashboardMetrics = isEmpty
    ? {
        isSynthetic: true,
        generatedAt: new Date().toISOString(),
        timeframe,
        stats: [],
        performanceData: [],
        endpoints: [],
      }
    : {
        isSynthetic: true,
        generatedAt: new Date().toISOString(),
        timeframe,
        stats: STATS_BY_TIMEFRAME[timeframe],
        performanceData: SERIES_BY_TIMEFRAME[timeframe],
        endpoints: SYNTHETIC_ENDPOINTS,
      };

  const validated = DashboardMetricsSchema.parse(payload);

  return NextResponse.json(validated, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
