# Architecture — The Neon Chasm

This document details the **17 architectural layers**, **16 autonomous swarm & cryptographic engines**, and the **Akasha-Omega Omnitemporal Core** powering The Neon Chasm platform.

---

## High-Level System Topology

```mermaid
flowchart TB
    subgraph Clients["Frontend & Visualization Plane (Next.js App Router + React 19)"]
        UI["Dual-Theme Glassmorphic Console\n(#f8fafc Light / #09090b Dark)"]
        WebGL["WebGL / Three.js Studios\n(GLSL Shaders, Bloom, DOF + 2D Canvas Fallback)"]
        Hook["useTelemetryStream Hook\n(WS -> SSE Fallback + rAF Batching + Optimistic UI)"]
    end

    subgraph Edge["Ingestion & Hardening Gateway (Express 5 + Node.js)"]
        Corr["Correlation & Tenant Auth\n(X-Request-ID + X-Tenant-ID + Bearer + JSON Log)"]
        RL["TokenBucketRateLimiter\n(Per-Tenant 429 + Retry-After, Probes Exempt)"]
        Zod["Zod v4 Schema Validation\n(Structured 400 INVALID_PAYLOAD)"]
        CB["DistributedCircuitBreaker & PolicyEngine"]
        WS["WebSocket (/ws/telemetry) & SSE (/api/v1/stream/telemetry)"]
    end

    subgraph Core["16-Engine Autonomous Swarm & Akasha-Omega Core"]
        Past["PAST_ARCHIVE Horizon\n(DNA Vault, ZK Attestation, Compliance Auditor)"]
        Present["PRESENT_EXECUTION Horizon\n(BFT Swarm, ML-KEM-1024 Sync, Neural-Genesis eBPF,\nSelf-Healing Mesh, SNN, Ring, Physarum, Bell-State, Resonance)"]
        Future["FUTURE_PREEMPTIVE Horizon\n(Retrocausal DAG, Holographic Singularity,\nSTDP Fault Isolation, Predictive Chaos)"]
        Akasha["Akasha-Omega Omnitemporal Core\n(Unified State Hash & Zero-Entropy Convergence)"]
    end

    subgraph Storage["Persistence & Supply Chain"]
        WAL["AtomicStateStore\n(SHA-256 Envelope + fsync + Rename + .wal.jsonl Recovery)"]
        Merkle["Cryptographic Audit Chain\n(SHA-256 + HMAC Signatures)"]
    end

    UI --> Hook
    WebGL --> Hook
    Hook <-->|WS / SSE / REST| Corr
    Corr --> RL --> Zod --> CB
    CB --> WS
    CB --> Core
    Past --> Akasha
    Present --> Akasha
    Future --> Akasha
    Akasha --> WAL
    CB --> Merkle
```

---

## The 17 Architectural Layers

| Layer | Domain | Primary Responsibilities | Key Modules |
| :---: | :--- | :--- | :--- |
| **1** | Presentation & Tokens | Dual-theme CSS tokens, sub-pixel antialiasing, chromatic glassmorphism, `/healthz` + `/readyz` widget | `src/styles/globals.css`, `src/components/system/HealthDashboard.tsx` |
| **2** | Spatial WebGL Visualizers | Custom GLSL holographic/particle shaders, GPU bloom/DOF, 2D fallback | `src/components/mesh/AkashaStudio.tsx` |
| **3** | Real-Time Transport Client | WS/SSE failover, RTT heartbeat, exponential backoff, rAF batching | `src/hooks/useTelemetryStream.ts` |
| **4** | Worker & Log Grid | Web Worker ingestion & virtualized high-throughput log explorer | `src/components/logs/AdvancedLogView.tsx` |
| **5** | Correlation, Tenant & Edge Defense | `X-Request-ID`, `X-Tenant-ID`, Bearer HMAC auth, per-tenant token bucket (`429`), Zod v4 (`400`) | `server/src/middleware/correlationAndTenant.ts`, `productionHardening.ts` |
| **6** | Resilience & Policy | Circuit breakers, eBPF throttlers, multi-tenant workspace guardrails | `server/src/middleware/circuitBreaker.ts`, `security/policyEngine.ts` |
| **7** | OTLP Ingestion & Streaming | OpenTelemetry batch ingestion, PromQL/LogQL & SSE/WS pub-sub | `server/src/index.ts`, `ws/gateway.ts`, `metrics/` |
| **8** | Incident & Causal Triage | Z-Score trace anomalies, Bayesian causal inference, post-mortems | `server/src/routes/incidents.ts`, `traces.ts` |
| **9** | Autonomous Remediation | Canary rollbacks, RL control loops, GitOps reconciliation | `server/src/routes/selfHealing.ts` |
| **10** | Continuous Governance | SOC2/GDPR posture linting, SIEM dispatch, FinOps, CBOM inventory | `server/src/routes/compliance.ts`, `governance/` |
| **11** | Cellular & DNA Vault | Synthetic DNA archival encoding & ZKP genomic privacy verification | `server/src/dna/dnaTelemetryVault.ts`, `zkpGenomicPrivacy.ts` |
| **12** | Post-Quantum Lattice Bus | ML-KEM-1024 telepathic swarm gossip & biophotonic Bell-state sync | `server/src/swarm/quantumSwarmSync.ts`, `crypto/biophotonicSync.ts` |
| **13** | Neuromorphic & Bio-Routing | SNN membrane prediction, STDP fault isolation, Physarum path routing | `server/src/ai/neuromorphicPredictor.ts`, `mesh/slimeMouldOptimizer.ts` |
| **14** | Neural-Genesis Kernel | Runtime eBPF XDP filter synthesis & JIT verification | `server/src/swarm/neuralGenesisKernel.ts` |
| **15** | Retrocausal & Chaos Twin | Preemptive DAG fault prevention & predictive chaos inoculation | `server/src/swarm/retrocausalFaultPrevention.ts`, `predictiveChaosSwarm.ts` |
| **16** | Akasha-Omega Core | 16-engine omnitemporal unification across Past, Present, Future | `server/src/swarm/akashaOmegaCore.ts` |
| **17** | Atomic WAL Persistence | Checksum-verified JSON snapshots, `.wal.jsonl` recovery, Merkle audit | `server/src/storage/statePersistence.ts` |

---

## The 16 Unified Swarm & Observability Engines

1. **Past Archive Horizon (`PAST_ARCHIVE`)**:
   - `dna-telemetry-vault` — Cellular DNA Telemetry Vault
   - `zk-swarm-attestation` — Zero-Knowledge Swarm Attestation
   - `continuous-compliance-auditor` — Continuous Compliance Auditor
2. **Present Execution Horizon (`PRESENT_EXECUTION`)**:
   - `sre-swarm-orchestrator` — Decentralized SRE Swarm BFT
   - `quantum-swarm-sync` — ML-KEM-1024 Telepathic Sync
   - `neural-genesis-kernel` — Neural-Genesis eBPF Kernel
   - `self-healing-mesh` — Autonomous Self-Healing Mesh
   - `neuromorphic-snn-predictor` — Neuromorphic SNN Predictor
   - `autonomous-mesh-ring` — Autonomous Mesh Ring Controller
   - `slime-mould-bio-router` — Physarum Bio-Routing Optimizer
   - `biophotonic-entanglement-sync` — Biophotonic CHSH Bell-State Sync
   - `neural-resonance-sync` — Neural Harmonic Resonance Sync
3. **Future Preemptive Horizon (`FUTURE_PREEMPTIVE`)**:
   - `retrocausal-fault-prevention` — Retrocausal Fault Prevention
   - `biophotonic-singularity-sync` — Holographic Singularity Sync
   - `neuromorphic-stdp-isolation` — Neuromorphic STDP Fault Isolation
   - `predictive-chaos-swarm` — Predictive Chaos Inoculation

---

## Omnitemporal Convergence & Atomic Persistence Flow

```mermaid
sequenceDiagram
    actor SRE as Operator / AkashaStudio UI
    participant Hook as useTelemetryStream
    participant API as Express Gateway (/api/v1/swarm/akasha/converge)
    participant Akasha as akashaOmegaCore (16 Engines)
    participant WAL as AtomicStateStore (.wal.jsonl + SHA-256)
    participant Bus as WS / SSE Broadcaster

    SRE->>Hook: Trigger "Initiate Omnitemporal Convergence"
    Hook->>Hook: Apply Optimistic Cycle Increment & Toast
    Hook->>API: POST /api/v1/swarm/akasha/converge
    API->>API: TokenBucketRateLimiter + Zod AkashaConvergeSchema
    API->>Akasha: convergeOmnitemporalState(triggerVector, timelineSpanYears)
    Akasha->>Akasha: Compute Past/Present/Future Merkle Roots + eternalStateHash
    Akasha->>WAL: Append WAL frame + fsync .tmp + atomic rename
    API->>API: appendAuditLog('AKASHA_OMEGA_CORE', 'OMNITEMPORAL_CONVERGENCE')
    API->>Bus: broadcastAkashaConvergence({ event, state })
    API-->>Hook: HTTP 201 { success: true, event, state }
    Bus-->>Hook: WS/SSE event: akasha_converged (batched via rAF)
    Hook-->>SRE: Commit optimistic state & synchronize 3D/2D field
```
