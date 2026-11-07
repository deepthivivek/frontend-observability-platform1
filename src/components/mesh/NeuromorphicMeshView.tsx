'use client';

import React, { useState, useEffect } from 'react';
import { 
  BrainCircuit, 
  Network, 
  Workflow, 
  Radio, 
  Activity, 
  Zap, 
  ShieldAlert, 
  CheckCircle2, 
  RefreshCw, 
  Sliders, 
  Cpu, 
  Globe, 
  Layers 
} from 'lucide-react';

interface SpikeEvent {
  id: string;
  timestamp: number;
  neuronId: string;
  membranePotential: number;
  threshold: number;
  fired: boolean;
  spikeFrequencyHz: number;
  layer: 'input' | 'hidden' | 'predictive_output';
}

interface MembraneState {
  globalVoltage: number;
  averageFiringRateHz: number;
  cascadingFailureProbability: number;
  activeSpikeTrains: number;
  status: 'STABLE' | 'ELEVATED_ACTIVITY' | 'CRITICAL_CASCADE_IMMINENT';
}

interface MeshNode {
  id: string;
  region: string;
  ip: string;
  status: 'HEALTHY' | 'PARTITIONED' | 'ISOLATED_EPHEMERAL_SIDECAR';
  latencyMs: number;
  activeSidecar: boolean;
  packetLossRate: number;
}

interface MeshTopology {
  clusterId: string;
  nodes: MeshNode[];
  activePartitions: number;
  activeSidecars: number;
  routingEfficiency: number;
}

interface BioTunnel {
  id: string;
  sourceRegion: string;
  targetRegion: string;
  conductivity: number;
  nutrientConcentration: number;
  fluxRateMbps: number;
  status: 'REINFORCED' | 'GROWING' | 'RETRACTING' | 'STABLE';
}

interface BellStatePair {
  pairId: string;
  nodeA: string;
  nodeB: string;
  fidelity: number;
  phaseAngleDeg: number;
  entangled: boolean;
  lastSyncHash: string;
}

export default function NeuromorphicMeshView() {
  const [activeTab, setActiveTab] = useState<'snn' | 'mesh' | 'slime' | 'biophotonic'>('snn');
  const [membraneState, setMembraneState] = useState<MembraneState | null>(null);
  const [spikes, setSpikes] = useState<SpikeEvent[]>([]);
  const [topology, setTopology] = useState<MeshTopology | null>(null);
  const [tunnels, setTunnels] = useState<BioTunnel[]>([]);
  const [bioSummary, setBioSummary] = useState<{ averageConductivity: number; totalThroughput: number; strain: string } | null>(null);
  const [biophotonicStatus, setBiophotonicStatus] = useState<{ activePairs: number; averageFidelity: number; zeroLatencySyncActive: boolean; bellStatePairs: BellStatePair[] } | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      const [sumRes, spikeRes, topoRes, tunnelRes, bioSumRes, photonRes] = await Promise.all([
        fetch('/api/v1/neuromorphic-mesh/summary').then(r => r.json()).catch(() => null),
        fetch('/api/v1/neuromorphic/spikes?limit=30').then(r => r.json()).catch(() => ({ spikes: [] })),
        fetch('/api/v1/mesh-ring/topology').then(r => r.json()).catch(() => null),
        fetch('/api/v1/slime-mould/tunnels').then(r => r.json()).catch(() => ({ tunnels: [] })),
        fetch('/api/v1/slime-mould/conductivity').then(r => r.json()).catch(() => null),
        fetch('/api/v1/biophotonic/entanglement-status').then(r => r.json()).catch(() => null),
      ]);

      if (sumRes) {
        setMembraneState(sumRes.membraneState);
        setTopology(sumRes.meshTopology);
        setBioSummary(sumRes.slimeMouldSummary);
        setBiophotonicStatus(sumRes.biophotonicStatus);
      }
      if (spikeRes?.spikes) setSpikes(spikeRes.spikes);
      if (topoRes?.clusterId) setTopology(topoRes);
      if (tunnelRes?.tunnels) setTunnels(tunnelRes.tunnels);
      if (bioSumRes) setBioSummary(bioSumRes);
      if (photonRes?.bellStatePairs) setBiophotonicStatus(photonRes);
    } catch (err) {
      console.error('Failed to fetch neuromorphic mesh telemetry', err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (active) {
        await fetchData();
      }
    };
    run();
    const interval = setInterval(() => {
      if (active) {
        fetchData();
      }
    }, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [fetchData]);

  const handleSimulateBurst = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/neuromorphic/simulate-burst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intensity: 1.5 }),
      });
      const data = await res.json();
      if (data.membraneState) setMembraneState(data.membraneState);
      setActionMessage('Simulated spike burst injected into eBPF telemetry vector successfully.');
      fetchData();
    } catch {
      setActionMessage('Failed to simulate spike burst.');
    } finally {
      setLoading(false);
    }
  };

  const handleIsolateNode = async (nodeId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/mesh-ring/isolate-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId }),
      });
      const data = await res.json();
      setTopology(data);
      setActionMessage(`Node ${nodeId} partitioned & ephemeral sidecar spawned.`);
    } catch {
      setActionMessage('Failed to isolate node.');
    } finally {
      setLoading(false);
    }
  };

  const handleHealCluster = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/mesh-ring/heal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setTopology(data);
      setActionMessage('Mesh cluster fully healed and eBPF tunnels restored.');
    } catch {
      setActionMessage('Failed to heal cluster.');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateSlimeGrowth = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/slime-mould/simulate-growth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nutrientBoost: 1.3 }),
      });
      const data = await res.json();
      setTunnels(data.tunnels);
      setBioSummary({
        averageConductivity: data.averageConductivity,
        totalThroughput: data.networkThroughputGbps,
        strain: data.organismStrain,
      });
      setActionMessage('Physarum polycephalum nutrient boost applied; organic routing tunnels reinforced.');
    } catch {
      setActionMessage('Failed to stimulate slime-mould growth.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBellState = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/biophotonic/verify-bell-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      setActionMessage(data.message);
      fetchData();
    } catch {
      setActionMessage('Failed to verify Bell-state fidelity.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-[var(--text-main)] bg-[var(--bg-canvas)] min-h-screen">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-mono font-semibold rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">
              DAY 21 CAPSTONE
            </span>
            <span className="px-2.5 py-1 text-xs font-mono font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              NEUROMORPHIC SNN & BIOPHOTONIC SYNC
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Neuromorphic Mesh Studio</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Autonomous spiking neural networks, self-healing eBPF mesh rings, slime-mould bio-routing, and biophotonic quantum entanglement sync.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-color)] hover:border-violet-500/50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-violet-400" />
            Refresh Telemetry
          </button>
          <button
            onClick={handleSimulateBurst}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors shadow-sm disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5" />
            Simulate SNN Spike Burst
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-lg bg-violet-500/10 border border-violet-500/30 text-violet-300 text-sm flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-xs opacity-70 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Top Status Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Membrane Potential</span>
            <BrainCircuit className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums">
            {membraneState ? `${membraneState.globalVoltage} mV` : '-68.4 mV'}
          </div>
          <div className="text-xs flex items-center gap-1 text-emerald-400 font-mono">
            <span>Firing Rate:</span>
            <span>{membraneState ? `${membraneState.averageFiringRateHz} Hz` : '48.2 Hz'}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Cascading Failure Risk</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums">
            {membraneState ? `${(membraneState.cascadingFailureProbability * 100).toFixed(1)}%` : '4.2%'}
          </div>
          <div className="text-xs font-mono uppercase tracking-wider text-amber-400">
            {membraneState?.status || 'STABLE'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Slime-Mould Conductivity</span>
            <Workflow className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums">
            {bioSummary ? `${(bioSummary.averageConductivity * 100).toFixed(1)}%` : '84.0%'}
          </div>
          <div className="text-xs font-mono text-[var(--text-muted)]">
            Throughput: {bioSummary?.totalThroughput || 124.6} Gbps
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
            <span>Biophotonic Fidelity</span>
            <Radio className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums">
            {biophotonicStatus ? `${(biophotonicStatus.averageFidelity * 100).toFixed(2)}%` : '99.7%'}
          </div>
          <div className="text-xs font-mono text-cyan-400">
            Bell-State |Φ+⟩ Synchronized
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
        {[
          { id: 'snn', label: 'Spiking Neural Network (SNN)', icon: BrainCircuit },
          { id: 'mesh', label: 'Autonomous Mesh Ring', icon: Network },
          { id: 'slime', label: 'Slime-Mould Bio-Routing', icon: Workflow },
          { id: 'biophotonic', label: 'Biophotonic Entanglement Sync', icon: Radio },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-violet-600/20 text-violet-400 border border-violet-500/50'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-color)] hover:text-[var(--text-main)] hover:border-white/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Spiking Neural Network */}
      {activeTab === 'snn' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Leaky Integrate-and-Fire Membrane Potential</h2>
                  <p className="text-xs text-[var(--text-muted)]">Real-time spike waterfall and voltage potentials across eBPF inference layers.</p>
                </div>
                <button
                  onClick={handleSimulateBurst}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/40 hover:bg-violet-600/30"
                >
                  Inject Spike Burst
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {spikes.map((spike) => (
                  <div
                    key={spike.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] text-xs font-mono"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${spike.fired ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}`} />
                      <span className="font-semibold text-[var(--text-main)]">{spike.neuronId}</span>
                      <span className="text-[var(--text-muted)] uppercase text-[10px] px-2 py-0.5 rounded bg-[var(--bg-elevated)]">
                        {spike.layer}
                      </span>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-[var(--text-muted)]">Threshold: {spike.threshold}mV</span>
                      <span className={`font-bold tabular-nums ${spike.fired ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {spike.membranePotential} mV
                      </span>
                      <span className="text-[var(--text-muted)]">{spike.spikeFrequencyHz} Hz</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-4">
              <h2 className="text-lg font-semibold">SNN Diagnostic Metrics</h2>
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-1">
                  <div className="text-[var(--text-muted)]">Global Membrane Voltage</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-violet-400">
                    {membraneState?.globalVoltage} mV
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-1">
                  <div className="text-[var(--text-muted)]">Average Firing Rate</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-cyan-400">
                    {membraneState?.averageFiringRateHz} Hz
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-1">
                  <div className="text-[var(--text-muted)]">Active Spike Trains</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-emerald-400">
                    {membraneState?.activeSpikeTrains} Neurons
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-1">
                  <div className="text-[var(--text-muted)]">Cascade Risk Index</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-amber-400">
                    {membraneState ? `${(membraneState.cascadingFailureProbability * 100).toFixed(1)}%` : '0%'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Autonomous Mesh Ring */}
      {activeTab === 'mesh' && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Autonomous Mesh Ring Topology</h2>
                <p className="text-xs text-[var(--text-muted)]">Multi-region eBPF proxy sidecars and automated network partition recovery.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleHealCluster}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Heal Mesh Cluster
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topology?.nodes.map((node) => (
                <div
                  key={node.id}
                  className={`p-4 rounded-xl border space-y-3 ${
                    node.status === 'HEALTHY'
                      ? 'bg-[var(--bg-canvas)] border-[var(--border-color)]'
                      : 'bg-rose-500/10 border-rose-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{node.id}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono rounded-full ${
                        node.status === 'HEALTHY'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {node.status}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 font-mono text-[var(--text-muted)]">
                    <div>Region: {node.region} ({node.ip})</div>
                    <div>Latency: {node.latencyMs} ms</div>
                    <div>Packet Loss: {node.packetLossRate}%</div>
                    <div>eBPF Sidecar: {node.activeSidecar ? 'ACTIVE (Ephemeral)' : 'Standard'}</div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    {node.status === 'HEALTHY' ? (
                      <button
                        onClick={() => handleIsolateNode(node.id)}
                        className="w-full py-1.5 text-xs font-medium rounded bg-rose-600/20 text-rose-400 border border-rose-500/40 hover:bg-rose-600/30 transition-colors"
                      >
                        Simulate Partition
                      </button>
                    ) : (
                      <button
                        onClick={handleHealCluster}
                        className="w-full py-1.5 text-xs font-medium rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-600/30 transition-colors"
                      >
                        Restore Node
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Slime-Mould Bio-Routing */}
      {activeTab === 'slime' && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Physarum polycephalum Bio-Routing Optimizer</h2>
                <p className="text-xs text-[var(--text-muted)]">Organic growth equations reinforcing low-latency eBPF tunnels and retracting congestion.</p>
              </div>
              <button
                onClick={handleSimulateSlimeGrowth}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                <Sliders className="w-4 h-4" />
                Apply Nutrient Boost
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tunnels.map((tunnel) => (
                <div key={tunnel.id} className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{tunnel.id}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono rounded-full ${
                        tunnel.status === 'REINFORCED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : tunnel.status === 'GROWING'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {tunnel.status}
                    </span>
                  </div>

                  <div className="text-xs font-mono space-y-1 text-[var(--text-muted)]">
                    <div>{tunnel.sourceRegion} ➔ {tunnel.targetRegion}</div>
                    <div>Conductivity: {(tunnel.conductivity * 100).toFixed(1)}%</div>
                    <div>Nutrient Level: {tunnel.nutrientConcentration}%</div>
                    <div>Flux Rate: {tunnel.fluxRateMbps.toLocaleString()} Mbps</div>
                  </div>

                  <div className="w-full bg-[var(--bg-elevated)] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${tunnel.conductivity * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Biophotonic Entanglement Sync */}
      {activeTab === 'biophotonic' && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Biophotonic Quantum Entanglement Sync</h2>
                <p className="text-xs text-[var(--text-muted)]">Bell-state |Φ+⟩ verification and zero-latency cross-region Merkle state synchronization.</p>
              </div>
              <button
                onClick={handleVerifyBellState}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
              >
                <Radio className="w-4 h-4" />
                Verify CHSH Bell-State
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {biophotonicStatus?.bellStatePairs.map((pair) => (
                <div key={pair.pairId} className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-color)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{pair.pairId}</span>
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      ENTANGLED
                    </span>
                  </div>

                  <div className="text-xs font-mono space-y-1 text-[var(--text-muted)]">
                    <div>Nodes: {pair.nodeA} ⟷ {pair.nodeB}</div>
                    <div>Fidelity: {(pair.fidelity * 100).toFixed(3)}%</div>
                    <div>Phase Angle: {pair.phaseAngleDeg}°</div>
                    <div className="truncate">Merkle Hash: {pair.lastSyncHash}</div>
                  </div>

                  <div className="w-full bg-[var(--bg-elevated)] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-cyan-400 h-full transition-all duration-500"
                      style={{ width: `${pair.fidelity * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
