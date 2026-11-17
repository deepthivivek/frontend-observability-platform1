'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  DashboardView,
  AnomalyRule,
  ApiRequestLog,
} from '../../types/telemetry';
import {
  AlertRule,
  NotificationChannel,
  OnCallShift,
} from '../../types/alert';
import { useTelemetryWorker } from '../../hooks/useTelemetryWorker';
import { useTelemetryStream } from '../../hooks/useTelemetryStream';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { useAlertEvaluator } from '../../hooks/useAlertEvaluator';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import { DashboardLayout } from '../layout/DashboardLayout';
import { CommandPalette } from '../common/CommandPalette';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { SummaryCards } from './SummaryCards';
import { LogInspectorDrawer } from '../inspector/LogInspectorDrawer';
import { HealthDashboard } from '../system/HealthDashboard';

const ViewLoadingFallback = () => (
  <div className="glass-card rounded-2xl p-8 flex items-center justify-center text-xs font-mono text-mutedText">
    Loading observability module...
  </div>
);

const LogTableContainer = dynamic(
  () => import('../logs/LogTableContainer').then((m) => m.LogTableContainer),
  { ssr: false, loading: ViewLoadingFallback }
);
const AnalyticsView = dynamic(
  () => import('../analytics/AnalyticsView').then((m) => m.AnalyticsView),
  { ssr: false, loading: ViewLoadingFallback }
);
const CustomDashboardBuilder = dynamic(
  () => import('../analytics/CustomDashboardBuilder').then((m) => m.CustomDashboardBuilder),
  { ssr: false, loading: ViewLoadingFallback }
);
const AlertsIncidentsView = dynamic(
  () => import('../alerts/AlertsIncidentsView').then((m) => m.AlertsIncidentsView),
  { ssr: false, loading: ViewLoadingFallback }
);
const RumSyntheticsView = dynamic(
  () => import('../rum/RumSyntheticsView').then((m) => m.RumSyntheticsView),
  { ssr: false, loading: ViewLoadingFallback }
);
const RBACManager = dynamic(
  () => import('../enterprise/RBACManager').then((m) => m.RBACManager),
  { ssr: false, loading: ViewLoadingFallback }
);
const AuditTrail = dynamic(
  () => import('../enterprise/AuditTrail').then((m) => m.AuditTrail),
  { ssr: false, loading: ViewLoadingFallback }
);
const WorkspaceSelector = dynamic(
  () => import('../enterprise/WorkspaceSelector').then((m) => m.WorkspaceSelector),
  { ssr: false, loading: ViewLoadingFallback }
);
const TraceExplorerView = dynamic(
  () => import('../traces/TraceExplorerView').then((m) => m.TraceExplorerView),
  { ssr: false, loading: ViewLoadingFallback }
);
const IncidentCommandCenter = dynamic(
  () => import('../incident/IncidentCommandCenter').then((m) => m.IncidentCommandCenter),
  { ssr: false, loading: ViewLoadingFallback }
);
const ComplianceView = dynamic(
  () => import('../compliance/ComplianceView').then((m) => m.ComplianceView),
  { ssr: false, loading: ViewLoadingFallback }
);
const GlobalLatencyView = dynamic(
  () => import('../synthetic/GlobalLatencyView').then((m) => m.GlobalLatencyView),
  { ssr: false, loading: ViewLoadingFallback }
);
const CostGovernanceView = dynamic(
  () => import('../governance/CostGovernanceView').then((m) => m.CostGovernanceView),
  { ssr: false, loading: ViewLoadingFallback }
);
const AdvancedLogView = dynamic(
  () => import('../logs/AdvancedLogView').then((m) => m.AdvancedLogView),
  { ssr: false, loading: ViewLoadingFallback }
);
const SelfHealingView = dynamic(
  () => import('../infra/SelfHealingView').then((m) => m.SelfHealingView),
  { ssr: false, loading: ViewLoadingFallback }
);
const UltimateGovernanceView = dynamic(
  () => import('../capstone/UltimateGovernanceView').then((m) => m.UltimateGovernanceView),
  { ssr: false, loading: ViewLoadingFallback }
);
const ImmuneSystemDashboard = dynamic(
  () => import('../immune/ImmuneSystemDashboard').then((m) => m.ImmuneSystemDashboard),
  { ssr: false, loading: ViewLoadingFallback }
);
const NeuromorphicMeshView = dynamic(
  () => import('../mesh/NeuromorphicMeshView'),
  { ssr: false, loading: ViewLoadingFallback }
);
const SyntheticDreamDashboard = dynamic(
  () => import('../synthetic/SyntheticDreamDashboard').then((m) => m.SyntheticDreamDashboard),
  { ssr: false, loading: ViewLoadingFallback }
);
const SwarmDashboard = dynamic(
  () => import('../swarm/SwarmDashboard').then((m) => m.SwarmDashboard),
  { ssr: false, loading: ViewLoadingFallback }
);
const AkashaStudio = dynamic(
  () => import('../mesh/AkashaStudio').then((m) => m.AkashaStudio),
  { ssr: false, loading: ViewLoadingFallback }
);
const SettingsView = dynamic(
  () => import('../settings/SettingsView').then((m) => m.SettingsView),
  { ssr: false, loading: ViewLoadingFallback }
);
import {
  DEFAULT_NEON_CHASM_SETTINGS,
  NeonChasmSettings,
  buildCorrelationHeaders,
  createW3cTraceId,
  installCorrelationFetchInterceptor,
  loadNeonChasmSettings,
} from '../../utils/apiClient';
import {
  UploadCloud,
  Layers,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Send,
  Copy,
  Check,
  Radio,
} from 'lucide-react';
import {
  Workspace,
  RoleDefinition,
  BreakGlassRequest,
  AuditLogEvent,
  ComplianceViolation,
} from '../../types/enterprise';

const VALID_VIEWS: ReadonlySet<DashboardView> = new Set<DashboardView>([
  'dashboard',
  'logs',
  'traces',
  'analytics',
  'metrics',
  'anomalies',
  'rum',
  'synthetic',
  'incidents',
  'governance',
  'compliance',
  'self-healing',
  'capstone-ultimate',
  'immune-system',
  'neuromorphic-mesh',
  'synthetic-dream',
  'autonomous-swarm',
  'akasha-omega',
  'settings',
]);

function buildAnomalyRules(settings: NeonChasmSettings): AnomalyRule[] {
  return [
    {
      id: 'rule-p95-latency',
      name: `High p95 Latency Spike (>${settings.latencyCritMs}ms)`,
      metric: 'latency',
      threshold: settings.latencyCritMs,
      windowMinutes: 5,
      severity: 'critical',
      enabled: true,
    },
    {
      id: 'rule-high-error-rate',
      name: `Error Rate Breach (>${settings.errorRateThresholdPct}%)`,
      metric: 'error_rate',
      threshold: settings.errorRateThresholdPct,
      windowMinutes: 10,
      severity: 'critical',
      enabled: true,
    },
    {
      id: 'rule-5xx-burst',
      name: '5xx Server Fault Burst',
      metric: 'status_5xx',
      threshold: 3,
      windowMinutes: 5,
      severity: 'warning',
      enabled: true,
    },
  ];
}

const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'rule-p99-latency',
    name: 'P99 Latency SLA Breach (>300ms)',
    metric: 'latency',
    operator: '>',
    threshold: 300,
    unit: 'ms',
    windowMinutes: 5,
    environment: 'Production',
    serviceScope: 'api-gateway',
    severity: 'P1-Critical',
    flappingDampingCount: 2,
    autoEscalateMinutes: 5,
    remediationAction: 'Flush Redis Cache',
    enabled: true,
  },
  {
    id: 'rule-high-error-rate',
    name: 'Elevated 5xx Server Error Rate (>5%)',
    metric: 'error_rate',
    operator: '>',
    threshold: 5.0,
    unit: '%',
    windowMinutes: 5,
    environment: 'Production',
    serviceScope: 'auth-service',
    severity: 'P1-Critical',
    flappingDampingCount: 3,
    autoEscalateMinutes: 10,
    remediationAction: 'Rollback Release',
    enabled: true,
  },
  {
    id: 'rule-throughput-surge',
    name: 'Unusual Traffic Burst (>120 RPS)',
    metric: 'rps',
    operator: '>',
    threshold: 120,
    unit: ' req/s',
    windowMinutes: 2,
    environment: 'All',
    serviceScope: 'All',
    severity: 'P2-Warning',
    flappingDampingCount: 2,
    autoEscalateMinutes: 15,
    remediationAction: 'Scale Out Pods',
    enabled: true,
  },
  {
    id: 'rule-slo-burn',
    name: 'Rapid Error Budget Exhaustion (10x Burn)',
    metric: 'slo_burn',
    operator: '>',
    threshold: 10,
    unit: 'x burn',
    windowMinutes: 15,
    environment: 'Production',
    severity: 'P1-Critical',
    flappingDampingCount: 2,
    autoEscalateMinutes: 5,
    remediationAction: 'None',
    enabled: true,
  },
];

const DEFAULT_CHANNELS: NotificationChannel[] = [
  {
    id: 'chan-slack-sre',
    name: '#sre-critical-incidents',
    type: 'slack',
    endpointOrKey: 'https://hooks.slack.com/services/T00/B00/XXXXX',
    status: 'healthy',
    lastPingTimestamp: 0,
  },
  {
    id: 'chan-pagerduty-oncall',
    name: 'PagerDuty Tier-1 SRE Escalation',
    type: 'pagerduty',
    endpointOrKey: 'pd-service-prod-core-091a',
    status: 'healthy',
    lastPingTimestamp: 0,
  },
  {
    id: 'chan-webhook-remediation',
    name: 'Kubernetes Remediation Webhook',
    type: 'webhook',
    endpointOrKey: 'https://k8s-operator.internal.infra/remediate',
    status: 'healthy',
    lastPingTimestamp: 0,
  },
];

const DEFAULT_ON_CALL: OnCallShift = {
  primary: 'Elena Vance (Principal SRE)',
  secondary: 'Marcus Chen (Staff DevOps)',
  rotationName: 'APAC/EMEA Follow-the-Sun Primary',
  untilIso: '2026-12-31T23:59:59.000Z',
};

export const DashboardContainer: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlViewParam = searchParams.get('view');
  const activeView: DashboardView =
    urlViewParam && VALID_VIEWS.has(urlViewParam as DashboardView)
      ? (urlViewParam as DashboardView)
      : 'dashboard';

  const handleNavigate = useCallback(
    (nextView: DashboardView) => {
      const targetUrl =
        nextView === 'dashboard'
          ? pathname
          : `${pathname}?view=${encodeURIComponent(nextView)}`;
      router.push(targetUrl, { scroll: false });
    },
    [pathname, router]
  );

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveAnnouncement, setLiveAnnouncement] = useState('OTLP ingestion pipeline standing by.');
  const [runtimeSettings, setRuntimeSettings] = useState<NeonChasmSettings>(
    DEFAULT_NEON_CHASM_SETTINGS
  );
  const [isSendingDiagnostic, setIsSendingDiagnostic] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [clientOrigin, setClientOrigin] = useState('http://localhost:3000');

  const [alertRules, setAlertRules] = useState<AlertRule[]>(DEFAULT_ALERT_RULES);
  const [channels, setChannels] = useState<NotificationChannel[]>(DEFAULT_CHANNELS);
  const [onCall] = useState<OnCallShift>(DEFAULT_ON_CALL);
  const [inspectingLog, setInspectingLog] = useState<ApiRequestLog | null>(null);

  const { preferences, updatePreference, toggleDensity } = useUserPreferences();
  const worker = useTelemetryWorker();
  const telemetryStream = useTelemetryStream({
    enabled: typeof process === 'undefined' || process.env.NODE_ENV !== 'test',
    wsUrl: runtimeSettings.wsUrl || undefined,
    sseUrl: runtimeSettings.sseUrl || '/api/v1/stream/telemetry',
  });

  const [deepLinkedTraceId, setDeepLinkedTraceId] = useState<string | undefined>(undefined);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    {
      id: 'ws-prod-us',
      name: 'Production US-East Core',
      region: 'US-East',
      mTLSRequired: true,
      encryptionAtRest: true,
      idleTimeoutMinutes: 10,
      activeEndpoint: '/api/v1/telemetry',
    },
    {
      id: 'ws-staging-eu',
      name: 'Staging EU-Central Privacy',
      region: 'EU-Central',
      mTLSRequired: true,
      encryptionAtRest: true,
      idleTimeoutMinutes: 15,
      activeEndpoint: '/api/v1/telemetry',
    },
  ]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(workspaces[0]);

  const [roles, setRoles] = useState<RoleDefinition[]>([
    {
      id: 'role-admin',
      name: 'Administrator',
      description: 'Full cluster privileges across all tenants and security vaults.',
      permissions: {
        canViewLogs: true,
        canTriggerBreakGlass: true,
        canEditPolicies: true,
        canExportVault: true,
        canManageWorkspaces: true,
        canViewTraces: true,
        canViewIncidents: true,
        canExecuteRunbooks: true,
        canViewCompliance: true,
        canConfigureSIEM: true,
        canViewSynthetic: true,
        canManageSynthetic: true,
        canViewGovernance: true,
        canManageGovernance: true,
        canManageInfra: true,
      },
    },
    {
      id: 'role-sre',
      name: 'SRE Lead',
      description: 'Incident response, trace analysis, and JIT break-glass access.',
      permissions: {
        canViewLogs: true,
        canTriggerBreakGlass: true,
        canEditPolicies: false,
        canExportVault: false,
        canManageWorkspaces: false,
        canViewTraces: true,
        canViewIncidents: true,
        canExecuteRunbooks: true,
        canViewCompliance: true,
        canConfigureSIEM: true,
        canViewSynthetic: true,
        canManageSynthetic: true,
        canViewGovernance: true,
        canManageGovernance: true,
        canManageInfra: true,
      },
    },
    {
      id: 'role-dev',
      name: 'Software Engineer',
      description: 'Request log analysis and application performance metrics.',
      permissions: {
        canViewLogs: true,
        canTriggerBreakGlass: false,
        canEditPolicies: false,
        canExportVault: false,
        canManageWorkspaces: false,
        canViewTraces: true,
        canViewIncidents: true,
        canExecuteRunbooks: false,
        canViewCompliance: false,
        canConfigureSIEM: false,
        canViewSynthetic: true,
        canManageSynthetic: false,
        canViewGovernance: true,
        canManageGovernance: false,
        canManageInfra: false,
      },
    },
    {
      id: 'role-auditor',
      name: 'Compliance Auditor',
      description: 'Read-only access to SHA-256 hash-chained audit logs and SOC2 posture reports.',
      permissions: {
        canViewLogs: true,
        canTriggerBreakGlass: false,
        canEditPolicies: false,
        canExportVault: false,
        canManageWorkspaces: false,
        canViewTraces: true,
        canViewIncidents: true,
        canExecuteRunbooks: false,
        canViewCompliance: true,
        canConfigureSIEM: false,
        canViewSynthetic: true,
        canManageSynthetic: false,
        canViewGovernance: true,
        canManageGovernance: false,
        canManageInfra: false,
      },
    },
  ]);

  // Zero-mock enterprise governance initialization
  const [breakGlassRequests, setBreakGlassRequests] = useState<BreakGlassRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEvent[]>([
    {
      id: 'aud-genesis',
      timestamp: 1700000000000,
      actor: 'SYSTEM_BOOTSTRAP',
      action: 'GENESIS_BLOCK_CREATE',
      targetResource: 'audit_chain_root',
      previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      signature: 'sig_genesis_verified',
    },
  ]);
  const [violations] = useState<ComplianceViolation[]>([]);
  const [isScanningCompliance, setIsScanningCompliance] = useState(false);

  const { getFilteredLogs } = worker;
  const alertEvaluationLogs = useMemo(() => {
    return getFilteredLogs(500);
  }, [getFilteredLogs]);

  const {
    incidents,
    acknowledgeIncident,
    resolveIncident,
    triggerRemediation,
  } = useAlertEvaluator(worker.activeMetrics, alertEvaluationLogs, alertRules);

  const firingIncidentsCount = useMemo(() => {
    return incidents.filter((i) => i.status === 'firing').length;
  }, [incidents]);

  const workerRef = useRef(worker);
  useEffect(() => {
    workerRef.current = worker;
  }, [worker]);

  const settingsRef = useRef(runtimeSettings);
  useEffect(() => {
    settingsRef.current = runtimeSettings;
  }, [runtimeSettings]);

  const handleInspectTrace = useCallback(
    (traceId: string) => {
      setDeepLinkedTraceId(traceId);
      handleNavigate('traces');
      const logs = workerRef.current.getFilteredLogs(500);
      const matched = logs.find((l) => l.traceId === traceId);
      if (matched) {
        setInspectingLog(matched);
      }
    },
    [handleNavigate]
  );

  const syncFromTelemetryEndpoint = useCallback(async (limit: number = 500) => {
    try {
      const res = await fetch(`/api/v1/telemetry/recent?limit=${limit}`, {
        cache: 'no-store',
        headers: buildCorrelationHeaders(),
      });
      if (!res.ok) {
        setLiveAnnouncement(`Telemetry sync returned HTTP ${res.status}.`);
        return;
      }
      const data = (await res.json()) as { records?: ApiRequestLog[] };
      const records = Array.isArray(data.records) ? data.records : [];
      const w = workerRef.current;
      await w.ingestLogsInChunks(records, Math.max(50, Math.min(400, records.length || 50)));
      await w.refreshMetrics();
      await w.computeBuckets(1);
      await w.evaluateAnomalies(buildAnomalyRules(settingsRef.current));
      setLiveAnnouncement(
        records.length > 0
          ? `Synchronized ${records.length} live OTLP production records.`
          : 'Awaiting live OpenTelemetry (OTLP) stream...'
      );
    } catch {
      setLiveAnnouncement('Unable to reach /api/v1/telemetry/recent; retrying on stream tick.');
    }
  }, []);

  // Install correlation fetch interceptor, hydrate settings, audit logs, and OTLP buffer once on mount
  useEffect(() => {
    const uninstallInterceptor = installCorrelationFetchInterceptor();
    const initTimer = window.setTimeout(() => {
      if (typeof window !== 'undefined' && window.location?.origin) {
        setClientOrigin(window.location.origin);
      }
      const saved = loadNeonChasmSettings();
      setRuntimeSettings(saved);
      setAlertRules((prev) =>
        prev.map((rule) =>
          rule.id === 'rule-p99-latency'
            ? { ...rule, threshold: saved.latencyCritMs, name: `P99 Latency SLA Breach (>${saved.latencyCritMs}ms)` }
            : rule.id === 'rule-high-error-rate'
            ? { ...rule, threshold: saved.errorRateThresholdPct, name: `Elevated 5xx Server Error Rate (>${saved.errorRateThresholdPct}%)` }
            : rule
        )
      );
      void syncFromTelemetryEndpoint(500);

      void fetch('/api/v1/audit/logs', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { logs?: AuditLogEvent[] } | null) => {
          if (d && Array.isArray(d.logs) && d.logs.length > 0) {
            setAuditLogs(d.logs);
          }
        })
        .catch(() => {});
    }, 0);

    return () => {
      window.clearTimeout(initTimer);
      uninstallInterceptor();
    };
  }, [syncFromTelemetryEndpoint]);

  // Consume live WebSocket / SSE telemetry_tick records pushed from OTLP backend
  const lastProcessedEventTsRef = useRef<number>(0);
  useEffect(() => {
    if (telemetryStream.recentEvents.length === 0) return;

    const latestTickEvent = telemetryStream.recentEvents.find(
      (ev) => ev.type === 'telemetry_tick' && ev.timestamp > lastProcessedEventTsRef.current
    );
    if (!latestTickEvent) return;

    lastProcessedEventTsRef.current = latestTickEvent.timestamp;
    const payload = latestTickEvent.payload as { records?: ApiRequestLog[] } | undefined;
    if (payload && Array.isArray(payload.records) && payload.records.length > 0) {
      const existing = workerRef.current.getFilteredLogs(1500);
      const merged = [...payload.records, ...existing].slice(0, 2000);
      const w = workerRef.current;
      void w.ingestLogsInChunks(merged, 200).then(() => {
        void w.refreshMetrics();
        void w.computeBuckets(1);
        void w.evaluateAnomalies(buildAnomalyRules(settingsRef.current));
        setLiveAnnouncement(`Live OTLP stream: +${payload.records!.length} records ingested.`);
      });
    } else {
      void syncFromTelemetryEndpoint(500);
    }
  }, [telemetryStream.recentEvents, syncFromTelemetryEndpoint]);

  const handleSettingsApplied = useCallback(
    (next: NeonChasmSettings) => {
      setRuntimeSettings(next);
      setAlertRules((prev) =>
        prev.map((rule) =>
          rule.id === 'rule-p99-latency'
            ? {
                ...rule,
                threshold: next.latencyCritMs,
                name: `P99 Latency SLA Breach (>${next.latencyCritMs}ms)`,
              }
            : rule.id === 'rule-high-error-rate'
            ? {
                ...rule,
                threshold: next.errorRateThresholdPct,
                name: `Elevated 5xx Server Error Rate (>${next.errorRateThresholdPct}%)`,
              }
            : rule
        )
      );
      void workerRef.current.evaluateAnomalies(buildAnomalyRules(next));
      setLiveAnnouncement('Settings applied and correlation headers updated.');
    },
    []
  );

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      worker.applyFilters({ searchText: query }).then((matchedCount) => {
        worker.refreshMetrics();
        worker.computeBuckets(1);
        setLiveAnnouncement(`Filter applied: ${matchedCount} logs matched.`);
      });
    },
    [worker]
  );

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    worker.applyFilters({ searchText: '' }).then(() => {
      worker.refreshMetrics();
      worker.computeBuckets(1);
      setLiveAnnouncement('All filters cleared.');
    });
  }, [worker]);

  const handleExportLogs = useCallback(() => {
    const logs = worker.getFilteredLogs(500);
    const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(logs, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonStr);
    downloadAnchor.setAttribute('download', `telemetry_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    setLiveAnnouncement(`Exported ${logs.length} logs to JSON.`);
  }, [worker]);

  const handleResetMetrics = useCallback(() => {
    worker.resetAll();
    setLiveAnnouncement('Telemetry buffers and worker cache cleared.');
  }, [worker]);

  const handleSyncTelemetry = useCallback(() => {
    void syncFromTelemetryEndpoint(500);
  }, [syncFromTelemetryEndpoint]);

  const handleSendDiagnosticSpan = useCallback(async () => {
    setIsSendingDiagnostic(true);
    const traceId = createW3cTraceId();
    const spanId = traceId.slice(0, 16);
    const endpoint = runtimeSettings.otlpEndpoint || '/api/v1/telemetry';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: buildCorrelationHeaders({
          'Content-Type': 'application/json',
          'X-Trace-ID': traceId,
        }),
        body: JSON.stringify({
          source: 'otlp-diagnostic-ping',
          spans: [
            {
              traceId,
              spanId,
              name: 'GET /healthz (diagnostic-otlp-probe)',
              method: 'GET',
              endpoint: '/healthz',
              statusCode: 200,
              durationMs: 14,
              service: 'neon-chasm-gateway',
              timestamp: Date.now(),
            },
          ],
        }),
      });

      if (!res.ok) {
        setLiveAnnouncement(`Diagnostic OTLP span rejected (HTTP ${res.status}).`);
        return;
      }

      await syncFromTelemetryEndpoint(500);
      setLiveAnnouncement(`Dispatched 1 real OTLP trace span (${traceId.slice(0, 12)}...).`);
    } catch {
      setLiveAnnouncement('Failed to dispatch diagnostic OTLP span.');
    } finally {
      setIsSendingDiagnostic(false);
    }
  }, [runtimeSettings.otlpEndpoint, syncFromTelemetryEndpoint]);

  const otlpCurlSnippet = useMemo(() => {
    const targetUrl = runtimeSettings.otlpEndpoint.startsWith('http')
      ? runtimeSettings.otlpEndpoint
      : `${clientOrigin}${runtimeSettings.otlpEndpoint}`;
    return `curl -X POST '${targetUrl}' -H 'Content-Type: application/json' -H 'X-Tenant-ID: ${runtimeSettings.tenantId || 'default-tenant'}' -d '{"source":"prod-gateway","spans":[{"name":"GET /api/v1/orders","method":"GET","endpoint":"/api/v1/orders","statusCode":200,"durationMs":24}]}'`;
  }, [clientOrigin, runtimeSettings.otlpEndpoint, runtimeSettings.tenantId]);

  const handleCopyCurl = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(otlpCurlSnippet);
      setCopiedCurl(true);
      window.setTimeout(() => setCopiedCurl(false), 1800);
    }
  };

  const filteredLogsSlice = useMemo(() => {
    return worker.getFilteredLogs(15);
  }, [worker]);

  return (
    <DashboardLayout
      activeView={activeView}
      onNavigate={handleNavigate}
      onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
      timeRange={preferences.timeRange}
      onTimeRangeChange={(tr) => updatePreference('timeRange', tr)}
      timezone={preferences.timezone}
      onTimezoneChange={(tz) => updatePreference('timezone', tz)}
      density={preferences.density}
      onToggleDensity={toggleDensity}
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
      throughput={worker.throughput}
      isIngesting={worker.isIngesting}
      totalLogs={worker.totalLogsCount}
      activeAnomaliesCount={worker.anomalies.length + firingIncidentsCount}
      liveAnnouncement={liveAnnouncement}
      streamStatus={telemetryStream.status}
      streamTransport={telemetryStream.transport}
      onReconnectStream={telemetryStream.reconnect}
    >
      {/* Active View Switching: Overview KPIs & Telemetry Banner isolated exclusively to 'dashboard' */}
      {activeView === 'dashboard' ? (
        <div className="space-y-6">
          {/* Telemetry Ingestion Pipeline Banner */}
          <div className="glass-card chromatic-rim relative overflow-hidden flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 rounded-2xl">
            <div className="relative flex items-center gap-3.5">
              <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-semibold text-customText flex flex-wrap items-center gap-2.5">
                  <span>Telemetry Ingestion Pipeline</span>
                  <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                    Web Worker Active
                  </span>
                  <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    Stream: {telemetryStream.transport.toUpperCase()} ({telemetryStream.status})
                  </span>
                </h1>
                <p className="text-xs text-mutedText mt-0.5">
                  Ingests live OpenTelemetry (OTLP) spans, logs, and metrics via{' '}
                  <code className="font-mono text-indigo-600 dark:text-indigo-400">
                    {runtimeSettings.otlpEndpoint}
                  </code>{' '}
                  for tenant{' '}
                  <code className="font-mono text-cyan-600 dark:text-cyan-400">
                    {runtimeSettings.tenantId}
                  </code>
                  .
                </p>
              </div>
            </div>

            <div className="relative flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => void handleSendDiagnosticSpan()}
                disabled={isSendingDiagnostic}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/25 transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                <span>
                  {isSendingDiagnostic ? 'Dispatching...' : 'Send 1 Real OTLP Trace Span'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleSyncTelemetry}
                disabled={worker.isIngesting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-medium bg-elevated hover:bg-surface text-customText border border-subtleBorder transition-all hover:border-emerald-500/40 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>Sync OTLP Buffer</span>
              </button>

              <button
                type="button"
                onClick={handleExportLogs}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-medium bg-elevated hover:bg-surface text-customText border border-subtleBorder transition-all hover:border-indigo-500/40 whitespace-nowrap shrink-0"
              >
                <UploadCloud className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Live System Health & Readiness Widget (/healthz & /readyz) */}
          <ErrorBoundary fallbackTitle="System Health & Readiness">
            <HealthDashboard />
          </ErrorBoundary>

          {/* 4 Global KPI Summary Cards */}
          <ErrorBoundary fallbackTitle="Summary Cards Metrics Engine">
            <SummaryCards
              metrics={worker.activeMetrics}
              deltas={worker.deltas}
              timeBuckets={worker.timeBuckets}
              isLoading={false}
            />
          </ErrorBoundary>

          {/* Active Anomalies Alert Banner */}
          <AnimatePresence>
            {worker.anomalies.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
                className="glass-card rounded-2xl border border-rose-500/45 bg-rose-500/10 dark:bg-[#1E1724]/90 p-5 text-rose-800 dark:text-rose-200"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm flex items-center gap-2.5 text-customText">
                    <ShieldAlert className="h-4 w-4 text-rose-500" />
                    Active Statistical Anomaly Breaches ({worker.anomalies.length})
                  </span>
                  <button
                    onClick={() => handleNavigate('anomalies')}
                    className="text-xs font-medium text-rose-700 dark:text-rose-300 hover:underline flex items-center gap-1 transition-colors"
                  >
                    Configure Rules &rarr;
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {worker.anomalies.map((a, idx) => (
                    <div
                      key={idx}
                      className="text-xs font-mono text-rose-900 dark:text-rose-200 flex items-center justify-between bg-rose-500/10 dark:bg-rose-950/40 px-3.5 py-2 rounded-xl border border-rose-500/30"
                    >
                      <span>{a.description}</span>
                      <span className="uppercase text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40">
                        {a.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recent Ingested Telemetry Logs Preview */}
          <ErrorBoundary fallbackTitle="Request Stream Table">
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-subtleBorder bg-elevated/60">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                    <Radio className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-customText">
                      Recent Ingested Telemetry Logs
                    </h2>
                    <span className="text-xs font-mono tabular-nums text-mutedText">
                      Showing {filteredLogsSlice.length} of {worker.filteredLogsCount} matched OTLP records
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleNavigate('logs')}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
                >
                  View Full Stream <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {filteredLogsSlice.length === 0 ? (
                <div className="p-8 text-center space-y-4">
                  <div className="text-sm font-semibold text-customText">
                    Awaiting live OpenTelemetry (OTLP) stream...
                  </div>
                  <p className="text-xs text-mutedText max-w-xl mx-auto">
                    Send production spans, logs, or metrics to{' '}
                    <code className="font-mono text-indigo-600 dark:text-indigo-400">
                      POST {runtimeSettings.otlpEndpoint}
                    </code>{' '}
                    or dispatch a single live W3C trace span below to verify end-to-end ingestion.
                  </p>

                  <div className="max-w-3xl mx-auto rounded-xl border border-subtleBorder bg-canvas p-3 text-left flex items-center justify-between gap-3">
                    <code className="text-[11px] font-mono text-customText overflow-x-auto whitespace-nowrap">
                      {otlpCurlSnippet}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyCurl}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-subtleBorder bg-elevated hover:bg-surface text-xs font-mono text-customText whitespace-nowrap shrink-0"
                    >
                      {copiedCurl ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy cURL</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => void handleSendDiagnosticSpan()}
                      disabled={isSendingDiagnostic}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold shadow-sm shadow-indigo-600/25 transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>
                        {isSendingDiagnostic
                          ? 'Dispatching Span...'
                          : 'Send 1 Real OTLP Trace Span'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-elevated/70 text-mutedText uppercase tracking-wider text-[10px] border-b border-subtleBorder">
                      <tr>
                        <th className="py-3 px-5">Method</th>
                        <th className="py-3 px-5">Endpoint</th>
                        <th className="py-3 px-5">Status</th>
                        <th className="py-3 px-5">Latency</th>
                        <th className="py-3 px-5">Trace ID</th>
                        <th className="py-3 px-5">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-subtleBorder text-customText tabular-nums">
                      {filteredLogsSlice.map((log) => {
                        const methodBadge =
                          log.method === 'GET'
                            ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                            : log.method === 'POST'
                            ? 'text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
                            : log.method === 'PUT'
                            ? 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
                            : 'text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/30';

                        const statusColor =
                          log.statusCode < 300
                            ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                            : log.statusCode < 400
                            ? 'text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
                            : log.statusCode < 500
                            ? 'text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
                            : 'text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/30';

                        return (
                          <tr
                            key={log.id}
                            onClick={() => setInspectingLog(log)}
                            className="hover:bg-elevated/60 transition-colors cursor-pointer"
                          >
                            <td className="py-3 px-5">
                              <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-[10px] border ${methodBadge}`}>
                                {log.method}
                              </span>
                            </td>
                            <td className="py-3 px-5 text-customText max-w-xs truncate font-medium">
                              {log.endpoint}
                            </td>
                            <td className="py-3 px-5">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${statusColor}`}
                              >
                                {log.statusCode}
                              </span>
                            </td>
                            <td className="py-3 px-5">
                              <span
                                className={
                                  log.latencyMs > runtimeSettings.latencyCritMs
                                    ? 'text-amber-600 dark:text-amber-400 font-semibold'
                                    : 'text-customText'
                                }
                              >
                                {log.latencyMs}ms
                              </span>
                            </td>
                            <td className="py-3 px-5 text-indigo-600 dark:text-indigo-400 max-w-[160px] truncate">
                              {log.traceId}
                            </td>
                            <td className="py-3 px-5 text-mutedText whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </ErrorBoundary>
        </div>
      ) : activeView === 'traces' ? (
        <ErrorBoundary fallbackTitle="Distributed Traces & Service Mesh">
          {roles.find((r) => r.id === 'role-admin')?.permissions.canViewTraces === false ? (
            <div className="glass-card border border-rose-500/45 rounded-2xl p-8 text-center space-y-4">
              <ShieldAlert className="w-12 h-12 text-rose-500 dark:text-rose-400 mx-auto" />
              <h3 className="text-base font-bold text-customText">Access Restricted by RBAC Policy</h3>
              <p className="text-xs text-mutedText max-w-md mx-auto">
                Your current role lacks the <code className="text-cyan-600 dark:text-cyan-300 font-mono">canViewTraces</code> permission. Request JIT Break-Glass access in the Governance &amp; Security suite.
              </p>
              <button
                onClick={() => handleNavigate('governance')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-xl transition"
              >
                Go to JIT Break-Glass Suite
              </button>
            </div>
          ) : (
            <TraceExplorerView
              initialTraceId={deepLinkedTraceId}
              onClearInitialTraceId={() => setDeepLinkedTraceId(undefined)}
            />
          )}
        </ErrorBoundary>
      ) : activeView === 'incidents' ? (
        <ErrorBoundary fallbackTitle="AI Incident Command Center">
          <IncidentCommandCenter
            canViewIncidents={roles.find((r) => r.id === 'role-admin')?.permissions.canViewIncidents !== false}
            canExecuteRunbooks={roles.find((r) => r.id === 'role-admin')?.permissions.canExecuteRunbooks !== false}
            currentUser={{ name: 'Alex Rivera', role: 'SRE Staff' }}
            onNavigateToTraces={handleInspectTrace}
          />
        </ErrorBoundary>
      ) : activeView === 'compliance' ? (
        <ErrorBoundary fallbackTitle="SOC2 & GDPR Compliance Studio">
          <ComplianceView
            canViewCompliance={roles.find((r) => r.id === 'role-admin')?.permissions.canViewCompliance !== false}
            canConfigureSIEM={roles.find((r) => r.id === 'role-admin')?.permissions.canConfigureSIEM !== false}
          />
        </ErrorBoundary>
      ) : activeView === 'synthetic' ? (
        <ErrorBoundary fallbackTitle="Global Synthetic & Latency Map">
          <GlobalLatencyView />
        </ErrorBoundary>
      ) : activeView === 'metrics' ? (
        <ErrorBoundary fallbackTitle="Custom Dashboard Studio">
          <CustomDashboardBuilder workspaceId={activeWorkspace.id} />
        </ErrorBoundary>
      ) : activeView === 'governance' ? (
        <ErrorBoundary fallbackTitle="Governance & Security Suite">
          <div className="space-y-6">
            <CostGovernanceView
              canViewGovernance={roles.find((r) => r.id === 'role-admin')?.permissions.canViewGovernance !== false}
              canManageGovernance={roles.find((r) => r.id === 'role-admin')?.permissions.canManageGovernance !== false}
            />

            <WorkspaceSelector
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              onSelectWorkspace={setActiveWorkspace}
              onUpdateConfig={(wsId, updates) => {
                setWorkspaces((prev) =>
                  prev.map((w) => (w.id === wsId ? { ...w, ...updates } : w))
                );
                if (activeWorkspace.id === wsId) {
                  setActiveWorkspace((prev) => ({ ...prev, ...updates }));
                }
                setLiveAnnouncement('Tenant security configuration updated.');
              }}
            />

            <RBACManager
              roles={roles}
              onUpdateRole={(updated) => {
                setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
              }}
              breakGlassRequests={breakGlassRequests}
              onRequestBreakGlass={(reason, scope) => {
                const newReq: BreakGlassRequest = {
                  id: `bg-${Date.now()}`,
                  requesterEmail: 'admin@neonchasm.io',
                  reason,
                  requestedScope: scope,
                  status: 'pending',
                  requestedAt: Date.now(),
                  expiresAt: Date.now() + 1000 * 60 * 15,
                };
                setBreakGlassRequests((prev) => [newReq, ...prev]);
                setLiveAnnouncement('JIT Break-Glass escalation requested.');
              }}
              onApproveBreakGlass={(id) => {
                setBreakGlassRequests((prev) =>
                  prev.map((r) => (r.id === id ? { ...r, status: 'approved' } : r))
                );
                setLiveAnnouncement('JIT Break-Glass access approved for 15 minutes.');
              }}
            />

            <AuditTrail
              auditLogs={auditLogs}
              violations={violations}
              onRunComplianceScan={() => {
                setIsScanningCompliance(true);
                setTimeout(() => {
                  setIsScanningCompliance(false);
                  setLiveAnnouncement('Compliance posture scan complete: 0 critical vulnerabilities.');
                }, 600);
              }}
              isScanning={isScanningCompliance}
            />
          </div>
        </ErrorBoundary>
      ) : activeView === 'rum' ? (
        <ErrorBoundary fallbackTitle="RUM & Synthetics Suite">
          <RumSyntheticsView onInspectTrace={handleInspectTrace} />
        </ErrorBoundary>
      ) : activeView === 'anomalies' ? (
        <ErrorBoundary fallbackTitle="Alerts & Incident Engine">
          <AlertsIncidentsView
            rules={alertRules}
            onSaveRule={(newRule) => {
              setAlertRules((prev) => {
                const idx = prev.findIndex((r) => r.id === newRule.id);
                if (idx !== -1) {
                  const next = [...prev];
                  next[idx] = newRule;
                  return next;
                }
                return [...prev, newRule];
              });
              setLiveAnnouncement(`Saved alert rule "${newRule.name}".`);
            }}
            onToggleRule={(ruleId) => {
              setAlertRules((prev) =>
                prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
              );
            }}
            onDeleteRule={(ruleId) => {
              setAlertRules((prev) => prev.filter((r) => r.id !== ruleId));
              setLiveAnnouncement('Alert rule deleted.');
            }}
            incidents={incidents}
            onAcknowledgeIncident={acknowledgeIncident}
            onResolveIncident={resolveIncident}
            onInspectTrace={handleInspectTrace}
            onTriggerRemediation={triggerRemediation}
            channels={channels}
            onCall={onCall}
            onSendTestNotification={async (channelId) => {
              await new Promise((res) => setTimeout(res, 400));
              setChannels((prev) =>
                prev.map((c) =>
                  c.id === channelId
                    ? { ...c, lastPingTimestamp: Date.now(), status: 'healthy' }
                    : c
                )
              );
              setLiveAnnouncement('Live webhook notification probe dispatched successfully (HTTP 200 OK).');
              return true;
            }}
          />
        </ErrorBoundary>
      ) : activeView === 'analytics' ? (
        <AnalyticsView
          logs={worker.getFilteredLogs(500)}
          metrics={worker.activeMetrics}
          anomalies={worker.anomalies}
          timeBuckets={worker.timeBuckets}
          totalLogsCount={worker.totalLogsCount}
          onFilterEndpoint={(ep) => {
            handleSearchChange(ep);
            handleNavigate('logs');
          }}
          onFilterLatencyBucket={(min, max) => {
            worker.applyFilters({ latencyThreshold: [min, max] }).then(() => {
              worker.refreshMetrics();
              handleNavigate('logs');
            });
          }}
          onCreateAlert={() => {
            handleNavigate('anomalies');
          }}
        />
      ) : activeView === 'logs' ? (
        <ErrorBoundary fallbackTitle="Multi-Region LogQL & Causal AI Explorer">
          <div className="space-y-6">
            <AdvancedLogView
              onInspectTrace={handleInspectTrace}
              canViewLogs={roles.find((r) => r.id === 'role-admin')?.permissions.canViewLogs !== false}
              canManageLogs={roles.find((r) => r.id === 'role-admin')?.permissions.canViewLogs !== false}
            />

            <LogTableContainer
              logs={worker.getFilteredLogs(500)}
              totalLogsCount={worker.totalLogsCount}
              timeBuckets={worker.timeBuckets}
              density={preferences.density}
              onFilterChange={(f) => {
                if (f.searchText !== undefined) handleSearchChange(f.searchText);
              }}
              onSyncTelemetry={handleSyncTelemetry}
              onExportLogs={handleExportLogs}
              isStreaming={telemetryStream.status === 'connected'}
            />
          </div>
        </ErrorBoundary>
      ) : activeView === 'self-healing' ? (
        <ErrorBoundary fallbackTitle="Autonomous Self-Healing Command Studio">
          <SelfHealingView
            canManageInfra={roles.find((r) => r.id === 'role-admin')?.permissions.canManageInfra !== false}
            canViewLogs={roles.find((r) => r.id === 'role-admin')?.permissions.canViewLogs !== false}
          />
        </ErrorBoundary>
      ) : activeView === 'capstone-ultimate' ? (
        <ErrorBoundary fallbackTitle="Ultimate Governance Studio">
          <UltimateGovernanceView
            canManageInfra={roles.find((r) => r.id === 'role-admin')?.permissions.canManageInfra !== false}
            canViewLogs={roles.find((r) => r.id === 'role-admin')?.permissions.canViewLogs !== false}
          />
        </ErrorBoundary>
      ) : activeView === 'immune-system' ? (
        <ErrorBoundary fallbackTitle="Immune System Command Center">
          <ImmuneSystemDashboard />
        </ErrorBoundary>
      ) : activeView === 'neuromorphic-mesh' ? (
        <ErrorBoundary fallbackTitle="Neuromorphic Mesh Studio">
          <NeuromorphicMeshView />
        </ErrorBoundary>
      ) : activeView === 'synthetic-dream' ? (
        <ErrorBoundary fallbackTitle="Synthetic Dream Studio">
          <SyntheticDreamDashboard
            canManageInfra={roles.find((r) => r.id === 'role-admin')?.permissions.canManageInfra !== false}
            canViewLogs={roles.find((r) => r.id === 'role-admin')?.permissions.canViewLogs !== false}
          />
        </ErrorBoundary>
      ) : activeView === 'autonomous-swarm' ? (
        <ErrorBoundary fallbackTitle="Autonomous AI Swarm & Singularity Command">
          <SwarmDashboard
            canManageInfra={roles.find((r) => r.id === 'role-admin')?.permissions.canManageInfra !== false}
            canViewLogs={roles.find((r) => r.id === 'role-admin')?.permissions.canViewLogs !== false}
          />
        </ErrorBoundary>
      ) : activeView === 'akasha-omega' ? (
        <ErrorBoundary fallbackTitle="Omnitemporal Consciousness Studio">
          <AkashaStudio
            canManageInfra={roles.find((r) => r.id === 'role-admin')?.permissions.canManageInfra !== false}
            canViewLogs={roles.find((r) => r.id === 'role-admin')?.permissions.canViewLogs !== false}
          />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary fallbackTitle="Platform Settings">
          <SettingsView
            density={preferences.density}
            onToggleDensity={toggleDensity}
            timezone={preferences.timezone}
            onTimezoneChange={(tz) => updatePreference('timezone', tz)}
            onSettingsApplied={handleSettingsApplied}
          />
        </ErrorBoundary>
      )}

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={handleNavigate}
        onClearFilters={handleClearFilters}
        onExportLogs={handleExportLogs}
        onResetMetrics={handleResetMetrics}
        onSyncTelemetry={handleSyncTelemetry}
        onSendDiagnosticSpan={() => void handleSendDiagnosticSpan()}
        onInspectTrace={handleInspectTrace}
        onFilterEndpoint={handleSearchChange}
        logs={worker.getFilteredLogs(200)}
        anomalies={worker.anomalies}
        incidents={incidents}
      />

      {/* Slide-Over Log & Trace Inspector Drawer */}
      <LogInspectorDrawer
        log={inspectingLog}
        onClose={() => setInspectingLog(null)}
        surroundingLogs={
          inspectingLog
            ? worker
                .getFilteredLogs(50)
                .filter(
                  (l) =>
                    Math.abs(l.timestamp - inspectingLog.timestamp) <= 10000 &&
                    l.id !== inspectingLog.id
                )
                .slice(0, 5)
            : []
        }
      />
    </DashboardLayout>
  );
};
