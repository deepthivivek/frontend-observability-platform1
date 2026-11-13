import { describe, it, expect } from 'vitest';
import { validateEnterpriseEnvironment, EnterpriseEnvSchema } from '../src/config/envValidator';
import { complianceAuditor } from '../src/governance/complianceAuditor';
import { healthRouter } from '../src/routes/health';
import express from 'express';

describe('Enterprise Configuration, Health Probes & Continuous Compliance Suite', () => {
  describe('1. Enterprise Environment Validator', () => {
    it('validates enterprise config with default fallbacks in dev/test', () => {
      const config = validateEnterpriseEnvironment();
      expect(config.PORT).toBeGreaterThan(0);
      expect(config.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
      expect(config.PQC_LATTICE_SEED.length).toBeGreaterThanOrEqual(16);
      expect(config.ENCRYPTION_MASTER_KEY.length).toBeGreaterThanOrEqual(32);
      expect(config.MAX_WORKERS).toBeGreaterThan(0);
    });

    it('rejects secrets shorter than minimum cryptographic compliance requirements', () => {
      const invalidEnv = {
        JWT_SECRET: 'short_secret',
        PQC_LATTICE_SEED: 'short_seed',
        ENCRYPTION_MASTER_KEY: 'short_fhe_key',
      };

      const result = EnterpriseEnvSchema.safeParse(invalidEnv);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorFields = result.error.issues.map((e) => e.path[0]);
        expect(errorFields).toContain('JWT_SECRET');
        expect(errorFields).toContain('PQC_LATTICE_SEED');
        expect(errorFields).toContain('ENCRYPTION_MASTER_KEY');
      }
    });

    it('successfully parses valid production-grade enterprise secrets', () => {
      const validEnv = {
        NODE_ENV: 'production',
        PORT: '4444',
        JWT_SECRET: 'super_secret_enterprise_jwt_master_key_32chars',
        PQC_LATTICE_SEED: 'pqc_seed_valid_16_bytes',
        ENCRYPTION_MASTER_KEY: 'fhe_encryption_master_key_32_bytes_long',
        MAX_WORKERS: '16',
      };

      const parsed = EnterpriseEnvSchema.parse(validEnv);
      expect(parsed.PORT).toBe(4444);
      expect(parsed.NODE_ENV).toBe('production');
      expect(parsed.MAX_WORKERS).toBe(16);
    });
  });

  describe('2. Continuous Compliance Audit Engine', () => {
    it('evaluates active security controls across SOC2, GDPR, and HIPAA', () => {
      const controls = complianceAuditor.getControls();
      expect(controls.length).toBeGreaterThanOrEqual(4);
      expect(controls.some((c) => c.framework === 'SOC2_TYPE_II')).toBe(true);
      expect(controls.some((c) => c.framework === 'GDPR_ART_32')).toBe(true);
      expect(controls.some((c) => c.framework === 'HIPAA_SECURITY')).toBe(true);
      expect(controls.every((c) => c.status === 'COMPLIANT')).toBe(true);
    });

    it('computes compliance status summary with 100% audit health', () => {
      const status = complianceAuditor.getComplianceStatus();
      expect(status.overallScorePct).toBe(100.0);
      expect(status.passingControls).toBe(status.totalControls);
      expect(status.auditorHealth).toBe('NOMINAL');
      expect(status.soc2Status).toContain('100%');
    });

    it('generates signed cryptographic attestation report with Merkle root hash', () => {
      const report = complianceAuditor.generateAttestationReport('ACQUISITION_DUE_DILIGENCE');
      expect(report.reportId).toBeDefined();
      expect(report.attestationStatus).toBe('FULLY_ATTESTED');
      expect(report.merkleRootHash).toHaveLength(64);
      expect(report.cryptographicSignature).toHaveLength(64);
      expect(report.overallScorePct).toBe(100.0);
    });
  });

  describe('3. Kubernetes Health & Readiness Probes Router', () => {
    it('defines liveness (/healthz) and readiness (/readyz) route handlers', () => {
      const app = express();
      app.use(healthRouter);

      // Verify router stack has healthz and readyz routes registered
      const routes = healthRouter.stack
        .filter((layer) => layer.route)
        .map((layer) => layer.route?.path);

      expect(routes).toContain('/healthz');
      expect(routes).toContain('/readyz');
    });
  });
});
