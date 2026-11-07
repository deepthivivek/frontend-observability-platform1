import { describe, it, expect, beforeEach } from 'vitest';
import { SelfHealingEngine } from '../src/infra/selfHealingEngine';
import { CanaryRollbackController } from '../src/infra/canaryRollbackController';
import { RLeBPFControlLoop } from '../src/infra/rlControlLoop';
import { GitOpsReconciliationController } from '../src/infra/gitopsReconciler';
import { RemediationVerificationEngine } from '../src/infra/remediationVerifier';
import { PostMortemSynthesizer } from '../src/infra/postMortemSynthesizer';

describe('Autonomous Self-Healing, Canary Rollback, RL & GitOps Engine (Day 18 Backend)', () => {
  let healingEngine: SelfHealingEngine;
  let canaryController: CanaryRollbackController;
  let rlLoop: RLeBPFControlLoop;
  let gitopsReconciler: GitOpsReconciliationController;
  let verifier: RemediationVerificationEngine;
  let pmSynthesizer: PostMortemSynthesizer;

  beforeEach(() => {
    healingEngine = new SelfHealingEngine();
    canaryController = new CanaryRollbackController();
    rlLoop = new RLeBPFControlLoop();
    gitopsReconciler = new GitOpsReconciliationController();
    verifier = new RemediationVerificationEngine();
    pmSynthesizer = new PostMortemSynthesizer();
  });

  describe('1. Self-Healing & Remediation Engine', () => {
    it('evaluates causal root-cause events and executes matching scale-out playbook', () => {
      const causalEvent = {
        service: 'auth-service',
        metric: 'p99_latency_ms',
        value: 340, // threshold is 280
        causalConfidence: 0.96,
      };

      const action = healingEngine.evaluateCausalEvent(causalEvent);
      expect(action).not.toBeNull();
      expect(action?.targetService).toBe('auth-service');
      expect(action?.playbook).toBe('scale_out_pods');
      expect(action?.details.deltaReplicas).toBe(3);
      expect(action?.details.targetReplicas).toBe(6);
      expect(action?.status).toBe('completed');
    });

    it('suppresses redundant triggers during cooldown period', () => {
      const causalEvent = {
        service: 'auth-service',
        metric: 'p99_latency_ms',
        value: 350,
      };

      const firstAction = healingEngine.evaluateCausalEvent(causalEvent);
      expect(firstAction).not.toBeNull();

      // Immediate re-evaluation should be blocked by 5-minute cooldown
      const secondAction = healingEngine.evaluateCausalEvent(causalEvent);
      expect(secondAction).toBeNull();
    });

    it('triggers eBPF rate-limiting on Z-Score latency spikes', () => {
      const zscoreEvent = {
        service: 'payment-gateway',
        metric: 'zscore_latency',
        value: 3.8, // threshold is 3.2
      };

      const action = healingEngine.evaluateCausalEvent(zscoreEvent);
      expect(action).not.toBeNull();
      expect(action?.playbook).toBe('ebpf_rate_throttle');
      expect(action?.details.throttleRatePercent).toBe(40);
      expect(action?.details.bpfMap).toBe('rate_limit_filter_table');
    });

    it('allows manual playbook trigger and updates rules', () => {
      const action = healingEngine.triggerManualRemediation('rule-circuit-break-search', {
        actor: 'SRE_OPERATOR',
      });
      expect(action.playbook).toBe('trip_circuit_breaker');
      expect(action.actor).toBe('SRE_OPERATOR');

      const updated = healingEngine.updateRule('rule-circuit-break-search', {
        thresholdValue: 12.0,
      });
      expect(updated.thresholdValue).toBe(12.0);
    });
  });

  describe('2. Automated Canary Rollback Controller', () => {
    it('detects error-rate regression and triggers instant eBPF socket weight shift', () => {
      const evaluation = canaryController.evaluateCanaryHealth('canary-checkout-v121', {
        canaryErrorRate: 3.4, // SLA threshold is 2.0%
        canaryLatencyMs: 210,
        totalRequestsSampled: 2500,
      });

      expect(evaluation.shouldRollback).toBe(true);
      expect(evaluation.reason).toContain('Error rate regression');
      expect(evaluation.deployment.trafficWeightCanary).toBe(0);
      expect(evaluation.deployment.trafficWeightBaseline).toBe(100);
      expect(evaluation.deployment.status).toBe('rolled_back');
      expect(evaluation.deployment.ebpfRoutingMap.activeRule).toContain('100% routed to baseline');
      expect(evaluation.deployment.rollbackHistory.length).toBeGreaterThan(0);
    });

    it('permits manual traffic weight adjustments via eBPF flow hash split', () => {
      const dep = canaryController.setTrafficWeight('canary-auth-v210', 40, 'SRE_TEST');
      expect(dep.trafficWeightCanary).toBe(40);
      expect(dep.trafficWeightBaseline).toBe(60);
      expect(dep.status).toBe('active');
    });

    it('promotes canary to 100% full production baseline', () => {
      const dep = canaryController.promoteCanary('canary-auth-v210', 'RELEASE_MANAGER');
      expect(dep.trafficWeightCanary).toBe(100);
      expect(dep.trafficWeightBaseline).toBe(0);
      expect(dep.status).toBe('promoted');
      expect(dep.baselineVersion).toBe('v2.1.0-rc3');
    });
  });

  describe('3. Reinforcement Learning eBPF Optimization Loop', () => {
    it('trains Q-learning policy on microservice latency and error feedback', () => {
      const stepResult = rlLoop.step({
        p99LatencyMs: 160,
        errorRatePercent: 0.45,
        cpuUtilizationPercent: 62,
        queueDepth: 7,
      });

      expect(stepResult.step).toBeGreaterThan(0);
      expect(stepResult.actionTaken).toBeDefined();
      expect(stepResult.reward).toBeDefined();
      expect(stepResult.qValue).toBeDefined();
      expect(stepResult.convergenceScore).toBeGreaterThan(0);
    });

    it('tracks hyperparameters and retrieves status with Q-table size', () => {
      const status = rlLoop.getStatus();
      expect(status.totalEpisodes).toBeGreaterThanOrEqual(20);
      expect(status.convergenceScore).toBeGreaterThan(80);
      expect(status.explorationRateEpsilon).toBe(0.12);

      const updatedParams = rlLoop.updateHyperparameters({ epsilon: 0.08 });
      expect(updatedParams.epsilon).toBe(0.08);
    });
  });

  describe('4. GitOps PR Reconciliation Controller', () => {
    it('constructs declarative Kubernetes YAML diff and creates GitOps PR for remediation', () => {
      const action = healingEngine.triggerManualRemediation('rule-autoscale-auth');
      const pr = gitopsReconciler.createPRForRemediation(action);

      expect(pr.targetRepo).toBe('neon-chasm/infra-fleet-gitops');
      expect(pr.service).toBe('auth-service');
      expect(pr.diff).toContain('minReplicas');
      expect(pr.status).toBe('submitted');
      expect(pr.driftDetected).toBe(true);
    });

    it('reconciles and merges open GitOps PR to eliminate infrastructure drift', () => {
      const pr = gitopsReconciler.getPR('pr-gitops-483');
      expect(pr).toBeDefined();

      const reconciled = gitopsReconciler.reconcilePR('pr-gitops-483', 'GITOPS_BOT');
      expect(reconciled.status).toBe('reconciled');
      expect(reconciled.driftDetected).toBe(false);
      expect(reconciled.reconciledAt).not.toBeNull();

      const drift = gitopsReconciler.checkDrift();
      expect(drift.syncedCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('5. Closed-Loop Remediation Verification Engine', () => {
    it('executes 3-cycle mathematical verification and assesses hysteresis risk', () => {
      const report = verifier.runVerification('rem-act-boot-01', 'auth-service', {
        p99: 320,
        errorRate: 4.5,
      });

      expect(report.testCycles.length).toBe(3);
      expect(report.baselineComparison.beforeP99LatencyMs).toBe(320);
      expect(report.baselineComparison.latencyDeltaPercent).toBeLessThan(0); // Latency decreased
      expect(report.hysteresisRiskScore).toBeLessThan(65);
      expect(['verified', 'inconclusive']).toContain(report.status);
    });
  });

  describe('6. Autonomous Post-Mortem & Git Hotfix Synthesizer', () => {
    it('aggregates incident telemetry into structured SOC2 post-mortem with hotfix diff', () => {
      const pm = pmSynthesizer.generatePostMortem({
        incidentId: 'inc-p1-test-99',
        title: 'Post-Mortem: Checkout API Redis Lock Contention',
        service: 'checkout-api',
        p99LatencyMs: 310,
        errorRatePct: 4.2,
      });

      expect(pm.soc2ComplianceCertified).toBe(true);
      expect(pm.causalRootCause.bayesianProbability).toBeGreaterThan(0.9);
      expect(pm.hotfixDiff.filePath).toContain('checkout-api');
      expect(pm.hotfixDiff.patch).toContain('--- a/');
      expect(pm.markdown).toContain('# Post-Mortem: Checkout API Redis Lock Contention');
      expect(pm.markdown).toContain('**SOC2 Certified**: Yes');
    });
  });
});
