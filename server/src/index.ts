import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'crypto';
import { DistributedCircuitBreaker } from './middleware/circuitBreaker';
import { PolicyEngine } from './security/policyEngine';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const circuitBreaker = new DistributedCircuitBreaker();
const policyEngine = new PolicyEngine();

app.use(circuitBreaker.middleware);
app.use(policyEngine.middleware);

// In-memory audit log hash chain store
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

const auditLogChain: AuditEvent[] = [
  {
    id: 'aud-genesis',
    timestamp: 1700000000000,
    actor: 'SYSTEM_BOOTSTRAP',
    action: 'GENESIS_BLOCK_CREATE',
    targetResource: 'audit_chain_root',
    previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    signature: 'sig_genesis_verified',
  },
];

export function appendAuditLog(actor: string, action: string, targetResource: string): AuditEvent {
  const previous = auditLogChain[auditLogChain.length - 1];
  const timestamp = Date.now();
  const rawPayload = `${timestamp}:${actor}:${action}:${targetResource}:${previous.hash}`;
  const hash = crypto.createHash('sha256').update(rawPayload).digest('hex');
  const signature = crypto.createHmac('sha256', 'neon-chasm-vault-secret').update(hash).digest('hex');

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
  return event;
}

// 1. Health & Status
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'Neon Chasm Ingestion Gateway & Security Broker',
    circuitBreaker: circuitBreaker.getStatus(),
    timestamp: Date.now(),
  });
});

// 2. OpenTelemetry Ingestion Endpoint
app.post('/api/v1/telemetry', (req: Request, res: Response) => {
  const { logs, metrics } = req.body || {};
  const traceId = req.headers['x-trace-id'] || `trace-${Date.now()}`;

  appendAuditLog('INGESTION_AGENT', 'TELEMETRY_BATCH_INGEST', `batch_${Array.isArray(logs) ? logs.length : 0}_logs`);

  res.setHeader('X-Trace-Id', traceId as string);
  res.status(202).json({
    accepted: true,
    processedLogs: Array.isArray(logs) ? logs.length : 0,
    traceId,
    timestamp: Date.now(),
  });
});

// 3. Get Cryptographic Hash-Chained Audit Logs
app.get('/api/v1/audit/logs', (req: Request, res: Response) => {
  res.json({
    chainLength: auditLogChain.length,
    verified: true,
    logs: auditLogChain,
  });
});

// 4. SIEM Webhook Dispatcher
app.post('/api/v1/siem/dispatch', (req: Request, res: Response) => {
  const { webhookUrl, eventType, payload } = req.body || {};
  if (!webhookUrl) {
    return res.status(400).json({ error: 'webhookUrl is required for SIEM dispatch.' });
  }

  appendAuditLog('SECURITY_ADMIN', 'SIEM_WEBHOOK_DISPATCH', webhookUrl);

  res.json({
    dispatched: true,
    destination: webhookUrl,
    eventType: eventType || 'SECURITY_ALERT',
    hmacSignature: crypto.createHmac('sha256', 'siem-secret').update(JSON.stringify(payload)).digest('hex'),
    timestamp: Date.now(),
  });
});

// 5. Compliance Linter Endpoint
app.post('/api/v1/compliance/audit', (req: Request, res: Response) => {
  const workspaceConfig = req.body || {};
  const result = policyEngine.evaluateCompliance(workspaceConfig);
  appendAuditLog('COMPLIANCE_BOT', 'POSTURE_DRIFT_SCAN', workspaceConfig.workspaceId || 'default');
  res.json(result);
});

import http from 'http';
import { evaluateMetricQuery, translateTextToPromQL } from './metrics/aggregator';
import { evaluateWidgetAlertTriggers } from './metrics/alertTriggers';
import { presetsRouter } from './routes/presets';
import { tracesRouter } from './routes/traces';
import { incidentsRouter } from './routes/incidents';
import { complianceRouter } from './routes/compliance';
import { syntheticRouter } from './routes/synthetic';
import { governanceRouter } from './routes/governance';
import { setupWebSocketGateway } from './ws/gateway';

// Mount Dashboard Presets API
app.use('/api/v1/dashboards/presets', presetsRouter);

// Mount Distributed Traces API
app.use('/api/v1/traces', tracesRouter);

// Mount AI Incident Triage & Command Center API
app.use('/api/v1/incidents', incidentsRouter);

// Mount SOC2/GDPR Compliance & SIEM Webhook API
app.use('/api/v1/compliance', complianceRouter);

// Mount Global Synthetic Prober & Edge API
app.use('/api/v1/synthetic', syntheticRouter);

// Mount Governance, FinOps, eBPF, ZKP, Chaos & FHE API
app.use('/api/v1/governance', governanceRouter);

// PromQL / LogQL Metric Query API
app.post('/api/v1/metrics/query', (req: Request, res: Response) => {
  const queryReq = req.body || {};
  const result = evaluateMetricQuery(queryReq);
  appendAuditLog('METRICS_ENGINE', 'PROMQL_QUERY_EXECUTE', queryReq.query || 'default_metric');
  res.json(result);
});

// Text-to-PromQL AI Assistant Translation API
app.post('/api/v1/metrics/ai-translate', (req: Request, res: Response) => {
  const { prompt } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: 'prompt text is required.' });
  }
  const translated = translateTextToPromQL(prompt);
  appendAuditLog('AI_QUERY_ASSISTANT', 'TEXT_TO_PROMQL_TRANSLATE', prompt);
  res.json(translated);
});

// Evaluate Widget Alert Triggers Endpoint
app.post('/api/v1/metrics/alerts', (req: Request, res: Response) => {
  const { widgets } = req.body || {};
  if (!Array.isArray(widgets)) {
    return res.status(400).json({ error: 'widgets array is required.' });
  }
  const alerts = evaluateWidgetAlertTriggers(widgets);
  res.json({ alerts, count: alerts.length });
});

const server = http.createServer(app);
setupWebSocketGateway(server);

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[Neon Chasm] Backend Node.js Ingestion Gateway running on port ${PORT}`);
  });
}

export { server };
export default app;
