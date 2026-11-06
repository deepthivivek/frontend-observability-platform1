/**
 * AI Incident Triage API & Command Center Routes (Day 13)
 * Provides endpoints for incident metadata, RAG context synthesis,
 * conversational AI triage, HITL runbook execution, and automated post-mortems.
 */

import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { Incident, RunbookActionId } from '../../../src/types/incident';
import { TelemetryRAGEngine, RAGLogEntry, RAGTraceBottleneck, RAGServiceHealth } from '../ai/ragEngine';
import { RunbookExecutor } from '../ai/runbookExecutor';
import { PostMortemGenerator } from '../ai/postMortemGenerator';
import { appendAuditLog } from '../index';

export const incidentsRouter = Router();

const ragEngine = new TelemetryRAGEngine();
const runbookExecutor = new RunbookExecutor();
const postMortemGenerator = new PostMortemGenerator();

// In-Memory Seeded Enterprise Incident Store
export const incidentStore: Map<string, Incident> = new Map([
  [
    'inc-2026-8812',
    {
      id: 'inc-2026-8812',
      title: 'Cascading Connection Pool Exhaustion on inventory-db causing 504s on /checkout',
      description:
        'Spike in concurrent checkout transactions exhausted PgBouncer connection limits on inventory-db, triggering cascading HTTP 504 Gateway Timeouts across order-service and api-gateway.',
      severity: 'P1-CRITICAL',
      status: 'IDENTIFIED',
      startedAt: Date.now() - 42 * 60 * 1000,
      leadSre: 'Alex Rivera (SRE Staff)',
      primaryService: 'inventory-db',
      affectedServices: ['api-gateway', 'checkout-service', 'order-service', 'inventory-db'],
      errorRatePeak: 19.4,
      p99LatencyMs: 1680,
      blastRadius: {
        affectedUserSessions: 12450,
        frustrationScore: 88,
        revenueImpactEstimated: 24500,
        directServices: ['inventory-db', 'order-service'],
        downstreamServices: ['checkout-service', 'api-gateway', 'notification-service'],
        sloBurnRate: 18.2,
      },
      rootCause:
        'Deadlock contention on Postgres table `inventory_reservations` held client connections open for >1500ms, causing the 120-client PgBouncer pool to saturate and queue 48 incoming requests indefinitely.',
      timeline: [
        {
          timestamp: Date.now() - 42 * 60 * 1000,
          type: 'DETECTION',
          message: 'Automated Z-score detector flagged 4.6σ latency surge on POST /checkout',
          actor: 'AnomalyDetectorBot',
        },
        {
          timestamp: Date.now() - 38 * 60 * 1000,
          type: 'ESCALATION',
          message: 'Paged Primary On-Call SRE (Alex Rivera) due to P1 SLO budget burn (18.2x)',
          actor: 'PagerDutyEngine',
        },
        {
          timestamp: Date.now() - 25 * 60 * 1000,
          type: 'INVESTIGATION',
          message: 'Identified connection pool exhaustion on inventory-db (120/120 active connections)',
          actor: 'Alex Rivera',
        },
        {
          timestamp: Date.now() - 12 * 60 * 1000,
          type: 'MITIGATION',
          message: 'Dry-run executed for FLUSH_CONNECTION_POOL on inventory-db',
          actor: 'Alex Rivera',
        },
      ],
      correlatedTraceIds: ['tr-cascade-504-01', 'tr-db-lock-02', 'tr-checkout-spike-03'],
      topErrors: [
        {
          service: 'inventory-db',
          message: 'FATAL: remaining connection slots are reserved for non-replication superuser connections',
          count: 1420,
          stack: 'Error: Connection pool exhausted\n    at Pool.connect (/app/db/pool.js:42:15)\n    at Query.execute (/app/db/query.js:88:21)',
        },
        {
          service: 'order-service',
          message: 'Error: 504 Gateway Timeout while awaiting downstream inventory reservation',
          count: 890,
          stack: 'GatewayTimeout: upstream service took longer than 1500ms\n    at HttpClient.post (/app/http/client.js:104:12)',
        },
      ],
      suggestedRunbooks: [
        {
          actionId: 'FLUSH_CONNECTION_POOL',
          title: 'Drain Stale Database Connections',
          description: 'Terminates idle and hanging client queries on PgBouncer to restore free pool slots.',
          riskLevel: 'HIGH',
          requiresHitlApproval: true,
          targetService: 'inventory-db',
          parameters: { maxIdleSeconds: 30 },
        },
        {
          actionId: 'CIRCUIT_BREAKER_RESET',
          title: 'Trip & Reset Gateway Circuit Breaker',
          description: 'Enables fast-fail shedding on upstream api-gateway to allow database recovery.',
          riskLevel: 'LOW',
          requiresHitlApproval: false,
          targetService: 'api-gateway',
        },
        {
          actionId: 'RESTART_POD',
          title: 'Rolling Restart of Order Service Pods',
          description: 'Performs zero-downtime rolling restart to clear deadlocks in local service memory.',
          riskLevel: 'MEDIUM',
          requiresHitlApproval: false,
          targetService: 'order-service',
        },
      ],
    },
  ],
  [
    'inc-2026-8813',
    {
      id: 'inc-2026-8813',
      title: 'Redis Cluster Memory Eviction Storm in auth-service',
      description: 'High rate of session token creation triggered volatile-lru eviction in Redis auth cluster.',
      severity: 'P2-HIGH',
      status: 'MITIGATING',
      startedAt: Date.now() - 75 * 60 * 1000,
      leadSre: 'Maya Chen (Platform SRE)',
      primaryService: 'auth-service',
      affectedServices: ['auth-service', 'api-gateway', 'user-profile'],
      errorRatePeak: 8.7,
      p99LatencyMs: 740,
      blastRadius: {
        affectedUserSessions: 4820,
        frustrationScore: 54,
        revenueImpactEstimated: 6200,
        directServices: ['auth-service'],
        downstreamServices: ['api-gateway', 'user-profile'],
        sloBurnRate: 4.5,
      },
      rootCause: 'Unbounded token generation without TTL compaction caused Redis heap to breach 95% threshold.',
      timeline: [
        {
          timestamp: Date.now() - 75 * 60 * 1000,
          type: 'DETECTION',
          message: 'Redis memory saturation warning (92% capacity)',
          actor: 'PrometheusAlert',
        },
        {
          timestamp: Date.now() - 60 * 60 * 1000,
          type: 'INVESTIGATION',
          message: 'Identified key explosion in auth_sessions:* namespace',
          actor: 'Maya Chen',
        },
      ],
      correlatedTraceIds: ['tr-redis-evict-01', 'tr-auth-storm-02'],
      topErrors: [
        {
          service: 'auth-service',
          message: 'OOM command not allowed when used memory > maxmemory',
          count: 512,
        },
      ],
      suggestedRunbooks: [
        {
          actionId: 'FLUSH_REDIS_CACHE',
          title: 'Flush Stale Session Tokens',
          description: 'Flushes expired keys in Redis session cache to reclaim memory.',
          riskLevel: 'MEDIUM',
          requiresHitlApproval: false,
          targetService: 'auth-service',
        },
        {
          actionId: 'SCALE_REPLICAS',
          title: 'Scale Auth Service Workers',
          description: 'Adds +4 worker instances to handle session decryption load.',
          riskLevel: 'MEDIUM',
          requiresHitlApproval: false,
          targetService: 'auth-service',
        },
      ],
    },
  ],
  [
    'inc-2026-8814',
    {
      id: 'inc-2026-8814',
      title: 'Payment Gateway Latency Surge (Z >= 4.2σ) on Stripe Webhook Endpoint',
      description: 'Upstream payment processor degradation induced 2.1s p99 latency on webhook settlements.',
      severity: 'P2-HIGH',
      status: 'RESOLVED',
      startedAt: Date.now() - 180 * 60 * 1000,
      resolvedAt: Date.now() - 25 * 60 * 1000,
      leadSre: 'Devon Lee (Payment SRE)',
      primaryService: 'payment-gateway',
      affectedServices: ['payment-gateway', 'checkout-service'],
      errorRatePeak: 4.2,
      p99LatencyMs: 2150,
      blastRadius: {
        affectedUserSessions: 1320,
        frustrationScore: 42,
        revenueImpactEstimated: 12800,
        directServices: ['payment-gateway'],
        downstreamServices: ['checkout-service'],
        sloBurnRate: 3.1,
      },
      rootCause: 'Third-party gateway timeout handling lacked fallback webhook queueing.',
      timeline: [
        {
          timestamp: Date.now() - 180 * 60 * 1000,
          type: 'DETECTION',
          message: 'Latency anomaly detected on /v1/webhook/stripe',
          actor: 'TraceAnomalyDetector',
        },
        {
          timestamp: Date.now() - 25 * 60 * 1000,
          type: 'RESOLUTION',
          message: 'Traffic routed to secondary processing partner; latency returned to 120ms baseline.',
          actor: 'Devon Lee',
        },
      ],
      correlatedTraceIds: ['tr-stripe-surge-01'],
      topErrors: [
        {
          service: 'payment-gateway',
          message: 'ETIMEDOUT connecting to api.stripe.com:443',
          count: 184,
        },
      ],
      suggestedRunbooks: [
        {
          actionId: 'DRAIN_TRAFFIC',
          title: 'Drain Traffic from Degraded Ingress',
          description: 'Reroutes incoming checkout requests to secondary gateway.',
          riskLevel: 'HIGH',
          requiresHitlApproval: true,
          targetService: 'payment-gateway',
        },
      ],
    },
  ],
]);

// 1. List Incidents
incidentsRouter.get('/', (req: Request, res: Response) => {
  const incidents = Array.from(incidentStore.values()).sort((a, b) => b.startedAt - a.startedAt);
  res.json({
    total: incidents.length,
    activeCount: incidents.filter((i) => i.status !== 'RESOLVED').length,
    incidents,
  });
});

// 2. Get Single Incident by ID
incidentsRouter.get('/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const incident = incidentStore.get(id);
  if (!incident) {
    return res.status(404).json({ error: `Incident ${id} not found.` });
  }
  res.json(incident);
});

// 3. Update Incident Status
incidentsRouter.post('/:id/status', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status, actor, message } = req.body || {};
  const incident = incidentStore.get(id);

  if (!incident) {
    return res.status(404).json({ error: `Incident ${id} not found.` });
  }

  const validStatuses = ['INVESTIGATING', 'IDENTIFIED', 'MITIGATING', 'RESOLVED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  incident.status = status;
  if (status === 'RESOLVED') {
    incident.resolvedAt = Date.now();
  }

  incident.timeline.push({
    timestamp: Date.now(),
    type: status === 'RESOLVED' ? 'RESOLUTION' : 'INVESTIGATION',
    message: message || `Incident status updated to ${status} by ${actor || 'Operator'}`,
    actor: actor || 'SRE Operator',
  });

  appendAuditLog(actor || 'SRE_OPERATOR', `INCIDENT_STATUS_CHANGE_${status}`, id);

  res.json(incident);
});

// 4. AI Incident Assistant Chat Endpoint (POST /api/v1/incidents/chat)
incidentsRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { incidentId, prompt, userRole, actor } = req.body || {};

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required.' });
    }

    const incident = incidentId ? incidentStore.get(incidentId) : incidentStore.get('inc-2026-8812');
    if (!incident) {
      return res.status(404).json({ error: `Incident ${incidentId} not found.` });
    }

    // Build RAG Context
    const correlatedLogs: RAGLogEntry[] = [
      {
        timestamp: Date.now() - 15 * 60 * 1000,
        level: 'error',
        service: incident.primaryService,
        message: incident.topErrors[0]?.message || 'Unhandled backend exception',
        stack: incident.topErrors[0]?.stack,
      },
      {
        timestamp: Date.now() - 14 * 60 * 1000,
        level: 'warn',
        service: 'api-gateway',
        message: 'High latency threshold exceeded on /checkout (p99 > 1500ms)',
      },
    ];

    const bottlenecks: RAGTraceBottleneck[] = [
      {
        traceId: incident.correlatedTraceIds[0] || 'tr-mock-01',
        serviceName: incident.primaryService,
        spanName: 'db_query_acquire_connection',
        durationMs: incident.p99LatencyMs,
        zScore: 4.6,
        statusCode: 504,
        errorMessage: 'Connection pool timeout waiting for available socket',
      },
    ];

    const serviceHealth: RAGServiceHealth[] = incident.affectedServices.map((svc) => ({
      service: svc,
      status: svc === incident.primaryService ? 'critical' : 'degraded',
      errorRate: svc === incident.primaryService ? incident.errorRatePeak : Math.round(incident.errorRatePeak / 3),
      p99LatencyMs: svc === incident.primaryService ? incident.p99LatencyMs : 320,
    }));

    const ragContext = ragEngine.buildContext(incident, correlatedLogs, bottlenecks, serviceHealth);
    const systemPromptContext = ragEngine.formatPromptContext(ragContext, prompt);

    let assistantText = '';

    // Check if Gemini API is available
    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `${systemPromptContext}\n\nYou are "The Neon Chasm" Principal AI Incident SRE. Provide a concise, structured response containing:
1. Root Cause Summary
2. Impact Analysis
3. Recommended Runbook Remediations (with risk assessment)
Use clean Markdown formatting.`,
        });
        assistantText = response.text || '';
      } catch (err) {
        console.warn('[Gemini API] Failed to query LLM, using deterministic triage engine:', err);
      }
    }

    // Deterministic High-Fidelity Fallback if API key missing or offline
    if (!assistantText) {
      assistantText = `### AI Incident Triage Analysis

**Primary Incident Correlation**: \`${incident.id}\` ("${incident.title}")
**Severity**: **${incident.severity}** | **Root Service**: \`${incident.primaryService}\`

#### 1. Root Cause Attribution
Telemetry RAG analysis reveals that **${incident.primaryService}** is the originating root-cause bottleneck. 
- **Z-Score Anomaly**: Observed statistical latency outlier of **4.6σ** on database query execution.
- **Cascading Chain**: Latency in \`${incident.primaryService}\` saturated incoming connection buffers, propagating **HTTP 504 Gateway Timeouts** upstream to \`${incident.affectedServices.filter((s) => s !== incident.primaryService).join('`, `')}\`.

#### 2. Blast Radius Assessment
- **Impacted Sessions**: ~${incident.blastRadius.affectedUserSessions.toLocaleString()} user sessions currently degraded.
- **SLO Error Budget Burn Rate**: **${incident.blastRadius.sloBurnRate}x** normal consumption.
- **Frustration Index**: ${incident.blastRadius.frustrationScore}/100.

#### 3. Recommended Remediation Runbooks
- **\`${incident.suggestedRunbooks[0]?.actionId || 'FLUSH_CONNECTION_POOL'}\`** (*Risk: ${incident.suggestedRunbooks[0]?.riskLevel || 'HIGH'}*): 
  ${incident.suggestedRunbooks[0]?.description || 'Drains idle connections to restore pool throughput.'}
- **\`${incident.suggestedRunbooks[1]?.actionId || 'CIRCUIT_BREAKER_RESET'}\`** (*Risk: ${incident.suggestedRunbooks[1]?.riskLevel || 'LOW'}*): 
  ${incident.suggestedRunbooks[1]?.description || 'Enables upstream fail-fast backpressure.'}

*Note: High-risk runbooks require explicit Human-in-the-Loop (HITL) authorization.*`;
    }

    appendAuditLog(actor || 'AI_INCIDENT_ASSISTANT', 'INCIDENT_AI_CHAT_QUERY', incident.id);

    res.json({
      message: assistantText,
      rootCause: incident.rootCause,
      affectedMicroservices: incident.affectedServices,
      correlatedLogs: correlatedLogs.map((l) => ({
        timestamp: l.timestamp,
        level: l.level,
        service: l.service,
        message: l.message,
      })),
      recommendedRunbooks: incident.suggestedRunbooks,
      blastRadiusSummary: `${incident.blastRadius.affectedUserSessions} sessions affected | ${incident.blastRadius.sloBurnRate}x SLO burn`,
      zScoreImpact: 4.6,
      userRole: userRole || 'SRE Lead',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Internal error processing incident chat query' });
  }
});

// 5. Automated Runbook Remediation Endpoint (POST /api/v1/incidents/remediate)
incidentsRouter.post('/remediate', async (req: Request, res: Response) => {
  try {
    const { actionId, targetService, actor, role, approved, dryRun, parameters } = req.body || {};

    if (!actionId) {
      return res.status(400).json({ error: 'actionId is required.' });
    }

    const validActions: RunbookActionId[] = [
      'FLUSH_REDIS_CACHE',
      'RESTART_POD',
      'CIRCUIT_BREAKER_RESET',
      'FLUSH_CONNECTION_POOL',
      'SCALE_REPLICAS',
      'DRAIN_TRAFFIC',
    ];

    if (!validActions.includes(actionId)) {
      return res.status(400).json({ error: `Invalid actionId. Allowed: ${validActions.join(', ')}` });
    }

    const result = await runbookExecutor.execute({
      actionId,
      targetService: targetService || 'primary-cluster',
      actor: actor || 'SRE Operator',
      role: role || 'SRE Lead',
      approved: Boolean(approved),
      dryRun: Boolean(dryRun),
      parameters: parameters || {},
      auditAppender: (act, actionName, target) => {
        const auditEvent = appendAuditLog(act, actionName, target);
        return { id: auditEvent.id, signature: auditEvent.signature };
      },
    });

    if (result.status === 'REJECTED_HITL_REQUIRED') {
      return res.status(403).json(result);
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Runbook execution failed' });
  }
});

// 6. Generate Automated Post-Mortem (GET /api/v1/incidents/:id/post-mortem)
incidentsRouter.get('/:id/post-mortem', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const incident = incidentStore.get(id);

  if (!incident) {
    return res.status(404).json({ error: `Incident ${id} not found.` });
  }

  const author = (req.query.author as string) || 'Neon Chasm SRE Lead';
  const report = postMortemGenerator.generate(incident, author);

  appendAuditLog('POST_MORTEM_ENGINE', 'GENERATE_BLAMELESS_REPORT', id);

  res.json(report);
});
