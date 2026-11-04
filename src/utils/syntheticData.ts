import { ApiRequestLog, HttpMethod } from '../types/telemetry';

const SAMPLE_ENDPOINTS = [
  '/api/v1/checkout/orders',
  '/api/v1/auth/session',
  '/api/v1/telemetry/events',
  '/api/v1/products/query',
  '/api/v1/users/profile',
  '/api/v1/payments/process',
  '/api/v1/analytics/ingest',
  '/api/v1/search/autocomplete',
];

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

export function generateSyntheticLogs(count: number = 500, timeSpanMinutes: number = 60): ApiRequestLog[] {
  const logs: ApiRequestLog[] = [];
  const now = Date.now();
  const startTime = now - timeSpanMinutes * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const timestamp = Math.floor(startTime + Math.random() * (now - startTime));
    const endpoint = SAMPLE_ENDPOINTS[Math.floor(Math.random() * SAMPLE_ENDPOINTS.length)];
    const method = METHODS[Math.floor(Math.random() * METHODS.length)];

    // Introduce realistic status codes (90% success, 7% 4xx, 3% 5xx)
    const roll = Math.random();
    let statusCode = 200;
    if (roll > 0.97) {
      statusCode = [500, 502, 503, 504][Math.floor(Math.random() * 4)];
    } else if (roll > 0.90) {
      statusCode = [400, 401, 403, 404, 429][Math.floor(Math.random() * 5)];
    } else if (method === 'POST') {
      statusCode = 201;
    }

    // Realistic latency distribution (log-normal with spikes)
    let latencyMs = Math.round(15 + Math.random() * 45); // base 15-60ms
    if (statusCode >= 500) {
      latencyMs = Math.round(350 + Math.random() * 800); // 5xx timeout/slowness
    } else if (Math.random() > 0.92) {
      latencyMs = Math.round(180 + Math.random() * 300); // p95/p99 tail
    }

    const traceId = `00-${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}-${Math.random().toString(16).substring(2, 10)}-01`;
    const spanId = Math.random().toString(16).substring(2, 10);

    logs.push({
      id: `log_${i}_${timestamp}`,
      timestamp,
      method,
      endpoint,
      statusCode,
      latencyMs,
      clientIp: `192.168.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 254)}`,
      userAgent: 'Mozilla/5.0 (Observability-Synthetic-Agent 2.0)',
      traceId,
      spanId,
      requestHeaders: {
        host: 'api.enterprise-observability.io',
        authorization: 'Bearer secret_user_jwt_token',
        'x-api-key': 'live_secret_key_prod_8992',
      },
      responseHeaders: {
        'content-type': 'application/json',
        'x-response-time': `${latencyMs}ms`,
      },
      requestBody: {
        userId: `usr_${Math.floor(Math.random() * 1000)}`,
        email: 'engineer@production-cluster.internal',
      },
      responseBody: {
        status: statusCode < 400 ? 'ok' : 'error',
      },
      webVitals: {
        lcp: Math.round(1200 + Math.random() * 800),
        fid: Math.round(10 + Math.random() * 30),
        cls: Number((Math.random() * 0.05).toFixed(3)),
        inp: Math.round(40 + Math.random() * 80),
      },
      errorDetails:
        statusCode >= 400
          ? {
              message: statusCode >= 500 ? 'Internal Server Exception' : 'Client Bad Request Error',
              code: `ERR_HTTP_${statusCode}`,
            }
          : undefined,
    });
  }

  // Sort chronologically
  return logs.sort((a, b) => a.timestamp - b.timestamp);
}
