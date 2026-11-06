'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  DashboardView,
  FilterState,
  AnomalyRule,
  ApiRequestLog,
} from '../../types/telemetry';
import {
  AlertRule,
  NotificationChannel,
  OnCallShift,
} from '../../types/alert';
import { useTelemetryWorker } from '../../hooks/useTelemetryWorker';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { useAlertEvaluator } from '../../hooks/useAlertEvaluator';
import { DashboardLayout } from '../layout/DashboardLayout';
import { CommandPalette } from '../common/CommandPalette';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { SummaryCards } from './SummaryCards';
import { LogTableContainer } from '../logs/LogTableContainer';
import { AnalyticsView } from '../analytics/AnalyticsView';
import { CustomDashboardBuilder } from '../analytics/CustomDashboardBuilder';
import { AlertsIncidentsView } from '../alerts/AlertsIncidentsView';
import { RumSyntheticsView } from '../rum/RumSyntheticsView';
import { RBACManager } from '../enterprise/RBACManager';
import { AuditTrail } from '../enterprise/AuditTrail';
import { WorkspaceSelector } from '../enterprise/WorkspaceSelector';
import { LogInspectorDrawer } from '../inspector/LogInspectorDrawer';
import { TraceExplorerView } from '../traces/TraceExplorerView';
import { IncidentCommandCenter } from '../incident/IncidentCommandCenter';
import { ComplianceView } from '../compliance/ComplianceView';
import { GlobalLatencyView } from '../synthetic/GlobalLatencyView';
import { CostGovernanceView } from '../governance/CostGovernanceView';
import { generateSyntheticLogs } from '../../utils/syntheticData';
import {
  UploadCloud,
  Play,
  Pause,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  BarChart3,
  FileText,
  LayoutDashboard,
  Users,
  Shield,
  Sliders,
  Globe,
} from 'lucide-react';
import { Workspace, RoleDefinition, BreakGlassRequest, AuditLogEvent, ComplianceViolation } from '../../types/enterprise';

const INITIAL_RULES: AnomalyRule[] = [
  {
    id: 'rule-p95-latency',
    name: 'High p95 Latency Spike',
    metric: 'latency',
    threshold: 300, // ms
    windowMinutes: 5,
    severity: 'critical',
    enabled: true,
  },
  {
    id: 'rule-high-error-rate',
    name: 'Error Rate Breach (>5%)',
    metric: 'error_rate',
    threshold: 5, // percent
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

const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'rule-p99-latency',
    name: 'P99 Latency SLA Breach (>250ms)',
    metric: 'latency',
    operator: '>',
    threshold: 250,
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
    name: 'Elevated 5xx Server Error Rate (>4%)',
    metric: 'error_rate',
    operator: '>',
    threshold: 4.0,
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
    lastPingTimestamp: Date.now() - 1000 * 60 * 12,
  },
  {
    id: 'chan-pagerduty-oncall',
    name: 'PagerDuty Tier-1 SRE Escalation',
    type: 'pagerduty',
    endpointOrKey: 'pd-service-prod-core-091a',
    status: 'healthy',
    lastPingTimestamp: Date.now() - 1000 * 60 * 45,
  },
  {
    id: 'chan-webhook-remediation',
    name: 'Kubernetes Remediation Webhook',
    type: 'webhook',
    endpointOrKey: 'https://k8s-operator.internal.infra/remediate',
    status: 'healthy',
    lastPingTimestamp: Date.now() - 1000 * 60 * 90,
  },
];

const DEFAULT_ON_CALL: OnCallShift = {
  primary: 'Elena Vance (Principal SRE)',
  secondary: 'Marcus Chen (Staff DevOps)',
  rotationName: 'APAC/EMEA Follow-the-Sun Primary',
  untilIso: new Date(Date.now() + 86400000 * 3).toISOString(),
};

export const DashboardContainer: React.FC = () => {
  const [activeView, setActiveView] = useState<DashboardView>('dashboard');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveAnnouncement, setLiveAnnouncement] = useState('System ready.');
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);

  // Day 7: Alerting & Incident Management States
  const [alertRules, setAlertRules] = useState<AlertRule[]>(DEFAULT_ALERT_RULES);
  const [channels, setChannels] = useState<NotificationChannel[]>(DEFAULT_CHANNELS);
  const [onCall] = useState<OnCallShift>(DEFAULT_ON_CALL);
  const [inspectingLog, setInspectingLog] = useState<ApiRequestLog | null>(null);

  const { preferences, updatePreference, toggleDensity, toggleLiveMode } = useUserPreferences();
  const worker = useTelemetryWorker();

  const [deepLinkedTraceId, setDeepLinkedTraceId] = useState<string | undefined>(undefined);

  // Day 10: Enterprise Governance, RBAC, Multi-Tenant Workspaces, and Audit Trail States
  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    {
      id: 'ws-prod-us',
      name: 'Production US-East Core',
      region: 'US-East',
      mTLSRequired: true,
      encryptionAtRest: true,
      idleTimeoutMinutes: 10,
      activeEndpoint: 'https://ingest-us.neonchasm.internal/v1/telemetry',
    },
    {
      id: 'ws-staging-eu',
      name: 'Staging EU-Central Privacy',
      region: 'EU-Central',
      mTLSRequired: true,
      encryptionAtRest: true,
      idleTimeoutMinutes: 15,
      activeEndpoint: 'https://ingest-eu.neonchasm.internal/v1/telemetry',
    },
  ]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace>(workspaces[0]);

  const [roles, setRoles] = useState<RoleDefinition[]>([
    {
      id: 'role-admin',
      name: 'Administrator',
      description: 'Full cluster privileges across all tenants and security vaults.',
      permissions: { canViewLogs: true, canTriggerBreakGlass: true, canEditPolicies: true, canExportVault: true, canManageWorkspaces: true, canViewTraces: true, canViewIncidents: true, canExecuteRunbooks: true, canViewCompliance: true, canConfigureSIEM: true, canViewSynthetic: true, canManageSynthetic: true, canViewGovernance: true, canManageGovernance: true },
    },
    {
      id: 'role-sre',
      name: 'SRE Lead',
      description: 'Incident response, trace analysis, and JIT break-glass access.',
      permissions: { canViewLogs: true, canTriggerBreakGlass: true, canEditPolicies: false, canExportVault: false, canManageWorkspaces: false, canViewTraces: true, canViewIncidents: true, canExecuteRunbooks: true, canViewCompliance: true, canConfigureSIEM: true, canViewSynthetic: true, canManageSynthetic: true, canViewGovernance: true, canManageGovernance: true },
    },
    {
      id: 'role-dev',
      name: 'Software Engineer',
      description: 'Request log analysis and application performance metrics.',
      permissions: { canViewLogs: true, canTriggerBreakGlass: false, canEditPolicies: false, canExportVault: false, canManageWorkspaces: false, canViewTraces: true, canViewIncidents: true, canExecuteRunbooks: false, canViewCompliance: false, canConfigureSIEM: false, canViewSynthetic: true, canManageSynthetic: false, canViewGovernance: true, canManageGovernance: false },
    },
    {
      id: 'role-auditor',
      name: 'Compliance Auditor',
      description: 'Read-only access to SHA-256 hash-chained audit logs and SOC2 posture reports.',
      permissions: { canViewLogs: true, canTriggerBreakGlass: false, canEditPolicies: false, canExportVault: false, canManageWorkspaces: false, canViewTraces: true, canViewIncidents: true, canExecuteRunbooks: false, canViewCompliance: true, canConfigureSIEM: false, canViewSynthetic: true, canManageSynthetic: false, canViewGovernance: true, canManageGovernance: false },
    },
  ]);

  const [breakGlassRequests, setBreakGlassRequests] = useState<BreakGlassRequest[]>(() => [
    {
      id: 'bg-991',
      requesterEmail: 'marcus.chen@neonchasm.io',
      reason: 'Incident #4491: Emergency root database dump to debug upstream gateway timeout.',
      requestedScope: 'Production DB Core Vault',
      status: 'pending',
      requestedAt: Date.now() - 480000,
      expiresAt: Date.now() + 420000,
    },
  ]);

  const [auditLogs, setAuditLogs] = useState<AuditLogEvent[]>(() => [
    {
      id: 'aud-001',
      timestamp: Date.now() - 7200000,
      actor: 'SYSTEM_BOOTSTRAP',
      action: 'GENESIS_BLOCK_CREATE',
      targetResource: 'audit_chain_root',
      previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      signature: 'sig_genesis_verified',
    },
    {
      id: 'aud-002',
      timestamp: Date.now() - 2700000,
      actor: 'elena.vance@neonchasm.io',
      action: 'POLICY_RULE_UPDATE',
      targetResource: 'pol-data-sovereignty',
      previousHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      signature: 'sig_admin_auth_991',
    },
  ]);

  const [violations, setViolations] = useState<ComplianceViolation[]>([
    {
      id: 'vio-1',
      standard: 'SOC2',
      severity: 'warning',
      title: 'Staging EU Workspace mTLS Certificate Rotation Due',
      remediation: 'Rotate client certificate bundle before 30-day expiration.',
    },
  ]);
  const [isScanningCompliance, setIsScanningCompliance] = useState(false);

  const { getFilteredLogs } = worker;
  // Memoize logs for alert evaluator
  const alertEvaluationLogs = useMemo(() => {
    return getFilteredLogs(500);
  }, [getFilteredLogs]);

  // Day 7: Real-Time Alert & Incident Evaluator
  const {
    incidents,
    setIncidents,
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

  // Deep-linking: Find log corresponding to trace ID and open Trace Waterfall & Inspector
  const handleInspectTrace = useCallback(
    (traceId: string) => {
      setDeepLinkedTraceId(traceId);
      setActiveView('traces');
      const logs = workerRef.current.getFilteredLogs(500);
      const matched = logs.find((l) => l.traceId === traceId);
      if (matched) {
        setInspectingLog(matched);
      }
    },
    []
  );

  // Ingest initial synthetic dataset strictly once on mount
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const initialDataset = generateSyntheticLogs(1200, 60);
    const w = workerRef.current;
    w.ingestLogsInChunks(initialDataset, 400).then(() => {
      w.refreshMetrics();
      w.computeBuckets(1);
      w.evaluateAnomalies(INITIAL_RULES);
      setLiveAnnouncement(`Ingested ${initialDataset.length} production telemetry records.`);
    });
  }, []);

  // Periodic live streaming simulation if live mode is toggled
  useEffect(() => {
    if (!isLiveStreaming) return;

    const interval = setInterval(() => {
      const liveChunk = generateSyntheticLogs(25, 2);
      const w = workerRef.current;
      w.ingestLogsInChunks(liveChunk, 25).then(() => {
        w.refreshMetrics();
        w.computeBuckets(1);
        w.evaluateAnomalies(INITIAL_RULES);
        setLiveAnnouncement(`Live stream: +${liveChunk.length} requests ingested.`);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isLiveStreaming]);

  // Handle global search filter propagation to worker
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

  const handleGenerateBurst = useCallback(
    (count: number = 2000) => {
      const burst = generateSyntheticLogs(count, 30);
      worker.ingestLogsInChunks(burst, 500).then(() => {
        worker.refreshMetrics();
        worker.computeBuckets(1);
        worker.evaluateAnomalies(INITIAL_RULES);
        setLiveAnnouncement(`Injected ${count} high-throughput logs.`);
      });
    },
    [worker]
  );

  const filteredLogsSlice = useMemo(() => {
    return worker.getFilteredLogs(15);
  }, [worker]);

  return (
    <DashboardLayout
      activeView={activeView}
      onNavigate={setActiveView}
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
    >
      {/* Top View Navigation Router Bar */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-2xl border border-slate-800/80 bg-[#131B2E]/90 backdrop-blur-xl font-mono text-xs shadow-md">
        <button
          onClick={() => setActiveView('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeView === 'dashboard'
              ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveView('logs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeView === 'logs'
              ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Logs &amp; Traces</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
            {worker.totalLogsCount.toLocaleString()}
          </span>
        </button>

        <button
          onClick={() => setActiveView('traces')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeView === 'traces'
              ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Layers className="h-4 w-4 text-indigo-400" />
          <span>Distributed Traces</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
            Mesh
          </span>
        </button>

        <button
          onClick={() => setActiveView('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeView === 'analytics'
              ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <BarChart3 className="h-4 w-4 text-emerald-400" />
          <span>Analytics &amp; Latency</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            Deep
          </span>
        </button>

        <button
          onClick={() => setActiveView('anomalies')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeView === 'anomalies'
              ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <ShieldAlert className="h-4 w-4 text-rose-400" />
          <span>Alerts &amp; Incidents</span>
          {firingIncidentsCount > 0 ? (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold animate-pulse">
              {firingIncidentsCount} Firing
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
              {alertRules.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveView('metrics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeView === 'metrics'
              ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Sliders className="h-4 w-4 text-cyan-400" />
          <span>Metrics &amp; Studio</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
            PromQL
          </span>
        </button>

        <button
          onClick={() => setActiveView('synthetic')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeView === 'synthetic'
              ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Globe className="h-4 w-4 text-sky-400" />
          <span>Global Synthetic</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/30">
            SLO
          </span>
        </button>

        <button
          onClick={() => setActiveView('governance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeView === 'governance'
              ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          <Shield className="h-4 w-4 text-cyan-400" />
          <span>Governance &amp; Security</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
            RBAC
          </span>
        </button>
      </div>

      {/* Top Banner / Ingestion Control Bar in Deep Ocean Container */}
      <div className="relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-800/80 bg-[#131B2E]/70 backdrop-blur-xl shadow-lg">
        {/* Subtle Ambient Radial Highlight */}
        <div className="absolute top-0 left-0 -ml-12 -mt-12 h-36 w-36 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2.5">
              Telemetry Ingestion Pipeline
              <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.15)]">
                Web Worker Active
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Processing in background worker thread with index-based filtering & percentile sorting.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="relative flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-medium border transition-all ${
              isLiveStreaming
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25 shadow-[0_0_15px_rgba(244,63,94,0.18)]'
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
            }`}
          >
            {isLiveStreaming ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isLiveStreaming ? 'Pause Live Stream' : 'Start Live Stream'}
          </button>

          <button
            onClick={() => handleGenerateBurst(2000)}
            disabled={worker.isIngesting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-medium bg-[#1E293B] hover:bg-slate-700/60 text-slate-200 border border-slate-700/70 transition-all hover:border-amber-500/40 hover:shadow-[0_0_12px_rgba(245,158,11,0.15)] disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            Inject +2k Burst
          </button>

          <button
            onClick={handleExportLogs}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-medium bg-[#1E293B] hover:bg-slate-700/60 text-slate-200 border border-slate-700/70 transition-all hover:border-indigo-500/40 hover:shadow-[0_0_12px_rgba(99,102,241,0.15)]"
          >
            <UploadCloud className="h-3.5 w-3.5 text-indigo-400" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards with Neon Sparklines & Gradients */}
      <ErrorBoundary fallbackTitle="Summary Cards Metrics Engine">
        <SummaryCards
          metrics={worker.activeMetrics}
          deltas={worker.deltas}
          timeBuckets={worker.timeBuckets}
          isLoading={worker.isIngesting && !worker.activeMetrics}
        />
      </ErrorBoundary>

      {/* Active Anomalies Alert Banner with Crimson Glow if Breached */}
      {worker.anomalies.length > 0 && (
        <div className="rounded-2xl border border-rose-500/50 bg-[#1E1724]/90 p-5 text-rose-200 backdrop-blur-xl shadow-[0_0_25px_rgba(244,63,94,0.18)]">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm flex items-center gap-2.5 text-white">
              <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-ping" />
              Active Statistical Anomaly Breaches ({worker.anomalies.length})
            </span>
            <button
              onClick={() => setActiveView('anomalies')}
              className="text-xs font-medium text-rose-300 hover:text-white flex items-center gap-1 transition-colors"
            >
              Configure Rules &rarr;
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {worker.anomalies.map((a, idx) => (
              <div
                key={idx}
                className="text-xs font-mono text-rose-200 flex items-center justify-between bg-rose-950/40 px-3.5 py-2 rounded-xl border border-rose-500/30"
              >
                <span>{a.description}</span>
                <span className="uppercase text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {a.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active View Switching: Traces, Metrics Studio, Governance, RUM, Anomalies, Analytics, Logs Explorer, or Overview Dashboard */}
      {activeView === 'traces' ? (
        <ErrorBoundary fallbackTitle="Distributed Traces & Service Mesh">
          {roles.find((r) => r.id === 'role-admin')?.permissions.canViewTraces === false ? (
            <div className="bg-[#1E1724]/90 border border-rose-500/50 rounded-2xl p-8 text-center space-y-4 shadow-[0_0_25px_rgba(244,63,94,0.18)]">
              <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
              <h3 className="text-base font-bold text-white">Access Restricted by RBAC Policy</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Your current role lacks the <code className="text-cyan-300 font-mono">canViewTraces</code> permission. Request JIT Break-Glass access in the Governance &amp; Security suite.
              </p>
              <button
                onClick={() => setActiveView('governance')}
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
            onNavigateToTraces={(traceId) => {
              setDeepLinkedTraceId(traceId);
              setActiveView('traces');
            }}
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
                }, 800);
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
              await new Promise((res) => setTimeout(res, 500));
              setChannels((prev) =>
                prev.map((c) =>
                  c.id === channelId
                    ? { ...c, lastPingTimestamp: Date.now(), status: 'healthy' }
                    : c
                )
              );
              setLiveAnnouncement('Synthetic canary probe dispatched successfully (HTTP 200 OK).');
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
            setActiveView('logs');
          }}
          onFilterLatencyBucket={(min, max) => {
            worker.applyFilters({ latencyThreshold: [min, max] }).then(() => {
              worker.refreshMetrics();
              setActiveView('logs');
            });
          }}
          onCreateAlert={() => {
            setActiveView('anomalies');
          }}
        />
      ) : activeView === 'logs' ? (
        <ErrorBoundary fallbackTitle="Request Log Data Grid">
          <LogTableContainer
            logs={worker.getFilteredLogs(500)}
            totalLogsCount={worker.totalLogsCount}
            timeBuckets={worker.timeBuckets}
            density={preferences.density}
            onFilterChange={(f) => {
              if (f.searchText !== undefined) handleSearchChange(f.searchText);
            }}
            onInjectBurst={handleGenerateBurst}
            onExportLogs={handleExportLogs}
            isStreaming={isLiveStreaming}
          />
        </ErrorBoundary>
      ) : (
        /* Real-time Request Log Explorer Preview on Dashboard */
        <ErrorBoundary fallbackTitle="Request Stream Table">
          <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E]/80 overflow-hidden backdrop-blur-xl shadow-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-[#0B0F17]/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    Recent Ingested Telemetry Logs
                  </h2>
                  <span className="text-xs font-mono text-slate-400">
                    Showing top {filteredLogsSlice.length} of {worker.filteredLogsCount} matched records
                  </span>
                </div>
              </div>

              <button
                onClick={() => setActiveView('logs')}
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                View Full Stream <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0B0F17]/90 text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800/80">
                  <tr>
                    <th className="py-3 px-5">Method</th>
                    <th className="py-3 px-5">Endpoint</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Latency</th>
                    <th className="py-3 px-5">Trace ID</th>
                    <th className="py-3 px-5">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredLogsSlice.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                        No logs matched the current search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLogsSlice.map((log) => {
                      const methodBadge =
                        log.method === 'GET'
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.12)]'
                          : log.method === 'POST'
                          ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.12)]'
                          : log.method === 'PUT'
                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                          : 'text-rose-400 bg-rose-500/10 border-rose-500/30';

                      const statusColor =
                        log.statusCode < 300
                          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                          : log.statusCode < 400
                          ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
                          : log.statusCode < 500
                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                          : 'text-rose-400 bg-rose-500/10 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.2)]';

                      return (
                        <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-5">
                            <span className={`inline-block px-2 py-0.5 rounded-md font-bold text-[10px] border ${methodBadge}`}>
                              {log.method}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-white max-w-xs truncate font-medium">
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
                                log.latencyMs > 250
                                  ? 'text-amber-400 font-semibold'
                                  : 'text-slate-300'
                              }
                            >
                              {log.latencyMs}ms
                            </span>
                          </td>
                          <td className="py-3 px-5 text-slate-400 max-w-[140px] truncate">
                            {log.traceId}
                          </td>
                          <td className="py-3 px-5 text-slate-500 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={setActiveView}
        onClearFilters={handleClearFilters}
        onExportLogs={handleExportLogs}
        onToggleLiveMode={() => setIsLiveStreaming(!isLiveStreaming)}
        onResetMetrics={handleResetMetrics}
      />

      {/* Slide-Over Log & Trace Inspector Drawer for Cross-Module Deep-Linking */}
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
