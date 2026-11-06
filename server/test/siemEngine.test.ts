import { describe, it, expect, beforeEach } from 'vitest';
import { SIEMWebhookDispatcher } from '../src/siem/webhookDispatcher';
import { DLQManager } from '../src/siem/dlqManager';
import { ComplianceAuditor } from '../src/siem/complianceAuditor';
import { ComplianceExporter } from '../src/siem/complianceExporter';

describe('SIEM & Compliance Engine (Day 14 Backend)', () => {
  describe('SIEM Webhook Dispatcher & HMAC-SHA256 Signing', () => {
    const dispatcher = new SIEMWebhookDispatcher();

    it('lists registered SIEM webhook configurations', () => {
      const configs = dispatcher.getConfigs();
      expect(configs.length).toBeGreaterThan(0);
      expect(configs.some((c) => c.name.includes('Splunk'))).toBe(true);
    });

    it('dispatches event payloads and attaches valid signatures', async () => {
      const results = await dispatcher.dispatchEvent('SECURITY_ALERT', { alert: 'Unauthorized vault access attempt' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].signature).toBeDefined();
      expect(results[0].signature.length).toBe(64); // SHA-256 hex length
    });
  });

  describe('Dead-Letter Queue (DLQ) Manager', () => {
    let dlq: DLQManager;

    beforeEach(() => {
      dlq = new DLQManager(':memory:');
    });

    it('records failed webhook dispatches and retrieves pending items', () => {
      dlq.recordFailure({
        webhookId: 'wh-splunk-core',
        destinationUrl: 'https://siem.internal.corp/collect',
        payload: { test: true },
        errorCode: 'HTTP_503',
        errorMessage: 'Service Unavailable',
        attemptCount: 3,
      });

      const pending = dlq.getItems('PENDING_REDRIVE');
      expect(pending.length).toBe(1);
      expect(pending[0].errorCode).toBe('HTTP_503');
      expect(pending[0].status).toBe('PENDING_REDRIVE');
    });

    it('marks DLQ items as successfully redrived', () => {
      const rec = dlq.recordFailure({
        webhookId: 'wh-splunk-core',
        destinationUrl: 'https://siem.internal.corp/collect',
        payload: { test: true },
        errorCode: 'HTTP_504',
        errorMessage: 'Gateway Timeout',
        attemptCount: 3,
      });

      dlq.markRedrived(rec.id, true);
      const remaining = dlq.getItems('PENDING_REDRIVE');
      expect(remaining.length).toBe(0);
    });
  });

  describe('Compliance Auditor (SOC2 & GDPR)', () => {
    const auditor = new ComplianceAuditor();

    it('evaluates control standards and calculates compliance percentage score', () => {
      const evaluation = auditor.evaluateControls();
      expect(evaluation.totalControls).toBeGreaterThan(0);
      expect(evaluation.complianceScore).toBeGreaterThanOrEqual(80);
      expect(evaluation.controls.some((c) => c.standard === 'SOC2')).toBe(true);
      expect(evaluation.controls.some((c) => c.standard === 'GDPR')).toBe(true);
    });
  });

  describe('Compliance Evidence Exporter', () => {
    const exporter = new ComplianceExporter();

    it('generates cryptographically signed compliance export package with Merkle root hash', () => {
      const pkg = exporter.generateExportPackage('Lead Security Officer');

      expect(pkg.exportId).toBeDefined();
      expect(pkg.merkleRootHash).toBeDefined();
      expect(pkg.cryptographicSignature).toBeDefined();
      expect(pkg.cryptographicSignature.length).toBe(64);
      expect(pkg.complianceScore).toBeGreaterThan(0);
      expect(pkg.controls.length).toBeGreaterThan(0);
    });
  });
});
