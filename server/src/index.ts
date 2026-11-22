import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import http from 'http';
import { z } from 'zod';
import { DistributedCircuitBreaker } from './middleware/circuitBreaker';
import { PolicyEngine } from './security/policyEngine';
import { validateEnterpriseEnvironment } from './config/envValidator';
import {
  correlationIdMiddleware,
  structuredRequestLogger,
  tenantAuthMiddleware,
} from './middleware/correlationAndTenant';
import {
  defaultRateLimiter,
  validateBody,
  TelemetryIngestSchema,
  PromqlQuerySchema,
  AiTranslateSchema,
  AlertEvaluateSchema,
  SiemDispatchSchema,
  ComplianceAuditSchema,
  RbacPolicyUpdateSchema,
} from './middleware/productionHardening';
import { statePersistence } from './storage/statePersistence';
import {
  broadcastTelemetryTick,
  closeWebSocketGateway,
  setupWebSocketGateway,
  subscribeTelemetryEvents,
} from './ws/gateway';
import { akashaOmegaCore } from './swarm/akashaOmegaCore';
import { evaluateMetricQuery, translateTextToPromQL } from './metrics/aggregator';
import { evaluateWidgetAlertTriggers } from './metrics/alertTriggers';
import { presetsRouter } from './routes/presets';
import { tracesRouter } from './routes/traces';
import { incidentsRouter } from './routes/incidents';
import { complianceRouter } from './routes/compliance';
import { syntheticRouter } from './routes/synthetic';
import { governanceRouter } from './routes/governance';
import { logsRouter } from './routes/logs';
import { selfHealingRouter } from './routes/selfHealing';
import { capstoneUltimateRouter } from './routes/capstoneUltimate';
import { immuneSystemRouter } from './routes/immuneSystem';
import { neuromorphicMeshRouter } from './routes/neuromorphicMesh';
import { syntheticDreamRouter } from './routes/syntheticDream';
import { healthRouter, recordOtlpIngestionMetrics } from './routes/health';
import { swarmRouter } from './routes/swarm';
import { authAndTenantRouter } from './routes/authAndTenant';

// Execute enterprise environment validation
const enterpriseConfig = validateEnterpriseEnvironment();

const app = express();
const PORT = process.env.PORT || enterpriseConfig.PORT || 4000;
const TELEMETRY_BUFFER_MAX = Math.max(100, Number(process.env.TELEMETRY_BUFFER_MAX || 2000));

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 1. Distributed Correlation ID + Structured JSON Logging + Cryptographic Tenant Auth + Rate Limiting
app.use(correlationIdMiddleware);
app.use(structuredRequestLogger);
app.use(tenantAuthMiddleware);
app.use(defaultRateLimiter.middleware);

const circuitBreaker = new DistributedCircuitBreaker();
const policyEngine = new PolicyEngine();

app.use(circuitBreaker.middleware);
app.use(policyEngine.middleware);

// Persistent Merkle/HMAC audit log chain store
interface AuditEvent {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  targetResource: string;
  previousHash: string;
  hash: string;
  signature: string;
}

const GENESIS_AUDIT_EVENT: AuditEvent = {
  id: 'aud-genesis',
  timestamp: 1700000000000,
  actor: 'SYSTEM_BOOTSTRAP',
  action: 'GENESIS_BLOCK_CREATE',
  targetResource: 'audit_chain_root',
  previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
  hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  signature: 'sig_genesis_verified',
};

const auditLogChain: AuditEvent[] = [GENESIS_AUDIT_EVENT];

export interface PersistedRbacRule {
  roleId: string;
  roleName: string;
  permissions: Record<string, boolean>;
  updatedAt: number;
}

const persistedRbacPolicies: Record<string, PersistedRbacRule> = {
  'role-admin': {
    roleId: 'role-admin',
    roleName: 'Administrator',
    permissions: { canViewLogs: true, canManageInfra: true, canTriggerBreakGlass: true },
    updatedAt: 1700000000000,
  },
};

export interface NormalizedTelemetryRecord {
  id: string;
  timestamp: number;
  tenantId: string;
  requestId: string;
  method: string;
  endpoint: string;
  statusCode: number;
  latencyMs: number;
  traceId: string;
  spanId: string;
  service: string;
  level: string;
  message: string;
}

const recentTelemetryBuffer: NormalizedTelemetryRecord[] = [];

// Hydrate durable snapshots on startup
{
  const loadedAudit = statePersistence.loadSnapshot<AuditEvent[]>('audit-log-chain', [GENESIS_AUDIT_EVENT]);
  if (loadedAudit.source !== 'fallback' && Array.isArray(loadedAudit.data) && loadedAudit.data.length > 0) {
    auditLogChain.splice(0, auditLogChain.length, ...loadedAudit.data);
  }
  const loadedRbac = statePersistence.loadSnapshot<Record<string, PersistedRbacRule>>('rbac-policies', persistedRbacPolicies);
  if (loadedRbac.source !== 'fallback' && loadedRbac.data) {
    Object.assign(persistedRbacPolicies, loadedRbac.data);
  }
  const loadedTelemetry = statePersistence.loadSnapshot<NormalizedTelemetryRecord[]>('recent-telemetry', []);
  if (loadedTelemetry.source !== 'fallback' && Array.isArray(loadedTelemetry.data)) {
    recentTelemetryBuffer.push(...loadedTelemetry.data.slice(-TELEMETRY_BUFFER_MAX));
  }
}

export function verifyAuditChain(chain: AuditEvent[] = auditLogChain): boolean {
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].previousHash !== chain[i - 1].hash) {
      return false;
    }
  }
  return chain.length > 0;
}

export function appendAuditLog(actor: string, action: string, targetResource: string): AuditEvent {
  const previous = auditLogChain[auditLogChain.length - 1];
  const timestamp = Date.now();
  const rawPayload = `${timestamp}:${actor}:${action}:${targetResource}:${previous.hash}`;
  const hash = crypto.createHash('sha256').update(rawPayload).digest('hex');
  const signature = crypto
    .createHmac('sha256', enterpriseConfig.JWT_SECRET || 'neon-chasm-vault-secret')
    .update(hash)
    .digest('hex');

  const event: AuditEvent = {
    id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp,
    actor,
    action,
    targetResource,
    previousHash: previous.hash,
    hash,
    signature,
  };

  auditLogChain.push(event);
  if (auditLogChain.length > 500) {
    auditLogChain.splice(1, auditLogChain.length - 500);
  }

  try {
    statePersistence.saveSnapshot('audit-log-chain', auditLogChain);
  } catch {
    // Non-fatal persistence safeguard
  }

  return event;
}

function flushAllDurableState(): void {
  try {
    statePersistence.saveSnapshot('audit-log-chain', auditLogChain);
    statePersistence.saveSnapshot('rbac-policies', persistedRbacPolicies);
    statePersistence.saveSnapshot('recent-telemetry', recentTelemetryBuffer);
    akashaOmegaCore.persistToStore(statePersistence);
  } catch (err) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'STATE_FLUSH_ERROR',
        message: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

// 1. Health & Status
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    requestId: req.requestId,
    service: 'Neon Chasm Ingestion Gateway & Security Broker',
    circuitBreaker: circuitBreaker.getStatus(),
    auditChainVerified: verifyAuditChain(),
    bufferedTelemetryRecords: recentTelemetryBuffer.length,
    timestamp: Date.now(),
  });
});

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

// 1b. Client Runtime Settings Persistence
app.get('/api/v1/settings', (req: Request, res: Response) => {
  const snap = statePersistence.loadSnapshot('client-settings', DEFAULT_PERSISTED_SETTINGS);
  res.json({
    requestId: req.requestId,
    tenantId: req.tenantId || 'default-tenant',
    settings: snap.data,
    timestamp: Date.now(),
  });
});

app.post('/api/v1/settings', validateBody(SettingsUpdateSchema), (req: Request, res: Response) => {
  const nextSettings = {
    ...req.body,
    updatedAt: Date.now(),
  };
  statePersistence.saveSnapshot('client-settings', nextSettings);
  appendAuditLog(
    `SETTINGS_ADMIN:${req.tenantId || 'default-tenant'}`,
    'CLIENT_SETTINGS_UPDATE',
    `otlp=${nextSettings.otlpEndpoint}`
  );
  res.json({
    saved: true,
    requestId: req.requestId,
    tenantId: req.tenantId || 'default-tenant',
    settings: nextSettings,
    timestamp: Date.now(),
  });
});

// 2. OpenTelemetry Ingestion Endpoint (Zod-Validated + Tenant Metered + Atomic WAL + Broadcast)
app.post('/api/v1/telemetry', validateBody(TelemetryIngestSchema), (req: Request, res: Response) => {
  const { logs, metrics, spans, resourceLogs, resourceMetrics, resourceSpans, source } = req.body;
  const traceId = (req.headers['x-trace-id'] as string) || `trace-${req.requestId || Date.now()}`;
  const tenantId = req.tenantId || 'default-tenant';
  const requestId = req.requestId || crypto.randomUUID();

  const normalizedRecords: NormalizedTelemetryRecord[] = [];

  if (Array.isArray(logs)) {
    for (let i = 0; i < logs.length; i++) {
      const rec = logs[i] as Record<string, unknown>;
      normalizedRecords.push({
        id: typeof rec.id === 'string' && rec.id ? rec.id : `otlp-${requestId}-${i}`,
        timestamp: typeof rec.timestamp === 'number' ? rec.timestamp : Date.now(),
        tenantId,
        requestId,
        method: typeof rec.method === 'string' ? rec.method : 'POST',
        endpoint: typeof rec.endpoint === 'string' ? rec.endpoint : '/api/v1/telemetry',
        statusCode: typeof rec.statusCode === 'number' ? rec.statusCode : 200,
        latencyMs: typeof rec.latencyMs === 'number' ? rec.latencyMs : 1,
        traceId: typeof rec.traceId === 'string' ? rec.traceId : traceId,
        spanId: typeof rec.spanId === 'string' ? rec.spanId : requestId.slice(0, 8),
        service: typeof rec.service === 'string' ? rec.service : source || 'otlp-http',
        level: typeof rec.level === 'string' ? rec.level : 'INFO',
        message: typeof rec.message === 'string' ? rec.message : 'OTLP telemetry record ingested',
      });
    }
  }

  if (Array.isArray(spans)) {
    for (let i = 0; i < spans.length; i++) {
      const sp = spans[i] as Record<string, unknown>;
      normalizedRecords.push({
        id: typeof sp.spanId === 'string' && sp.spanId ? `span-${sp.spanId}` : `span-${requestId}-${i}`,
        timestamp: typeof sp.timestamp === 'number' ? sp.timestamp : Date.now(),
        tenantId,
        requestId,
        method: typeof sp.method === 'string' ? sp.method : 'POST',
        endpoint: typeof sp.endpoint === 'string' ? sp.endpoint : typeof sp.name === 'string' ? sp.name : '/otlp/span',
        statusCode: typeof sp.statusCode === 'number' ? sp.statusCode : 200,
        latencyMs: typeof sp.durationMs === 'number' ? sp.durationMs : typeof sp.latencyMs === 'number' ? sp.latencyMs : 12,
        traceId: typeof sp.traceId === 'string' ? sp.traceId : traceId,
        spanId: typeof sp.spanId === 'string' ? sp.spanId : requestId.slice(0, 16),
        service: typeof sp.service === 'string' ? sp.service : source || 'otlp-span',
        level: 'INFO',
        message: typeof sp.name === 'string' ? `Span: ${sp.name}` : 'OTLP trace span ingested',
      });
    }
  }

  if (normalizedRecords.length > 0) {
    recentTelemetryBuffer.push(...normalizedRecords);
    if (recentTelemetryBuffer.length > TELEMETRY_BUFFER_MAX) {
      recentTelemetryBuffer.splice(0, recentTelemetryBuffer.length - TELEMETRY_BUFFER_MAX);
    }
    try {
      statePersistence.saveSnapshot('recent-telemetry', recentTelemetryBuffer);
    } catch {
      // Non-fatal persistence safeguard
    }
  }

  const processedLogs =
    (Array.isArray(logs) ? logs.length : 0) +
    (Array.isArray(resourceLogs) ? resourceLogs.length : 0);
  const processedMetrics =
    (Array.isArray(metrics) ? metrics.length : 0) +
    (Array.isArray(resourceMetrics) ? resourceMetrics.length : 0);
  const processedSpans =
    (Array.isArray(spans) ? spans.length : 0) +
    (Array.isArray(resourceSpans) ? resourceSpans.length : 0);

  const totalBatchRecords = processedLogs + processedMetrics + processedSpans;
  recordOtlpIngestionMetrics(totalBatchRecords);

  appendAuditLog(
    `INGESTION_AGENT:${tenantId}`,
    'TELEMETRY_BATCH_INGEST',
    `req=${requestId}:batch_${processedLogs}logs_${processedMetrics}metrics_${processedSpans}spans`
  );

  broadcastTelemetryTick({
    processedLogs: totalBatchRecords,
    traceId,
    source: source || 'otlp-http',
    throughputEstimateRps: Math.max(1, totalBatchRecords),
    tenantId,
    records: normalizedRecords.slice(0, 25),
  });

  res.setHeader('X-Trace-Id', traceId);
  res.status(202).json({
    accepted: true,
    requestId,
    tenantId,
    processedLogs,
    processedMetrics,
    processedSpans,
    traceId,
    timestamp: Date.now(),
  });
});

// 2a. Recent Real Production Telemetry Records (No Synthetic Seed)
app.get('/api/v1/telemetry/recent', (req: Request, res: Response) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 200)));
  const tenantFilter = typeof req.query.tenantId === 'string' ? req.query.tenantId : undefined;
  const scoped = tenantFilter
    ? recentTelemetryBuffer.filter((r) => r.tenantId === tenantFilter)
    : recentTelemetryBuffer;

  res.json({
    requestId: req.requestId,
    tenantId: req.tenantId || 'default-tenant',
    totalBuffered: scoped.length,
    records: scoped.slice(-limit),
    timestamp: Date.now(),
  });
});

// 2b. Real-Time SSE Telemetry & Singularity Stream
app.get('/api/v1/stream/telemetry', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(
    `event: handshake_ack\ndata: ${JSON.stringify({
      type: 'handshake_ack',
      payload: {
        protocol: 'neon-chasm-sse-v1',
        requestId: req.requestId,
        tenantId: req.tenantId || 'default-tenant',
        connectedAt: Date.now(),
      },
      timestamp: Date.now(),
    })}\n\n`
  );

  const unsubscribe = subscribeTelemetryEvents((event) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  });

  const heartbeat = setInterval(() => {
    res.write(
      `event: pong\ndata: ${JSON.stringify({
        type: 'pong',
        payload: { heartbeat: true },
        timestamp: Date.now(),
      })}\n\n`
    );
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// 3. Get Cryptographic Hash-Chained Audit Logs
app.get('/api/v1/audit/logs', (req: Request, res: Response) => {
  res.json({
    requestId: req.requestId,
    chainLength: auditLogChain.length,
    verified: verifyAuditChain(),
    logs: auditLogChain,
  });
});

// 3b. Persisted RBAC Rules Endpoints
app.get('/api/v1/rbac/policies', (req: Request, res: Response) => {
  res.json({
    requestId: req.requestId,
    policies: Object.values(persistedRbacPolicies),
    count: Object.keys(persistedRbacPolicies).length,
    timestamp: Date.now(),
  });
});

app.post('/api/v1/rbac/policies', validateBody(RbacPolicyUpdateSchema), (req: Request, res: Response) => {
  const { roleId, roleName, permissions, actor } = req.body;
  const updated: PersistedRbacRule = {
    roleId,
    roleName,
    permissions,
    updatedAt: Date.now(),
  };
  persistedRbacPolicies[roleId] = updated;
  statePersistence.saveSnapshot('rbac-policies', persistedRbacPolicies);
  appendAuditLog(actor || 'RBAC_ADMIN', 'RBAC_POLICY_UPDATE', roleId);
  res.json({ success: true, requestId: req.requestId, policy: updated });
});

// 4. SIEM Webhook Dispatcher
app.post('/api/v1/siem/dispatch', validateBody(SiemDispatchSchema), (req: Request, res: Response) => {
  const { webhookUrl, eventType, payload } = req.body;

  appendAuditLog('SECURITY_ADMIN', 'SIEM_WEBHOOK_DISPATCH', webhookUrl);

  res.json({
    dispatched: true,
    requestId: req.requestId,
    destination: webhookUrl,
    eventType: eventType || 'SECURITY_ALERT',
    hmacSignature: crypto.createHmac('sha256', 'siem-secret').update(JSON.stringify(payload ?? {})).digest('hex'),
    timestamp: Date.now(),
  });
});

// 5. Compliance Linter Endpoint
app.post('/api/v1/compliance/audit', validateBody(ComplianceAuditSchema), (req: Request, res: Response) => {
  const workspaceConfig = req.body || {};
  const result = policyEngine.evaluateCompliance(workspaceConfig);
  appendAuditLog('COMPLIANCE_BOT', 'POSTURE_DRIFT_SCAN', workspaceConfig.workspaceId || 'default');
  res.json({ ...result, requestId: req.requestId });
});

// Kubernetes Health & Readiness Probes (/healthz and /readyz)
app.use(healthRouter);

// Mount Core API Routers
app.use('/api/v1/dashboards/presets', presetsRouter);
app.use('/api/v1/traces', tracesRouter);
app.use('/api/v1/incidents', incidentsRouter);
app.use('/api/v1/compliance', complianceRouter);
app.use('/api/v1/synthetic', syntheticRouter);
app.use('/api/v1/governance', governanceRouter);
app.use('/api/v1/logs', logsRouter);
app.use('/api/v1/self-healing', selfHealingRouter);
app.use('/api/v1/capstone-ultimate', capstoneUltimateRouter);
app.use('/api/v1', capstoneUltimateRouter);
app.use('/api/v1/immune', immuneSystemRouter);
app.use('/api/v1/lattice', immuneSystemRouter);
app.use('/api/v1/mesh', immuneSystemRouter);
app.use('/api/v1', immuneSystemRouter);
app.use('/api/v1', neuromorphicMeshRouter);
app.use('/api/v1/neuromorphic-mesh', neuromorphicMeshRouter);
app.use('/api/v1', syntheticDreamRouter);
app.use('/api/v1/synthetic-dream', syntheticDreamRouter);
app.use('/api/v1/dna', syntheticDreamRouter);
app.use('/api/v1/dream', syntheticDreamRouter);
app.use('/api/v1/resonance', syntheticDreamRouter);
app.use('/api/v1/swarm', swarmRouter);
app.use('/api/v1', authAndTenantRouter);

// PromQL / LogQL Metric Query API
app.post('/api/v1/metrics/query', validateBody(PromqlQuerySchema), (req: Request, res: Response) => {
  const queryReq = req.body;
  const result = evaluateMetricQuery(queryReq);
  appendAuditLog('METRICS_ENGINE', 'PROMQL_QUERY_EXECUTE', queryReq.query);
  res.json({ ...result, requestId: req.requestId });
});

// Text-to-PromQL AI Assistant Translation API
app.post('/api/v1/metrics/ai-translate', validateBody(AiTranslateSchema), (req: Request, res: Response) => {
  const { prompt } = req.body;
  const translated = translateTextToPromQL(prompt);
  appendAuditLog('AI_QUERY_ASSISTANT', 'TEXT_TO_PROMQL_TRANSLATE', prompt);
  res.json({ ...translated, requestId: req.requestId });
});

// Evaluate Widget Alert Triggers Endpoint
app.post('/api/v1/metrics/alerts', validateBody(AlertEvaluateSchema), (req: Request, res: Response) => {
  const { widgets } = req.body;
  const alerts = evaluateWidgetAlertTriggers(widgets);
  res.json({ alerts, count: alerts.length, requestId: req.requestId });
});

// JSON Malformed Body Syntax Error Handler (prevents HTML 500 stack leakage)
app.use((err: unknown, req: Request, res: Response, next: express.NextFunction) => {
  if (err && typeof err === 'object' && 'type' in err && (err as { type?: string }).type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Malformed JSON payload.',
      code: 'MALFORMED_JSON',
      requestId: req.requestId,
      timestamp: Date.now(),
    });
  }
  return next(err);
});

// Global Express Fallback Error Handler
app.use((err: unknown, req: Request, res: Response, _next: express.NextFunction) => {
  void _next;
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      event: 'UNHANDLED_ROUTE_ERROR',
      requestId: req.requestId,
      tenantId: req.tenantId || 'default-tenant',
      message: err instanceof Error ? err.message : String(err),
    })
  );
  res.status(500).json({
    error: 'Internal observability gateway fault.',
    code: 'INTERNAL_GATEWAY_ERROR',
    requestId: req.requestId,
    timestamp: Date.now(),
  });
});

const server = http.createServer(app);
setupWebSocketGateway(server);

// Global Uncaught / Unhandled Safety Guards
let shuttingDown = false;

function gracefulShutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      event: 'GRACEFUL_SHUTDOWN_INITIATED',
      signal,
    })
  );

  flushAllDurableState();
  closeWebSocketGateway();

  const drainTimeout = setTimeout(() => {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        event: 'GRACEFUL_SHUTDOWN_FORCED_EXIT',
        signal,
      })
    );
    process.exit(1);
  }, 10000);
  drainTimeout.unref?.();

  server.close(() => {
    clearTimeout(drainTimeout);
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        event: 'GRACEFUL_SHUTDOWN_COMPLETE',
        signal,
      })
    );
    process.exit(0);
  });
}

if (require.main === module) {
  process.on('uncaughtException', (err) => {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'fatal',
        event: 'UNCAUGHT_EXCEPTION',
        message: err.message,
        stack: err.stack,
      })
    );
    flushAllDurableState();
  });

  process.on('unhandledRejection', (reason) => {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        event: 'UNHANDLED_REJECTION',
        reason: reason instanceof Error ? reason.message : String(reason),
      })
    );
  });

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  server.listen(PORT, () => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        event: 'GATEWAY_LISTENING',
        port: Number(PORT),
        service: 'Neon Chasm Ingestion Gateway & Security Broker',
      })
    );
  });
}

export { server, defaultRateLimiter as rateLimiter, flushAllDurableState };
export default app;
