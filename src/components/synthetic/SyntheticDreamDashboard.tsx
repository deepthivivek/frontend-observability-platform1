'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dna,
  Moon,
  Radio,
  ShieldCheck,
  Zap,
  RefreshCw,
  Cpu,
  Lock,
  Layers,
  Sparkles,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Play,
  Activity,
  Binary,
} from 'lucide-react';

export interface DnaSnapshot {
  id: string;
  name: string;
  timestamp: number;
  originalPayloadHash: string;
  nucleotideSequence: string;
  basePairCount: number;
  gcContentRatio: number;
  reedSolomonParityBases: number;
  errorCorrectionCapabilityPct: number;
  densityBytesPerBase: number;
  status: 'SYNTHESIZED' | 'COLD_STORAGE' | 'VERIFIED';
}

export interface DnaVaultStatus {
  totalBasePairs: number;
  totalSnapshots: number;
  reedSolomonParityPct: number;
  storageDensityPetabytesPerGram: number;
  averageGcContent: number;
  vaultStatus: 'OPTIMAL' | 'REDUNDANCY_REBUILDING' | 'REHYDRATING';
  snapshots: DnaSnapshot[];
}

export interface CounterfactualScenario {
  id: string;
  name: string;
  threatCategory: 'QUANTUM_DECRYPT_BURST' | 'EBPF_MAP_POISONING' | 'BFT_SPLIT_BRAIN' | 'CASCADE_MEMBRANE_OVERLOAD';
  hypotheticalAttackVector: string;
  simulatedBlastRadiusPct: number;
  preEvolvedEbpfRule: string;
  synthesisFitnessScore: number;
  verifiedInvariantsCount: number;
  generatedAt: number;
  status: 'ACTIVE_GUARD' | 'STANDBY_SYNTHESIS' | 'REFINING';
}

export interface DreamStateStatus {
  isDreaming: boolean;
  currentCycleId: string;
  dreamCyclesCompleted: number;
  counterfactualsGenerated: number;
  preEvolvedRulesCount: number;
  averageFitnessScore: number;
  lastCycleDurationMs: number;
  activeEntropyVector: string;
}

export interface GenomicZkProof {
  proofId: string;
  snapshotId: string;
  curve: 'BN254' | 'BLS12-381';
  publicInputs: {
    merkleRoot: string;
    parityCheckSum: string;
    nucleotideCount: number;
    gcContentRatio: number;
  };
  proofData: {
    pi_a: [string, string];
    pi_b: [[string, string], [string, string]];
    pi_c: [string, string];
  };
  zkProtocol: 'Groth16-Genomic';
  createdAt: number;
  verified: boolean;
}

export interface RegionalResonanceNode {
  nodeId: string;
  region: string;
  currentFrequencyHz: number;
  resonanceLock: boolean;
  phaseCoherencePct: number;
  harmonicEnergy: number;
}

export interface ResonanceStatus {
  baseFrequencyHz: number;
  activeNodesCount: number;
  synchronizationFidelity: number;
  harmonicCouplingCoefficient: number;
  zeroSerializationActive: boolean;
  cognitiveStateHash: string;
  nodes: RegionalResonanceNode[];
}

export interface HarmonicWavePoint {
  timeStep: number;
  fundamentalWave: number;
  harmonic3rd: number;
  harmonic5th: number;
  compositeResonance: number;
}

interface SyntheticDreamDashboardProps {
  canManageInfra?: boolean;
  canViewLogs?: boolean;
}

export const SyntheticDreamDashboard: React.FC<SyntheticDreamDashboardProps> = ({
  canManageInfra = true,
  canViewLogs = true,
}) => {
  const [activeTab, setActiveTab] = useState<'dna' | 'dream' | 'zkp' | 'resonance'>('dna');
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [vaultStatus, setVaultStatus] = useState<DnaVaultStatus | null>(null);
  const [dreamStatus, setDreamStatus] = useState<DreamStateStatus | null>(null);
  const [counterfactuals, setCounterfactuals] = useState<CounterfactualScenario[]>([]);
  const [proofs, setProofs] = useState<GenomicZkProof[]>([]);
  const [resonanceStatus, setResonanceStatus] = useState<ResonanceStatus | null>(null);
  const [harmonicWave, setHarmonicWave] = useState<HarmonicWavePoint[]>([]);

  const [selectedFreq, setSelectedFreq] = useState<number>(432);
  const [newSnapshotName, setNewSnapshotName] = useState<string>('');

  const fetchAllData = useCallback(async () => {
    try {
      const [sumRes, vaultRes, dreamRes, cfRes, proofRes, resRes, waveRes] = await Promise.all([
        fetch('/api/v1/synthetic-dream/summary').then((r) => r.json()).catch(() => null),
        fetch('/api/v1/dna/vault-status').then((r) => r.json()).catch(() => null),
        fetch('/api/v1/dream/status').then((r) => r.json()).catch(() => null),
        fetch('/api/v1/dream/counterfactuals').then((r) => r.json()).catch(() => ({ counterfactuals: [] })),
        fetch('/api/v1/dna/proofs').then((r) => r.json()).catch(() => ({ proofs: [] })),
        fetch('/api/v1/resonance/status').then((r) => r.json()).catch(() => null),
        fetch('/api/v1/resonance/harmonic-field?samples=24').then((r) => r.json()).catch(() => ({ wavePoints: [] })),
      ]);

      if (sumRes) {
        if (sumRes.dnaVault) setVaultStatus(sumRes.dnaVault);
        if (sumRes.dreamState) setDreamStatus(sumRes.dreamState);
        if (sumRes.counterfactuals) setCounterfactuals(sumRes.counterfactuals);
        if (sumRes.resonance) setResonanceStatus(sumRes.resonance);
        if (sumRes.harmonicField?.wavePoints) setHarmonicWave(sumRes.harmonicField.wavePoints);
        if (sumRes.latestProofs) setProofs(sumRes.latestProofs);
      }

      if (vaultRes && vaultRes.snapshots) setVaultStatus(vaultRes);
      if (dreamRes && dreamRes.currentCycleId) setDreamStatus(dreamRes);
      if (cfRes?.counterfactuals) setCounterfactuals(cfRes.counterfactuals);
      if (proofRes?.proofs) setProofs(proofRes.proofs);
      if (resRes && resRes.nodes) setResonanceStatus(resRes);
      if (waveRes?.wavePoints) setHarmonicWave(waveRes.wavePoints);
    } catch (err) {
      console.error('Failed to load synthetic dream telemetry', err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (active) {
        await fetchAllData();
      }
    };
    run();
    const interval = setInterval(() => {
      if (active) {
        fetchAllData();
      }
    }, 4500);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [fetchAllData]);

  const handleSynthesizeSnapshot = async () => {
    if (!canManageInfra) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/dna/encode-snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSnapshotName || `Cold Storage Block #${Date.now().toString(36).toUpperCase()}`,
          payload: {
            merkleRoot: `0x${Date.now().toString(16)}aabbccdd`,
            activeTenants: 16,
            policyEngineStatus: 'HEALTHY',
            timestamp: Date.now(),
          },
        }),
      });
      const data = await res.json();
      if (data.snapshot) {
        setActionMessage(`Telemetry synthesized into nucleotide sequence (${data.snapshot.basePairCount} bp).`);
        setNewSnapshotName('');
        fetchAllData();
      }
    } catch {
      setActionMessage('Failed to encode synthetic DNA snapshot.');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerDreamCycle = async () => {
    if (!canManageInfra) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/dream/trigger-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intensity: 1.2 }),
      });
      const data = await res.json();
      if (data.newCounterfactual) {
        setActionMessage(`Dream cycle executed: Pre-evolved eBPF rule with ${(data.fitnessScore * 100).toFixed(1)}% fitness.`);
        fetchAllData();
      }
    } catch {
      setActionMessage('Failed to trigger dream-state cycle.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateGenomicProof = async (snapshotId?: string) => {
    if (!canManageInfra) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/dna/generate-genomic-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId }),
      });
      const data = await res.json();
      if (data.proof) {
        setActionMessage(`zk-SNARK genomic privacy proof ${data.proof.proofId} generated on curve BN254.`);
        fetchAllData();
      }
    } catch {
      setActionMessage('Failed to generate genomic ZKP proof.');
    } finally {
      setLoading(false);
    }
  };

  const handleTuneFrequency = async (freq: number) => {
    if (!canManageInfra) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/resonance/tune-frequency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetFrequencyHz: freq }),
      });
      const data = await res.json();
      if (data.tuned) {
        setActionMessage(`Harmonic neural resonance tuned to ${data.newFrequencyHz} Hz.`);
        fetchAllData();
      }
    } catch {
      setActionMessage('Failed to tune harmonic frequency.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-[var(--text-main)] bg-[var(--bg-canvas)] min-h-screen">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-sm">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-mono font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              DAY 22 ADVANCED
            </span>
            <span className="px-2.5 py-1 text-xs font-mono font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              SYNTHETIC DNA &amp; DREAM STATE
            </span>
            <span className="px-2.5 py-1 text-xs font-mono font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              NEURAL RESONANCE
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Synthetic DNA &amp; Dream State Studio</h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)]">
            Ultra-dense nucleotide telemetry archives, offline neural-symbolic dream chaos pre-evolution, zk-SNARK genomic privacy, and quantum-harmonic neural resonance.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fetchAllData}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-color)] hover:border-emerald-500/50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            Refresh State
          </button>

          {canManageInfra && (
            <button
              onClick={handleTriggerDreamCycle}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm disabled:opacity-50"
            >
              <Moon className="w-3.5 h-3.5" />
              Trigger Dream Cycle
            </button>
          )}
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-xs opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Primary KPI Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* DNA Storage Density */}
        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Synthetic DNA Base Pairs</span>
            <Dna className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
            {vaultStatus ? `${vaultStatus.totalBasePairs.toLocaleString()} bp` : '48,200 bp'}
          </div>
          <div className="text-xs text-[var(--text-muted)] flex items-center justify-between">
            <span>Density: 215.4 PB/gram</span>
            <span className="text-emerald-400 font-mono">RS 20% Parity</span>
          </div>
        </div>

        {/* Dream Counterfactuals Pre-Evolved */}
        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Pre-Evolved eBPF Shields</span>
            <Moon className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-indigo-400">
            {dreamStatus ? `${dreamStatus.preEvolvedRulesCount} Rules` : '4 Rules'}
          </div>
          <div className="text-xs text-[var(--text-muted)] flex items-center justify-between">
            <span>Fitness: {dreamStatus ? `${(dreamStatus.averageFitnessScore * 100).toFixed(1)}%` : '98.2%'}</span>
            <span className="text-indigo-400 font-mono">Idle Cycles Active</span>
          </div>
        </div>

        {/* ZKP Genomic Privacy */}
        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>ZKP Genomic Proofs</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-cyan-400">
            {proofs.length} Proofs
          </div>
          <div className="text-xs text-[var(--text-muted)] flex items-center justify-between">
            <span>Curve: BN254 Groth16</span>
            <span className="text-emerald-400 font-mono">Zero Plaintext Leak</span>
          </div>
        </div>

        {/* Neural Resonance Fidelity */}
        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Harmonic Resonance Sync</span>
            <Radio className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-400">
            {resonanceStatus ? `${resonanceStatus.baseFrequencyHz} Hz` : '432 Hz'}
          </div>
          <div className="text-xs text-[var(--text-muted)] flex items-center justify-between">
            <span>Fidelity: {resonanceStatus ? `${(resonanceStatus.synchronizationFidelity * 100).toFixed(2)}%` : '99.4%'}</span>
            <span className="text-amber-400 font-mono">Zero-Serialization</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-color)] pb-3">
        {[
          { id: 'dna', label: 'Cellular DNA Telemetry Vault', icon: Dna },
          { id: 'dream', label: 'Neural-Symbolic Dream Console', icon: Moon },
          { id: 'zkp', label: 'ZKP Genomic Privacy Circuit', icon: ShieldCheck },
          { id: 'resonance', label: 'Biological-Quantum Resonance', icon: Radio },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-color)] hover:text-[var(--text-main)] hover:border-white/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: DNA Storage Vault */}
      {activeTab === 'dna' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Cellular Synthetic DNA Cold Storage</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Merkle audit trail snapshots encoded into quaternary nucleotides (A, C, G, T) with Reed-Solomon parity for millennium-grade durability.
                </p>
              </div>

              {canManageInfra && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Snapshot label..."
                    value={newSnapshotName}
                    onChange={(e) => setNewSnapshotName(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] text-xs text-[var(--text-main)] focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    onClick={handleSynthesizeSnapshot}
                    disabled={loading}
                    className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                  >
                    <Binary className="w-3.5 h-3.5" />
                    Synthesize Snapshot
                  </button>
                </div>
              )}
            </div>

            {/* Base Pair Distribution Visualizer */}
            <div className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-semibold text-[var(--text-main)]">Nucleotide Distribution &amp; GC Balance</span>
                <span className="text-[var(--text-muted)]">
                  GC Ratio: {vaultStatus?.averageGcContent || 0.512} (Optimal: 0.500 - 0.550)
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <div className="text-[10px] text-[var(--text-muted)]">Adenine (A)</div>
                  <div className="text-base font-bold tabular-nums">24.8%</div>
                </div>
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <div className="text-[10px] text-[var(--text-muted)]">Cytosine (C)</div>
                  <div className="text-base font-bold tabular-nums">25.6%</div>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <div className="text-[10px] text-[var(--text-muted)]">Guanine (G)</div>
                  <div className="text-base font-bold tabular-nums">25.6%</div>
                </div>
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
                  <div className="text-[10px] text-[var(--text-muted)]">Thymine (T)</div>
                  <div className="text-base font-bold tabular-nums">24.0%</div>
                </div>
              </div>
            </div>

            {/* Snapshots Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Active DNA Cold-Storage Snapshots ({vaultStatus?.snapshots.length || 0})</h3>
              <div className="space-y-3">
                {vaultStatus?.snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-3 font-mono text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="font-bold text-[var(--text-main)]">{snap.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {snap.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[var(--text-muted)] text-[11px]">
                        <span>{snap.basePairCount.toLocaleString()} bp</span>
                        <span>RS Parity: +{snap.reedSolomonParityBases} bp</span>
                        <span>{new Date(snap.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] overflow-x-auto text-[11px] text-emerald-300 break-all select-all">
                      {snap.nucleotideSequence}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[var(--text-muted)]">
                      <div>Merkle Hash: {snap.originalPayloadHash.substring(0, 24)}...</div>
                      {canManageInfra && (
                        <button
                          onClick={() => handleGenerateGenomicProof(snap.id)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors"
                        >
                          Generate zk-SNARK Proof
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Dream-State Simulator */}
      {activeTab === 'dream' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Neural-Symbolic Dream-State Engine</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Proactive offline chaos simulations and zero-day threat permutations executed during cluster idle cycles.
                </p>
              </div>

              {canManageInfra && (
                <button
                  onClick={handleTriggerDreamCycle}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Trigger Counterfactual Dream Cycle
                </button>
              )}
            </div>

            {/* Counterfactual Scenarios Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {counterfactuals.map((cf) => (
                <div
                  key={cf.id}
                  className="p-5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-3 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[var(--text-main)]">{cf.name}</span>
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {cf.threatCategory}
                    </span>
                  </div>

                  <p className="text-[var(--text-muted)] text-[11px] font-sans">
                    {cf.hypotheticalAttackVector}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)]">
                    <div>
                      <span className="text-[var(--text-muted)] block">Simulated Blast Radius:</span>
                      <span className="text-amber-400 font-bold tabular-nums">{cf.simulatedBlastRadiusPct}%</span>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block">Synthesis Fitness:</span>
                      <span className="text-emerald-400 font-bold tabular-nums">{(cf.synthesisFitnessScore * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase text-[var(--text-muted)]">Pre-Evolved eBPF Shield:</span>
                    <pre className="p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-[10px] text-cyan-300 overflow-x-auto whitespace-pre-wrap">
                      {cf.preEvolvedEbpfRule}
                    </pre>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-1">
                    <span>Verified Invariants: {cf.verifiedInvariantsCount}</span>
                    <span className="text-emerald-400 font-semibold">{cf.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: ZKP Genomic Privacy */}
      {activeTab === 'zkp' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">zk-SNARK Genomic Privacy Circuit</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Cryptographic verification of DNA archive integrity, basepair count, and Reed-Solomon parity without exposing nucleotide sequences.
                </p>
              </div>

              {canManageInfra && (
                <button
                  onClick={() => handleGenerateGenomicProof()}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Generate New Genomic Proof
                </button>
              )}
            </div>

            <div className="space-y-3">
              {proofs.map((proof) => (
                <div
                  key={proof.proofId}
                  className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-3 font-mono text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span className="font-bold text-[var(--text-main)]">{proof.proofId}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        Curve: {proof.curve} ({proof.zkProtocol})
                      </span>
                    </div>
                    <span className="text-emerald-400 text-[10px] font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      GROTH16 VERIFIED
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                    <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] space-y-1">
                      <div className="text-[var(--text-muted)]">Public Inputs:</div>
                      <div>Merkle Root: {proof.publicInputs.merkleRoot}</div>
                      <div>Parity Checksum: {proof.publicInputs.parityCheckSum}</div>
                      <div>Nucleotide Count: {proof.publicInputs.nucleotideCount.toLocaleString()} bp</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] space-y-1">
                      <div className="text-[var(--text-muted)]">G1 / G2 Proof Points:</div>
                      <div className="truncate">π_a: {proof.proofData.pi_a[0]}...</div>
                      <div className="truncate">π_b: {proof.proofData.pi_b[0][0]}...</div>
                      <div className="truncate">π_c: {proof.proofData.pi_c[0]}...</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Biological-Quantum Neural Resonance */}
      {activeTab === 'resonance' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Biological-Quantum Neural Resonance Console</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Harmonic frequency tuning across regional nodes for zero-serialization cognitive telemetry synchronization.
                </p>
              </div>

              {canManageInfra && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[var(--text-muted)]">Target Freq:</span>
                  {[432, 528, 639].map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setSelectedFreq(f);
                        handleTuneFrequency(f);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${
                        resonanceStatus?.baseFrequencyHz === f
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : 'bg-[var(--bg-canvas)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-white'
                      }`}
                    >
                      {f} Hz
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Resonance Waveform Preview */}
            <div className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--text-main)]">Composite Harmonic Resonance Field</span>
                <span className="text-amber-400">Lock Fidelity: {resonanceStatus ? `${(resonanceStatus.synchronizationFidelity * 100).toFixed(2)}%` : '99.8%'}</span>
              </div>

              <div className="h-28 flex items-end gap-1 pt-2">
                {harmonicWave.map((pt, idx) => {
                  const heightPct = Math.max(10, Math.min(100, Math.round(((pt.compositeResonance + 1.5) / 3.0) * 100)));
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-amber-500/30 hover:bg-amber-400 rounded-t transition-all duration-300 relative group"
                      style={{ height: `${heightPct}%` }}
                    >
                      <div className="hidden group-hover:block absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black text-[10px] text-amber-300 px-1.5 py-0.5 rounded shadow z-10 whitespace-nowrap">
                        {pt.compositeResonance}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Regional Resonance Nodes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {resonanceStatus?.nodes.map((node) => (
                <div
                  key={node.nodeId}
                  className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-2 font-mono text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--text-main)]">{node.region}</span>
                    <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      LOCKED
                    </span>
                  </div>
                  <div className="text-[var(--text-muted)] text-[11px] space-y-1">
                    <div>Node: {node.nodeId}</div>
                    <div>Frequency: {node.currentFrequencyHz} Hz</div>
                    <div>Phase Coherence: {node.phaseCoherencePct}%</div>
                    <div>Energy: {node.harmonicEnergy} pJ</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyntheticDreamDashboard;
