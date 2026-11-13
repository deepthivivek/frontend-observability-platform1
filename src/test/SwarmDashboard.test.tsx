import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SwarmDashboard } from '../components/swarm/SwarmDashboard';

const mockSummaryPayload = {
  orchestrator: {
    totalAgents: 4,
    bftFaultTolerance: 1,
    quorumThreshold: 3,
    agents: [
      {
        id: 'agent-diag-01',
        role: 'DiagAgent',
        region: 'us-east-1',
        status: 'ACTIVE',
        reputationScore: 0.994,
        bftWeight: 1,
        lastHeartbeat: Date.now(),
        actionsExecuted: 142,
      },
      {
        id: 'agent-sec-02',
        role: 'SecAgent',
        region: 'eu-central-1',
        status: 'ACTIVE',
        reputationScore: 0.998,
        bftWeight: 1,
        lastHeartbeat: Date.now(),
        actionsExecuted: 89,
      },
      {
        id: 'agent-finops-03',
        role: 'FinOpsAgent',
        region: 'us-west-2',
        status: 'ACTIVE',
        reputationScore: 0.987,
        bftWeight: 1,
        lastHeartbeat: Date.now(),
        actionsExecuted: 64,
      },
      {
        id: 'agent-kernel-04',
        role: 'KernelAgent',
        region: 'ap-southeast-1',
        status: 'EXECUTING',
        reputationScore: 0.999,
        bftWeight: 1,
        lastHeartbeat: Date.now(),
        actionsExecuted: 211,
      },
    ],
    recentProposals: [
      {
        proposalId: 'prop-bft-901',
        targetService: 'ingress-ebpf-gateway',
        anomalySignature: 'Z_SCORE_TAIL_LATENCY_SPIKE_4.8',
        recommendedAction: 'REWRITE_EBPF_RING_FILTER_AND_REROUTE_SLIME_TUNNEL',
        votesFor: ['DiagAgent', 'SecAgent', 'KernelAgent', 'FinOpsAgent'],
        votesAgainst: [],
        quorumReached: true,
        consensusLatencyMs: 14.2,
        merkleDecisionHash: 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899',
        status: 'APPROVED_EXECUTED',
        timestamp: Date.now(),
      },
    ],
  },
  quantumSync: {
    protocol: 'ML-KEM-1024-TELEPATHIC-GOSSIP',
    activeRegions: ['us-east-1', 'us-west-2', 'eu-central-1', 'ap-southeast-1'],
    globalStateEpoch: 1084,
    stateRootHash: 'lattice-root-0123456789abcdef',
    averageSyncLatencyMs: 0.42,
    packetsDelivered: 1,
    packets: [
      {
        packetId: 'qsync-init-01',
        sourceRegion: 'us-east-1',
        targetRegions: ['us-west-2', 'eu-central-1', 'ap-southeast-1'],
        kemAlgorithm: 'ML-KEM-1024',
        ciphertextDigest: '00112233445566778899aabbccddeeff',
        gossipRound: 1084,
        syncLatencyMs: 0.42,
        tamperVerified: true,
        timestamp: Date.now(),
      },
    ],
  },
  neuralGenesis: {
    jitCompilerVersion: 'LLVM-BPF-19.1-NEURAL-GENESIS',
    totalCompiledPrograms: 1,
    activeInKernel: 1,
    programs: [
      {
        programId: 'ebpf-gen-401',
        hookPoint: 'XDP_INGRESS',
        anomalyTrigger: 'ZERO_DAY_HTTP2_RAPID_RESET_FLOOD',
        ebpfSourceSnippet: 'SEC("xdp") int drop_reset_flood(struct xdp_md *ctx) { return XDP_PASS; }',
        jitBytecodeHash: 'deadbeef00112233',
        bytecodeSizeBytes: 1248,
        smtVerification: {
          verified: true,
          boundsChecked: true,
          terminationProven: true,
          verifierPasses: 14,
        },
        injectedIntoRingBuffer: true,
        compiledAt: Date.now(),
      },
    ],
  },
  retrocausal: {
    horizonWindowMs: 150,
    totalSimulations: 1,
    totalAnomaliesPrevented: 1,
    totalDeterministicRollbacks: 1,
    latestRun: {
      simulationId: 'retro-dag-001',
      horizonMs: 120,
      anomaliesPreventedCount: 1,
      deterministicRollbacksExecuted: 1,
      dagNodes: [
        {
          nodeId: 'dag-n1',
          service: 'auth-token-verifier',
          lookaheadMs: 35,
          predictedFaultProbability: 0.08,
          parentNodeId: null,
          preventativeAction: 'NONE_REQUIRED',
          status: 'NOMINAL',
        },
        {
          nodeId: 'dag-n2',
          service: 'session-redis-pool',
          lookaheadMs: 75,
          predictedFaultProbability: 0.89,
          parentNodeId: 'dag-n1',
          preventativeAction: 'PREEMPTIVE_CONNECTION_POOL_DRAIN_ROLLBACK',
          status: 'PREEMPTED',
        },
      ],
      timestamp: Date.now(),
    },
    runs: [],
  },
  singularity: {
    singularityLock: true,
    zeroThermalDissipation: true,
    averageCoherence: 0.9991,
    channelsCount: 1,
    channels: [
      {
        channelId: 'holo-alpha-1550',
        wavelengthNm: 1550.12,
        phaseConjugationAngleRad: 0.0041,
        interferenceCoherence: 0.9994,
        thermalDissipationMilliwatts: 0.0,
        encodedDimensions: 16,
        hologramHash: 'holohash123456',
        syncedAt: Date.now(),
      },
    ],
  },
  stdp: {
    plasticityModel: 'STDP-ASYMMETRIC-EXPONENTIAL',
    meanIsolationLatencyUs: 0.46,
    activeSynapses: 64,
    restingMembraneMv: -70.0,
    events: [
      {
        synapseId: 'stdp-ingress-01',
        preNeuron: 'ebpf-socket-sensor-04',
        postNeuron: 'fault-isolator-core',
        deltaTimingUs: 0.48,
        weightDelta: 0.142,
        membranePotentialMv: -68.2,
        isolatedFaultNode: 'pod-edge-ingress-7c9f',
        autonomicResetTriggered: true,
        timestamp: Date.now(),
      },
    ],
  },
  zkAttestation: {
    provingSystem: 'Groth16-Recursive-BN254',
    totalVerifiedProofs: 1,
    receipts: [
      {
        receiptId: 'zk-swarm-rcpt-01',
        proposalId: 'prop-bft-901',
        recursionDepth: 4,
        provingSystem: 'Groth16-Recursive-BN254',
        publicConsensusRoot: '0x11223344',
        proofCommitment: '0xaabbccdd',
        constraintsCount: 384200,
        verificationTimeMs: 1.18,
        verified: true,
        timestamp: Date.now(),
      },
    ],
  },
  chaosInoculation: {
    meshImmunityIndexPct: 99.15,
    totalCampaigns: 1,
    campaigns: [
      {
        campaignId: 'inoc-camp-01',
        mutationVector: 'BFT_SPLIT_BRAIN',
        sandboxNamespace: 'twin-sandbox-bft-09',
        immunityScorePct: 99.4,
        recoveryLatencyMs: 18.4,
        antibodySignature: 'eBPF_QUORUM_FAILOVER_V3',
        inoculatedAt: Date.now(),
        status: 'VACCINATED',
      },
    ],
  },
  selfHealingMesh: {
    meshHealthStatus: 'SELF_HEALING_ACTIVE',
    totalMitigations: 1,
    totalPacketDropsPrevented: 18420,
    activeBioFailoverTunnel: 'tunnel-us-east-west',
    mitigations: [
      {
        mitigationId: 'heal-mesh-701',
        triggerSource: 'KernelAgent_XDP_Alert',
        actionType: 'BIO_TUNNEL_FAILOVER',
        isolatedSocketOrNode: 'sock-10.190.3.22:8443',
        failoverTunnelId: 'tunnel-us-east-west',
        mitigationDurationMs: 6.4,
        packetDropPreventedCount: 18420,
        status: 'MITIGATED',
        timestamp: Date.now(),
      },
    ],
  },
};

describe('Autonomous AI Swarm & Singularity Command Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn((url: string) => {
      if (url.includes('/api/v1/swarm/summary')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockSummaryPayload),
        });
      }
      if (url.includes('/api/v1/swarm/orchestrator/propose')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              proposal: {
                ...mockSummaryPayload.orchestrator.recentProposals[0],
                proposalId: 'prop-bft-new',
                consensusLatencyMs: 11.4,
              },
            }),
        });
      }
      if (url.includes('/api/v1/swarm/quantum-sync/broadcast')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              packet: { ...mockSummaryPayload.quantumSync.packets[0], gossipRound: 1085, syncLatencyMs: 0.31 },
            }),
        });
      }
      if (url.includes('/api/v1/swarm/neural-genesis/compile')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              program: { ...mockSummaryPayload.neuralGenesis.programs[0], programId: 'ebpf-gen-new' },
            }),
        });
      }
      if (url.includes('/api/v1/swarm/self-healing-mesh/mitigate')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              record: { ...mockSummaryPayload.selfHealingMesh.mitigations[0], mitigationId: 'heal-mesh-new' },
            }),
        });
      }
      if (url.includes('/api/v1/swarm/retrocausal/simulate')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              run: { ...mockSummaryPayload.retrocausal.latestRun, simulationId: 'retro-dag-new', horizonMs: 150 },
            }),
        });
      }
      if (url.includes('/api/v1/swarm/stdp/isolate')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              event: { ...mockSummaryPayload.stdp.events[0], synapseId: 'stdp-new', deltaTimingUs: 0.29 },
            }),
        });
      }
      if (url.includes('/api/v1/swarm/singularity/project')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              channel: { ...mockSummaryPayload.singularity.channels[0], channelId: 'holo-sync-new' },
            }),
        });
      }
      if (url.includes('/api/v1/swarm/zk-attestation/prove')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              receipt: { ...mockSummaryPayload.zkAttestation.receipts[0], receiptId: 'zk-swarm-rcpt-new' },
            }),
        });
      }
      if (url.includes('/api/v1/swarm/chaos-inoculation/run')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              campaign: { ...mockSummaryPayload.chaosInoculation.campaigns[0], campaignId: 'inoc-camp-new' },
            }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;
  });

  it('renders all 9 autonomous swarm subsystems and executes interactive triggers', async () => {
    render(<SwarmDashboard canManageInfra={true} canViewLogs={true} />);

    await waitFor(() => {
      expect(screen.getByText('Autonomous AI Swarm & Singularity Command')).toBeInTheDocument();
      expect(screen.getByText('DiagAgent')).toBeInTheDocument();
      expect(screen.getByText('KernelAgent')).toBeInTheDocument();
      expect(screen.getByText('prop-bft-901')).toBeInTheDocument();
    });

    // Trigger BFT Consensus Proposal
    fireEvent.click(screen.getByRole('button', { name: /Propose BFT Consensus/i }));
    await waitFor(() => {
      expect(screen.getByText(/BFT Consensus APPROVED_EXECUTED: prop-bft-new/i)).toBeInTheDocument();
    });

    // Switch to Neural-Genesis eBPF & Self-Healing Mesh tab
    fireEvent.click(screen.getByRole('button', { name: /Neural-Genesis eBPF & Mesh/i }));
    await waitFor(() => {
      expect(screen.getByText('ebpf-gen-401')).toBeInTheDocument();
      expect(screen.getByText('heal-mesh-701')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Synthesize & JIT Compile eBPF/i }));
    await waitFor(() => {
      expect(screen.getByText(/Neural-Genesis JIT compiled ebpf-gen-new/i)).toBeInTheDocument();
    });

    // Switch to Retrocausal DAG & STDP tab
    fireEvent.click(screen.getByRole('button', { name: /Retrocausal DAG & STDP/i }));
    await waitFor(() => {
      expect(screen.getByText('session-redis-pool')).toBeInTheDocument();
      expect(screen.getByText('stdp-ingress-01')).toBeInTheDocument();
    });

    // Switch to Singularity & ZK Receipts tab
    fireEvent.click(screen.getByRole('button', { name: /Singularity & ZK Receipts/i }));
    await waitFor(() => {
      expect(screen.getByText('holo-alpha-1550')).toBeInTheDocument();
      expect(screen.getByText('zk-swarm-rcpt-01')).toBeInTheDocument();
    });

    // Switch to Chaos Inoculation tab
    fireEvent.click(screen.getByRole('button', { name: /Chaos Inoculation/i }));
    await waitFor(() => {
      expect(screen.getByText('inoc-camp-01')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Launch Chaos Inoculation/i }));
    await waitFor(() => {
      expect(screen.getByText(/Chaos Inoculation inoc-camp-new/i)).toBeInTheDocument();
    });
  });

  it('enforces RBAC restrictions for read-only users and restricted log viewers', async () => {
    const { rerender } = render(<SwarmDashboard canManageInfra={false} canViewLogs={true} />);

    await waitFor(() => {
      expect(screen.getByText('RBAC: READ-ONLY AUDIT')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /Propose BFT Consensus/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Broadcast Lattice Gossip/i })).not.toBeInTheDocument();

    rerender(<SwarmDashboard canManageInfra={false} canViewLogs={false} />);
    expect(screen.getByText('Autonomous Swarm Access Restricted')).toBeInTheDocument();
  });
});
