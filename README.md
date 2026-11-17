# The Neon Chasm — Enterprise Full-Stack Observability & Omnitemporal Operations Platform

**The Neon Chasm** is a production-hardened, dual-theme full-stack observability, security, and autonomous SRE platform combining live OpenTelemetry (OTLP) ingestion, multi-tenant correlation & rate limiting, PromQL/LogQL engines, WebGL/Three.js topological & omnitemporal visualizers, post-quantum lattice cryptography, and the **Akasha-Omega Omnitemporal Core**.

---

## Key Capabilities

- **Dual-Theme Glassmorphic UI**: Synchronized Dark (`#09090b`) and Light (`#f8fafc`) themes driven by CSS custom property tokens (`--bg-canvas`, `--bg-surface`, `--text-main`, `--border-color`, `--accent-glow`), tabular numerals, sub-pixel antialiasing, and live `/healthz` + `/readyz` readiness telemetry via `HealthDashboard`.
- **Immersive WebGL / Three.js Studios (`AkashaStudio.tsx`)**: Custom GLSL holographic shaders, volumetric instanced particle fields, GPU-adaptive `EffectComposer` bloom + depth-of-field post-processing, and automatic 2D `<canvas>` fallbacks for low-power/headless devices with strict GPU memory disposal.
- **Real-Time Telemetry Stream (`useTelemetryStream`)**: Native WebSocket (`/ws/telemetry`) with automatic SSE (`/api/v1/stream/telemetry`) fallback, jittered exponential backoff reconnection, RTT heartbeat checks, `requestAnimationFrame` state batching, and optimistic SRE action dispatch.
- **Multi-Tenant Backend Hardening**:
  - Distributed correlation ID (`X-Request-ID`) and tenant isolation (`X-Tenant-ID`, `Authorization: Bearer`) middleware with single-line JSON structured request logging.
  - Dynamic per-tenant `TokenBucketRateLimiter` returning `HTTP 429` + `Retry-After` + `X-RateLimit-*` headers (with Kubernetes health probes exempt).
  - Strict Zod v4 schema validation returning structured HTTP `400` (`INVALID_PAYLOAD`) diagnostics.
  - Global `uncaughtException` / `unhandledRejection` safety handlers, graceful `SIGTERM`/`SIGINT` draining, and SHA-256 checksum-verified atomic JSON + Write-Ahead Log (`.wal.jsonl`) persistence.
- **16-Engine Akasha-Omega Core**: Unifies Past Archive (DNA Vault, ZK Attestation, Continuous Compliance), Present Execution (SRE Swarm BFT, ML-KEM-1024 Sync, Neural-Genesis eBPF, Self-Healing Mesh, SNN Predictor, Mesh Ring, Physarum Bio-Routing, Biophotonic Bell-State, Neural Resonance), and Future Preemptive (Retrocausal DAG, Holographic Singularity, STDP Fault Isolation, Predictive Chaos Inoculation) horizons.

---

## Quickstart

### Prerequisites
- Node.js `>= 20` (recommended `22.x`) or Bun `>= 1.1`
- Docker + Docker Compose (optional containerized runtime)
- Helm `>= 3.12` & Terraform `>= 1.6` (optional Kubernetes / GKE infrastructure deployment)

### Local Development
```bash
cp .env.example .env
make install
make dev
```
Open `http://127.0.0.1:3000` for the observability console (which includes built-in Next.js API bridges on port `3000` or proxies to `BACKEND_GATEWAY_URL`), or run the standalone Express/WebSocket gateway on port `4000`:
```bash
npx tsx server/src/index.ts
```

### Verification & Quality Gates
```bash
make typecheck      # Strict TypeScript check (npx tsc --noEmit)
make lint           # ESLint zero-warning check
make build          # Production Next.js build
make helm-lint      # Lint Kubernetes Restricted PSS Helm chart
make tf-validate    # Format-check and validate multi-AZ Terraform IaC
```

### Docker Compose (Gateway + Web + OTel Collector)
```bash
docker compose up --build
```
- Web UI: `http://localhost:3000`
- Ingestion Gateway: `http://localhost:4000`
- OpenTelemetry Collector OTLP gRPC/HTTP: `localhost:4317` / `localhost:4318`
- Prometheus Spanmetrics Exporter: `http://localhost:8889/metrics`

### Terraform & Helm (`Restricted` PSS Compliant)
```bash
terraform -chdir=deploy/terraform init
terraform -chdir=deploy/terraform apply -var="project_id=<GCP_PROJECT_ID>"

make helm-lint
helm upgrade --install neon-chasm ./deploy/helm/neon-chasm \
  --namespace neon-chasm-enterprise
```

---

## Core REST & Streaming API

| Method | Endpoint | Headers / Validation | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/healthz` | Exempt from rate limit & auth | Kubernetes liveness probe (`status`, `uptimeSeconds`, `pid`, `requestId`). |
| `GET` | `/readyz` | Exempt from rate limit & auth | Readiness probe checking OTLP ingestion, atomic WAL integrity, Akasha SHA-256 convergence, and free memory. |
| `GET` | `/api/v1/health` | Exempt from rate limit & auth | Gateway health, circuit breaker state, and Merkle chain integrity check. |
| `POST` | `/api/v1/telemetry` | `X-Request-ID`, `X-Tenant-ID`, `Authorization: Bearer`, `TelemetryIngestSchema` | Live OTLP logs, metrics, and spans ingestion -> persists ring buffer & broadcasts `telemetry_tick`. |
| `GET` | `/api/v1/telemetry/recent` | `X-Request-ID`, `X-Tenant-ID` | Returns recent persisted OTLP production telemetry records (`?limit=1..500`). |
| `GET` | `/api/v1/stream/telemetry` | SSE (`text/event-stream`) | Real-time telemetry, anomaly, and Akasha convergence stream. |
| `WS` | `/ws/telemetry` | WebSocket protocol v1 | Bidirectional live telemetry and RTT heartbeat channel. |
| `POST` | `/api/v1/metrics/query` | `PromqlQuerySchema` | PromQL time-series evaluation engine. |
| `POST` | `/api/v1/metrics/ai-translate` | `AiTranslateSchema` | Natural language to PromQL translation. |
| `GET` | `/api/v1/audit/logs` | Cryptographic HMAC/SHA-256 | Returns hash-chained audit trail & integrity boolean. |
| `GET/POST` | `/api/v1/rbac/policies` | `RbacPolicyUpdateSchema` | Inspect or atomically persist workspace RBAC policy rules. |
| `GET` | `/api/v1/swarm/akasha/state` | Read-only snapshot | Returns unified 16-engine omnitemporal state & root hashes. |
| `GET` | `/api/v1/swarm/akasha/field` | Read-only harmonic vector | Returns 16-dimensional phase/amplitude/coherence WebGL field. |
| `GET` | `/api/v1/swarm/akasha/history` | Read-only log | Returns chronological `ETERNAL_HARMONY` convergence records. |
| `POST` | `/api/v1/swarm/akasha/converge` | `AkashaConvergeSchema` | Triggers omnitemporal convergence & broadcasts over WS/SSE. |

---

## Keyboard Shortcuts

| Shortcut | Navigation / Action |
| :--- | :--- |
| `⌘K` / `Ctrl+K` | Open global Command Palette |
| `/` | Focus telemetry search / query filter |
| `?` | Toggle keyboard shortcuts cheat sheet (Log Table) |
| `J` / `K` / `Esc` | Next log, previous log, close Log Inspector Drawer |
| `G` then `D` | Overview Dashboard |
| `G` then `R` | Real-Time Log Stream |
| `G` then `T` | Distributed Tracing |
| `G` then `A` | Alert Rules & Thresholds |
| `G` then `M` | Metrics Studio & PromQL |
| `G` then `I` | AI Incident Command Center |
| `G` then `G` | Enterprise Governance |
| `N` then `M` | Neuromorphic & Bio-Photonic Mesh |
| `A` then `S` | Agent Swarm & Neural-Genesis |
| `A` then `K` | Akasha-Omega Consciousness Studio |
| `G` then `,` | Settings & Access Control |

---

## RBAC Policy Matrix

| Role ID | Role Name | View Logs & Traces | Manage Infrastructure & Swarm | Trigger Break-Glass / Akasha Converge |
| :--- | :--- | :---: | :---: | :---: |
| `role-viewer` | Read-Only Auditor | Yes | No | No |
| `role-sre` | Site Reliability Engineer | Yes | Yes | Scoped (`POST /akasha/converge`) |
| `role-secops` | Security & Compliance Admin | Yes | Policy & SIEM | Audit & Attestation |
| `role-admin` | Platform Administrator | Yes | Yes | Full (`canTriggerBreakGlass: true`) |

---

## SRE Runbooks

### 1. Rate Limit Saturation (`HTTP 429 RATE_LIMIT_EXCEEDED`)
- Inspect `X-Request-ID`, `X-Tenant-ID`, `X-RateLimit-Remaining`, and `Retry-After` headers on edge responses.
- Verify upstream OTel Collector `batch` & `tail_sampling` processor settings (`deploy/otel/otel-collector-config.yaml`).
- Tune `RATE_LIMIT_BURST` (default `240`) and `RATE_LIMIT_RPS` (default `60`) via Helm values or environment variables.

### 2. Primary Snapshot Corruption Recovery
- On boot, `AtomicStateStore` verifies SHA-256 checksums for `akasha-omega-state.json`, `audit-log-chain.json`, `rbac-policies.json`, and `recent-telemetry.json`.
- If a primary snapshot fails checksum validation, the store automatically walks the append-only `.wal.jsonl` journal backward to recover the latest valid state envelope with zero manual intervention.

### 3. Readiness Probe Failure (`HTTP 503 /readyz`)
- Query `/readyz` JSON payload to inspect `freeMemoryPct` (threshold `> 5%`), `components.otlpIngestion`, `components.statePersistence`, and `components.akashaConvergence`.
- Check HPA scaling events and memory limits in Kubernetes (`deploy/helm/neon-chasm/values.yaml`).
