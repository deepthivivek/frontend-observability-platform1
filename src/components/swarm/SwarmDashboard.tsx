'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Binary,
  CheckCircle2,
  Cpu,
  GitBranch,
  Layers,
  Lock,
  Network,
  Play,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';

export interface SwarmAgent {
  id: string;
  role: 'DiagAgent' | 'SecAgent' | 'FinOpsAgent' | 'KernelAgent';
  region: string;
  status: 'ACTIVE' | 'VOTING' | 'EXECUTING' | 'IDLE';
  reputationScore: number;
  bftWeight: number;
  lastHeartbeat: number;
  actionsExecuted: number;
}

export interface ConsensusProposal {
  proposalId: string;
  targetService: string;
  anomalySignature: string;
  recommendedAction: string;
  votesFor: string[];
  votesAgainst: string[];
  quorumReached: boolean;
  consensusLatencyMs: number;
  merkleDecisionHash: string;
  status: 'APPROVED_EXECUTED' | 'QUORUM_PENDING' | 'REJECTED';
  timestamp: number;
}

export interface SwarmOrchestratorState {
  totalAgents: number;
  bftFaultTolerance: number;
  quorumThreshold: number;
  agents: SwarmAgent[];
  recentProposals: ConsensusProposal[];
}

export interface LatticeGossipPacket {
  packetId: string;
  sourceRegion: string;
  targetRegions: string[];
  kemAlgorithm: 'ML-KEM-1024';
  ciphertextDigest: string;
  gossipRound: number;
  syncLatencyMs: number;
  tamperVerified: boolean;
  timestamp: number;
}

export interface QuantumSyncState {
  protocol: 'ML-KEM-1024-TELEPATHIC-GOSSIP';
  activeRegions: string[];
  globalStateEpoch: number;
  stateRootHash: string;
  averageSyncLatencyMs: number;
  packetsDelivered: number;
  packets: LatticeGossipPacket[];
}

export interface CompiledKernelProgram {
  programId: string;
  hookPoint: 'XDP_INGRESS' | 'TC_EGRESS' | 'SOCK_OPS' | 'PERF_EVENT';
  anomalyTrigger: string;
  ebpfSourceSnippet: string;
  jitBytecodeHash: string;
  bytecodeSizeBytes: number;
  smtVerification: {
    verified: boolean;
    boundsChecked: boolean;
    terminationProven: boolean;
    verifierPasses: number;
  };
  injectedIntoRingBuffer: boolean;
  compiledAt: number;
}

export interface NeuralGenesisState {
  jitCompilerVersion: string;
  totalCompiledPrograms: number;
  activeInKernel: number;
  programs: CompiledKernelProgram[];
}

export interface CausalTimelineNode {
  nodeId: string;
  service: string;
  lookaheadMs: number;
  predictedFaultProbability: number;
  parentNodeId: string | null;
  preventativeAction: string;
  status: 'PREEMPTED' | 'NOMINAL' | 'ROLLED_BACK';
}

export interface RetrocausalRun {
  simulationId: string;
  horizonMs: number;
  anomaliesPreventedCount: number;
  deterministicRollbacksExecuted: number;
  dagNodes: CausalTimelineNode[];
  timestamp: number;
}

export interface RetrocausalState {
  horizonWindowMs: number;
  totalSimulations: number;
  totalAnomaliesPrevented: number;
  totalDeterministicRollbacks: number;
  latestRun: RetrocausalRun;
  runs: RetrocausalRun[];
}

export interface HolographicChannel {
  channelId: string;
  wavelengthNm: number;
  phaseConjugationAngleRad: number;
  interferenceCoherence: number;
  thermalDissipationMilliwatts: number;
  encodedDimensions: number;
  hologramHash: string;
  syncedAt: number;
}

export interface SingularityState {
  singularityLock: boolean;
  zeroThermalDissipation: boolean;
  averageCoherence: number;
  channelsCount: number;
  channels: HolographicChannel[];
}

export interface StdpSynapseEvent {
  synapseId: string;
  preNeuron: string;
  postNeuron: string;
  deltaTimingUs: number;
  weightDelta: number;
  membranePotentialMv: number;
  isolatedFaultNode: string;
  autonomicResetTriggered: boolean;
  timestamp: number;
}

export interface StdpState {
  plasticityModel: string;
  meanIsolationLatencyUs: number;
  activeSynapses: number;
  restingMembraneMv: number;
  events: StdpSynapseEvent[];
}

export interface RecursiveSwarmZkProof {
  receiptId: string;
  proposalId: string;
  recursionDepth: number;
  provingSystem: 'Groth16-Recursive-BN254';
  publicConsensusRoot: string;
  proofCommitment: string;
  constraintsCount: number;
  verificationTimeMs: number;
  verified: boolean;
  timestamp: number;
}

export interface ZkAttestationState {
  provingSystem: 'Groth16-Recursive-BN254';
  totalVerifiedProofs: number;
  receipts: RecursiveSwarmZkProof[];
}

export type ChaosMutationVector =
  | 'MEMORY_PRESSURE'
  | 'LATTICE_DESYNC'
  | 'BFT_SPLIT_BRAIN'
  | 'KERNEL_RING_SATURATION';

export interface InoculationCampaign {
  campaignId: string;
  mutationVector: ChaosMutationVector;
  sandboxNamespace: string;
  immunityScorePct: number;
  recoveryLatencyMs: number;
  antibodySignature: string;
  inoculatedAt: number;
  status: 'VACCINATED' | 'MUTATING_TWIN';
}

export interface ChaosInoculationState {
  meshImmunityIndexPct: number;
  totalCampaigns: number;
  campaigns: InoculationCampaign[];
}

export interface MeshMitigationRecord {
  mitigationId: string;
  triggerSource: string;
  actionType: 'EBPF_RULE_REWRITE' | 'ROGUE_SOCKET_ISOLATION' | 'BIO_TUNNEL_FAILOVER';
  isolatedSocketOrNode: string;
  failoverTunnelId: string;
  mitigationDurationMs: number;
  packetDropPreventedCount: number;
  status: 'MITIGATED' | 'MONITORING';
  timestamp: number;
}

export interface SelfHealingMeshState {
  meshHealthStatus: string;
  totalMitigations: number;
  totalPacketDropsPrevented: number;
  activeBioFailoverTunnel: string;
  mitigations: MeshMitigationRecord[];
}

interface SwarmDashboardProps {
  canManageInfra?: boolean;
  canViewLogs?: boolean;
}

type SwarmTab = 'swarm' | 'kernel' | 'retrocausal' | 'singularity' | 'inoculation';

export const SwarmDashboard: React.FC<SwarmDashboardProps> = ({
  canManageInfra = true,
  canViewLogs = true,
}) => {
  const [activeTab, setActiveTab] = useState<SwarmTab>('swarm');
  const [loading, setLoading] = useState(false);
  const [actionBanner, setActionBanner] = useState<string | null>(null);

  const [orchestrator, setOrchestrator] = useState<SwarmOrchestratorState | null>(null);
  const [quantumSync, setQuantumSync] = useState<QuantumSyncState | null>(null);
  const [neuralGenesis, setNeuralGenesis] = useState<NeuralGenesisState | null>(null);
  const [retrocausal, setRetrocausal] = useState<RetrocausalState | null>(null);
  const [singularity, setSingularity] = useState<SingularityState | null>(null);
  const [stdp, setStdp] = useState<StdpState | null>(null);
  const [zkAttestation, setZkAttestation] = useState<ZkAttestationState | null>(null);
  const [chaosInoculation, setChaosInoculation] = useState<ChaosInoculationState | null>(null);
  const [selfHealingMesh, setSelfHealingMesh] = useState<SelfHealingMeshState | null>(null);

  // Interactive form state
  const [targetService, setTargetService] = useState('ingress-ebpf-gateway');
  const [anomalySignature, setAnomalySignature] = useState('ZERO_DAY_TAIL_LATENCY_BURST');
  const [recommendedAction, setRecommendedAction] = useState('REWRITE_EBPF_RING_FILTER');
  const [hookPoint, setHookPoint] = useState<CompiledKernelProgram['hookPoint']>('XDP_INGRESS');
  const [kernelTrigger, setKernelTrigger] = useState('HTTP2_RAPID_RESET_ANOMALY');
  const [horizonMs, setHorizonMs] = useState<number>(150);
  const [mutationVector, setMutationVector] = useState<ChaosMutationVector>('MEMORY_PRESSURE');
  const [meshActionType, setMeshActionType] =
    useState<MeshMitigationRecord['actionType']>('EBPF_RULE_REWRITE');

  const fetchAllData = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/swarm/summary');
      if (!res.ok) return;
      const data = await res.json();
      if (data.orchestrator) setOrchestrator(data.orchestrator);
      if (data.quantumSync) setQuantumSync(data.quantumSync);
      if (data.neuralGenesis) setNeuralGenesis(data.neuralGenesis);
      if (data.retrocausal) setRetrocausal(data.retrocausal);
      if (data.singularity) setSingularity(data.singularity);
      if (data.stdp) setStdp(data.stdp);
      if (data.zkAttestation) setZkAttestation(data.zkAttestation);
      if (data.chaosInoculation) setChaosInoculation(data.chaosInoculation);
      if (data.selfHealingMesh) setSelfHealingMesh(data.selfHealingMesh);
    } catch (err) {
      console.error('Failed to fetch swarm singularity telemetry', err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (active) {
        await fetchAllData();
      }
    };
    void run();

    const timer = setInterval(() => {
      if (active) {
        void fetchAllData();
      }
    }, 5000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [fetchAllData]);

  const handleProposeConsensus = async () => {
    if (!canManageInfra) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/swarm/orchestrator/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetService,
          anomalySignature,
          recommendedAction,
        }),
      });
      const data = await res.json();
      if (data.proposal) {
        setActionBanner(
          `BFT Consensus ${data.proposal.status}: ${data.proposal.proposalId} (${data.proposal.votesFor.length}/${orchestrator?.totalAgents ?? 4} votes in ${data.proposal.consensusLatencyMs} ms).`
        );
        await fetchAllData();
      }
    } catch {
      setActionBanner('Failed to submit BFT swarm proposal.');
    } finally {
      setLoading(false);
    }
  };

  const handleBroadcastGossip = async () => {
    if (!canManageInfra) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/swarm/quantum-sync/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceRegion: 'us-east-1',
          statePayload: { epoch: (quantumSync?.globalStateEpoch ?? 1084) + 1, sync: 'ml-kem-1024' },
        }),
      });
      const data = await res.json();
      if (data.packet) {
        setActionBanner(
          `ML-KEM-1024 Lattice Gossip Round #${data.packet.gossipRound} synced in ${data.packet.syncLatencyMs} ms.`
        );
        await fetchAllData();
      }
    } catch {
      setActionBanner('Failed to broadcast ML-KEM-1024 gossip packet.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompileKernel = async () => {
    if (!canManageInfra) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/swarm/neural-genesis/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anomalyTrigger: kernelTrigger,
          hookPoint,
        }),
      });
      const data = await res.json();
      if (data.program) {
        setActionBanner(
          `Neural-Genesis JIT compiled ${data.program.programId} (${data.program.bytecodeSizeBytes} B) & injected into ${data.program.hookPoint}.`
        );
        await fetchAllData();
      }
    } catch {
      setActionBanner('Failed to compile Neural-Genesis eBPF kernel program.');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteMeshMitigation = async () => {
    if (!canManageInfra) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/swarm/self-healing-mesh/mitigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerSource: 'Swarm_Console_Command',
          actionType: meshActionType,
        }),
      });
      const data = await res.json();
      if (data.record) {
        setActionBanner(
          `Mesh mitigation ${data.record.mitigationId} (${data.record.actionType}) completed in ${data.record.mitigationDurationMs} ms.`
        );
        await fetchAllData();
      }
    } catch {
      setActionBanner('Failed to execute self-healing mesh mitigation.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateRetrocausal = async () => {
    if (!canManageInfra) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/swarm/retrocausal/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horizonMs }),
      });
      const data = await res.json();
      if (data.run) {
        setActionBanner(
          `Retrocausal DAG ${data.run.simulationId} simulated +${data.run.horizonMs} ms ahead: ${data.run.anomaliesPreventedCount} anomaly preempted.`
        );
        await fetchAllData();
      }
    } catch {
      setActionBanner('Failed to simulate retrocausal lookahead DAG.');
    } finally {
      setLoading(false);
    }
  };

  const handleIsolateStdpFault = async () => {
    if (!canManageInfra) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/swarm/stdp/isolate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faultSource: 'edge-ingress-worker-42' }),
      });
      const data = await res.json();
      if (data.event) {
        setActionBanner(
          `STDP spike-train isolated ${data.event.isolatedFaultNode} in ${data.event.deltaTimingUs} us (membrane reset to ${data.event.membranePotentialMv} mV).`
        );
        await fetchAllData();
      }
    } catch {
      setActionBanner('Failed to trigger STDP fault isolation.');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectHologram = async () => {
    if (!canManageInfra) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/swarm/singularity/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telemetrySample: { epoch: Date.now(), source: 'swarm-ui' } }),
      });
      const data = await res.json();
      if (data.channel) {
        setActionBanner(
          `Holographic channel ${data.channel.channelId} locked at ${data.channel.wavelengthNm} nm (coherence ${data.channel.interferenceCoherence}).`
        );
        await fetchAllData();
      }
    } catch {
      setActionBanner('Failed to project holographic interference channel.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateZkProof = async () => {
    if (!canManageInfra) return;
    setLoading(true);
    try {
      const latestProposalId = orchestrator?.recentProposals[0]?.proposalId || 'prop-bft-901';
      const res = await fetch('/api/v1/swarm/zk-attestation/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: latestProposalId, recursionDepth: 4 }),
      });
      const data = await res.json();
      if (data.receipt) {
        setActionBanner(
          `Recursive Groth16 BN254 receipt ${data.receipt.receiptId} attested in ${data.receipt.verificationTimeMs} ms.`
        );
        await fetchAllData();
      }
    } catch {
      setActionBanner('Failed to generate Groth16 swarm attestation proof.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyZkProof = async (receiptId: string) => {
    if (!canManageInfra) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/swarm/zk-attestation/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptId }),
      });
      const data = await res.json();
      setActionBanner(
        `ZK Pairing verification for ${data.receiptId}: ${data.verified && data.pairingSatisfied ? 'VALID' : 'FAILED'}.`
      );
    } catch {
      setActionBanner('Failed to verify ZK attestation pairing.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunInoculation = async () => {
    if (!canManageInfra) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/swarm/chaos-inoculation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mutationVector }),
      });
      const data = await res.json();
      if (data.campaign) {
        setActionBanner(
          `Chaos Inoculation ${data.campaign.campaignId} (${data.campaign.mutationVector}) vaccinated in ${data.campaign.recoveryLatencyMs} ms (${data.campaign.immunityScorePct}% immunity).`
        );
        await fetchAllData();
      }
    } catch {
      setActionBanner('Failed to run predictive chaos inoculation campaign.');
    } finally {
      setLoading(false);
    }
  };

  if (!canViewLogs) {
    return (
      <div className="rounded-2xl border border-rose-500/40 bg-[var(--bg-surface)] p-8 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-semibold text-[var(--text-main)]">
          Autonomous Swarm Access Restricted
        </h2>
        <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
          Current RBAC policy lacks <code className="font-mono text-indigo-400">canViewLogs</code> permission to inspect swarm consensus, kernel bytecode, or attestation receipts.
        </p>
      </div>
    );
  }

  const tabs: { id: SwarmTab; label: string; icon: React.ReactNode }[] = [
    { id: 'swarm', label: 'BFT Swarm & Quantum Sync', icon: <Network className="h-3.5 w-3.5" /> },
    { id: 'kernel', label: 'Neural-Genesis eBPF & Mesh', icon: <Cpu className="h-3.5 w-3.5" /> },
    { id: 'retrocausal', label: 'Retrocausal DAG & STDP', icon: <GitBranch className="h-3.5 w-3.5" /> },
    { id: 'singularity', label: 'Singularity & ZK Receipts', icon: <Lock className="h-3.5 w-3.5" /> },
    { id: 'inoculation', label: 'Chaos Inoculation', icon: <Zap className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-6 text-[var(--text-main)]">
      {/* Header */}
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-[var(--text-main)]">
                Autonomous AI Swarm &amp; Singularity Command
              </h1>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                BFT + ML-KEM-1024 + GROTH16
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Decentralized SRE consensus voting, Neural-Genesis SMT-verified eBPF JIT compilation, retrocausal DAG preemption, STDP spike isolation, and autonomous self-healing mesh.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-xs font-mono px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] text-[var(--text-muted)] whitespace-nowrap">
            RBAC: {canManageInfra ? 'OPERATOR WRITE' : 'READ-ONLY AUDIT'}
          </span>
          <button
            onClick={() => void fetchAllData()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:border-cyan-500/40 text-xs font-mono text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Swarm</span>
          </button>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionBanner && (
        <div
          role="status"
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 flex items-center justify-between gap-3 text-xs font-mono text-emerald-400"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionBanner}</span>
          </div>
          <button
            onClick={() => setActionBanner(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top KPI Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>BFT Swarm Quorum</span>
            <ShieldCheck className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-semibold tabular-nums text-[var(--text-main)]">
            {orchestrator ? `${orchestrator.quorumThreshold}/${orchestrator.totalAgents}` : '3/4'}{' '}
            <span className="text-xs font-normal text-[var(--text-muted)]">Agents</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-emerald-400 tabular-nums">
            Byzantine Tolerance f={orchestrator?.bftFaultTolerance ?? 1} · Consensus Active
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>ML-KEM-1024 &amp; Singularity</span>
            <Radio className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-semibold tabular-nums text-[var(--text-main)]">
            {quantumSync ? `${quantumSync.averageSyncLatencyMs} ms` : '0.42 ms'}{' '}
            <span className="text-xs font-normal text-[var(--text-muted)]">Gossip</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-cyan-400 tabular-nums">
            Coherence {singularity?.averageCoherence ?? 0.9991} · 0.0 mW Thermal
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Retrocausal &amp; STDP Isolation</span>
            <Activity className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-semibold tabular-nums text-[var(--text-main)]">
            {stdp ? `${stdp.meanIsolationLatencyUs} us` : '0.46 us'}{' '}
            <span className="text-xs font-normal text-[var(--text-muted)]">STDP Lock</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-amber-400 tabular-nums">
            {retrocausal?.totalAnomaliesPrevented ?? 1} Faults Preempted (+{retrocausal?.horizonWindowMs ?? 150} ms)
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Mesh Immunity &amp; ZK Proofs</span>
            <Lock className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-mono font-semibold tabular-nums text-[var(--text-main)]">
            {chaosInoculation ? `${chaosInoculation.meshImmunityIndexPct}%` : '99.15%'}{' '}
            <span className="text-xs font-normal text-[var(--text-muted)]">Immunity</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-emerald-400 tabular-nums">
            {zkAttestation?.totalVerifiedProofs ?? 1} Groth16 BN254 · {selfHealingMesh?.totalPacketDropsPrevented ?? 18420} Pkts Saved
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-mono transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)] border border-transparent'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: BFT Swarm Orchestrator & Quantum Telepathic Sync */}
      {activeTab === 'swarm' && (
        <div className="space-y-6">
          {/* Active Agents Matrix */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
                  <Shield className="h-4 w-4 text-indigo-400" />
                  <span>Decentralized SRE Agent Swarm (BFT Consensus)</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Autonomous DiagAgent, SecAgent, FinOpsAgent, and KernelAgent nodes voting with cryptographic Merkle quorum.
                </p>
              </div>
              <span className="text-xs font-mono text-[var(--text-muted)] tabular-nums">
                Quorum Threshold: {orchestrator?.quorumThreshold ?? 3} of {orchestrator?.totalAgents ?? 4}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {(orchestrator?.agents || []).map((agent) => (
                <div
                  key={agent.id}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3.5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold text-[var(--text-main)]">
                      {agent.role}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      {agent.status}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-[var(--text-muted)] space-y-1 tabular-nums">
                    <div className="flex justify-between">
                      <span>Region</span>
                      <span className="text-[var(--text-main)]">{agent.region}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Reputation</span>
                      <span className="text-cyan-400">{(agent.reputationScore * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Executed</span>
                      <span className="text-[var(--text-main)]">{agent.actionsExecuted} ops</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Propose Consensus Remediation */}
            {canManageInfra && (
              <div className="pt-2 border-t border-[var(--border-color)] grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-[11px] font-mono text-[var(--text-muted)] mb-1">
                    Target Service
                  </label>
                  <input
                    type="text"
                    value={targetService}
                    onChange={(e) => setTargetService(e.target.value)}
                    aria-label="Target Service"
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-[var(--text-muted)] mb-1">
                    Anomaly Signature
                  </label>
                  <input
                    type="text"
                    value={anomalySignature}
                    onChange={(e) => setAnomalySignature(e.target.value)}
                    aria-label="Anomaly Signature"
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-[var(--text-muted)] mb-1">
                    Remediation Action
                  </label>
                  <input
                    type="text"
                    value={recommendedAction}
                    onChange={(e) => setRecommendedAction(e.target.value)}
                    aria-label="Remediation Action"
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)]"
                  />
                </div>
                <button
                  onClick={() => void handleProposeConsensus()}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Propose BFT Consensus</span>
                </button>
              </div>
            )}

            {/* Consensus Voting Ledger */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-[10px] uppercase text-[var(--text-muted)] border-b border-[var(--border-color)]">
                  <tr>
                    <th className="py-2 pr-3">Proposal ID</th>
                    <th className="py-2 pr-3">Target Service</th>
                    <th className="py-2 pr-3">Votes For</th>
                    <th className="py-2 pr-3">Latency</th>
                    <th className="py-2 pr-3">Merkle Decision Hash</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] tabular-nums">
                  {(orchestrator?.recentProposals || []).map((p) => (
                    <tr key={p.proposalId}>
                      <td className="py-2.5 pr-3 text-indigo-400">{p.proposalId}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-main)]">{p.targetService}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-muted)]">{p.votesFor.join(', ')}</td>
                      <td className="py-2.5 pr-3 text-cyan-400">{p.consensusLatencyMs} ms</td>
                      <td className="py-2.5 pr-3 text-[var(--text-muted)]">{p.merkleDecisionHash.slice(0, 16)}...</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quantum-Resistant Swarm Telepathic Sync */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
                  <Radio className="h-4 w-4 text-cyan-400" />
                  <span>Quantum-Resistant Swarm Telepathic Sync (ML-KEM-1024)</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Epoch #{quantumSync?.globalStateEpoch ?? 1084} · State Root:{' '}
                  <span className="font-mono text-cyan-400">
                    {quantumSync?.stateRootHash?.slice(0, 20) || 'lattice-root'}...
                  </span>
                </p>
              </div>
              {canManageInfra && (
                <button
                  onClick={() => void handleBroadcastGossip()}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Broadcast Lattice Gossip</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-[10px] uppercase text-[var(--text-muted)] border-b border-[var(--border-color)]">
                  <tr>
                    <th className="py-2 pr-3">Packet ID</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Targets</th>
                    <th className="py-2 pr-3">Algorithm</th>
                    <th className="py-2 pr-3">Sync Latency</th>
                    <th className="py-2">Integrity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] tabular-nums">
                  {(quantumSync?.packets || []).map((pkt) => (
                    <tr key={pkt.packetId}>
                      <td className="py-2.5 pr-3 text-cyan-400">{pkt.packetId}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-main)]">{pkt.sourceRegion}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-muted)]">{pkt.targetRegions.join(', ')}</td>
                      <td className="py-2.5 pr-3 text-indigo-400">{pkt.kemAlgorithm}</td>
                      <td className="py-2.5 pr-3 text-emerald-400">{pkt.syncLatencyMs} ms</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {pkt.tamperVerified ? 'VERIFIED' : 'INVALID'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Neural-Genesis eBPF Kernel Compilation & Autonomous Self-Healing Mesh */}
      {activeTab === 'kernel' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-indigo-400" />
                  <span>Neural-Genesis eBPF Kernel Self-Compilation</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Compiler: {neuralGenesis?.jitCompilerVersion || 'LLVM-BPF-19.1-NEURAL-GENESIS'} · Active in Ring Buffer:{' '}
                  <span className="font-mono text-emerald-400">{neuralGenesis?.activeInKernel ?? 1}</span>
                </p>
              </div>
            </div>

            {canManageInfra && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end pt-2 border-t border-[var(--border-color)]">
                <div>
                  <label className="block text-[11px] font-mono text-[var(--text-muted)] mb-1">
                    Kernel Hook Point
                  </label>
                  <select
                    value={hookPoint}
                    onChange={(e) => setHookPoint(e.target.value as CompiledKernelProgram['hookPoint'])}
                    aria-label="Kernel Hook Point"
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)]"
                  >
                    <option value="XDP_INGRESS">XDP_INGRESS</option>
                    <option value="TC_EGRESS">TC_EGRESS</option>
                    <option value="SOCK_OPS">SOCK_OPS</option>
                    <option value="PERF_EVENT">PERF_EVENT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-[var(--text-muted)] mb-1">
                    Zero-Day Anomaly Trigger
                  </label>
                  <input
                    type="text"
                    value={kernelTrigger}
                    onChange={(e) => setKernelTrigger(e.target.value)}
                    aria-label="Zero-Day Anomaly Trigger"
                    className="w-full px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)]"
                  />
                </div>
                <button
                  onClick={() => void handleCompileKernel()}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Cpu className="h-3.5 w-3.5" />
                  <span>Synthesize &amp; JIT Compile eBPF</span>
                </button>
              </div>
            )}

            <div className="space-y-3">
              {(neuralGenesis?.programs || []).map((prog) => (
                <div
                  key={prog.programId}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3.5 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-indigo-400">{prog.programId}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        {prog.hookPoint}
                      </span>
                      <span className="text-[var(--text-main)]">{prog.anomalyTrigger}</span>
                    </div>
                    <span className="text-[var(--text-muted)] tabular-nums">
                      {prog.bytecodeSizeBytes} B · SMT Passes: {prog.smtVerification.verifierPasses} · Verified:{' '}
                      {prog.smtVerification.verified ? 'YES' : 'NO'}
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono text-emerald-400 bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-lg p-2.5 overflow-x-auto">
                    {prog.ebpfSourceSnippet}
                  </pre>
                </div>
              ))}
            </div>
          </div>

          {/* Autonomous Self-Healing Mesh */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-400" />
                  <span>Autonomous Self-Healing Mesh</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Active Bio-Failover Tunnel:{' '}
                  <span className="font-mono text-emerald-400">
                    {selfHealingMesh?.activeBioFailoverTunnel || 'tunnel-us-east-west'}
                  </span>{' '}
                  · Packet Drops Prevented:{' '}
                  <span className="font-mono tabular-nums text-[var(--text-main)]">
                    {selfHealingMesh?.totalPacketDropsPrevented?.toLocaleString() ?? '18,420'}
                  </span>
                </p>
              </div>
              {canManageInfra && (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={meshActionType}
                    onChange={(e) =>
                      setMeshActionType(e.target.value as MeshMitigationRecord['actionType'])
                    }
                    aria-label="Mesh Mitigation Action"
                    className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)]"
                  >
                    <option value="EBPF_RULE_REWRITE">EBPF_RULE_REWRITE</option>
                    <option value="ROGUE_SOCKET_ISOLATION">ROGUE_SOCKET_ISOLATION</option>
                    <option value="BIO_TUNNEL_FAILOVER">BIO_TUNNEL_FAILOVER</option>
                  </select>
                  <button
                    onClick={() => void handleExecuteMeshMitigation()}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Execute Mesh Mitigation</span>
                  </button>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-[10px] uppercase text-[var(--text-muted)] border-b border-[var(--border-color)]">
                  <tr>
                    <th className="py-2 pr-3">Mitigation ID</th>
                    <th className="py-2 pr-3">Action</th>
                    <th className="py-2 pr-3">Socket / Node</th>
                    <th className="py-2 pr-3">Failover Tunnel</th>
                    <th className="py-2 pr-3">Duration</th>
                    <th className="py-2">Packets Saved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] tabular-nums">
                  {(selfHealingMesh?.mitigations || []).map((m) => (
                    <tr key={m.mitigationId}>
                      <td className="py-2.5 pr-3 text-emerald-400">{m.mitigationId}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-main)]">{m.actionType}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-muted)]">{m.isolatedSocketOrNode}</td>
                      <td className="py-2.5 pr-3 text-cyan-400">{m.failoverTunnelId}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-main)]">{m.mitigationDurationMs} ms</td>
                      <td className="py-2.5 text-emerald-400">{m.packetDropPreventedCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Chrono-Temporal Retrocausal DAG & Neuromorphic STDP Fault Isolation */}
      {activeTab === 'retrocausal' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-amber-400" />
                  <span>Chrono-Temporal Retrocausal Fault Prevention</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Causal DAG execution timeline simulations with deterministic state rollbacks before anomaly manifestation.
                </p>
              </div>
              {canManageInfra && (
                <div className="flex items-center gap-2">
                  <select
                    value={horizonMs}
                    onChange={(e) => setHorizonMs(Number(e.target.value))}
                    aria-label="Lookahead Horizon"
                    className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)]"
                  >
                    <option value={100}>+100 ms Lookahead</option>
                    <option value={150}>+150 ms Lookahead</option>
                    <option value={250}>+250 ms Lookahead</option>
                  </select>
                  <button
                    onClick={() => void handleSimulateRetrocausal()}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Simulate Lookahead DAG</span>
                  </button>
                </div>
              )}
            </div>

            {retrocausal?.latestRun && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {retrocausal.latestRun.dagNodes.map((node) => (
                  <div
                    key={node.nodeId}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-semibold text-[var(--text-main)]">{node.service}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] border ${
                          node.status === 'ROLLED_BACK'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : node.status === 'PREEMPTED'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                        }`}
                      >
                        {node.status}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)] space-y-1 tabular-nums">
                      <div>Lookahead: +{node.lookaheadMs} ms</div>
                      <div>Fault Prob: {(node.predictedFaultProbability * 100).toFixed(1)}%</div>
                      <div className="text-indigo-400 truncate" title={node.preventativeAction}>
                        {node.preventativeAction}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Neuromorphic STDP Spike-Timing Fault Isolation */}
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
                  <Activity className="h-4 w-4 text-rose-400" />
                  <span>Neuromorphic STDP Spike-Timing Fault Isolation</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Model: {stdp?.plasticityModel || 'STDP-ASYMMETRIC-EXPONENTIAL'} · Resting Membrane:{' '}
                  <span className="font-mono tabular-nums text-rose-400">
                    {stdp?.restingMembraneMv ?? -70.0} mV
                  </span>
                </p>
              </div>
              {canManageInfra && (
                <button
                  onClick={() => void handleIsolateStdpFault()}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>Isolate Fault Spike</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-[10px] uppercase text-[var(--text-muted)] border-b border-[var(--border-color)]">
                  <tr>
                    <th className="py-2 pr-3">Synapse ID</th>
                    <th className="py-2 pr-3">Pre Neuron</th>
                    <th className="py-2 pr-3">Delta Timing</th>
                    <th className="py-2 pr-3">Weight Delta</th>
                    <th className="py-2 pr-3">Isolated Node</th>
                    <th className="py-2">Membrane Reset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] tabular-nums">
                  {(stdp?.events || []).map((ev) => (
                    <tr key={ev.synapseId}>
                      <td className="py-2.5 pr-3 text-rose-400">{ev.synapseId}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-main)]">{ev.preNeuron}</td>
                      <td className="py-2.5 pr-3 text-cyan-400">{ev.deltaTimingUs} us</td>
                      <td className="py-2.5 pr-3 text-[var(--text-muted)]">+{ev.weightDelta}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-main)]">{ev.isolatedFaultNode}</td>
                      <td className="py-2.5 text-emerald-400">{ev.membranePotentialMv} mV</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Biophotonic Holographic Singularity & Recursive ZK Swarm Attestation */}
      {activeTab === 'singularity' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <span>Bio-Photonic Holographic Singularity Sync</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Photonic phase conjugation interference channels with zero thermal dissipation (0.0 mW).
                </p>
              </div>
              {canManageInfra && (
                <button
                  onClick={() => void handleProjectHologram()}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Project Holographic Pattern</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-[10px] uppercase text-[var(--text-muted)] border-b border-[var(--border-color)]">
                  <tr>
                    <th className="py-2 pr-3">Channel ID</th>
                    <th className="py-2 pr-3">Wavelength</th>
                    <th className="py-2 pr-3">Phase Angle</th>
                    <th className="py-2 pr-3">Coherence</th>
                    <th className="py-2 pr-3">Dimensions</th>
                    <th className="py-2">Hologram Hash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] tabular-nums">
                  {(singularity?.channels || []).map((ch) => (
                    <tr key={ch.channelId}>
                      <td className="py-2.5 pr-3 text-cyan-400">{ch.channelId}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-main)]">{ch.wavelengthNm} nm</td>
                      <td className="py-2.5 pr-3 text-[var(--text-muted)]">{ch.phaseConjugationAngleRad} rad</td>
                      <td className="py-2.5 pr-3 text-emerald-400">{ch.interferenceCoherence}</td>
                      <td className="py-2.5 pr-3 text-indigo-400">{ch.encodedDimensions}D</td>
                      <td className="py-2.5 text-[var(--text-muted)]">{ch.hologramHash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
                  <Binary className="h-4 w-4 text-emerald-400" />
                  <span>Zero-Knowledge Swarm Attestation Pipeline (Groth16 BN254)</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Recursive zk-SNARK proofs guaranteeing verifiable agent quorum without leaking raw payload telemetry.
                </p>
              </div>
              {canManageInfra && (
                <button
                  onClick={() => void handleGenerateZkProof()}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Generate Recursive Proof</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-[10px] uppercase text-[var(--text-muted)] border-b border-[var(--border-color)]">
                  <tr>
                    <th className="py-2 pr-3">Receipt ID</th>
                    <th className="py-2 pr-3">Proposal</th>
                    <th className="py-2 pr-3">Depth</th>
                    <th className="py-2 pr-3">Constraints</th>
                    <th className="py-2 pr-3">Verify Time</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)] tabular-nums">
                  {(zkAttestation?.receipts || []).map((rcpt) => (
                    <tr key={rcpt.receiptId}>
                      <td className="py-2.5 pr-3 text-emerald-400">{rcpt.receiptId}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-main)]">{rcpt.proposalId}</td>
                      <td className="py-2.5 pr-3 text-indigo-400">L{rcpt.recursionDepth}</td>
                      <td className="py-2.5 pr-3 text-[var(--text-muted)]">{rcpt.constraintsCount.toLocaleString()}</td>
                      <td className="py-2.5 pr-3 text-cyan-400">{rcpt.verificationTimeMs} ms</td>
                      <td className="py-2.5">
                        {canManageInfra ? (
                          <button
                            onClick={() => void handleVerifyZkProof(rcpt.receiptId)}
                            className="px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] whitespace-nowrap"
                          >
                            Verify Pairing
                          </button>
                        ) : (
                          <span className="text-emerald-400">VERIFIED</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Predictive Chaos-Swarm Inoculation Engine */}
      {activeTab === 'inoculation' && (
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-main)] flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-400" />
                <span>Predictive Chaos-Swarm Inoculation Engine</span>
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Proactive digital twin mutations vaccinating the self-healing mesh against split-brain, lattice desync, and kernel saturation.
              </p>
            </div>

            {canManageInfra && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={mutationVector}
                  onChange={(e) => setMutationVector(e.target.value as ChaosMutationVector)}
                  aria-label="Chaos Mutation Vector"
                  className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)]"
                >
                  <option value="MEMORY_PRESSURE">MEMORY_PRESSURE</option>
                  <option value="LATTICE_DESYNC">LATTICE_DESYNC</option>
                  <option value="BFT_SPLIT_BRAIN">BFT_SPLIT_BRAIN</option>
                  <option value="KERNEL_RING_SATURATION">KERNEL_RING_SATURATION</option>
                </select>
                <button
                  onClick={() => void handleRunInoculation()}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Launch Chaos Inoculation</span>
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[10px] uppercase text-[var(--text-muted)] border-b border-[var(--border-color)]">
                <tr>
                  <th className="py-2 pr-3">Campaign ID</th>
                  <th className="py-2 pr-3">Mutation Vector</th>
                  <th className="py-2 pr-3">Twin Sandbox</th>
                  <th className="py-2 pr-3">Immunity Score</th>
                  <th className="py-2 pr-3">Recovery</th>
                  <th className="py-2">Antibody Signature</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)] tabular-nums">
                {(chaosInoculation?.campaigns || []).map((c) => (
                  <tr key={c.campaignId}>
                    <td className="py-2.5 pr-3 text-indigo-400">{c.campaignId}</td>
                    <td className="py-2.5 pr-3 text-amber-400">{c.mutationVector}</td>
                    <td className="py-2.5 pr-3 text-[var(--text-muted)]">{c.sandboxNamespace}</td>
                    <td className="py-2.5 pr-3 text-emerald-400">{c.immunityScorePct}%</td>
                    <td className="py-2.5 pr-3 text-cyan-400">{c.recoveryLatencyMs} ms</td>
                    <td className="py-2.5 text-[var(--text-main)]">{c.antibodySignature}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
