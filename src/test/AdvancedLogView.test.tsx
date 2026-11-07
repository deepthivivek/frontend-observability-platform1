import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdvancedLogView } from '../components/logs/AdvancedLogView';

const mockQueryResult = {
  query: '{app="checkout", level="error"} |= "timeout"',
  ast: {
    rawQuery: '{app="checkout", level="error"} |= "timeout"',
    selectors: [{ label: 'app', operator: '=', value: 'checkout' }],
    filters: [{ operator: '|=', pattern: 'timeout' }],
    isSemanticVectorSearch: false,
  },
  logs: [
    {
      id: 'log-101',
      timestamp: Date.now() - 60000,
      region: 'us-east',
      clusterNode: 'us-east-node-01',
      streamLabels: { app: 'checkout', level: 'error' },
      rawLogLine: 'HTTP 504 Gateway Timeout: db-proxy pool connection timeout',
      scrubbedLogLine: 'HTTP 504 Gateway Timeout: Bearer [REDACTED_AUTH_TOKEN] - db-proxy pool connection timeout',
      piiTokensMasked: ['BEARER_TOKEN'],
      traceId: 'tr-db-leak-991',
      spanId: 'sp-chk-101',
      severity: 'ERROR',
    },
  ],
  totalMatched: 1,
  queryExecutionMs: 12,
  causalAnalysis: {
    primaryRootCauseService: 'db-proxy-pool',
    rootCauseProbability: 96.4,
    confidenceScore: 99.2,
    causalChain: [
      {
        id: 'cnode-01',
        service: 'db-proxy-pool',
        anomalyType: 'CONNECTION_POOL_EXHAUSTION',
        probabilityScore: 96.4,
        contributingLogCount: 142,
        linkedTraceId: 'tr-db-leak-991',
        causalDirection: 'ROOT_CAUSE_ORIGIN',
      },
    ],
    recommendedRemediation: 'Increase db-proxy max_connections from 200 to 500.',
  },
  zkProof: {
    proofId: 'zk-log-test-99',
    shardId: 'shard-us-east-42',
    region: 'us-east',
    timestamp: Date.now(),
    merkleRootHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    zkProofSnarkHash: '99887766554433221100abcdef0123456789abcdef0123456789abcdef012345',
    retrievabilityStatus: 'VERIFIED',
    totalBytesProven: 450200000,
  },
};

const mockClusters = [
  {
    regionId: 'us-east',
    name: 'US-East Primary Partition Cluster',
    activeNodes: 12,
    ingestionRateGbs: 4.2,
    replicationLagMs: 8,
    partitionStatus: 'HEALTHY',
    totalStoredLogs: 142050000,
  },
];

describe('Advanced Log Explorer Studio UI (Day 17 Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/logs/query')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQueryResult) });
      }
      if (url.includes('/api/v1/logs/regions')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ clusters: mockClusters }) });
      }
      if (url.includes('/api/v1/logs/zk-proofs')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQueryResult.zkProof) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;
  });

  it('renders LogQL query editor, virtualized log grid, causal Bayesian analysis, and zk-SNARK retrievability badge', async () => {
    render(<AdvancedLogView canViewLogs={true} canManageLogs={true} />);

    await waitFor(() => {
      expect(screen.getByText('Multi-Region LogQL & Causal AI Explorer')).toBeInTheDocument();
    });

    expect(screen.getByText('PII SCRUBBED & VECTOR INDEXED')).toBeInTheDocument();

    // Check log row details
    await waitFor(() => {
      expect(screen.getByText(/db-proxy pool connection timeout/i)).toBeInTheDocument();
    });

    // Inspect JSON click
    const inspectBtn = screen.getByRole('button', { name: /Inspect JSON/i });
    fireEvent.click(inspectBtn);

    await waitFor(() => {
      expect(screen.getByText('Log Entry Raw JSON Inspector')).toBeInTheDocument();
    });

    // Close modal
    const closeBtn = screen.getByRole('button', { name: '×' });
    fireEvent.click(closeBtn);

    // Switch to Causal Bayesian Root-Cause AI tab
    const causalTab = screen.getByRole('button', { name: /Causal Bayesian Root-Cause AI/i });
    fireEvent.click(causalTab);

    await waitFor(() => {
      expect(screen.getByText('Causal Bayesian Root-Cause Analysis')).toBeInTheDocument();
      expect(screen.getByText(/Primary Root Cause Origin: db-proxy-pool/i)).toBeInTheDocument();
    });

    // Switch to Multi-Region Partition Clusters tab
    const clusterTab = screen.getByRole('button', { name: /Multi-Region Partition Clusters/i });
    fireEvent.click(clusterTab);

    await waitFor(() => {
      expect(screen.getByText(/us-east/i)).toBeInTheDocument();
      expect(screen.getByText(/4\.2 GB\/s/i)).toBeInTheDocument();
    });

    // Switch to zk-SNARK Retrievability Proofs tab
    const zkpTab = screen.getByRole('button', { name: /zk-SNARK Retrievability Proofs/i });
    fireEvent.click(zkpTab);

    await waitFor(() => {
      expect(screen.getByText('zk-SNARK Provable Data Possession & Integrity Ledger')).toBeInTheDocument();
      expect(screen.getByText('ZK-RETRIEVABILITY VERIFIED')).toBeInTheDocument();
    });
  });
});
