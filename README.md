# The Neon Chasm — API Monitoring & Telemetry Dashboard

**The Neon Chasm** is an interactive Next.js 15 App Router observability dashboard for API endpoint monitoring, rolling latency/error analytics, request logs, and anomaly triage—paired with hardened multi-tenant authentication (`/login`) and OTLP ingestion routes (`/api/v1/*`).

---

## Quickstart & Commands

```bash
npm install
npm run dev        # Start Next.js dev server on http://127.0.0.1:3000
npm test           # Run Vitest + React Testing Library unit & component tests
npm run lint       # Run ESLint across the repository
npm run build      # Build production Next.js standalone bundle
npm run test:security  # Run multi-tenant isolation, RBAC, key rotation & audit checks
```

Type-checking:

```bash
npx tsc --noEmit
```

---

## Dashboard Architecture & Data Layer

- **TanStack Query + Zod Validation (`src/lib/metrics.ts`, `app/providers.tsx`)**:
  - The root layout mounts a client `QueryClientProvider` configured with `retry: 1`.
  - Every query fetches from `/api/metrics` and parses the JSON response through strict **Zod** schemas (`DashboardMetricsSchema`, `StatMetricSchema`, `PerformancePointSchema`, `EndpointRowSchema`), ensuring both HTTP errors and malformed responses trigger TanStack Query's `isError` state.
  - Query flags `?simulateError=1` and `?empty=1` on any dashboard route are forwarded directly to `/api/metrics` so loading skeletons (`role="status"`), error recovery (`role="alert"` + **Retry** button), and empty states (`"No telemetry data available"`) can be verified live.
  - Whenever synthetic telemetry is active, an explicit **Demo data** badge is displayed in the header.
- **6-Section Multi-Route Navigation (`src/components/layout/AppShell.tsx`)**:
  - `Overview` (`/`)
  - `Endpoints` (`/endpoints`)
  - `Analytics` (`/analytics`)
  - `Request Logs` (`/logs`)
  - `Anomalies` (`/anomalies`)
  - `Settings` (`/settings`, including `/api/healthz` and `/api/readyz` probe panels)
  - Workspace multi-tenant authentication remains accessible at `/login`.

---

## Filtering, URL Synchronization & Trend Polarity

- **Pure Filtering & Derived Summaries (`src/lib/filterEndpoints.ts`)**:
  - `filterAndSortEndpoints(endpoints, { query, status, sort })` performs case-insensitive substring matching across `name`, `path`, and `method`, filters by `All | Healthy | Warning | Failed`, and sorts by `responseTimeMs` (`none`, `asc`, `desc`) without mutating input arrays.
  - `calculateDashboardSummary(endpoints)` derives `totalEndpoints`, `healthyCount`, `warningCount`, `failedCount`, `healthyRatePercent` (rounded to 1 decimal place), and `averageResponseTimeMs`.
- **URL Query Sync (`src/components/UrlSyncedEndpointTable.tsx`)**:
  - Search (`q`), status (`status`), and sort order (`sort`) synchronize via `useSearchParams()`, `usePathname()`, and `useRouter().replace(..., { scroll: false })` inside `<Suspense>` boundaries, sanitizing invalid query parameters and preserving unrelated flags (`simulateError`, `empty`).
- **Direction-Aware Trend Polarity (`getDeltaPresentation`)**:
  - Metrics marked `higherIsBetter: true` (throughput, uptime) render positive changes in emerald (`↑`) and negative changes in rose (`↓`).
  - Metrics marked `higherIsBetter: false` (response latency, error rate) invert color polarity so reductions (`↓`) render in emerald and increases (`↑`) render in rose; `0%` renders neutral slate (`→`).

---

## Accessibility (`a11y`) & Testing

- Semantic landmarks (`<nav aria-label="Primary navigation">`, `<main>`), `<Link>` navigation with `aria-current="page"`, visible `:focus-visible` focus rings, native `<button>` controls with `aria-pressed`, accessible notification popover (`aria-label="Notifications"`), and semantic `<table>` headers with dynamic `aria-sort="ascending" | "descending" | "none"`.
- Automated test suite (`vitest.config.ts`, `src/test/setup.ts`):
  - `src/lib/filterEndpoints.test.ts` — pure filtering, sorting, summary calculations, and URL param sanitization.
  - `src/lib/metrics.test.ts` — direction-aware polarity helper, Zod schema validation, and error handling.
  - `src/components/EndpointTable.test.tsx` — interactive React Testing Library + `userEvent` tests for search, clear, status filters, sorting, `aria-sort`, and filter reset.
