'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  Search,
  Filter,
  Flame,
  AlertTriangle,
  RotateCw,
  Network,
  Radio,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  X,
} from 'lucide-react';
import { TraceSummary, TraceTree, ServiceTopologyMapData, TraceFilterOptions } from '../../types/trace';
import { TraceWaterfall } from './TraceWaterfall';
import { ServiceTopologyMap } from './ServiceTopologyMap';

interface TraceExplorerViewProps {
  initialTraceId?: string;
  onClearInitialTraceId?: () => void;
}

export const TraceExplorerView: React.FC<TraceExplorerViewProps> = ({
  initialTraceId,
  onClearInitialTraceId,
}) => {
  const [activeTab, setActiveTab] = useState<'traces' | 'topology'>('traces');
  const [traces, setTraces] = useState<TraceSummary[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<TraceTree | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [latestWsAnomaly, setLatestWsAnomaly] = useState<{
    traceId: string;
    serviceName: string;
    durationMs: number;
    zScore: number;
    rootCauseReason?: string;
  } | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState('All');
  const [minDurationMs, setMinDurationMs] = useState(0);
  const [onlyAnomalies, setOnlyAnomalies] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);

  // Topology Map Data
  const [topology, setTopology] = useState<ServiceTopologyMapData>(() => ({
    nodes: [],
    edges: [],
    timestamp: Date.now(),
  }));

  // Fetch Trace Summaries
  const fetchTraces = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedService && selectedService !== 'All') params.append('serviceName', selectedService);
      if (minDurationMs > 0) params.append('minDurationMs', String(minDurationMs));
      if (onlyAnomalies) params.append('onlyAnomalies', 'true');
      if (onlyErrors) params.append('hasError', 'true');
      if (searchQuery) params.append('searchQuery', searchQuery);

      const res = await fetch(`/api/v1/traces?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTraces(data.traces || []);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  }, [selectedService, minDurationMs, onlyAnomalies, onlyErrors, searchQuery]);

  // Fetch Topology Map
  const fetchTopology = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/traces/topology');
      if (res.ok) {
        const data = await res.json();
        setTopology(data);
      }
    } catch {
      // Fallback
    }
  }, []);

  // Fetch Full Trace by ID
  const inspectTrace = useCallback(async (traceId: string) => {
    try {
      const res = await fetch(`/api/v1/traces/${traceId}`);
      if (res.ok) {
        const tree = await res.json();
        setSelectedTrace(tree);
      }
    } catch {
      // Fallback
    }
  }, []);

  // Handle Initial Deep-Linked Trace ID
  useEffect(() => {
    if (!initialTraceId) return;
    let isMounted = true;
    const loadTrace = async () => {
      try {
        const res = await fetch(`/api/v1/traces/${initialTraceId}`);
        if (res.ok && isMounted) {
          const tree = await res.json();
          setSelectedTrace(tree);
        }
      } catch {
        // Fallback
      }
    };
    loadTrace();
    if (onClearInitialTraceId) onClearInitialTraceId();
    return () => {
      isMounted = false;
    };
  }, [initialTraceId, onClearInitialTraceId]);

  // WebSocket Subscription
  useEffect(() => {
    let ws: WebSocket | null = null;
    let isCancelled = false;

    const connectWs = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        ws = new WebSocket(`${protocol}//${host}/ws/telemetry`);

        ws.onopen = () => {
          if (!isCancelled) setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'trace_anomaly_detected') {
              setLatestWsAnomaly(data.payload);
              fetchTraces();
            } else if (data.type === 'topology_updated') {
              setTopology(data.payload);
            }
          } catch {
            // Ignore
          }
        };

        ws.onclose = () => {
          if (!isCancelled) setWsConnected(false);
        };

        ws.onerror = () => {
          if (!isCancelled) setWsConnected(false);
        };
      } catch {
        setWsConnected(false);
      }
    };

    connectWs();

    return () => {
      isCancelled = true;
      if (ws) ws.close();
    };
  }, [fetchTraces]);

  // Initial Data Load
  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      try {
        const [tracesRes, topoRes] = await Promise.all([
          fetch('/api/v1/traces'),
          fetch('/api/v1/traces/topology'),
        ]);
        if (isMounted && tracesRes.ok) {
          const tData = await tracesRes.json();
          setTraces(tData.traces || []);
        }
        if (isMounted && topoRes.ok) {
          const topoData = await topoRes.json();
          setTopology(topoData);
        }
      } catch {
        // Fallback
      }
    };
    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  const uniqueServices = Array.from(new Set(traces.flatMap((t) => t.services)));

  return (
    <div className="space-y-6 text-slate-100">
      {/* Top Banner & Tab Navigation */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white flex items-center space-x-2.5">
              <span>Distributed Traces &amp; Service Mesh</span>
              <span
                className={`flex items-center space-x-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  wsConnected
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <Radio className={`w-3 h-3 ${wsConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                <span>{wsConnected ? 'Live Socket Stream' : 'HTTP Polling'}</span>
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Trace transaction flows, identify cascading latencies, and pinpoint root causes across microservices.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#0B0F17] p-1 rounded-xl border border-slate-800 space-x-1 text-xs font-mono">
          <button
            onClick={() => setActiveTab('traces')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5 ${
              activeTab === 'traces'
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Trace Waterfalls</span>
          </button>
          <button
            onClick={() => setActiveTab('topology')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition flex items-center space-x-1.5 ${
              activeTab === 'topology'
                ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Network className="w-3.5 h-3.5 text-cyan-400" />
            <span>Service Topology</span>
          </button>
        </div>
      </div>

      {/* Real-Time WebSocket Anomaly Notification Banner */}
      {latestWsAnomaly && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 flex items-center justify-between text-xs animate-in fade-in">
          <div className="flex items-center space-x-3">
            <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40">
              <Flame className="w-4 h-4 text-rose-400 animate-pulse" />
            </span>
            <div>
              <div className="font-bold text-rose-300 flex items-center space-x-2">
                <span>Real-Time Z-Score Anomaly Detected: {latestWsAnomaly.serviceName}</span>
                <span className="font-mono text-[10px] bg-rose-900/60 px-2 py-0.5 rounded text-white border border-rose-500/40">
                  {latestWsAnomaly.zScore}σ Outlier ({latestWsAnomaly.durationMs}ms)
                </span>
              </div>
              <div className="text-slate-300 mt-0.5">
                Trace ID: <span className="font-mono text-cyan-300">{latestWsAnomaly.traceId}</span> &bull; {latestWsAnomaly.rootCauseReason}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => inspectTrace(latestWsAnomaly.traceId)}
              className="bg-rose-600 hover:bg-rose-500 text-white font-medium px-3 py-1.5 rounded-lg transition"
            >
              Inspect Waterfall
            </button>
            <button
              onClick={() => setLatestWsAnomaly(null)}
              className="text-slate-400 hover:text-slate-200 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TAB 1: TRACES & WATERFALLS */}
      {activeTab === 'traces' && (
        <div className="space-y-5">
          {/* Active Trace Waterfall Inspector Drawer (if a trace is selected) */}
          {selectedTrace && (
            <TraceWaterfall trace={selectedTrace} onClose={() => setSelectedTrace(null)} />
          )}

          {/* Filter Bar */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter trace ID, endpoint..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#0B0F17] border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-slate-200 outline-none focus:border-indigo-500 w-56"
                />
              </div>

              {/* Service Filter */}
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="bg-[#0B0F17] border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 outline-none"
              >
                <option value="All">All Services</option>
                {uniqueServices.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              {/* Min Duration */}
              <div className="flex items-center space-x-2 bg-[#0B0F17] border border-slate-700 rounded-lg px-3 py-1.5 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Min Latency:</span>
                <select
                  value={minDurationMs}
                  onChange={(e) => setMinDurationMs(Number(e.target.value))}
                  className="bg-transparent text-cyan-300 outline-none font-bold"
                >
                  <option value={0}>0ms</option>
                  <option value={100}>&gt;100ms</option>
                  <option value={500}>&gt;500ms</option>
                  <option value={1000}>&gt;1000ms</option>
                </select>
              </div>

              {/* Toggles */}
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyAnomalies}
                  onChange={(e) => setOnlyAnomalies(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-0"
                />
                <span className="text-slate-300 flex items-center space-x-1">
                  <Flame className="w-3.5 h-3.5 text-rose-400" />
                  <span>Anomalies Only</span>
                </span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyErrors}
                  onChange={(e) => setOnlyErrors(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-red-500 focus:ring-0"
                />
                <span className="text-slate-300 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span>5xx Errors Only</span>
                </span>
              </label>
            </div>

            <button
              onClick={fetchTraces}
              className="flex items-center space-x-1.5 p-2 rounded-lg bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition"
              title="Refresh Traces"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Trace Summaries Table */}
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#0B0F17] text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Trace ID</th>
                    <th className="py-3 px-4">Root Service &amp; Endpoint</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Spans</th>
                    <th className="py-3 px-4">Services Involved</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {traces.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                        No distributed traces matched the current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    traces.map((t) => {
                      const isSelected = selectedTrace?.traceId === t.traceId;
                      const statusColor =
                        t.statusCode >= 500
                          ? 'bg-red-500/20 text-red-400 border-red-500/40'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

                      return (
                        <tr
                          key={t.traceId}
                          onClick={() => inspectTrace(t.traceId)}
                          className={`hover:bg-slate-800/40 transition cursor-pointer ${
                            isSelected ? 'bg-indigo-600/15' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white select-all">{t.traceId}</span>
                              {t.hasAnomalies && (
                                <span className="p-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40" title="Z-Score Anomaly Detected">
                                  <Flame className="w-3 h-3 text-rose-400" />
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div>
                              <span className="text-cyan-300 font-bold block">{t.rootServiceName}</span>
                              <span className="text-slate-400 text-[11px] truncate max-w-xs block">{t.rootEndpoint}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusColor}`}>
                              {t.statusCode}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <span className={t.totalDurationMs > 500 ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                                {t.totalDurationMs}ms
                              </span>
                              <div className="w-24 h-1.5 bg-[#0B0F17] rounded-full overflow-hidden border border-slate-800">
                                <div
                                  className={`h-full ${
                                    t.hasErrors
                                      ? 'bg-red-500'
                                      : t.hasAnomalies
                                      ? 'bg-rose-500'
                                      : 'bg-cyan-500'
                                  }`}
                                  style={{ width: `${Math.min(100, (t.totalDurationMs / 1500) * 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 font-bold text-slate-300">{t.spanCount}</td>

                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {t.services.map((svc) => (
                                <span
                                  key={svc}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400"
                                >
                                  {svc}
                                </span>
                              ))}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                inspectTrace(t.traceId);
                              }}
                              className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center space-x-1 font-sans"
                            >
                              <span>View Waterfall</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SERVICE TOPOLOGY MAP */}
      {activeTab === 'topology' && (
        <ServiceTopologyMap
          topology={topology}
          onRefresh={fetchTopology}
          onSelectService={(serviceName) => {
            setSelectedService(serviceName);
            setActiveTab('traces');
          }}
        />
      )}
    </div>
  );
};
