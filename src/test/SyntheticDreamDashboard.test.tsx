import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SyntheticDreamDashboard } from '../components/synthetic/SyntheticDreamDashboard';

const mockVaultStatus = {
  totalBasePairs: 64200,
  totalSnapshots: 2,
  reedSolomonParityPct: 20.0,
  storageDensityPetabytesPerGram: 215.4,
  averageGcContent: 0.512,
  vaultStatus: 'OPTIMAL',
  snapshots: [
    {
      id: 'dna-snap-01',
      name: 'Merkle Audit Log & PQC Master Snapshot',
      timestamp: Date.now() - 3600000,
      originalPayloadHash: '0x112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00',
      nucleotideSequence: 'ACGTACGTACGTACGTACGTACGTACGTACGTACGTACGT...',
      basePairCount: 32100,
      gcContentRatio: 0.512,
      reedSolomonParityBases: 6420,
      errorCorrectionCapabilityPct: 99.999,
      densityBytesPerBase: 0.25,
      status: 'COLD_STORAGE',
    },
  ],
};

const mockDreamStatus = {
  isDreaming: true,
  currentCycleId: 'cycle-42-test',
  dreamCyclesCompleted: 42,
  counterfactualsGenerated: 4,
  preEvolvedRulesCount: 4,
  averageFitnessScore: 0.982,
  lastCycleDurationMs: 420,
  activeEntropyVector: 'a1b2c3d4e5f6',
};

const mockCounterfactuals = [
  {
    id: 'cf-dream-01',
    name: 'Asymmetric Post-Quantum Lattice Key Desync',
    threatCategory: 'QUANTUM_DECRYPT_BURST',
    hypotheticalAttackVector: 'Concurrent Kyber-1024 decapsulation storm injected into ingress mesh',
    simulatedBlastRadiusPct: 18.4,
    preEvolvedEbpfRule: 'SEC("tc/ingress") int filter_lattice_storm(struct __sk_buff *skb) { return BPF_REDIRECT_CELLULAR_QUARANTINE; }',
    synthesisFitnessScore: 0.982,
    verifiedInvariantsCount: 8,
    generatedAt: Date.now() - 3600000,
    status: 'ACTIVE_GUARD',
  },
];

const mockProofs = [
  {
    proofId: 'zkp-dna-01',
    snapshotId: 'dna-snap-01',
    curve: 'BN254',
    publicInputs: {
      merkleRoot: '0x1122334455667788',
      parityCheckSum: '0xaabbccdd',
      nucleotideCount: 32100,
      gcContentRatio: 0.512,
    },
    proofData: {
      pi_a: ['0x1111', '0x2222'],
      pi_b: [
        ['0x3333', '0x4444'],
        ['0x5555', '0x6666'],
      ],
      pi_c: ['0x7777', '0x8888'],
    },
    zkProtocol: 'Groth16-Genomic',
    createdAt: Date.now(),
    verified: true,
  },
];

const mockResonanceStatus = {
  baseFrequencyHz: 432.0,
  activeNodesCount: 4,
  synchronizationFidelity: 0.9984,
  harmonicCouplingCoefficient: 0.9942,
  zeroSerializationActive: true,
  cognitiveStateHash: '0x9988776655443322',
  nodes: [
    { nodeId: 'res-us-east-01', region: 'US-East', currentFrequencyHz: 432.0, resonanceLock: true, phaseCoherencePct: 99.8, harmonicEnergy: 142.5 },
    { nodeId: 'res-eu-central-01', region: 'EU-Central', currentFrequencyHz: 432.0, resonanceLock: true, phaseCoherencePct: 99.4, harmonicEnergy: 140.1 },
  ],
};

const mockHarmonicField = {
  baseFrequencyHz: 432.0,
  nyquistThresholdKhz: 96.0,
  wavePoints: [
    { timeStep: 0, fundamentalWave: 0.0, harmonic3rd: 0.0, harmonic5th: 0.0, compositeResonance: 0.0 },
    { timeStep: 1, fundamentalWave: 0.5, harmonic3rd: 0.2, harmonic5th: 0.1, compositeResonance: 0.8 },
  ],
};

describe('Synthetic DNA & Dream State Studio UI (Day 22 Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/v1/synthetic-dream/summary')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              day: 22,
              title: 'Synthetic DNA, Dream State & Neural Resonance Studio',
              dnaVault: mockVaultStatus,
              dreamState: mockDreamStatus,
              counterfactuals: mockCounterfactuals,
              resonance: mockResonanceStatus,
              harmonicField: mockHarmonicField,
              latestProofs: mockProofs,
              timestamp: Date.now(),
            }),
        });
      }
      if (url.includes('/api/v1/dna/vault-status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockVaultStatus) });
      }
      if (url.includes('/api/v1/dna/encode-snapshot')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              snapshot: { ...mockVaultStatus.snapshots[0], id: 'dna-snap-new', name: 'New Snapshot' },
            }),
        });
      }
      if (url.includes('/api/v1/dream/status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDreamStatus) });
      }
      if (url.includes('/api/v1/dream/counterfactuals')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ counterfactuals: mockCounterfactuals }) });
      }
      if (url.includes('/api/v1/dream/trigger-cycle')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              cycleId: 'cycle-43',
              newCounterfactual: { ...mockCounterfactuals[0], id: 'cf-dream-02', name: 'Synthesized Permutation' },
              fitnessScore: 0.985,
              synthesizedRule: 'SEC("tc/dream") int shield() { return 1; }',
              durationMs: 380,
            }),
        });
      }
      if (url.includes('/api/v1/dna/proofs')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ proofs: mockProofs }) });
      }
      if (url.includes('/api/v1/dna/generate-genomic-proof')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, proof: mockProofs[0] }),
        });
      }
      if (url.includes('/api/v1/resonance/status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockResonanceStatus) });
      }
      if (url.includes('/api/v1/resonance/tune-frequency')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              tuned: true,
              previousFrequencyHz: 432.0,
              newFrequencyHz: 528.0,
              synchronizationFidelity: 0.999,
              harmonicStatus: { ...mockResonanceStatus, baseFrequencyHz: 528.0 },
            }),
        });
      }
      if (url.includes('/api/v1/resonance/harmonic-field')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockHarmonicField) });
      }

      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;
  });

  it('renders Synthetic DNA Studio, KPIs, nucleotide distribution, and cold storage snapshots', async () => {
    render(<SyntheticDreamDashboard canManageInfra={true} canViewLogs={true} />);

    // 1. Verify Header & Badge elements
    await waitFor(() => {
      expect(screen.getByText('Synthetic DNA & Dream State Studio')).toBeInTheDocument();
      expect(screen.getByText('DAY 22 ADVANCED')).toBeInTheDocument();
      expect(screen.getByText('SYNTHETIC DNA & DREAM STATE')).toBeInTheDocument();
    });

    // 2. Verify KPI Cards
    expect(screen.getByText('Synthetic DNA Base Pairs')).toBeInTheDocument();
    expect(screen.getByText('Pre-Evolved eBPF Shields')).toBeInTheDocument();
    expect(screen.getByText('ZKP Genomic Proofs')).toBeInTheDocument();
    expect(screen.getByText('Harmonic Resonance Sync')).toBeInTheDocument();

    // 3. Verify DNA nucleotide distribution
    await waitFor(() => {
      expect(screen.getByText('Merkle Audit Log & PQC Master Snapshot')).toBeInTheDocument();
      expect(screen.getByText('Adenine (A)')).toBeInTheDocument();
      expect(screen.getByText('Cytosine (C)')).toBeInTheDocument();
    });

    // 4. Test Dream-State Tab
    const dreamTab = screen.getByRole('button', { name: /Neural-Symbolic Dream Console/i });
    fireEvent.click(dreamTab);

    await waitFor(() => {
      expect(screen.getByText('Neural-Symbolic Dream-State Engine')).toBeInTheDocument();
      expect(screen.getByText('Asymmetric Post-Quantum Lattice Key Desync')).toBeInTheDocument();
    });

    // Trigger Dream Cycle
    const dreamBtn = screen.getByRole('button', { name: /Trigger Counterfactual Dream Cycle/i });
    fireEvent.click(dreamBtn);

    await waitFor(() => {
      expect(screen.getByText(/Dream cycle executed:/i)).toBeInTheDocument();
    });

    // 5. Test ZKP Genomic Privacy Tab
    const zkpTab = screen.getByRole('button', { name: /ZKP Genomic Privacy Circuit/i });
    fireEvent.click(zkpTab);

    await waitFor(() => {
      expect(screen.getByText('zk-SNARK Genomic Privacy Circuit')).toBeInTheDocument();
      expect(screen.getByText(/GROTH16 VERIFIED/i)).toBeInTheDocument();
    });

    // 6. Test Neural Resonance Tab
    const resTab = screen.getByRole('button', { name: /Biological-Quantum Resonance/i });
    fireEvent.click(resTab);

    await waitFor(() => {
      expect(screen.getByText('Biological-Quantum Neural Resonance Console')).toBeInTheDocument();
      expect(screen.getByText('US-East')).toBeInTheDocument();
    });

    const tuneBtn = screen.getByRole('button', { name: /528 Hz/i });
    fireEvent.click(tuneBtn);

    await waitFor(() => {
      expect(screen.getByText(/Harmonic neural resonance tuned to 528 Hz/i)).toBeInTheDocument();
    });
  });

  it('enforces RBAC gates and hides mutating controls when canManageInfra is false', async () => {
    render(<SyntheticDreamDashboard canManageInfra={false} canViewLogs={true} />);

    await waitFor(() => {
      expect(screen.getByText('Synthetic DNA & Dream State Studio')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Trigger Dream Cycle/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Synthesize Snapshot/i })).not.toBeInTheDocument();
  });
});
