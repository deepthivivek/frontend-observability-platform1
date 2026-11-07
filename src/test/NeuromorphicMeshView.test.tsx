import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NeuromorphicMeshView from '../components/mesh/NeuromorphicMeshView';

const mockSummary = {
  day: 21,
  title: 'Neuromorphic SNN, Slime-Mould & Biophotonic Entanglement Sync',
  membraneState: {
    globalVoltage: -65.4,
    averageFiringRateHz: 52.1,
    cascadingFailureProbability: 0.12,
    activeSpikeTrains: 8,
    status: 'STABLE',
  },
  meshTopology: {
    clusterId: 'neon-chasm-global-mesh-alpha',
    nodes: [
      { id: 'node-us-east-1', region: 'us-east', ip: '10.142.0.12', status: 'HEALTHY', latencyMs: 12.4, activeSidecar: false, packetLossRate: 0.0 },
      { id: 'node-sa-east-1', region: 'sa-east', ip: '10.190.3.22', status: 'PARTITIONED', latencyMs: 310.8, activeSidecar: true, packetLossRate: 14.5 },
    ],
    activePartitions: 1,
    activeSidecars: 1,
    routingEfficiency: 91.2,
  },
  slimeMouldSummary: {
    averageConductivity: 0.88,
    totalThroughput: 135.2,
    strain: 'Physarum_polycephalum_Strain_NEON_v4',
  },
  biophotonicStatus: {
    activePairs: 2,
    averageFidelity: 0.9985,
    zeroLatencySyncActive: true,
    bellStatePairs: [
      { pairId: 'bell-us-east-eu', nodeA: 'us-east-1', nodeB: 'eu-central-1', fidelity: 0.9982, phaseAngleDeg: 0.02, entangled: true, lastSyncHash: 'e3b0c44298fc1c14' },
    ],
  },
};

const mockSpikes = {
  spikes: [
    { id: 'sp-1', timestamp: Date.now(), neuronId: 'neuron-ebpf-1', membranePotential: -42.5, threshold: -50, fired: true, spikeFrequencyHz: 140, layer: 'input' },
    { id: 'sp-2', timestamp: Date.now(), neuronId: 'neuron-ebpf-2', membranePotential: -62.0, threshold: -50, fired: false, spikeFrequencyHz: 22, layer: 'hidden' },
  ],
};

const mockTunnels = {
  tunnels: [
    { id: 'tunnel-us-eu', sourceRegion: 'us-east', targetRegion: 'eu-central', conductivity: 0.94, nutrientConcentration: 98.2, fluxRateMbps: 45000, status: 'REINFORCED' },
  ],
};

describe('Neuromorphic Mesh Studio UI (Day 21 Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/v1/neuromorphic-mesh/summary')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSummary) });
      }
      if (url.includes('/api/v1/neuromorphic/spikes')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSpikes) });
      }
      if (url.includes('/api/v1/neuromorphic/simulate-burst')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ simulatedSpikes: 32, riskDelta: 0.25, membraneState: { ...mockSummary.membraneState, globalVoltage: -52.0, status: 'ELEVATED_ACTIVITY' } }),
        });
      }
      if (url.includes('/api/v1/mesh-ring/topology')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSummary.meshTopology) });
      }
      if (url.includes('/api/v1/mesh-ring/heal')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...mockSummary.meshTopology, activePartitions: 0, routingEfficiency: 99.8 }),
        });
      }
      if (url.includes('/api/v1/slime-mould/tunnels')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockTunnels) });
      }
      if (url.includes('/api/v1/slime-mould/conductivity')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSummary.slimeMouldSummary) });
      }
      if (url.includes('/api/v1/biophotonic/entanglement-status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSummary.biophotonicStatus) });
      }
      if (url.includes('/api/v1/biophotonic/verify-bell-state')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ verified: true, bellFidelity: 0.9985, message: 'Bell state |Φ+⟩ verified.' }),
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;
  });

  it('renders Neuromorphic Mesh Studio, membrane metrics, mesh topology, bio-tunnels, and quantum entanglement', async () => {
    render(<NeuromorphicMeshView />);

    // 1. Header & main stats
    await waitFor(() => {
      expect(screen.getByText('Neuromorphic Mesh Studio')).toBeInTheDocument();
      expect(screen.getByText('DAY 21 CAPSTONE')).toBeInTheDocument();
    });

    // 2. Membrane potential section
    expect(screen.getByText('Membrane Potential')).toBeInTheDocument();
    expect(screen.getByText('Cascading Failure Risk')).toBeInTheDocument();

    // 3. Tab switching & interaction test
    const meshTab = screen.getByRole('button', { name: /Autonomous Mesh Ring/i });
    fireEvent.click(meshTab);

    await waitFor(() => {
      expect(screen.getByText('Autonomous Mesh Ring Topology')).toBeInTheDocument();
      expect(screen.getByText('node-us-east-1')).toBeInTheDocument();
    });

    const healBtn = screen.getByRole('button', { name: /Heal Mesh Cluster/i });
    fireEvent.click(healBtn);

    await waitFor(() => {
      expect(screen.getByText('Mesh cluster fully healed and eBPF tunnels restored.')).toBeInTheDocument();
    });

    // 4. Slime Mould tab
    const slimeTab = screen.getByRole('button', { name: /Slime-Mould Bio-Routing/i });
    fireEvent.click(slimeTab);

    await waitFor(() => {
      expect(screen.getByText(/Physarum polycephalum Bio-Routing Optimizer/i)).toBeInTheDocument();
    });

    // 5. Biophotonic tab
    const bioTab = screen.getByRole('button', { name: /Biophotonic Entanglement Sync/i });
    fireEvent.click(bioTab);

    await waitFor(() => {
      expect(screen.getByText('Biophotonic Quantum Entanglement Sync')).toBeInTheDocument();
    });
  });
});
