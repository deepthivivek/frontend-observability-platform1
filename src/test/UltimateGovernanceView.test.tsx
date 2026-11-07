import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UltimateGovernanceView } from '../components/capstone/UltimateGovernanceView';

const mockSandboxes = [
  {
    id: 'dt-sandbox-auth-01',
    name: 'Shadow Sandbox: Auth Service JWT Isolation',
    shadowNamespace: 'shadow-ns-auth-prod-v2',
    targetService: 'auth-service',
    status: 'verified_safe',
    ebpfNamespaceHandle: 'nsfs:/var/run/netns/shadow_auth_7812',
    traceReplayCount: 15400,
    chaosExperimentType: 'ASYMMETRIC_RSA_CPU_SATURATION',
    aiRemediationPlaybook: 'SCALE_OUT_PODS_AND_CACHE_KEYS',
    dryRunResults: {
      predictedMttrMs: 450,
      blastRadiusScore: 12.4,
      p99LatencyDeltaPercent: -42.5,
      errorRateDeltaPercent: -100.0,
      safetyCheckPassed: true,
    },
    createdAt: Date.now() - 7200000,
    lastSimulatedAt: Date.now() - 3600000,
  },
];

const mockNodes = [
  {
    nodeId: 'node-us-east-01',
    region: 'US-East',
    status: 'active',
    localEpoch: 48,
    modelLoss: 0.0412,
    privacyBudgetEpsilon: 1.2,
    lastSyncTimestamp: Date.now() - 15000,
    gradientHash: 'grad_hash_us_east_9a81',
  },
];

const mockGlobalModel = {
  globalVersion: 'v4.8.2-federated',
  globalLoss: 0.0433,
  participatingNodes: 4,
  differentialPrivacyEpsilonTotal: 4.7,
  aggregationAlgorithm: 'SecureAggregation-Laplacian',
  updatedAt: Date.now(),
  weightVectorSummary: {
    weightsCount: 145020,
    norm: 1.428,
    noiseScale: 0.085,
  },
};

describe('Ultimate Governance Studio UI (Capstone Ultimate Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/v1/digital-twin/status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: { totalSandboxes: 1 }, sandboxes: mockSandboxes }),
        });
      }
      if (url.includes('/api/v1/digital-twin/spawn')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              sandbox: {
                ...mockSandboxes[0],
                id: 'dt-sandbox-new',
                name: 'Shadow Sandbox: checkout-api Isolation',
                targetService: 'checkout-api',
                shadowNamespace: 'shadow-ns-checkout-new',
              },
            }),
        });
      }
      if (url.includes('/api/v1/digital-twin/simulate-chaos')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              sandbox: {
                ...mockSandboxes[0],
                status: 'verified_safe',
                dryRunResults: { predictedMttrMs: 310, blastRadiusScore: 10.5, p99LatencyDeltaPercent: -30.0, errorRateDeltaPercent: -95.0, safetyCheckPassed: true },
              },
            }),
        });
      }
      if (url.includes('/api/v1/federated/submit-gradients')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              node: { ...mockNodes[0], modelLoss: 0.0385, localEpoch: 49 },
              globalModel: { ...mockGlobalModel, globalLoss: 0.0421 },
            }),
        });
      }
      if (url.includes('/api/v1/federated/global-model')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ globalModel: mockGlobalModel, nodes: mockNodes }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;
  });

  it('renders digital twin sandbox topology comparisons, dry-run results, and federated anomaly matrices', async () => {
    render(<UltimateGovernanceView canManageInfra={true} canViewLogs={true} />);

    // 1. Verify header and high-level stats
    await waitFor(() => {
      expect(screen.getByText('Ultimate Governance & Capstone Studio')).toBeInTheDocument();
      expect(screen.getByText(/Capstone Defense: ACTIVE/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Shadow Sandboxes')).toBeInTheDocument();
    expect(screen.getByText('Verified Safe Dry-Runs')).toBeInTheDocument();

    // 2. Verify sandbox details rendered
    await waitFor(() => {
      expect(screen.getByText('Shadow Sandbox: Auth Service JWT Isolation')).toBeInTheDocument();
      expect(screen.getByText('verified safe')).toBeInTheDocument();
    });

    // 3. Trigger Chaos Dry-Run Simulation
    const simulateBtn = screen.getByRole('button', { name: /Run Chaos Dry-Run/i });
    fireEvent.click(simulateBtn);

    await waitFor(() => {
      expect(screen.getByText(/Chaos simulation completed: Safety Verified Safe/i)).toBeInTheDocument();
    });

    // 4. Switch to Federated Coordinator tab
    const fedTab = screen.getByRole('button', { name: /Federated Privacy-Preserving Coordinator/i });
    fireEvent.click(fedTab);

    await waitFor(() => {
      expect(screen.getByText('Global Federated Anomaly Model (v4.8.2-federated)')).toBeInTheDocument();
      expect(screen.getByText('US-East (node-us-east-01)')).toBeInTheDocument();
    });

    // Submit Gradients
    const syncBtn = screen.getByRole('button', { name: /Sync Encrypted Gradients/i });
    fireEvent.click(syncBtn);

    await waitFor(() => {
      expect(screen.getByText(/Secure Laplacian gradients synced for node node-us-east-01/i)).toBeInTheDocument();
    });
  });

  it('enforces RBAC read-only mode when canManageInfra is false', async () => {
    render(<UltimateGovernanceView canManageInfra={false} canViewLogs={true} />);

    await waitFor(() => {
      expect(screen.getByText(/Read-Only Mode:/i)).toBeInTheDocument();
    });

    expect(screen.queryByText('Spawn Sandbox')).not.toBeInTheDocument();
  });
});
