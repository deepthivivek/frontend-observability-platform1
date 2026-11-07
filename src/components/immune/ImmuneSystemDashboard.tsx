'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Lock,
  Zap,
  Activity,
  Terminal,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Radio,
  FileCode2,
  Globe,
  BarChart3,
  Sparkles,
} from 'lucide-react';

export interface MutationRule {
  id: string;
  generation: number;
  pattern: string;
  mutationType: 'THRESHOLD_SHIFT' | 'REGEX_EXPANSION' | 'ENTROPY_BOUND' | 'SOCKET_SHIELD';
  fitnessScore: number;
  mutationDescription: string;
  status: 'active' | 'evaluating' | 'quarantined' | 'promoted';
  createdAt: number;
}

export interface EnterpriseInvariant {
  id: string;
  name: string;
  logicExpression: string;
  severity: 'CRITICAL_SAFETY' | 'NON_BLOCKING_PERF' | 'COMPLIANCE_GDPR';
  status: 'PROVEN_SATISFIED' | 'VIOLATION_DETECTED' | 'PENDING_VERIFICATION';
  description: string;
}

export interface QuarantinedSocketStream {
  streamId: string;
  sourceIp: string;
  targetService: string;
  bytesDroppedPerSec: number;
  anomalyConfidence: number;
  ebpfRingBufferFd: number;
  quarantinedAt: number;
  status: 'ISOLATED' | 'RELEASED' | 'MITIGATED';
}

export interface LatticeCipherNode {
  nodeId: string;
  region: string;
  kemAlgorithm: 'ML-KEM-768' | 'ML-KEM-1024';
  dsaAlgorithm: 'ML-DSA-65' | 'ML-DSA-87';
  status: string;
  entropyBits: number;
  lastEncapsulatedAt: number;
}

export interface AnnealingState {
  jobId: string;
  regionsOptimized: string[];
  initialEnergy: number;
  finalEnergy: number;
  iterations: number;
  temperature: number;
  routingEfficiencyGainPct: number;
  status: string;
  timestamp: number;
}

interface ImmuneSystemDashboardProps {
  canManageInfra?: boolean;
  canViewLogs?: boolean;
}

export const ImmuneSystemDashboard: React.FC<ImmuneSystemDashboardProps> = ({
  canManageInfra = true,
  canViewLogs = true,
}) => {
  const [activeTab, setActiveTab] = useState<'heuristic' | 'cellular' | 'lattice' | 'annealing'>('heuristic');
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const [generations, setGenerations] = useState<MutationRule[]>([]);
  const [invariants, setInvariants] = useState<EnterpriseInvariant[]>([]);
  const [quarantinedStreams, setQuarantinedStreams] = useState<QuarantinedSocketStream[]>([]);
  const [latticeNodes, setLatticeNodes] = useState<LatticeCipherNode[]>([]);
  const [annealingState, setAnnealingState] = useState<AnnealingState | null>(null);

  const fetchImmuneData = useCallback(async () => {
    setLoading(true);
    try {
      const [genRes, invRes, cellRes, latRes, annRes] = await Promise.all([
        fetch('/api/v1/immune/generations').then((r) => r.json()).catch(() => ({ generations: [] })),
        fetch('/api/v1/immune/invariants').then((r) => r.json()).catch(() => ({ invariants: [] })),
        fetch('/api/v1/immune/cellular-status').then((r) => r.json()).catch(() => ({ streams: [] })),
        fetch('/api/v1/lattice/status').then((r) => r.json()).catch(() => ({ nodes: [] })),
        fetch('/api/v1/mesh/anneal-status').then((r) => r.json()).catch(() => null),
      ]);

      if (genRes.generations) setGenerations(genRes.generations);
      if (invRes.invariants) setInvariants(invRes.invariants);
      if (cellRes.streams) setQuarantinedStreams(cellRes.streams);
      if (latRes.nodes) setLatticeNodes(latRes.nodes);
      if (annRes) setAnnealingState(annRes);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const [genRes, invRes, cellRes, latRes, annRes] = await Promise.all([
          fetch('/api/v1/immune/generations').then((r) => r.json()).catch(() => ({ generations: [] })),
          fetch('/api/v1/immune/invariants').then((r) => r.json()).catch(() => ({ invariants: [] })),
          fetch('/api/v1/immune/cellular-status').then((r) => r.json()).catch(() => ({ streams: [] })),
          fetch('/api/v1/lattice/status').then((r) => r.json()).catch(() => ({ nodes: [] })),
          fetch('/api/v1/mesh/anneal-status').then((r) => r.json()).catch(() => null),
        ]);

        if (!ignore) {
          if (genRes.generations) setGenerations(genRes.generations);
          if (invRes.invariants) setInvariants(invRes.invariants);
          if (cellRes.streams) setQuarantinedStreams(cellRes.streams);
          if (latRes.nodes) setLatticeNodes(latRes.nodes);
          if (annRes) setAnnealingState(annRes);
        }
      } catch {
        // Fallback
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  const handleEvolveMutation = async () => {
    if (!canManageInfra) return;
    try {
      const res = await fetch('/api/v1/immune/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mutationType: 'REGEX_EXPANSION', actor: 'IMMUNE_OPERATOR' }),
      });
      const data = await res.json();
      if (data.success && data.rule) {
        setGenerations((prev) => [data.rule, ...prev]);
        setAnnouncement(`New heuristic mutation evolved: Gen #${data.rule.generation} (Fitness: ${data.rule.fitnessScore})`);
        fetchImmuneData();
      }
    } catch {
      setAnnouncement('Heuristic evolution failed.');
    }
  };

  const handleIsolateSocket = async () => {
    if (!canManageInfra) return;
    try {
      const res = await fetch('/api/v1/immune/socket-isolate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceIp: '198.51.100.99', targetService: 'auth-service', anomalyConfidence: 0.99, actor: 'CELLULAR_AGENT' }),
      });
      const data = await res.json();
      if (data.success && data.stream) {
        setQuarantinedStreams((prev) => [data.stream, ...prev]);
        setAnnouncement(`Cellular socket quarantined for IP ${data.stream.sourceIp} at eBPF ring buffer FD ${data.stream.ebpfRingBufferFd}`);
        fetchImmuneData();
      }
    } catch {
      setAnnouncement('Socket isolation failed.');
    }
  };

  const handleOptimizeAnnealing = async () => {
    if (!canManageInfra) return;
    try {
      const res = await fetch('/api/v1/mesh/optimize-routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor: 'QUANTUM_OPERATOR' }),
      });
      const data = await res.json();
      if (data.success && data.state) {
        setAnnealingState(data.state);
        setAnnouncement(`Quantum annealing optimized routes: Final Energy ${data.state.finalEnergy} (${data.state.routingEfficiencyGainPct}% efficiency gain)`);
      }
    } catch {
      setAnnouncement('Quantum annealing optimization failed.');
    }
  };

  const activeQuarantinesCount = quarantinedStreams.filter((s) => s.status === 'ISOLATED').length;
  const promotedRulesCount = generations.filter((g) => g.status === 'promoted').length;

  return (
    <div className="space-y-6">
      {/* Live Accessibility Announcement */}
      {announcement && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center justify-between shadow-[0_0_15px_rgba(16,185,129,0.15)]"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{announcement}</span>
          </div>
          <button
            onClick={() => setAnnouncement(null)}
            className="text-mutedText hover:text-customText text-[10px] px-2 py-0.5 rounded bg-surface border border-subtleBorder"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-surface border border-subtleBorder shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-customText">
                Immune Command Center &amp; Quantum Annealer
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                Day 20 Supercharged
              </span>
            </div>
            <p className="text-xs text-mutedText max-w-2xl">
              Autonomous heuristic eBPF mutation engines, neural-symbolic SMT invariant verifiers, cellular socket-level quarantines, NIST FIPS 203/204 post-quantum lattice meshes, and quantum-annealing global traffic optimizers.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchImmuneData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-elevated hover:bg-canvas border border-subtleBorder text-xs text-mutedText hover:text-customText transition-all font-mono"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Sync Immune State</span>
            </button>
            <div className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <span>Immune Defense: ACTIVE</span>
            </div>
          </div>
        </div>

        {/* 4 Metric Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-elevated/70 border border-subtleBorder">
            <div className="text-[11px] font-mono text-mutedText flex items-center justify-between">
              <span>Promoted Heuristics</span>
              <Cpu className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-customText mt-1 metric-number">
              {promotedRulesCount} / {generations.length}
            </div>
            <div className="text-[10px] text-mutedText mt-1">
              <span className="text-emerald-400 font-semibold">Genetic</span> eBPF evolution
            </div>
          </div>

          <div className="p-4 rounded-xl bg-elevated/70 border border-subtleBorder">
            <div className="text-[11px] font-mono text-mutedText flex items-center justify-between">
              <span>Cellular Isolations</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-customText mt-1 metric-number">
              {activeQuarantinesCount} Active
            </div>
            <div className="text-[10px] text-mutedText mt-1">
              <span className="text-rose-400 font-semibold">Socket</span> ring buffer drop
            </div>
          </div>

          <div className="p-4 rounded-xl bg-elevated/70 border border-subtleBorder">
            <div className="text-[11px] font-mono text-mutedText flex items-center justify-between">
              <span>Post-Quantum Lattice</span>
              <Lock className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-customText mt-1 metric-number">
              ML-KEM-768
            </div>
            <div className="text-[10px] text-mutedText mt-1">
              <span className="text-indigo-400 font-semibold">FIPS 203/204</span> enforced
            </div>
          </div>

          <div className="p-4 rounded-xl bg-elevated/70 border border-subtleBorder">
            <div className="text-[11px] font-mono text-mutedText flex items-center justify-between">
              <span>Quantum Routing Energy</span>
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-customText mt-1 metric-number">
              {annealingState ? annealingState.finalEnergy : '11.2'}
            </div>
            <div className="text-[10px] text-mutedText mt-1">
              <span className="text-amber-400 font-semibold">+{annealingState ? annealingState.routingEfficiencyGainPct : 34.8}%</span> efficiency
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-subtleBorder pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('heuristic')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
            activeTab === 'heuristic'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
              : 'text-mutedText hover:text-customText hover:bg-elevated'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>Heuristic Mutation &amp; Invariants ({generations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cellular')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
            activeTab === 'cellular'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
              : 'text-mutedText hover:text-customText hover:bg-elevated'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Cellular Socket Quarantine ({quarantinedStreams.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('lattice')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
            activeTab === 'lattice'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
              : 'text-mutedText hover:text-customText hover:bg-elevated'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Post-Quantum Lattice &amp; ZKP Proofs ({latticeNodes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('annealing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-medium transition-all ${
            activeTab === 'annealing'
              ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
              : 'text-mutedText hover:text-customText hover:bg-elevated'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Quantum Annealing Optimizer</span>
        </button>
      </div>

      {/* RBAC Warning */}
      {!canManageInfra && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-3 font-mono">
          <Lock className="w-4 h-4 shrink-0" />
          <span>Read-Only Mode: Your role lacks <code className="text-amber-300">canManageInfra</code> permission. Immune evolution and socket isolation are view-only.</span>
        </div>
      )}

      {/* TAB 1: Heuristic Mutation & Neural-Symbolic Matrix */}
      {activeTab === 'heuristic' && (
        <div className="space-y-6">
          {canManageInfra && (
            <div className="p-4 rounded-xl bg-surface border border-subtleBorder flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-mono text-mutedText">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Trigger Genetic Evolution on Zero-Day Telemetry Stream:</span>
              </div>
              <button
                onClick={handleEvolveMutation}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-mono transition-all"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Evolve New Mutation Generation</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Generations List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-mutedText uppercase font-mono">
                eBPF Genetic Mutation Lineage
              </h3>
              <div className="space-y-3">
                {generations.map((g) => (
                  <div key={g.id} className="p-4 rounded-xl bg-surface border border-subtleBorder space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                          Gen #{g.generation}
                        </span>
                        <span className="text-sm font-bold font-mono text-customText">{g.mutationType}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                          g.status === 'promoted'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        }`}
                      >
                        {g.status}
                      </span>
                    </div>
                    <p className="text-xs text-mutedTrust">{g.mutationDescription}</p>
                    <div className="p-2.5 rounded-lg bg-[#0c0d11] border border-subtleBorder font-mono text-[11px] text-cyan-400 truncate">
                      {g.pattern}
                    </div>
                    <div className="flex justify-between text-[11px] font-mono text-mutedText pt-1">
                      <span>Fitness Score: <strong className="text-emerald-400">{g.fitnessScore}/100</strong></span>
                      <span>{new Date(g.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Neural-Symbolic Invariants */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-mutedText uppercase font-mono">
                Neural-Symbolic SMT Safety Invariants
              </h3>
              <div className="space-y-3">
                {invariants.map((inv) => (
                  <div key={inv.id} className="p-4 rounded-xl bg-surface border border-subtleBorder space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-customText">{inv.name}</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        {inv.status}
                      </span>
                    </div>
                    <p className="text-xs text-mutedText">{inv.description}</p>
                    <div className="p-2.5 rounded-lg bg-[#0c0d11] border border-subtleBorder font-mono text-[11px] text-purple-400">
                      {inv.logicExpression}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Cellular Socket Quarantine */}
      {activeTab === 'cellular' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-customText font-mono">
              Cellular Ring Buffer Socket Isolations
            </h3>
            {canManageInfra && (
              <button
                onClick={handleIsolateSocket}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-mono transition-all"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Simulate Socket Threat Isolation</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {quarantinedStreams.map((stream) => (
              <div key={stream.streamId} className="p-5 rounded-xl bg-surface border border-rose-500/40 space-y-3 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-sm font-bold font-mono text-customText">Source IP: {stream.sourceIp}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300">
                      {stream.status}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-mutedText">
                    Ring Buffer FD: <code className="text-cyan-400">{stream.ebpfRingBufferFd}</code>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-elevated border border-subtleBorder">
                    <span className="text-mutedText block text-[10px]">Target Service</span>
                    <span className="text-cyan-400 font-bold">{stream.targetService}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-elevated border border-subtleBorder">
                    <span className="text-mutedText block text-[10px]">Dropped Traffic</span>
                    <span className="text-rose-400 font-bold metric-number">
                      {(stream.bytesDroppedPerSec / 1024 / 1024).toFixed(2)} MB/s
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-elevated border border-subtleBorder">
                    <span className="text-mutedText block text-[10px]">Confidence</span>
                    <span className="text-emerald-400 font-bold metric-number">
                      {(stream.anomalyConfidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Post-Quantum Lattice & ZKP Proofs */}
      {activeTab === 'lattice' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-surface border border-subtleBorder space-y-4">
            <h3 className="text-sm font-bold text-customText font-mono">
              NIST FIPS 203 (ML-KEM) &amp; FIPS 204 (ML-DSA) Mesh Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latticeNodes.map((node) => (
                <div key={node.nodeId} className="p-4 rounded-xl bg-elevated border border-subtleBorder space-y-2 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="font-bold text-customText">{node.nodeId} ({node.region})</span>
                    <span className="text-emerald-400">{node.status}</span>
                  </div>
                  <div>KEM: <strong className="text-indigo-400">{node.kemAlgorithm}</strong></div>
                  <div>DSA: <strong className="text-cyan-400">{node.dsaAlgorithm}</strong></div>
                  <div>Entropy: <strong className="text-customText">{node.entropyBits} bits</strong></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Quantum Annealing Optimizer */}
      {activeTab === 'annealing' && annealingState && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-surface border border-subtleBorder space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-customText font-mono">
                  Quantum Annealing Global Routing ({annealingState.jobId})
                </h3>
                <p className="text-xs text-mutedText">
                  Simulated quantum annealing minimizes latency energy across multi-region edge mesh.
                </p>
              </div>

              {canManageInfra && (
                <button
                  onClick={handleOptimizeAnnealing}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-mono font-semibold transition-all"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Execute Quantum Annealing Run</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg bg-elevated border border-subtleBorder">
                <span className="text-mutedText block text-[10px]">Initial Energy</span>
                <span className="text-mutedText font-bold text-base metric-number">{annealingState.initialEnergy}</span>
              </div>
              <div className="p-3 rounded-lg bg-elevated border border-subtleBorder">
                <span className="text-mutedText block text-[10px]">Final Optimized Energy</span>
                <span className="text-emerald-400 font-bold text-base metric-number">{annealingState.finalEnergy}</span>
              </div>
              <div className="p-3 rounded-lg bg-elevated border border-subtleBorder">
                <span className="text-mutedText block text-[10px]">Efficiency Gain</span>
                <span className="text-amber-400 font-bold text-base metric-number">+{annealingState.routingEfficiencyGainPct}%</span>
              </div>
              <div className="p-3 rounded-lg bg-elevated border border-subtleBorder">
                <span className="text-mutedText block text-[10px]">Iterations</span>
                <span className="text-customText font-bold text-base metric-number">{annealingState.iterations.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImmuneSystemDashboard;
