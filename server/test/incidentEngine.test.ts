import { describe, it, expect, beforeEach } from 'vitest';
import { redactTelemetryText, redactTelemetryObject } from '../src/ai/piiFilter';
import { TelemetryRAGEngine } from '../src/ai/ragEngine';
import { RemediationSafetyGuard } from '../src/ai/remediationSafety';
import { RunbookExecutor } from '../src/ai/runbookExecutor';
import { PostMortemGenerator } from '../src/ai/postMortemGenerator';
import { Incident } from '../../src/types/incident';

describe('AI Incident Triage & Safety Engine (Day 13 Backend)', () => {
  const mockIncident: Incident = {
    id: 'inc-test-999',
    title: 'Postgres Connection Saturation on inventory-db',
    description: 'Database pool exhaustion cascading 504 timeouts to checkout-service',
    severity: 'P1-CRITICAL',
    status: 'IDENTIFIED',
    startedAt: 1700000000000,
    leadSre: 'Alex Rivera',
    primaryService: 'inventory-db',
    affectedServices: ['api-gateway', 'checkout-service', 'inventory-db'],
    errorRatePeak: 18.5,
    p99LatencyMs: 1450,
    blastRadius: {
      affectedUserSessions: 8400,
      frustrationScore: 78,
      revenueImpactEstimated: 15000,
      directServices: ['inventory-db'],
      downstreamServices: ['checkout-service', 'api-gateway'],
      sloBurnRate: 12.5,
    },
    rootCause: 'Connection starvation due to long-running unindexed locking queries.',
    timeline: [
      {
        timestamp: 1700000000000,
        type: 'DETECTION',
        message: 'Z-score latency anomaly detected',
        actor: 'AnomalyDetector',
      },
    ],
    correlatedTraceIds: ['tr-test-101'],
    topErrors: [
      {
        service: 'inventory-db',
        message: 'FATAL: remaining connection slots are reserved for non-replication superuser connections',
        count: 450,
        stack: 'Error: Connection pool exhausted\n    at Pool.connect (/app/db.js:12:3)',
      },
    ],
    suggestedRunbooks: [
      {
        actionId: 'FLUSH_CONNECTION_POOL',
        title: 'Drain Idle Database Connections',
        description: 'Terminate hanging connections',
        riskLevel: 'HIGH',
        requiresHitlApproval: true,
        targetService: 'inventory-db',
      },
      {
        actionId: 'CIRCUIT_BREAKER_RESET',
        title: 'Reset Gateway Circuit Breaker',
        description: 'Allow upstream traffic backpressure',
        riskLevel: 'LOW',
        requiresHitlApproval: false,
        targetService: 'api-gateway',
      },
    ],
  };

  describe('Telemetry PII & Confidentiality Redactor', () => {
    it('redacts JWT bearer tokens, API keys, passwords, and credit card numbers', () => {
      const rawLog =
        'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisToken ' +
        'user_pass="superSecretPassword123!" card=4111-2222-3333-4444 api_key=sk-proj99887766554433221100aa';

      const sanitized = redactTelemetryText(rawLog);

      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(sanitized).toContain('[REDACTED_TOKEN]');
      expect(sanitized).not.toContain('superSecretPassword123!');
      expect(sanitized).toContain('[REDACTED_SECRET]');
      expect(sanitized).not.toContain('4111-2222-3333-4444');
      expect(sanitized).toContain('[REDACTED_CARD]');
      expect(sanitized).not.toContain('sk-proj99887766554433221100aa');
      expect(sanitized).toContain('[REDACTED_API_KEY]');
    });

    it('recursively redacts nested object telemetry payloads', () => {
      const payload = {
        traceId: 'tr-123',
        headers: {
          authorization: 'Bearer secret_token',
          cookie: 'session=xyz987',
        },
        user: {
          email: 'admin@corp.internal',
          auth_token: 'secret_jwt_string',
        },
      };

      const redacted = redactTelemetryObject(payload);
      expect(redacted.headers.authorization).toBe('[REDACTED_CONFIDENTIAL]');
      expect(redacted.headers.cookie).toBe('[REDACTED_CONFIDENTIAL]');
      expect(redacted.user.auth_token).toBe('[REDACTED_CONFIDENTIAL]');
      expect(redacted.traceId).toBe('tr-123');
    });
  });

  describe('Telemetry RAG Synthesizer', () => {
    const ragEngine = new TelemetryRAGEngine();

    it('correlates incident metadata, logs, and trace bottlenecks into sanitized prompt context', () => {
      const logs = [
        {
          timestamp: 1700000001000,
          level: 'error',
          service: 'inventory-db',
          message: 'Connection timeout with token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz.abc',
        },
      ];

      const bottlenecks = [
        {
          traceId: 'tr-test-101',
          serviceName: 'inventory-db',
          spanName: 'acquire_connection',
          durationMs: 1450,
          zScore: 4.8,
          statusCode: 504,
          errorMessage: 'Acquisition timeout',
        },
      ];

      const context = ragEngine.buildContext(mockIncident, logs, bottlenecks);

      expect(context.incidentId).toBe('inc-test-999');
      expect(context.recentLogs[0].message).not.toContain('eyJhbGci');
      expect(context.recentLogs[0].message).toContain('[REDACTED_JWT]');
      expect(context.traceBottlenecks[0].zScore).toBe(4.8);

      const promptStr = ragEngine.formatPromptContext(context, 'Why did checkout-service fail?');
      expect(promptStr).toContain('=== OBSERVED INCIDENT TELEMETRY CONTEXT (RAG SYNTHESIS) ===');
      expect(promptStr).toContain('inventory-db');
      expect(promptStr).toContain('Z >= 3.5σ');
      expect(promptStr).toContain('Why did checkout-service fail?');
    });
  });

  describe('Human-in-the-Loop (HITL) Safety Guard & Runbook Executor', () => {
    const safetyGuard = new RemediationSafetyGuard();
    const executor = new RunbookExecutor();

    it('correctly calculates risk levels: LOW for circuit breaker, HIGH for connection pool flush', () => {
      expect(safetyGuard.evaluateRisk('CIRCUIT_BREAKER_RESET')).toBe('LOW');
      expect(safetyGuard.evaluateRisk('FLUSH_REDIS_CACHE')).toBe('MEDIUM');
      expect(safetyGuard.evaluateRisk('RESTART_POD')).toBe('MEDIUM');
      expect(safetyGuard.evaluateRisk('FLUSH_CONNECTION_POOL')).toBe('HIGH');
      expect(safetyGuard.evaluateRisk('DRAIN_TRAFFIC')).toBe('HIGH');
    });

    it('blocks HIGH-risk action when approved is false and dryRun is false', async () => {
      const result = await executor.execute({
        actionId: 'FLUSH_CONNECTION_POOL',
        targetService: 'inventory-db',
        actor: 'Devon Lee',
        role: 'SRE Staff',
        approved: false,
        dryRun: false,
      });

      expect(result.status).toBe('REJECTED_HITL_REQUIRED');
      expect(result.riskLevel).toBe('HIGH');
      expect(result.stderr[0]).toContain('Operational Safety Guard Blocked Execution');
    });

    it('permits HIGH-risk action when dryRun is true without requiring approval', async () => {
      const result = await executor.execute({
        actionId: 'FLUSH_CONNECTION_POOL',
        targetService: 'inventory-db',
        actor: 'Devon Lee',
        role: 'SRE Staff',
        approved: false,
        dryRun: true,
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.dryRun).toBe(true);
      expect(result.stdout.some((line) => line.includes('[DRY-RUN]'))).toBe(true);
      expect(result.auditEventId).toBeDefined();
      expect(result.auditSignature).toBeDefined();
    });

    it('authorizes and executes HIGH-risk action when explicitly approved by SRE Lead', async () => {
      let auditLogged = false;
      const result = await executor.execute({
        actionId: 'FLUSH_CONNECTION_POOL',
        targetService: 'inventory-db',
        actor: 'Alex Rivera',
        role: 'SRE Lead',
        approved: true,
        dryRun: false,
        auditAppender: (actor, action, target) => {
          auditLogged = true;
          return { id: 'aud-test-proof', signature: 'hmac-test-sig' };
        },
      });

      expect(result.status).toBe('SUCCESS');
      expect(result.dryRun).toBe(false);
      expect(auditLogged).toBe(true);
      expect(result.stdout.some((l) => l.includes('Normalized')) || result.stdout.some((l) => l.includes('Gracefully terminated'))).toBe(true);
      expect(result.auditEventId).toBe('aud-test-proof');
    });
  });

  describe('Automated Post-Mortem Generator', () => {
    const generator = new PostMortemGenerator();

    it('synthesizes blameless Markdown report with timeline, blast radius, and action items', () => {
      const report = generator.generate(mockIncident, 'Staff SRE Alex Rivera');

      expect(report.incidentId).toBe('inc-test-999');
      expect(report.markdown).toContain('# Post-Mortem: Postgres Connection Saturation on inventory-db');
      expect(report.markdown).toContain('## 1. Executive Summary');
      expect(report.markdown).toContain('## 2. Blast Radius & Business Impact');
      expect(report.markdown).toContain('## 3. Incident Timeline');
      expect(report.markdown).toContain('## 6. Preventative Action Items');
      expect(report.markdown).toContain('## 7. Lessons Learned');

      expect(report.sections.actionItems.length).toBeGreaterThanOrEqual(3);
      expect(report.sections.actionItems.some((a) => a.priority === 'P0')).toBe(true);
    });
  });
});
