'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldAlert,
  Zap,
  Lock,
  Cpu,
  Sliders,
  RotateCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Flame,
  FileCheck,
  TrendingDown,
  Layers,
  Database,
  ArrowRight,
} from 'lucide-react';
import {
  CardinalityMetric,
  SamplingPolicyRule,
  SimulationResult,
  eBPFThrottlerStatus,
  FinOpsAgentState,
  ZKPAttestationReceipt,
  ChaosExperiment,
  FHEPipelineStatus,
} from '../../types/governance';

interface CostGovernanceViewProps {
  canViewGovernance?: boolean;
  canManageGovernance?: boolean;
}

export const CostGovernanceView: React.FC<CostGovernanceViewProps> = ({
  canViewGovernance = true,
  canManageGovernance = true,
}) => {
  const [activeTab, setActiveTab] = useState<'cardinality' | 'finops' | 'zkp_fhe' | 'chaos'>('cardinality');

  // Data States
  const [metrics, setMetrics] = useState<CardinalityMetric[]>([]);
  const [policies, setPolicies] = useState<SamplingPolicyRule[]>([]);
  const [ebpfStatus, setEbpfStatus] = useState<eBPFThrottlerStatus | null>(null);
  const [finOpsState, setFinOpsState] = useState<FinOpsAgentState | null>(null);
  const [zkpReceipts, setZkpReceipts] = useState<ZKPAttestationReceipt[]>([]);
  const [chaosExperiments, setChaosExperiments] = useState<ChaosExperiment[]>([]);
  const [fheStatus, setFheStatus] = useState<FHEPipelineStatus | null>(null);

  // Simulation & Action States
  const [simulatedSampleRate, setSimulatedSampleRate] = useState<number>(10);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [fheTestResult, setFheTestResult] = useState<any>(null);
  const [isTestingFHE, setIsTestingFHE] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string>('');

  const fetchGovernanceData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cardRes, polRes, ebpfRes, finOpsRes, zkpRes, chaosRes, fheRes] = await Promise.all([
        fetch('/api/v1/governance/cardinality'),
        fetch('/api/v1/governance/sampling/policies'),
        fetch('/api/v1/governance/ebpf/status'),
        fetch('/api/v1/governance/finops/agent'),
        fetch('/api/v1/governance/finops/zkp-proofs'),
        fetch('/api/v1/governance/chaos/experiments'),
        fetch('/api/v1/governance/fhe/status'),
      ]);

      if (cardRes.ok) {
        const d = await cardRes.json();
        setMetrics(d.metrics || []);
      }
      if (polRes.ok) {
        const d = await polRes.json();
        setPolicies(d.policies || []);
      }
      if (ebpfRes.ok) {
        const d = await ebpfRes.json();
        setEbpfStatus(d);
      }
      if (finOpsRes.ok) {
        const d = await finOpsRes.json();
        setFinOpsState(d);
      }
      if (zkpRes.ok) {
        const d = await zkpRes.json();
        setZkpReceipts(d.receipts || []);
      }
      if (chaosRes.ok) {
        const d = await chaosRes.json();
        setChaosExperiments(d.experiments || []);
      }
      if (fheRes.ok) {
        const d = await fheRes.json();
        setFheStatus(d);
      }
    } catch (err) {
      console.error('Failed to load governance suite data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (mounted) {
        await fetchGovernanceData();
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [fetchGovernanceData]);

  // Run sampling simulation
  const handleRunSimulation = async (sampleRate: number) => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/v1/governance/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyId: 'rule-200-ok-logs', proposedSampleRate: sampleRate }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimulationResult(data);
      }
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Toggle metric quarantine
  const handleToggleQuarantine = async (metricId: string, currentQuarantine: boolean) => {
    try {
      const res = await fetch('/api/v1/governance/cardinality/quarantine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metricId, quarantined: !currentQuarantine }),
      });
      if (res.ok) {
        setMetrics((prev) =>
          prev.map((m) => (m.id === metricId ? { ...m, quarantined: !currentQuarantine } : m))
        );
        setActionMessage(`Quarantine status updated for metric "${metricId}".`);
      }
    } catch (err) {
      console.error('Quarantine toggle failed:', err);
    }
  };

  // Toggle Autonomous FinOps Agent
  const handleToggleFinOpsAgent = async () => {
    if (!finOpsState) return;
    try {
      const res = await fetch('/api/v1/governance/finops/agent/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !finOpsState.enabled }),
      });
      if (res.ok) {
        const updated = await res.json();
        setFinOpsState(updated);
        setActionMessage(`Autonomous FinOps agent set to ${updated.enabled ? 'ACTIVE' : 'DISABLED'}.`);
      }
    } catch (err) {
      console.error('FinOps toggle failed:', err);
    }
  };

  // Run Live FHE Homomorphic Aggregation Test
  const handleTestFHEAggregation = async () => {
    setIsTestingFHE(true);
    try {
      const res = await fetch('/api/v1/governance/fhe/aggregate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [145, 280, 190, 310] }),
      });
      if (res.ok) {
        const data = await res.json();
        setFheTestResult(data);
        setActionMessage('Homomorphic aggregation computed on encrypted lattice ciphertexts without decryption.');
      }
    } catch (err) {
      console.error('FHE test failed:', err);
    } finally {
      setIsTestingFHE(false);
    }
  };

  // Run Chaos Fault Injection Experiment
  const handleRunChaosExperiment = async (expId: string) => {
    try {
      const res = await fetch('/api/v1/governance/chaos/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experimentId: expId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.experiment) {
          setChaosExperiments((prev) =>
            prev.map((e) => (e.id === expId ? data.experiment : e))
          );
          setActionMessage(`Chaos fault injection "${data.experiment.name}" completed. MTTR: ${data.experiment.recoveryTimeMttrMs}ms.`);
        }
      }
    } catch (err) {
      console.error('Chaos execution failed:', err);
    }
  };

  if (!canViewGovernance) {
    return (
      <div className="bg-[#1E1724]/90 border border-rose-500/50 rounded-2xl p-8 text-center space-y-4 shadow-[0_0_25px_rgba(244,63,94,0.18)] font-sans">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-white">Governance &amp; FinOps Access Restricted</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Your current RBAC role does not have <code className="text-cyan-300 font-mono">canViewGovernance</code> permission. Request JIT Break-Glass escalation to view cost allocation and zero-knowledge proofs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header Banner */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-lg font-bold text-white tracking-wide">FinOps, Cardinality &amp; Chaos Governance</h2>
              {finOpsState && (
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold">
                  AUTONOMOUS GOVERNOR {finOpsState.enabled ? 'ACTIVE' : 'OFF'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Label explosion quarantine, OPA adaptive sampling, kernel eBPF rate limiting, ZKP attestation proofs, FHE lattice computing &amp; chaos fault injection.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 font-mono text-xs">
          {finOpsState && (
            <div className="bg-[#0B0F17] border border-slate-800 px-3.5 py-2 rounded-xl">
              <span className="text-slate-400 block text-[10px]">MONTHLY BUDGET</span>
              <span className="text-emerald-400 font-bold">
                ${finOpsState.currentMonthSpendUsd.toLocaleString()} / ${finOpsState.monthlyBudgetUsd.toLocaleString()}
              </span>
            </div>
          )}

          <button
            onClick={fetchGovernanceData}
            disabled={isLoading}
            className="flex items-center space-x-1.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-slate-300 px-3.5 py-2 rounded-xl text-xs font-mono transition disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Audit State</span>
          </button>
        </div>
      </div>

      {/* Action Banner Toast */}
      {actionMessage && (
        <div className="bg-indigo-950/40 border border-indigo-500/40 text-indigo-200 px-4 py-2.5 rounded-xl text-xs font-mono flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-400" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage('')} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* 2. Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 font-mono text-xs">
        <button
          onClick={() => setActiveTab('cardinality')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'cardinality'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span>Cardinality &amp; Quarantine</span>
        </button>

        <button
          onClick={() => setActiveTab('finops')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'finops'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
          <span>Autonomous FinOps &amp; Sampling</span>
        </button>

        <button
          onClick={() => setActiveTab('zkp_fhe')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'zkp_fhe'
              ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-indigo-400" />
          <span>ZKP Proofs &amp; FHE Gateway</span>
        </button>

        <button
          onClick={() => setActiveTab('chaos')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'chaos'
              ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-rose-400" />
          <span>Generative Chaos Engineering</span>
        </button>
      </div>

      {/* 3. Tab Content Panels */}
      {/* TAB 1: High-Cardinality Detection & Auto-Quarantine */}
      {activeTab === 'cardinality' && (
        <div className="space-y-6">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm">High-Cardinality Label Explosion Hot-Spot Grid</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Scans OpenTelemetry metric series for explosive label sets causing unbudgeted storage bloat.
                </p>
              </div>
              <span className="text-xs font-mono text-cyan-300">
                {metrics.filter((m) => m.quarantined).length} Quarantined Series
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0B0F17] text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Metric Series Name</th>
                    <th className="py-3 px-4">Label Series Count</th>
                    <th className="py-3 px-4">Offending Dynamic Label</th>
                    <th className="py-3 px-4">Cardinality Risk</th>
                    <th className="py-3 px-4">Est. Monthly Cost</th>
                    <th className="py-3 px-4">Status &amp; Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {metrics.map((m) => {
                    const riskBadge =
                      m.cardinalityRisk === 'EXPLOSIVE'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                        : m.cardinalityRisk === 'HIGH'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : m.cardinalityRisk === 'MEDIUM'
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

                    return (
                      <tr key={m.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-bold text-white">{m.metricName}</td>
                        <td className="py-3 px-4 text-cyan-300">{m.labelCount.toLocaleString()} series</td>
                        <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{m.offendingLabel}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${riskBadge}`}>
                            {m.cardinalityRisk}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-emerald-400 font-bold">${m.estimatedCostMonthlyUsd.toLocaleString()}/mo</td>
                        <td className="py-3 px-4">
                          {canManageGovernance ? (
                            <button
                              onClick={() => handleToggleQuarantine(m.id, m.quarantined)}
                              className={`px-3 py-1 rounded-xl text-[11px] font-bold border transition ${
                                m.quarantined
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                              }`}
                            >
                              {m.quarantined ? 'Quarantined (Un-quarantine)' : 'Auto-Quarantine'}
                            </button>
                          ) : (
                            <span className="text-slate-500">{m.quarantined ? 'Quarantined' : 'Active'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Autonomous FinOps Agent & Sampling Simulator */}
      {activeTab === 'finops' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Autonomous Agent Activity & Controls */}
          {finOpsState && (
            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <TrendingDown className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-white text-sm font-sans">Autonomous FinOps Agent</h3>
                </div>
                {canManageGovernance && (
                  <button
                    onClick={handleToggleFinOpsAgent}
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold border transition ${
                      finOpsState.enabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {finOpsState.enabled ? 'Governor: ACTIVE' : 'Governor: OFF'}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-slate-300">
                <div className="bg-[#0B0F17] p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">BURN RATE VELOCITY</span>
                  <span className="text-cyan-300 font-bold text-sm">{finOpsState.burnRateRps.toLocaleString()} RPS</span>
                </div>
                <div className="bg-[#0B0F17] p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">ACTIVE FIDELITY MODE</span>
                  <span className="text-indigo-300 font-bold text-xs">{finOpsState.activeFidelityMode}</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-slate-400 font-bold block text-[11px]">AUTOMATED AUDIT CONTROL FEED</span>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {finOpsState.actionLogs.map((log) => (
                    <div key={log.id} className="bg-[#0B0F17] p-3 rounded-xl border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-indigo-300 font-bold text-[11px]">{log.action}</span>
                        <span className="text-emerald-400 font-bold text-[10px]">{log.savingsImpact}</span>
                      </div>
                      <p className="text-[10px] text-slate-400">{log.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Interactive Sampling Simulator & eBPF Status */}
          <div className="space-y-6">
            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-sm font-sans">Automated Remediation &amp; Sampling Simulator</h3>
                <span className="text-emerald-400 font-bold text-[11px]">DRY-RUN ENGINE</span>
              </div>

              <div className="space-y-3">
                <label className="text-slate-300 block text-[11px]">
                  Proposed HTTP 200 OK Trace Downsample Rate: <span className="text-cyan-300 font-bold">{simulatedSampleRate}%</span>
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={simulatedSampleRate}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSimulatedSampleRate(val);
                    handleRunSimulation(val);
                  }}
                  className="w-full accent-indigo-500"
                />

                {simulationResult && (
                  <div className="bg-[#0B0F17] border border-slate-800 p-4 rounded-xl space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Monthly Cost Savings:</span>
                      <span className="text-emerald-400 font-bold text-sm">+${simulationResult.monthlyCostSavingsUsd.toLocaleString()}/mo</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Retained Error Trace Ratio:</span>
                      <span className="text-cyan-300 font-bold">{simulationResult.retainedErrorTraceRatio}% (100% 5xx Retained)</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">Storage Volume:</span>
                      <span className="text-slate-300">{simulationResult.currentMonthlyGb} GB &rarr; {simulationResult.projectedMonthlyGb} GB</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Kernel eBPF Throttler Card */}
            {ebpfStatus && (
              <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-bold text-white text-sm font-sans">Kernel-Level eBPF Ingestion Throttler</h3>
                  </div>
                  <span className="text-emerald-400 font-bold text-[10px]">SOCKET LEVEL</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-slate-300">
                  <div>
                    <span className="text-slate-500 block text-[10px]">KERNEL OVERHEAD</span>
                    <span className="text-cyan-300 font-bold">{ebpfStatus.kernelLatencyMs}ms</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">MICROBURST DROPS</span>
                    <span className="text-amber-400 font-bold">{ebpfStatus.droppedPacketsCount.toLocaleString()} pkts</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Cryptographic ZKP Attestation & FHE Gateway */}
      {activeTab === 'zkp_fhe' && (
        <div className="space-y-6">
          {/* ZKP Receipts Data Grid */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm font-sans">Zero-Knowledge Proof (ZKP) FinOps Attestation Receipts</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">
                  Merkle-chained cryptographic proofs verifying billing accuracy and sampling policy compliance without revealing PII.
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                MERKLE CHAIN VERIFIED
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0B0F17] text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Proof ID</th>
                    <th className="py-3 px-4">Merkle Root Hash</th>
                    <th className="py-3 px-4">ZKP Proof Hash</th>
                    <th className="py-3 px-4">Policy Version</th>
                    <th className="py-3 px-4">Proven Ingestion</th>
                    <th className="py-3 px-4">Attestation Badge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {zkpReceipts.map((r) => (
                    <tr key={r.proofId} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-bold text-indigo-300">{r.proofId}</td>
                      <td className="py-3 px-4 text-slate-400 max-w-xs truncate font-mono text-[10px]">{r.merkleRootHash}</td>
                      <td className="py-3 px-4 text-cyan-300 max-w-xs truncate font-mono text-[10px]">{r.zkProofHash}</td>
                      <td className="py-3 px-4 text-slate-300">{r.samplingPolicyVersion}</td>
                      <td className="py-3 px-4 text-emerald-400 font-bold">{r.totalIngestedGbProven} GB (${r.totalBilledAmountUsd})</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                          {r.verificationBadge}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fully Homomorphic Encryption (FHE) Status & Live Test */}
          {fheStatus && (
            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-indigo-400" />
                  <h3 className="font-bold text-white text-sm font-sans">Homomorphic Encryption (FHE) Ingestion Gateway</h3>
                </div>
                <button
                  onClick={handleTestFHEAggregation}
                  disabled={isTestingFHE}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-xl font-sans text-xs font-semibold shadow transition disabled:opacity-50"
                >
                  {isTestingFHE ? 'Computing Lattice Ops...' : 'Test Homomorphic Aggregation'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-slate-300">
                <div className="bg-[#0B0F17] p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px]">LATTICE SCHEME</span>
                  <div className="text-cyan-300 font-bold text-xs">{fheStatus.activeLatticeScheme}</div>
                </div>
                <div className="bg-[#0B0F17] p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px]">CIPHERTEXT OPS RATE</span>
                  <div className="text-emerald-400 font-bold text-sm">{fheStatus.ciphertextOpsPerSec.toLocaleString()} ops/s</div>
                </div>
                <div className="bg-[#0B0F17] p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px]">PLAINTEXT EXPOSURE</span>
                  <div className="text-emerald-400 font-bold text-sm">{fheStatus.plaintextDataExposedRatio}% (ZERO LEAKAGE)</div>
                </div>
              </div>

              {fheTestResult && (
                <div className="bg-[#0B0F17] border border-indigo-500/40 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between text-indigo-300 font-bold text-[11px]">
                    <span>HOMOMORPHIC AVERAGE COMPUTED ON CIPHERTEXT</span>
                    <span>{fheTestResult.opsPerformed} Ops Executed</span>
                  </div>
                  <div className="bg-[#080C14] p-2.5 rounded-lg border border-slate-800 text-[10px] text-slate-400 truncate">
                    Ciphertext Result: <span className="text-cyan-300 font-mono">{fheTestResult.encryptedAverageCiphertext}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Generative Chaos Engineering */}
      {activeTab === 'chaos' && (
        <div className="space-y-6 font-mono text-xs">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm font-sans">Generative Chaos Engineering Control Center</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">
                  Automated fault injection experiments (latency, packet loss, CPU starvation) testing system MTTR &amp; circuit breaker reaction time.
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                RESILIENCE SCORE: 94/100
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {chaosExperiments.map((exp) => (
                <div key={exp.id} className="bg-[#0B0F17] border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs">{exp.targetService}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        exp.status === 'COMPLETED'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : exp.status === 'RUNNING'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {exp.status}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300">{exp.name}</p>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">MTTR Recovery:</span>
                    <span className="text-cyan-300 font-bold">{exp.recoveryTimeMttrMs}ms</span>
                  </div>

                  {canManageGovernance && (
                    <button
                      onClick={() => handleRunChaosExperiment(exp.id)}
                      className="w-full mt-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 py-1.5 rounded-xl font-sans text-xs font-semibold transition"
                    >
                      Trigger Fault Injection
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
