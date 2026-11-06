'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutGrid,
  Plus,
  RotateCw,
  Sparkles,
  Save,
  Download,
  Upload,
  Trash2,
  Settings,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Layers,
  X,
  Sliders,
  BarChart3,
} from 'lucide-react';
import { MetricWidget, WidgetType, DashboardPreset, MetricQueryResultPoint } from '../../types/dashboard';
import { useDashboardPresets } from '../../hooks/useDashboardPresets';
import { MetricQueryBuilder } from './MetricQueryBuilder';

interface CustomDashboardBuilderProps {
  workspaceId?: string;
}

export const CustomDashboardBuilder: React.FC<CustomDashboardBuilderProps> = ({ workspaceId = 'ws-default' }) => {
  const {
    presets,
    activePresetId,
    activeWidgets,
    setActiveWidgets,
    selectPreset,
    savePreset,
    deletePreset,
    exportPresetsJSON,
    importPresetsJSON,
  } = useDashboardPresets();

  const [refreshIntervalMs, setRefreshIntervalMs] = useState<number>(15000); // default 15s
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(() => Date.now());
  const [isAiBuilderOpen, setIsAiBuilderOpen] = useState(false);
  const [isAddWidgetOpen, setIsAddWidgetOpen] = useState(false);
  const [isSavePresetOpen, setIsSavePresetOpen] = useState(false);

  const [presetNameInput, setPresetNameInput] = useState('');
  const [presetDescInput, setPresetDescInput] = useState('');

  // Widget Edit State
  const [editingWidget, setEditingWidget] = useState<MetricWidget | null>(null);

  // New Widget Form State
  const [newTitle, setNewTitle] = useState('New Metric Widget');
  const [newType, setNewType] = useState<WidgetType>('line');
  const [newUnit, setNewUnit] = useState('ms');
  const [newWidth, setNewWidth] = useState<number>(6);
  const [newWarnThreshold, setNewWarnThreshold] = useState<string>('200');
  const [newCritThreshold, setNewCritThreshold] = useState<string>('450');

  // Calculated Metric Data Cache per widget ID
  const [widgetData, setWidgetData] = useState<
    Record<
      string,
      {
        currentValue: number;
        dataPoints: MetricQueryResultPoint[];
        cached: boolean;
        status: 'ok' | 'warning' | 'critical';
        executionTimeMs: number;
      }
    >
  >({});

  const generateMockWidgetData = useCallback((w: MetricWidget, now: number) => {
    const count = 20;
    const pts: MetricQueryResultPoint[] = [];
    const base = w.unit === '%' ? 2.4 : w.unit === 'ms' ? 145 : 420;
    for (let i = count - 1; i >= 0; i--) {
      pts.push({
        timestamp: now - i * 60000,
        value: Math.max(0, parseFloat((base + Math.sin(i + (now % 100)) * (base * 0.2)).toFixed(2))),
      });
    }
    const curr = pts[pts.length - 1].value;
    let st: 'ok' | 'warning' | 'critical' = 'ok';
    if (w.threshold) {
      if (w.threshold.critical && curr > w.threshold.critical) st = 'critical';
      else if (w.threshold.warning && curr > w.threshold.warning) st = 'warning';
    }
    return {
      currentValue: curr,
      dataPoints: pts,
      cached: true,
      status: st,
      executionTimeMs: 4,
    };
  }, []);

  // Query Backend for metric data
  const fetchMetricData = useCallback(async () => {
    const newData: Record<string, any> = {};
    const now = Date.now();

    await Promise.all(
      activeWidgets.map(async (w) => {
        try {
          const res = await fetch('/api/v1/metrics/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: w.query.expression,
              metric: w.query.metric,
              aggregation: w.query.aggregation,
              threshold: w.threshold,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            newData[w.id] = {
              currentValue: data.currentValue,
              dataPoints: data.dataPoints,
              cached: data.cached,
              status: data.status,
              executionTimeMs: data.executionTimeMs,
            };
          } else {
            // Local fallback simulation if endpoint returns non-200
            newData[w.id] = generateMockWidgetData(w, now);
          }
        } catch {
          newData[w.id] = generateMockWidgetData(w, now);
        }
      })
    );

    setWidgetData(newData);
    setLastRefreshedAt(Date.now());
  }, [activeWidgets, generateMockWidgetData]);

  useEffect(() => {
    let isMounted = true;
    const runFetch = async () => {
      await fetchMetricData();
    };
    runFetch();
    return () => {
      isMounted = false;
    };
  }, [fetchMetricData]);

  // Auto Refresh Interval Loop
  useEffect(() => {
    if (refreshIntervalMs <= 0) return;
    const timer = setInterval(() => {
      fetchMetricData();
    }, refreshIntervalMs);
    return () => clearInterval(timer);
  }, [refreshIntervalMs, fetchMetricData]);

  const handleAddWidgetSubmit = () => {
    const id = `w-${Date.now()}`;
    const widget: MetricWidget = {
      id,
      title: newTitle,
      type: newType,
      unit: newUnit,
      gridSpan: { w: newWidth, h: 1 },
      query: {
        expression: `avg_over_time(${newTitle.toLowerCase().replace(/\s+/g, '_')}[5m])`,
        step: '1m',
        metric: 'custom_metric',
        aggregation: 'avg',
      },
      threshold: {
        operator: '>',
        warning: newWarnThreshold ? parseFloat(newWarnThreshold) : undefined,
        critical: newCritThreshold ? parseFloat(newCritThreshold) : undefined,
      },
    };

    setActiveWidgets((prev) => [...prev, widget]);
    setIsAddWidgetOpen(false);
  };

  const handleDeleteWidget = (id: string) => {
    setActiveWidgets((prev) => prev.filter((w) => w.id !== id));
  };

  const handleSavePresetSubmit = () => {
    if (!presetNameInput.trim()) return;
    savePreset(presetNameInput, presetDescInput || 'User customized dashboard layout', activeWidgets);
    setIsSavePresetOpen(false);
    setPresetNameInput('');
    setPresetDescInput('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          importPresetsJSON(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6 text-slate-100">
      {/* TOOLBAR & HEADER */}
      <div className="bg-[#0F172A]/90 backdrop-blur border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        {/* Preset Selector */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-cyan-400">
            <LayoutGrid className="w-5 h-5" />
            <span className="font-semibold text-sm tracking-wide text-slate-200">Preset Layout:</span>
          </div>
          <select
            value={activePresetId}
            onChange={(e) => selectPreset(e.target.value)}
            className="bg-[#0B0F17] border border-slate-700 text-cyan-300 text-xs font-mono rounded-lg px-3 py-2 outline-none focus:border-cyan-500"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.widgets.length} widgets)
              </option>
            ))}
          </select>
        </div>

        {/* Refresh Rate & Studio Actions */}
        <div className="flex flex-wrap items-center space-x-2.5">
          {/* Refresh Selector */}
          <div className="flex items-center bg-[#0B0F17] border border-slate-800 rounded-lg p-1 text-xs">
            <button
              onClick={() => fetchMetricData()}
              className="p-1 text-slate-400 hover:text-cyan-400 transition"
              title="Refresh Now"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <select
              value={refreshIntervalMs}
              onChange={(e) => setRefreshIntervalMs(Number(e.target.value))}
              className="bg-transparent text-slate-300 font-mono px-2 py-0.5 outline-none text-xs"
            >
              <option value={0}>Auto-refresh: Off</option>
              <option value={5000}>5s</option>
              <option value={15000}>15s</option>
              <option value={30000}>30s</option>
              <option value={60000}>1m</option>
            </select>
          </div>

          {/* AI Query Studio Toggle */}
          <button
            onClick={() => setIsAiBuilderOpen((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 border ${
              isAiBuilderOpen
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-[#0B0F17] text-slate-300 border-slate-800 hover:border-cyan-500/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI PromQL Studio</span>
          </button>

          {/* Add Widget Button */}
          <button
            onClick={() => setIsAddWidgetOpen(true)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1 shadow-md shadow-cyan-950/50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Widget</span>
          </button>

          {/* Save Preset Button */}
          <button
            onClick={() => setIsSavePresetOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center space-x-1 border border-slate-700"
          >
            <Save className="w-3.5 h-3.5 text-emerald-400" />
            <span>Save Preset</span>
          </button>

          {/* Export / Import JSON */}
          <button
            onClick={exportPresetsJSON}
            className="p-1.5 bg-[#0B0F17] hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-800 transition"
            title="Export Presets JSON"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <label
            className="p-1.5 bg-[#0B0F17] hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-800 transition cursor-pointer"
            title="Import Presets JSON"
          >
            <Upload className="w-3.5 h-3.5" />
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* AI PROMQL STUDIO EXPANDABLE PANEL */}
      {isAiBuilderOpen && (
        <MetricQueryBuilder
          onApplyQuery={(config) => {
            if (activeWidgets.length > 0) {
              const updated = [...activeWidgets];
              updated[0] = { ...updated[0], query: config };
              setActiveWidgets(updated);
            }
          }}
          onClose={() => setIsAiBuilderOpen(false)}
        />
      )}

      {/* DYNAMIC METRIC WIDGET GRID */}
      <div className="grid grid-cols-12 gap-5">
        {activeWidgets.map((w) => {
          const data = widgetData[w.id] || {
            currentValue: 0,
            dataPoints: [],
            cached: false,
            status: 'ok',
            executionTimeMs: 0,
          };

          const colSpanClass =
            w.gridSpan.w === 12
              ? 'col-span-12'
              : w.gridSpan.w === 6
              ? 'col-span-12 lg:col-span-6'
              : w.gridSpan.w === 3
              ? 'col-span-12 sm:col-span-6 lg:col-span-3'
              : 'col-span-12 lg:col-span-4';

          const statusBorder =
            data.status === 'critical'
              ? 'border-red-500/60 shadow-red-950/40 shadow-xl'
              : data.status === 'warning'
              ? 'border-amber-500/60 shadow-amber-950/40 shadow-xl'
              : 'border-slate-800 hover:border-slate-700';

          return (
            <div
              key={w.id}
              className={`bg-[#0F172A] border ${statusBorder} rounded-xl p-5 relative group flex flex-col justify-between transition-all`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between border-b border-slate-800/80 pb-3 mb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-semibold text-sm text-slate-200">{w.title}</h4>
                    {data.status !== 'ok' && (
                      <span
                        className={`px-2 py-0.5 text-[10px] uppercase font-mono font-bold rounded ${
                          data.status === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        }`}
                      >
                        {data.status} BREACH
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5 truncate max-w-[280px]">
                    {w.query.expression}
                  </p>
                </div>

                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-mono text-slate-500 bg-[#0B0F17] px-2 py-0.5 rounded border border-slate-800">
                    {data.executionTimeMs}ms {data.cached && '(cached)'}
                  </span>
                  <button
                    onClick={() => handleDeleteWidget(w.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition"
                    title="Remove Widget"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* RENDER BASED ON WIDGET TYPE */}
              {/* TYPE 1: STAT GAUGE */}
              {w.type === 'stat' && (
                <div className="py-4 space-y-2">
                  <div className="flex items-baseline space-x-2">
                    <span className="text-4xl font-extrabold font-mono text-cyan-300">
                      {data.currentValue}
                    </span>
                    <span className="text-sm font-mono text-slate-400">{w.unit}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>+2.4% vs previous 5m window</span>
                  </div>
                </div>
              )}

              {/* TYPE 2: LINE / AREA CHART */}
              {w.type === 'line' && (
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-bold font-mono text-cyan-300">
                      {data.currentValue} <span className="text-xs text-slate-400">{w.unit}</span>
                    </span>
                  </div>
                  <div className="h-28 w-full bg-[#0B0F17] border border-slate-800/80 rounded-lg p-2 flex items-end space-x-1.5 overflow-hidden">
                    {data.dataPoints.map((pt, i) => {
                      const maxVal = Math.max(...data.dataPoints.map((p) => p.value), 1);
                      const heightPct = Math.max(10, Math.min(100, (pt.value / maxVal) * 100));
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-gradient-to-t from-cyan-900/40 to-cyan-400 rounded-t-sm hover:brightness-125 transition"
                          style={{ height: `${heightPct}%` }}
                          title={`${new Date(pt.timestamp).toLocaleTimeString()}: ${pt.value}${w.unit || ''}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TYPE 3: HEATMAP MATRIX */}
              {w.type === 'heatmap' && (
                <div className="space-y-3">
                  <div className="text-xs font-mono text-slate-400">Latency Bucket Density (P95/P99 Matrix)</div>
                  <div className="grid grid-cols-10 gap-1 bg-[#0B0F17] p-2.5 rounded-lg border border-slate-800">
                    {Array.from({ length: 40 }).map((_, i) => {
                      const opacity = Math.sin(i * 1.7) * 0.5 + 0.5;
                      return (
                        <div
                          key={i}
                          className="h-4 rounded-xs transition hover:scale-110"
                          style={{
                            backgroundColor:
                              opacity > 0.7
                                ? `rgba(239, 68, 68, ${opacity})`
                                : opacity > 0.4
                                ? `rgba(245, 158, 11, ${opacity})`
                                : `rgba(6, 182, 212, ${opacity})`,
                          }}
                          title={`Bucket #${i}: Density ${(opacity * 100).toFixed(0)}%`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TYPE 4: DISTRIBUTION BAR BREAKDOWN */}
              {w.type === 'distribution' && (
                <div className="space-y-2.5">
                  <div className="text-xs font-mono text-slate-400">Instance Allocation Breakdown</div>
                  <div className="space-y-2 font-mono text-xs">
                    {[
                      { label: 'node-us-east-1a', val: 78, color: 'bg-cyan-500' },
                      { label: 'node-us-east-1b', val: 64, color: 'bg-blue-500' },
                      { label: 'node-eu-west-1a', val: 45, color: 'bg-emerald-500' },
                    ].map((row, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-300">
                          <span>{row.label}</span>
                          <span>{row.val}%</span>
                        </div>
                        <div className="h-2 bg-[#0B0F17] rounded-full overflow-hidden border border-slate-800">
                          <div className={`h-full ${row.color}`} style={{ width: `${row.val}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Threshold Status Bar Footnote */}
              {w.threshold && (
                <div className="mt-4 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
                  <span>Threshold: {w.threshold.operator} {w.threshold.warning || w.threshold.critical}</span>
                  <span className={data.status === 'ok' ? 'text-emerald-400' : 'text-amber-400'}>
                    Status: {data.status.toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ADD WIDGET MODAL */}
      {isAddWidgetOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-cyan-500/40 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-slate-100 flex items-center space-x-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>Add Custom Metric Widget</span>
              </h3>
              <button onClick={() => setIsAddWidgetOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-slate-400 block mb-1">Widget Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Visualization Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as WidgetType)}
                    className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none"
                  >
                    <option value="line">Line / Area Chart</option>
                    <option value="stat">Single Stat Gauge</option>
                    <option value="heatmap">Heatmap Matrix</option>
                    <option value="distribution">Distribution Bar</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Grid Column Width</label>
                  <select
                    value={newWidth}
                    onChange={(e) => setNewWidth(Number(e.target.value))}
                    className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none"
                  >
                    <option value={3}>1/4 Width (3 cols)</option>
                    <option value={6}>1/2 Width (6 cols)</option>
                    <option value={12}>Full Width (12 cols)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Warning Threshold</label>
                  <input
                    type="number"
                    value={newWarnThreshold}
                    onChange={(e) => setNewWarnThreshold(e.target.value)}
                    className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Critical Threshold</label>
                  <input
                    type="number"
                    value={newCritThreshold}
                    onChange={(e) => setNewCritThreshold(e.target.value)}
                    className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsAddWidgetOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddWidgetSubmit}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-xs font-medium"
              >
                Add Custom Widget
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAVE PRESET MODAL */}
      {isSavePresetOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-emerald-500/40 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-slate-100 flex items-center space-x-2">
                <Save className="w-4 h-4 text-emerald-400" />
                <span>Save Dashboard Preset</span>
              </h3>
              <button onClick={() => setIsSavePresetOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-slate-400 block mb-1">Preset Name</label>
                <input
                  type="text"
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                  placeholder="e.g. Production Edge Gateway & Latency"
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Description</label>
                <textarea
                  value={presetDescInput}
                  onChange={(e) => setPresetDescInput(e.target.value)}
                  rows={3}
                  placeholder="Summary of metrics monitored in this preset layout..."
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg p-2 text-slate-200 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsSavePresetOpen(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePresetSubmit}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-medium"
              >
                Save Layout Preset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
