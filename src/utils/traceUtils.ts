import { ApiRequestLog } from '../types/telemetry';
import { TraceSpan } from '../types/trace';

export function generateSpansForLog(log: ApiRequestLog): TraceSpan[] {
  const total = Math.max(log.latencyMs, 10);
  const isErr = log.statusCode >= 500;
  const isHighLatency = total > 200;

  // Breakdown proportions of the total lifecycle
  const dnsTime = Math.max(Math.round(total * 0.05), 1);
  const tlsTime = Math.max(Math.round(total * 0.08), 2);
  const middlewareTime = Math.max(Math.round(total * 0.07), 2);

  // Remaining budget
  const budget = Math.max(total - dnsTime - tlsTime - middlewareTime, 5);
  const dbTime = Math.round(budget * (isErr ? 0.6 : 0.45));
  const extApiTime = Math.round(budget * 0.3);
  const handlerTime = Math.max(budget - dbTime - extApiTime, 2);

  let currentOffset = 0;

  const spans: TraceSpan[] = [
    {
      id: `${log.spanId}-dns`,
      name: 'DNS Lookup',
      service: 'gateway-dns',
      startTimeOffsetMs: currentOffset,
      durationMs: dnsTime,
      status: 'ok',
      baselineDurationMs: Math.round(dnsTime * 0.8),
      tags: { 'dns.server': '8.8.8.8', 'dns.query': 'api.enterprise-observability.io' },
    },
  ];

  currentOffset += dnsTime;
  spans.push({
    id: `${log.spanId}-tls`,
    name: 'TLS Handshake',
    service: 'edge-proxy',
    startTimeOffsetMs: currentOffset,
    durationMs: tlsTime,
    status: 'ok',
    baselineDurationMs: Math.round(tlsTime * 0.9),
    tags: { 'tls.cipher': 'TLS_AES_256_GCM_SHA384', 'tls.version': '1.3' },
  });

  currentOffset += tlsTime;
  spans.push({
    id: `${log.spanId}-mw`,
    name: 'Edge Middleware & Auth',
    service: 'auth-edge-service',
    startTimeOffsetMs: currentOffset,
    durationMs: middlewareTime,
    status: 'ok',
    baselineDurationMs: Math.round(middlewareTime * 0.9),
    tags: { 'auth.strategy': 'jwt-bearer', 'cache.status': 'HIT' },
  });

  currentOffset += middlewareTime;
  spans.push({
    id: `${log.spanId}-db`,
    name: 'Database Query (pg_read)',
    service: 'postgres-primary-cluster',
    startTimeOffsetMs: currentOffset,
    durationMs: dbTime,
    status: isErr ? 'error' : isHighLatency ? 'warning' : 'ok',
    baselineDurationMs: Math.round(dbTime * (isErr ? 0.25 : 0.8)),
    tags: {
      'db.system': 'postgresql',
      'db.statement': `SELECT * FROM orders WHERE user_id = '${log.clientIp}' LIMIT 50`,
      'db.rows_affected': isErr ? '0' : '42',
    },
  });

  currentOffset += Math.round(dbTime * 0.6);
  spans.push({
    id: `${log.spanId}-ext`,
    name: 'External Service Call',
    service: 'stripe-billing-gateway',
    startTimeOffsetMs: currentOffset,
    durationMs: extApiTime,
    status: isErr ? 'error' : 'ok',
    baselineDurationMs: Math.round(extApiTime * (isErr ? 0.3 : 0.85)),
    tags: {
      'http.url': 'https://api.stripe.com/v1/charges',
      'http.status_code': isErr ? '504' : '200',
    },
  });

  currentOffset = total - handlerTime;
  spans.push({
    id: `${log.spanId}-app`,
    name: 'Main Route Handler & Serialization',
    service: 'nextjs-server-runtime',
    startTimeOffsetMs: Math.max(currentOffset, 0),
    durationMs: handlerTime,
    status: isErr ? 'error' : 'ok',
    baselineDurationMs: Math.round(handlerTime * 0.9),
    tags: { 'runtime': 'node20', 'app.action': 'render_response' },
  });

  return spans;
}
