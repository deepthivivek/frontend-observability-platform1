# The Neon Chasm — Multi-Tenant Observability & Autonomous SRE Platform

**The Neon Chasm** is a production-hardened, dual-theme full-stack observability, security, and autonomous SRE platform combining OpenTelemetry (OTLP) HTTP ingestion, WebGL/Three.js topological & omnitemporal visualizers, PromQL/LogQL query engines, tenant-scoped real-time SSE telemetry streaming, tamper-evident SHA-256 hash-chained audit logging, and the **Akasha-Omega Omnitemporal Core**.

---

## Architecture & Security Model

### Zero-Mock Clean Boot (`0` Events)
- Newly booted instances and newly created company workspaces initialize cleanly with **`0` telemetry records**.
- Data arrives strictly from real OTLP HTTP ingestion (`POST /api/v1/telemetry`), `scripts/emit-otlp.mjs`, an upstream OpenTelemetry Collector, or the opt-in **"Simulate Live Microservice Traffic"** toggle in the dashboard header (restricted to `admin` and `editor` roles).

### Multi-Tenant Authentication, MFA & Isolation
- **Strong Password Policy & Hashing**: Passwords require at least 12 characters with common/predictable pattern checks, hashed with Node `crypto.scryptSync` + per-user 16-byte random salts and verified via constant-time `crypto.timingSafeEqual`. Rotating a password revokes all other active sessions for that user. API keys (`nc_live_...`) are stored exclusively as SHA-256 hashes at rest.
- **RFC 6238 TOTP MFA & Single-Use Recovery Codes**: Native Node `crypto` TOTP enrollment supports `±1` step clock skew, replay prevention (`lastTotpStepUsed`), and 8 single-use SHA-256 hashed backup recovery codes.
- **Server-Enforced Step-Up Re-Authentication**: Destructive or high-privilege operations (API key rotation/revocation, promoting/removing an `admin`, purging tenant telemetry, disabling MFA, or deactivating a workspace) require fresh step-up verification via password or TOTP/recovery code (`403 STEP_UP_REQUIRED` until verified for the short 5-minute step-up window).
- **Session Cookies & Lifetimes**: Server-signed (`HMAC-SHA256`) `httpOnly` session cookies enforce sliding idle timeouts (`30m` default) and absolute lifetimes (`24h` default), automatically adapting to HTTPS embedded frames (`SameSite=None; Secure; Partitioned`) and local HTTP (`SameSite=Lax`). Production (`NODE_ENV=production`) requires `SESSION_SECRET` (`>= 32` chars) with no hardcoded fallback.
- **AES-256-GCM Field Encryption & Atomic Persistence**: Sensitive recoverable fields (TOTP secrets and SSRF-validated outbound webhook URLs) are encrypted at rest with `AES-256-GCM` keys derived via HKDF from `SESSION_SECRET`, persisted with `fs.fsyncSync` atomic temp writes (`0o750` directory / `0o600` file permissions).
- **RBAC Enforcement**:
  - `admin`: Full workspace governance, ingestion pause/resume kill-switch, per-tenant rate limits, member invitations, role updates (with `409 LAST_ADMIN_LOCKOUT` protection), and zero-downtime API key lifecycle management.
  - `editor`: Telemetry ingestion, live traffic simulation, dashboard presets, and SLO threshold updates.
  - `viewer`: Strictly read-only access across dashboards, logs, traces, and audit views (`403 ROLE_FORBIDDEN` on write/mutation endpoints).
- **OTLP Secret & PII Redaction + Bounded SSE**: `/api/v1/telemetry` recursively scrubs credentials, bearer tokens, API keys, cookies, and sensitive fields (`authorization`, `x-api-key`, `password`, `token`, `nc_live_...`) to `"[REDACTED]"` before storing, broadcasting, or auditing, while `/api/v1/stream/telemetry` enforces per-tenant/global subscriber caps (`429 TOO_MANY_STREAMS`) and request abort cleanup.
- **Zero-Downtime Key Rotation**: Rotating an API key preserves the previous key during a configurable grace period (default 60 minutes) before expiration, while immediate revocation invalidates the key instantly.
- **Defense-in-Depth Headers & DAL Guards**:
  - `poweredByHeader: false`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, and a WebGL/Worker/AI-Studio-compatible `Content-Security-Policy`.
  - Strict `Cache-Control: private, no-store, max-age=0` + `Vary: Cookie, Authorization, X-Tenant-ID` on authenticated endpoints.
  - Rejection of spoofed `x-middleware-subrequest` headers (`403 FORBIDDEN_INTERNAL_HEADER`), cross-tenant `X-Tenant-ID` mismatches (`403 TENANT_FORBIDDEN`), invalid CSRF `Origin` headers (`403 CSRF_FORBIDDEN`), and brute-force login attempts (`429 RATE_LIMITED` + `Retry-After`).
- **Hash-Chained Audit Trail**: Sensitive tenant actions append immutable entries linked via `SHA-256(timestamp | tenantId | actor | action | target | requestId | prevHash)` and expose live chain verification via `GET /api/v1/auth/audit`.

---

## Quickstart (Local)

```bash
cp .env.example .env
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`:
1. Register your initial company workspace (or accept a single-use invite token).
2. Create a scoped API key (`ingest:write`, `telemetry:read`) in **Settings & Access Control**.
3. Stream real OTLP payloads or toggle **Simulate Live Microservice Traffic** in the header.

### Emit Live OTLP Telemetry from CLI

```bash
node scripts/emit-otlp.mjs \
  --key nc_live_your_generated_key \
  --url http://127.0.0.1:3000/api/v1/telemetry \
  --interval 1500
```

### OpenTelemetry Collector Configuration Snippet

```yaml
exporters:
  otlphttp/neon_chasm:
    endpoint: http://127.0.0.1:3000/api/v1/telemetry
    headers:
      Authorization: "Bearer ${NEON_CHASM_API_KEY}"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/neon_chasm]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlphttp/neon_chasm]
```

---

## Verification & Quality Gates

```bash
npx tsc --noEmit        # Strict TypeScript check
npm run lint            # ESLint zero-warning check
npm run build           # Production Next.js standalone build
npm run test:security   # Automated multi-tenant isolation, RBAC, rotation & audit suite
```

---

## Docker Production Deployment

```bash
docker compose up --build
```

- Persistent workspace auth state, API key hashes, audit chains, and buffered tenant telemetry persist under `./data` mounted to `/app/data` (`DATA_DIR=/app/data`).
- Health & self-telemetry readiness endpoints:
  - `GET /healthz` — Liveness probe
  - `GET /readyz` — Readiness + platform self-telemetry (`activeSseSubscribers`, `estimatedBufferBytes`, `ingestionEventsPerSec`, `authChecksDenied`)
