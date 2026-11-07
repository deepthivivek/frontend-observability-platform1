import { describe, it, expect, beforeEach } from 'vitest';
import { DigitalTwinChaosSimulator } from '../src/chaos/digitalTwinChaos';
import { FederatedAnomalySyncCoordinator } from '../src/ai/federatedAnomalySync';

describe('Digital Twin & Federated Anomaly Sync Suite (Capstone Ultimate Backend)', () => {
  let twinSimulator: DigitalTwinChaosSimulator;
  let federatedCoordinator: FederatedAnomalySyncCoordinator;

  beforeEach(() => {
    twinSimulator = new DigitalTwinChaosSimulator();
    federatedCoordinator = new FederatedAnomalySyncCoordinator();
  });

  describe('1. Ephemeral Digital Twin Chaos Simulator', () => {
    it('spawns shadow sandbox via eBPF namespace isolation', () => {
      const sandbox = twinSimulator.spawnSandbox({
        targetService: 'auth-service',
        chaosExperimentType: 'ASYMMETRIC_RSA_CPU_SATURATION',
        actor: 'TEST_ARCHITECT',
      });

      expect(sandbox.id).toBeDefined();
      expect(sandbox.targetService).toBe('auth-service');
      expect(sandbox.shadowNamespace).toContain('shadow-ns-auth-service');
      expect(sandbox.ebpfNamespaceHandle).toContain('nsfs:/var/run/netns/');
      expect(sandbox.status).toBe('active');
    });

    it('simulates chaos dry-run and calculates safe blast radius & MTTR', () => {
      const sandboxes = twinSimulator.getSandboxes();
      const target = sandboxes[0];

      const simulated = twinSimulator.simulateChaos(target.id, 'TEST_ARCHITECT');
      expect(simulated.status).toBe('verified_safe');
      expect(simulated.dryRunResults.predictedMttrMs).toBeGreaterThan(0);
      expect(simulated.dryRunResults.blastRadiusScore).toBeLessThan(40);
      expect(simulated.dryRunResults.safetyCheckPassed).toBe(true);
    });
  });

  describe('2. Federated Privacy-Preserving Telemetry Coordinator', () => {
    it('synchronizes decentralized anomaly gradients using Laplacian differential privacy', () => {
      const initialModel = federatedCoordinator.getGlobalModel();
      expect(initialModel.participatingNodes).toBeGreaterThanOrEqual(4);

      const result = federatedCoordinator.submitGradients({
        nodeId: 'node-us-east-01',
        region: 'US-East',
        localEpoch: 51,
        modelLoss: 0.0392,
        privacyBudgetEpsilon: 1.2,
        actor: 'TEST_NODE',
      });

      expect(result.node.modelLoss).toBe(0.0392);
      expect(result.globalModel.participatingNodes).toBeGreaterThanOrEqual(4);
      expect(result.globalModel.aggregationAlgorithm).toBe('SecureAggregation-Laplacian');
      expect(result.globalModel.differentialPrivacyEpsilonTotal).toBeGreaterThan(4.0);
    });
  });
});
