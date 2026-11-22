#!/usr/bin/env node
/**
 * Neon Chasm OTLP HTTP Sample Telemetry Emitter
 * Uses native Node.js fetch() (Node >= 20) with zero external dependencies.
 *
 * Usage:
 *   node scripts/emit-otlp.mjs --key nc_live_... [--url http://127.0.0.1:3000/api/v1/telemetry] [--tenant ten-...] [--interval 1500] [--count 0]
 */

import crypto from 'node:crypto';

function parseArgs(argv) {
  const args = {
    key: process.env.NEON_CHASM_API_KEY || '',
    url: process.env.NEON_CHASM_OTLP_URL || 'http://127.0.0.1:3000/api/v1/telemetry',
    tenant: process.env.NEON_CHASM_TENANT_ID || '',
    interval: 1500,
    count: 0, // 0 = continuous until SIGINT
    once: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if ((arg === '--key' || arg === '-k') && argv[i + 1]) {
      args.key = argv[++i];
    } else if ((arg === '--url' || arg === '-u') && argv[i + 1]) {
      args.url = argv[++i];
    } else if ((arg === '--tenant' || arg === '-t') && argv[i + 1]) {
      args.tenant = argv[++i];
    } else if ((arg === '--interval' || arg === '-i') && argv[i + 1]) {
      args.interval = Math.max(200, Number(argv[++i]) || 1500);
    } else if ((arg === '--count' || arg === '-c') && argv[i + 1]) {
      args.count = Math.max(1, Number(argv[++i]) || 1);
    } else if (arg === '--once') {
      args.once = true;
      args.count = 1;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'Usage: node scripts/emit-otlp.mjs --key <nc_live_...> [options]',
          '',
          'Options:',
          '  --key, -k       Scoped Neon Chasm Bearer API key (ingest:write)',
          '  --url, -u       OTLP ingestion endpoint (default: http://127.0.0.1:3000/api/v1/telemetry)',
          '  --tenant, -t    Optional explicit X-Tenant-ID verification header',
          '  --interval, -i  Milliseconds between batches (default: 1500)',
          '  --count, -c     Number of batches to emit before exiting (default: continuous)',
          '  --once          Emit a single batch and exit',
        ].join('\n')
      );
      process.exit(0);
    }
  }
  return args;
}

const MICROSERVICES = [
  { service: 'api-gateway', method: 'GET', endpoint: '/api/v1/orders' },
  { service: 'auth-service', method: 'POST', endpoint: '/api/v1/auth/verify' },
  { service: 'checkout-engine', method: 'POST', endpoint: '/api/v1/checkout/commit' },
  { service: 'inventory-db', method: 'PUT', endpoint: '/api/v1/inventory/reserve' },
  { service: 'payment-relay', method: 'POST', endpoint: '/api/v1/payments/authorize' },
];

function buildSampleOtlpPayload(batchIdx) {
  const traceId = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const spans = MICROSERVICES.map((svc, idx) => {
    const isError = (batchIdx + idx) % 13 === 0;
    const statusCode = isError ? 503 : 200;
    const durationMs = isError
      ? Math.round(240 + Math.random() * 220)
      : Math.round(12 + Math.random() * 95);

    return {
      traceId,
      spanId: crypto.randomBytes(8).toString('hex'),
      name: `${svc.method} ${svc.endpoint}`,
      method: svc.method,
      endpoint: svc.endpoint,
      statusCode,
      durationMs,
      service: svc.service,
      timestamp: now + idx,
    };
  });

  const logs = [
    {
      traceId,
      spanId: spans[0].spanId,
      method: 'POST',
      endpoint: '/api/v1/checkout/commit',
      statusCode: spans[2].statusCode,
      latencyMs: spans[2].durationMs,
      service: 'checkout-engine',
      level: spans[2].statusCode >= 500 ? 'ERROR' : 'INFO',
      message:
        spans[2].statusCode >= 500
          ? 'Downstream payment-relay timeout during checkout commit'
          : 'Checkout transaction finalized and committed',
      timestamp: now + 10,
    },
  ];

  return {
    traceId,
    body: {
      source: 'cli-emit-otlp',
      spans,
      logs,
    },
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.key) {
    console.error('Error: --key <nc_live_...> (or NEON_CHASM_API_KEY) is required.');
    process.exit(1);
  }

  let running = true;
  process.on('SIGINT', () => {
    running = false;
  });
  process.on('SIGTERM', () => {
    running = false;
  });

  let batchIdx = 0;
  while (running) {
    batchIdx += 1;
    const { traceId, body } = buildSampleOtlpPayload(batchIdx);
    const requestId = crypto.randomUUID();
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.key}`,
      'X-Request-ID': requestId,
      'X-Trace-ID': traceId,
      'X-Idempotency-Key': `cli-${requestId}`,
    };
    if (opts.tenant) {
      headers['X-Tenant-ID'] = opts.tenant;
    }

    try {
      const res = await fetch(opts.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let json = {};
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text.slice(0, 120) };
      }

      if (res.ok) {
        console.log(
          `[batch #${batchIdx}] HTTP ${res.status} tenant=${json.tenantId || '-'} spans=${json.processedSpans ?? 0} logs=${json.processedLogs ?? 0} traceId=${traceId.slice(0, 12)}`
        );
      } else {
        console.error(
          `[batch #${batchIdx}] HTTP ${res.status} code=${json.code || 'ERROR'} error="${json.error || 'Rejected'}"`
        );
        if (res.status === 401 || res.status === 403) {
          process.exit(2);
        }
      }
    } catch (err) {
      console.error(`[batch #${batchIdx}] Network error:`, err instanceof Error ? err.message : err);
    }

    if (opts.once || (opts.count > 0 && batchIdx >= opts.count)) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, opts.interval));
  }
}

void main();
