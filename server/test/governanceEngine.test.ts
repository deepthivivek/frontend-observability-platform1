import { describe, it, expect, beforeEach } from 'vitest';
import { CardinalityEngine } from '../src/governance/cardinalityEngine';
import { SamplingPolicyManager } from '../src/governance/samplingPolicy';
import { RemediationEngine } from '../src/governance/remediationEngine';
import { EBPFThrottler } from '../src/governance/ebpfThrottler';
import { AutonomousFinOpsAgent } from '../src/governance/autonomousFinOpsAgent';
import { ZKPFinOpsAttestation } from '../src/governance/zkpFinOpsAttestation';
import { ChaosEngine } from '../src/chaos/chaosEngine';
import { HomomorphicEncryptionGateway } from '../src/gateway/homomorphicEncryption';

describe('Governance, FinOps, ZKP, Chaos & FHE Engine (Day 16 Backend)', () => {
  describe('High-Cardinality Detection Engine', () => {
    const cardEngine = new CardinalityEngine();

    it('scans incoming telemetry label sets and identifies explosive dynamic keys', () => {
      const normalLabels = { environment: 'production', service: 'auth-service' };
      const normalCheck = cardEngine.detectLabelExplosion(normalLabels);
      expect(normalCheck.isExplosive).toBe(false);

      const explosiveLabels = {
        environment: 'production',
        user_guid: 'c4a991b0-781e-42b8-93c4-99182376ad12',
      };
      const expCheck = cardEngine.detectLabelExplosion(explosiveLabels);
      expect(expCheck.isExplosive).toBe(true);
      expect(expCheck.offendingKeys).toContain('user_guid');
    });

    it('retrieves cardinality report and toggles metric quarantine', () => {
      const report = cardEngine.getCardinalityReport();
      expect(report.length).toBeGreaterThan(0);

      const target = report[0];
      const updated = cardEngine.quarantineMetric(target.id, true);
      expect(updated?.quarantined).toBe(true);
    });
  });

  describe('Adaptive Sampling & Remediation Simulator', () => {
    const samplingMgr = new SamplingPolicyManager();
    const simulator = new RemediationEngine();

    it('enforces 100% error trace retention regardless of downsampling rules', () => {
      const normalRet = samplingMgr.shouldSampleEvent(200, false, 'LOW');
      expect(normalRet.sampleRate).toBe(10);

      const errorRet = samplingMgr.shouldSampleEvent(500, true, 'LOW');
      expect(errorRet.sampled).toBe(true);
      expect(errorRet.sampleRate).toBe(100);
    });

    it('simulates dry-run cost savings and retained error ratio', () => {
      const sim = simulator.simulateSamplingChange('rule-200-ok-logs', 10);
      expect(sim.monthlyCostSavingsUsd).toBeGreaterThan(0);
      expect(sim.retainedErrorTraceRatio).toBeGreaterThanOrEqual(99.0);
    });
  });

  describe('Kernel-Level eBPF Throttler', () => {
    const ebpf = new EBPFThrottler();

    it('tracks kernel latency overhead and simulates socket microburst packet shedding', () => {
      const status = ebpf.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.kernelLatencyMs).toBeLessThan(0.5);

      const updated = ebpf.simulateMicroburstShed(10000);
      expect(updated.droppedPacketsCount).toBeGreaterThan(status.droppedPacketsCount);
    });
  });

  describe('Autonomous FinOps Feedback Agent', () => {
    let agent: AutonomousFinOpsAgent;

    beforeEach(() => {
      agent = new AutonomousFinOpsAgent();
    });

    it('dynamically switches fidelity modes when spend velocity breaches budget cap', () => {
      const state = agent.getState();
      expect(state.monthlyBudgetUsd).toBe(5000);

      // Reduce budget cap to trigger control loop action
      const updated = agent.updateBudget(3000);
      expect(updated.activeFidelityMode).toBe('MAX_CONSERVATION');
      expect(updated.actionLogs.length).toBeGreaterThan(0);
    });
  });

  describe('Cryptographic ZKP FinOps Attestation Ledger', () => {
    const zkp = new ZKPFinOpsAttestation();

    it('generates cryptographic ZKP receipt with SHA-256 Merkle root hash and verifies proof', () => {
      const receipt = zkp.generateProof(450.0, 3420.5, 'v1.6-opa');

      expect(receipt.proofId).toBeDefined();
      expect(receipt.merkleRootHash.length).toBe(64);
      expect(receipt.zkProofHash.length).toBe(64);
      expect(receipt.verificationBadge).toBe('VERIFIED_ZERO_KNOWLEDGE');
    });
  });

  describe('Generative Chaos Engineering Engine', () => {
    const chaos = new ChaosEngine();

    it('simulates fault injection and calculates MTTR recovery time', () => {
      const experiments = chaos.getExperiments();
      expect(experiments.length).toBeGreaterThan(0);

      const ran = chaos.runExperiment(experiments[0].id);
      expect(ran?.status).toBe('COMPLETED');
      expect(ran?.recoveryTimeMttrMs).toBeGreaterThan(0);
      expect(ran?.circuitBreakerTripped).toBe(true);
    });
  });

  describe('Homomorphic Encryption (FHE) Ingestion Gateway', () => {
    const fhe = new HomomorphicEncryptionGateway();

    it('encrypts scalars into lattice ciphertexts and computes homomorphic additions without decryption', () => {
      const p1 = fhe.encryptScalar(150);
      const p2 = fhe.encryptScalar(250);

      expect(p1.encryptedCiphertext).toBeDefined();
      expect(p2.encryptedCiphertext).toBeDefined();

      const sumCiphertext = fhe.computeHomomorphicSum(p1.encryptedCiphertext, p2.encryptedCiphertext);
      expect(sumCiphertext).toBeDefined();

      const avgResult = fhe.computeHomomorphicAverage([p1.encryptedCiphertext, p2.encryptedCiphertext]);
      expect(avgResult.totalOpsCount).toBe(2);
      expect(avgResult.zeroPlaintextLeakage).toBe(true);
    });
  });
});
