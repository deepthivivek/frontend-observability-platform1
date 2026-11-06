import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CostGovernanceView } from '../components/governance/CostGovernanceView';

const mockMetrics = [
  {
    id: 'card-http-requests',
    metricName: 'http_requests_total',
    labelCount: 145000,
    cardinalityRisk: 'EXPLOSIVE',
    estimatedStorageBloatGb: 142.5,
    estimatedCostMonthlyUsd: 1425.0,
    quarantined: false,
    offendingLabel: 'user_guid (dynamic uuid in label set)',
  },
];

const mockPolicies = [
  {
    id: 'rule-200-ok-logs',
    name: 'HTTP 200 OK Trace Downsampler',
    targetMetricOrEndpoint: 'GET /health & 2xx Telemetry',
    sampleRatePercent: 10,
    preserveErrors: true,
    priority: 'LOW',
    enabled: true,
  },
];

const mockEbpf = {
  enabled: true,
  droppedPacketsCount: 142050,
  ingestionRateRps: 1850,
  kernelLatencyMs: 0.12,
  queueSaturationPercent: 34.5,
  activeSocketSheds: 4,
};

const mockFinOps = {
  enabled: true,
  monthlyBudgetUsd: 5000.0,
  currentMonthSpendUsd: 3420.5,
  projectedMonthEndSpendUsd: 4850.0,
  burnRateRps: 2450,
  activeFidelityMode: 'ADAPTIVE_DOWNSAMPLE',
  actionLogs: [
    {
      id: 'fin-001',
      timestamp: Date.now() - 3600000,
      action: 'DOWNSAMPLE_HTTP_200_SPANS',
      reason: 'Burn rate surge detected.',
      savingsImpact: '-$650/mo',
    },
  ],
};

const mockZkp = [
  {
    proofId: 'zkp-test-01',
    timestamp: Date.now(),
    merkleRootHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    zkProofHash: '99887766554433221100abcdef0123456789abcdef0123456789abcdef012345',
    samplingPolicyVersion: 'v1.4-sampling-opa',
    totalIngestedGbProven: 450.0,
    totalBilledAmountUsd: 3420.5,
    verificationBadge: 'VERIFIED_ZERO_KNOWLEDGE',
  },
];

const mockChaos = [
  {
    id: 'exp-latency-spike',
    name: 'Upstream Gateway Latency Surge Injection (+800ms)',
    faultType: 'LATENCY_INJECTION',
    targetService: 'api-gateway',
    durationSeconds: 30,
    intensityPercent: 75,
    status: 'COMPLETED',
    recoveryTimeMttrMs: 1420,
    resilienceScore: 94,
    circuitBreakerTripped: true,
  },
];

const mockFhe = {
  enabled: true,
  ciphertextOpsPerSec: 14200,
  encryptedMetricsCount: 450200,
  plaintextDataExposedRatio: 0.0,
  activeLatticeScheme: 'Ring-LWE / Paillier Additive Homomorphism',
  keyBits: 4096,
};

describe('Cost Governance & FinOps Studio UI (Day 16 Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/governance/cardinality/quarantine')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ metric: { ...mockMetrics[0], quarantined: true } }) });
      }
      if (url.includes('/api/v1/governance/cardinality')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ metrics: mockMetrics }) });
      }
      if (url.includes('/api/v1/governance/sampling/policies')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ policies: mockPolicies }) });
      }
      if (url.includes('/api/v1/governance/ebpf/status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockEbpf) });
      }
      if (url.includes('/api/v1/governance/finops/agent/toggle')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ...mockFinOps, enabled: false }) });
      }
      if (url.includes('/api/v1/governance/finops/agent')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFinOps) });
      }
      if (url.includes('/api/v1/governance/finops/zkp-proofs')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ receipts: mockZkp }) });
      }
      if (url.includes('/api/v1/governance/chaos/run')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ experiment: { ...mockChaos[0], recoveryTimeMttrMs: 1420 } }) });
      }
      if (url.includes('/api/v1/governance/chaos/experiments')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ experiments: mockChaos }) });
      }
      if (url.includes('/api/v1/governance/fhe/aggregate')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ opsPerformed: 4, encryptedAverageCiphertext: 'FHE_CIPHERTEXT_TEST' }) });
      }
      if (url.includes('/api/v1/governance/fhe/status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockFhe) });
      }
      if (url.includes('/api/v1/governance/simulate')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ monthlyCostSavingsUsd: 3600, retainedErrorTraceRatio: 99.9, currentMonthlyGb: 450, projectedMonthlyGb: 75 }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;
  });

  it('renders cardinality grid, ZKP proof ledger, FHE gateway status, and triggers chaos injection', async () => {
    render(<CostGovernanceView canViewGovernance={true} canManageGovernance={true} />);

    await waitFor(() => {
      expect(screen.getByText('FinOps, Cardinality & Chaos Governance')).toBeInTheDocument();
    });

    expect(screen.getByText('http_requests_total')).toBeInTheDocument();
    expect(screen.getByText('EXPLOSIVE')).toBeInTheDocument();

    // Switch to Autonomous FinOps & Sampling tab
    const finopsTab = screen.getByRole('button', { name: /Autonomous FinOps & Sampling/i });
    fireEvent.click(finopsTab);

    await waitFor(() => {
      expect(screen.getByText('Autonomous FinOps Agent')).toBeInTheDocument();
      expect(screen.getByText('DOWNSAMPLE_HTTP_200_SPANS')).toBeInTheDocument();
    });

    // Switch to ZKP Proofs & FHE Gateway tab
    const zkpTab = screen.getByRole('button', { name: /ZKP Proofs & FHE Gateway/i });
    fireEvent.click(zkpTab);

    await waitFor(() => {
      expect(screen.getByText('Zero-Knowledge Proof (ZKP) FinOps Attestation Receipts')).toBeInTheDocument();
      expect(screen.getByText('Ring-LWE / Paillier Additive Homomorphism')).toBeInTheDocument();
    });

    // Test FHE aggregation
    const testFheBtn = screen.getByRole('button', { name: /Test Homomorphic Aggregation/i });
    fireEvent.click(testFheBtn);

    await waitFor(() => {
      expect(screen.getByText(/Homomorphic aggregation computed on encrypted lattice ciphertexts/i)).toBeInTheDocument();
    });

    // Switch to Generative Chaos Engineering tab
    const chaosTab = screen.getByRole('button', { name: /Generative Chaos Engineering/i });
    fireEvent.click(chaosTab);

    await waitFor(() => {
      expect(screen.getByText('Generative Chaos Engineering Control Center')).toBeInTheDocument();
      expect(screen.getByText('api-gateway')).toBeInTheDocument();
    });

    // Trigger Chaos Fault Injection
    const triggerChaosBtn = screen.getByRole('button', { name: /Trigger Fault Injection/i });
    fireEvent.click(triggerChaosBtn);

    await waitFor(() => {
      expect(screen.getByText(/MTTR: 1420ms/i)).toBeInTheDocument();
    });
  });
});
