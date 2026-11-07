import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SelfHealingView } from '../components/infra/SelfHealingView';

const mockActions = [
  {
    id: 'rem-act-boot-01',
    ruleId: 'rule-autoscale-auth',
    ruleName: 'Auto-Scale Auth Service on Causal CPU/Latency Saturation',
    targetService: 'auth-service',
    triggerReason: 'Causal Bayesian inference isolated auth-service thread exhaustion (P=0.96)',
    triggerMetric: 'p99_latency_ms',
    triggerValue: 312,
    playbook: 'scale_out_pods',
    status: 'completed',
    startedAt: Date.now() - 3600000,
    completedAt: Date.now() - 3594000,
    executionLatencyMs: 6000,
    details: {
      previousReplicas: 3,
      scaledReplicas: 6,
      cluster: 'us-east-prod-1',
    },
    gitOpsPrUrl: 'https://github.com/neon-chasm/infra-gitops/pull/482',
    gitOpsPrId: 'pr-gitops-482',
    verificationStatus: 'verified',
    actor: 'AutonomousSelfHealingEngine',
  },
];

const mockRules = [
  {
    id: 'rule-autoscale-auth',
    name: 'Auto-Scale Auth Service on Causal CPU/Latency Saturation',
    targetService: 'auth-service',
    triggerCondition: 'causal_root_cause',
    metric: 'p99_latency_ms',
    thresholdValue: 280,
    playbook: 'scale_out_pods',
    playbookParams: { scaleReplicasDelta: 3, maxReplicas: 12 },
    cooldownMinutes: 5,
    lastTriggeredAt: Date.now() - 3600000,
    enabled: true,
    autoGitOpsSync: true,
  },
];

const mockCanaries = [
  {
    id: 'canary-checkout-v121',
    service: 'checkout-api',
    canaryVersion: 'v1.2.1-canary',
    baselineVersion: 'v1.2.0',
    trafficWeightCanary: 15,
    trafficWeightBaseline: 85,
    status: 'active',
    thresholds: {
      maxErrorRatePercent: 2.0,
      maxP99LatencyMs: 220,
      minEvaluatedRequests: 1000,
    },
    metrics: {
      canaryErrorRate: 2.85,
      canaryLatencyMs: 242,
      baselineErrorRate: 0.21,
      baselineLatencyMs: 145,
      totalRequestsSampled: 4820,
    },
    ebpfRoutingMap: {
      mapName: 'canary_sock_hash_checkout',
      fd: 14,
      pinnedPath: '/sys/fs/bpf/canary_checkout',
      activeRule: 'BPF_PROG_TYPE_SOCK_OPS: weight 15/85 split via flow hash',
    },
    rollbackHistory: [],
  },
];

const mockRL = {
  totalEpisodes: 20,
  convergenceScore: 91.2,
  explorationRateEpsilon: 0.12,
  learningRateAlpha: 0.15,
  discountFactorGamma: 0.85,
  activeAction: {
    id: 'act-moderate-throttle',
    name: 'Moderate eBPF Throttling & Buffer Expand',
    ebpfThrottleRatePct: 15,
    ebpfSocketBufferSizeKb: 256,
    threadPoolWeightMultiplier: 1.25,
  },
  recentSteps: [
    {
      step: 20,
      state: { p99LatencyMs: 120, errorRatePercent: 0.25, cpuUtilizationPercent: 48, queueDepth: 5 },
      actionTaken: { id: 'act-moderate-throttle', name: 'Moderate eBPF Throttling', ebpfThrottleRatePct: 15 },
      reward: 0.52,
      qValue: 2.84,
      latencyPenalty: 1.2,
      errorPenalty: 0.75,
      throughputBonus: 0.68,
      convergenceScore: 91.2,
      timestamp: Date.now(),
    },
  ],
  hyperparameters: {
    alpha: 0.15,
    gamma: 0.85,
    epsilon: 0.12,
    latencyWeight: 1.5,
    errorWeight: 3.0,
    throughputWeight: 0.8,
    targetP99LatencyMs: 150,
    targetMaxErrorRatePercent: 1.0,
  },
};

const mockGitOps = [
  {
    id: 'pr-gitops-482',
    title: 'fix(gitops): reconcile auth-service scale-out HPA minReplicas (3 -> 6)',
    branch: 'gitops/remediation-auth-service-scale-482',
    targetRepo: 'neon-chasm/infra-fleet-gitops',
    targetFile: 'deploy/base/auth-service/hpa.yaml',
    commitSha: '9f8b1c4d2e0a',
    diff: `--- a/hpa.yaml\n+++ b/hpa.yaml\n@@ -10,7 +10,7 @@\n-  minReplicas: 3\n+  minReplicas: 6`,
    status: 'submitted',
    service: 'auth-service',
    driftDetected: true,
    createdAt: Date.now() - 3600000,
    reconciledAt: null,
    prUrl: 'https://github.com/neon-chasm/infra-gitops/pull/482',
    author: 'GitOpsReconciliationController[bot]',
  },
];

const mockPostMortems = [
  {
    id: 'pm-inc-2026-081',
    incidentId: 'inc-p1-auth-081',
    title: 'Post-Mortem: Auth Service JWT Token Verification Thread Pool Exhaustion',
    severity: 'P1-Critical',
    affectedServices: ['auth-service', 'api-gateway'],
    startTime: Date.now() - 7200000,
    mitigationTime: Date.now() - 7080000,
    timeToRemediateMinutes: 2.0,
    executiveSummary: 'Worker thread starvation in auth-service restored autonomously in 120s.',
    causalRootCause: {
      primaryPath: 'api-gateway -> auth-service:verifyToken()',
      bayesianProbability: 0.96,
      blastRadiusServices: ['auth-service'],
    },
    telemetryCorrelations: {
      p99SpikeMs: 312,
      errorRateSpikePct: 4.8,
      exemplarTraceId: 'trace-auth-err-9941a8',
      errorLogSample: 'E_THREADPOOL_TIMEOUT',
    },
    actionsTaken: [
      { action: 'Autonomous HPA scale-out (+3)', timestamp: Date.now() - 7140000, automated: true },
    ],
    preventativeWorkItems: ['Migrate RSA to Ed25519'],
    hotfixDiff: {
      filePath: 'src/auth/tokenVerifier.ts',
      patch: `--- a/tokenVerifier.ts\n+++ b/tokenVerifier.ts\n@@ -24,7 +24,9 @@\n+  // Mitigate thread starvation\n+  const cached = tokenCache.get(rawJwt);`,
      testAssertion: 'expect(verifyAuthToken).toRejectWithinMs(75)',
      gitCommitMessage: 'fix(auth): fast token cache and 75ms timeout',
    },
    soc2ComplianceCertified: true,
    generatedAt: Date.now() - 6900000,
    markdown: '# Post-Mortem: Auth Service JWT Token Verification Thread Pool Exhaustion',
  },
];

describe('Self-Healing Command Studio UI (Day 18 Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url: string, options?: RequestInit) => {
      if (url.includes('/api/v1/self-healing/actions')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ actions: mockActions }) });
      }
      if (url.includes('/api/v1/self-healing/rules')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ rules: mockRules }) });
      }
      if (url.includes('/api/v1/self-healing/canary/rollback')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              deployment: { ...mockCanaries[0], status: 'rolled_back', trafficWeightCanary: 0, trafficWeightBaseline: 100 },
            }),
        });
      }
      if (url.includes('/api/v1/self-healing/canary')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ deployments: mockCanaries }) });
      }
      if (url.includes('/api/v1/self-healing/rl/step')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              result: { step: 21, reward: 0.64, qValue: 2.91, convergenceScore: 92.0 },
            }),
        });
      }
      if (url.includes('/api/v1/self-healing/rl/status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockRL) });
      }
      if (url.includes('/api/v1/self-healing/gitops/reconcile')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              pr: { ...mockGitOps[0], status: 'reconciled', driftDetected: false },
            }),
        });
      }
      if (url.includes('/api/v1/self-healing/gitops/prs')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ prs: mockGitOps }) });
      }
      if (url.includes('/api/v1/self-healing/postmortems')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ postMortems: mockPostMortems }) });
      }
      if (url.includes('/api/v1/self-healing/trigger')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              action: {
                ...mockActions[0],
                id: 'rem-act-test-new',
                triggerReason: 'Manual SRE Command',
                startedAt: Date.now(),
              },
            }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;
  });

  it('renders active remediation timelines, GitOps PR status badges, RL convergence charts, and post-mortem vaults', async () => {
    render(<SelfHealingView canManageInfra={true} canViewLogs={true} />);

    // 1. Verify header and high level stats
    await waitFor(() => {
      expect(screen.getByText('Autonomous Self-Healing Command Studio')).toBeInTheDocument();
      expect(screen.getByText(/Self-Healing Engine: ONLINE/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Verified Remediations')).toBeInTheDocument();
    expect(screen.getByText('eBPF Canary Rollbacks (1)')).toBeInTheDocument();

    // 2. Verify timeline contains action and status
    await waitFor(() => {
      expect(screen.getAllByText('auth-service').length).toBeGreaterThan(0);
      expect(screen.getByText('VERIFIED')).toBeInTheDocument();
    });

    // 3. Switch to Playbook Policies tab
    const policiesTab = screen.getByRole('button', { name: /Playbook Policies/i });
    fireEvent.click(policiesTab);

    await waitFor(() => {
      expect(screen.getByText('Auto-Scale Auth Service on Causal CPU/Latency Saturation')).toBeInTheDocument();
    });

    // 4. Switch to eBPF Canary Rollbacks tab
    const canaryTab = screen.getByRole('button', { name: /eBPF Canary Rollbacks/i });
    fireEvent.click(canaryTab);

    await waitFor(() => {
      expect(screen.getByText('checkout-api')).toBeInTheDocument();
      expect(screen.getByText('v1.2.1-canary')).toBeInTheDocument();
      expect(screen.getByText('Emergency eBPF Rollback')).toBeInTheDocument();
    });

    // Trigger Canary Rollback
    const rollbackBtn = screen.getByRole('button', { name: /Emergency eBPF Rollback/i });
    fireEvent.click(rollbackBtn);

    await waitFor(() => {
      expect(screen.getByText(/Instant eBPF Canary Rollback executed for canary-checkout-v121/i)).toBeInTheDocument();
    });

    // 5. Switch to RL eBPF Optimization tab
    const rlTab = screen.getByRole('button', { name: /RL eBPF Optimization/i });
    fireEvent.click(rlTab);

    await waitFor(() => {
      expect(screen.getByText('Continuous Q-Learning eBPF Socket Optimization')).toBeInTheDocument();
      expect(screen.getByText('Moderate eBPF Throttling & Buffer Expand')).toBeInTheDocument();
    });

    // Step RL Simulation
    const stepRLBtn = screen.getByRole('button', { name: /Simulate Learning Step/i });
    fireEvent.click(stepRLBtn);

    await waitFor(() => {
      expect(screen.getByText(/RL step #21 executed/i)).toBeInTheDocument();
    });

    // 6. Switch to GitOps PR Reconciler tab
    const gitopsTab = screen.getByRole('button', { name: /GitOps PR Reconciler/i });
    fireEvent.click(gitopsTab);

    await waitFor(() => {
      expect(screen.getByText('fix(gitops): reconcile auth-service scale-out HPA minReplicas (3 -> 6)')).toBeInTheDocument();
      expect(screen.getByText('DRIFT DETECTED')).toBeInTheDocument();
    });

    // Reconcile GitOps PR
    const reconcileBtn = screen.getByRole('button', { name: /Reconcile & Merge PR/i });
    fireEvent.click(reconcileBtn);

    await waitFor(() => {
      expect(screen.getByText(/GitOps PR pr-gitops-482 reconciled into main branch/i)).toBeInTheDocument();
    });

    // 7. Switch to Post-Mortem & Hotfixes tab
    const pmTab = screen.getByRole('button', { name: /Post-Mortem & Hotfixes/i });
    fireEvent.click(pmTab);

    await waitFor(() => {
      expect(screen.getAllByText('Post-Mortem: Auth Service JWT Token Verification Thread Pool Exhaustion').length).toBeGreaterThan(0);
      expect(screen.getByText('3. Verified Git Hotfix Patch')).toBeInTheDocument();
      expect(screen.getByText(/Download SOC2 Report/i)).toBeInTheDocument();
    });
  });

  it('enforces RBAC gates in read-only mode when canManageInfra is false', async () => {
    render(<SelfHealingView canManageInfra={false} canViewLogs={true} />);

    await waitFor(() => {
      expect(screen.getByText(/Read-Only Mode:/i)).toBeInTheDocument();
      expect(screen.getByText(/Your role lacks the/i)).toBeInTheDocument();
    });

    // Simulation trigger controls should be hidden
    expect(screen.queryByText('Fire Synthetic Alert')).not.toBeInTheDocument();
  });
});
