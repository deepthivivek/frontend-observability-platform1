'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DashboardView,
  FilterState,
  AnomalyRule,
  ApiRequestLog,
} from '../../types/telemetry';
import { useTelemetryWorker } from '../../hooks/useTelemetryWorker';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { DashboardLayout } from '../layout/DashboardLayout';
import { CommandPalette } from '../common/CommandPalette';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { SummaryCards } from './SummaryCards';
import { generateSyntheticLogs } from '../../utils/syntheticData';
import {
  UploadCloud,
  Play,
  Pause,
  RefreshCw,
  SlidersHorizontal,
  FileText,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';

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

export const DashboardContainer: React.FC = () => {
  const [activeView, setActiveView] = useState<DashboardView>('dashboard');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [liveAnnouncement, setLiveAnnouncement] = useState('System ready.');
  const [isLiveStreaming, setIsLiveStreaming] = useState(false);

  const { preferences, updatePreference, toggleDensity, toggleLiveMode } = useUserPreferences();
  const worker = useTelemetryWorker();

  // Initial synthetic dataset ingestion on mount
  useEffect(() => {
    const initialDataset = generateSyntheticLogs(1200, 60);
    worker.ingestLogsInChunks(initialDataset, 400).then(() => {
      worker.refreshMetrics();
      worker.computeBuckets(1);
      worker.evaluateAnomalies(INITIAL_RULES);
      setLiveAnnouncement(`Ingested ${initialDataset.length} production telemetry records.`);
    });
  }, []);

  // Periodic live streaming simulation if live mode is toggled
  useEffect(() => {
    if (!isLiveStreaming) return;

    const interval = setInterval(() => {
      const liveChunk = generateSyntheticLogs(25, 2);
      worker.ingestLogsInChunks(liveChunk, 25).then(() => {
        worker.refreshMetrics();
        worker.computeBuckets(1);
        worker.evaluateAnomalies(INITIAL_RULES);
        setLiveAnnouncement(`Live stream: +${liveChunk.length} requests ingested.`);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isLiveStreaming, worker]);

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
  }, [worker.filteredLogsCount, worker.getFilteredLogs]);

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
      activeAnomaliesCount={worker.anomalies.length}
      liveAnnouncement={liveAnnouncement}
    >
      {/* Top Banner / Ingestion Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-neutral-800 bg-neutral-900/40 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-neutral-100 flex items-center gap-2">
              Telemetry Ingestion Pipeline
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-sky-500/10 text-sky-400 border border-sky-500/30">
                Web Worker Active
              </span>
            </h1>
            <p className="text-xs text-neutral-400">
              Processing in background worker thread with index-based filtering & percentile sorting.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
              isLiveStreaming
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
            }`}
          >
            {isLiveStreaming ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isLiveStreaming ? 'Pause Live Stream' : 'Start Live Stream'}
          </button>

          <button
            onClick={() => handleGenerateBurst(2000)}
            disabled={worker.isIngesting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            Inject +2k Burst
          </button>

          <button
            onClick={handleExportLogs}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors"
          >
            <UploadCloud className="h-3.5 w-3.5 text-sky-400" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Summary Metrics Cards with Sparklines & Variance */}
      <ErrorBoundary fallbackTitle="Summary Cards Metrics Engine">
        <SummaryCards
          metrics={worker.activeMetrics}
          deltas={worker.deltas}
          timeBuckets={worker.timeBuckets}
          isLoading={worker.isIngesting && !worker.activeMetrics}
        />
      </ErrorBoundary>

      {/* Active Anomalies Alert Banner if Breached */}
      {worker.anomalies.length > 0 && (
        <div className="rounded-xl border border-rose-800/80 bg-rose-950/20 p-4 text-rose-200">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              Active Statistical Anomaly Breaches ({worker.anomalies.length})
            </span>
            <button
              onClick={() => setActiveView('anomalies')}
              className="text-xs text-rose-300 underline hover:text-rose-100"
            >
              Configure Rules &rarr;
            </button>
          </div>
          <div className="mt-2 space-y-1.5">
            {worker.anomalies.map((a, idx) => (
              <div
                key={idx}
                className="text-xs font-mono text-rose-300/90 flex items-center justify-between bg-rose-900/30 px-3 py-1.5 rounded-lg border border-rose-800/40"
              >
                <span>{a.description}</span>
                <span className="uppercase text-[10px] px-1.5 py-0.5 rounded font-bold bg-rose-500 text-white">
                  {a.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Real-time Request Log Explorer Preview */}
      <ErrorBoundary fallbackTitle="Request Stream Table">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-neutral-100">
                Recent Ingested Telemetry Logs
              </h2>
              <span className="text-xs font-mono text-neutral-500">
                (Showing top {filteredLogsSlice.length} of {worker.filteredLogsCount} matched)
              </span>
            </div>

            <button
              onClick={() => setActiveView('logs')}
              className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1"
            >
              View Full Stream <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-neutral-950/80 text-neutral-400 uppercase tracking-wider text-[10px] border-b border-neutral-800">
                <tr>
                  <th className="py-2.5 px-4">Method</th>
                  <th className="py-2.5 px-4">Endpoint</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Latency</th>
                  <th className="py-2.5 px-4">Trace ID</th>
                  <th className="py-2.5 px-4">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
                {filteredLogsSlice.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-500">
                      No logs matched the current search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLogsSlice.map((log) => {
                    const statusColor =
                      log.statusCode < 300
                        ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40'
                        : log.statusCode < 400
                        ? 'text-sky-400 bg-sky-950/40 border-sky-800/40'
                        : log.statusCode < 500
                        ? 'text-amber-400 bg-amber-950/40 border-amber-800/40'
                        : 'text-rose-400 bg-rose-950/40 border-rose-800/40';

                    return (
                      <tr key={log.id} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="py-2.5 px-4 font-bold text-neutral-200">
                          {log.method}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-100 max-w-xs truncate">
                          {log.endpoint}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold border ${statusColor}`}
                          >
                            {log.statusCode}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={
                              log.latencyMs > 250
                                ? 'text-amber-400 font-semibold'
                                : 'text-neutral-300'
                            }
                          >
                            {log.latencyMs}ms
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-neutral-400 max-w-[140px] truncate">
                          {log.traceId}
                        </td>
                        <td className="py-2.5 px-4 text-neutral-500 whitespace-nowrap">
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
    </DashboardLayout>
  );
};
