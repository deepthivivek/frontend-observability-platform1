'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Play,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Clock,
  ExternalLink,
  ShieldAlert,
  Terminal,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';
import { SyntheticMonitor } from '../../types/rum';

interface SyntheticMonitorsProps {
  monitors: SyntheticMonitor[];
  onRunMonitor: (monitorId: string) => void;
  onInspectTrace: (traceId: string) => void;
}

export const SyntheticMonitors: React.FC<SyntheticMonitorsProps> = ({
  monitors,
  onRunMonitor,
  onInspectTrace,
}) => {
  const [selectedMonitorId, setSelectedMonitorId] = useState<string>(
    monitors[0]?.id || ''
  );
  const [runningId, setRunningId] = useState<string | null>(null);

  const activeMonitor =
    monitors.find((m) => m.id === selectedMonitorId) || monitors[0];

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleRunNow = (id: string) => {
    setRunningId(id);
    setTimeout(() => {
      if (!isMounted.current) return;
      onRunMonitor(id);
      setRunningId(null);
    }, 800);
  };

  return (
    <div className="space-y-5 font-mono text-xs">
      {/* 1. Synthetic Status Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="font-bold text-[11px] uppercase">Active Synthetic Probes</span>
            <Activity className="h-4 w-4 text-indigo-400" />
          </div>
          <span className="text-2xl font-bold text-white">{monitors.length} Flows</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Automated canary execution every 1–5m</p>
        </div>

        <div className="p-4 rounded-2xl border border-rose-500/30 bg-[#1A121F]/90 backdrop-blur-xl">
          <div className="flex items-center justify-between text-rose-400 mb-1">
            <span className="font-bold text-[11px] uppercase">Failing Flow Alerts</span>
            <AlertOctagon className="h-4 w-4" />
          </div>
          <span className="text-2xl font-bold text-rose-400">
            {monitors.filter((m) => m.status === 'failing').length} Broken Workflow
          </span>
          <p className="text-[11px] text-rose-300 mt-0.5">Checkout Step #4 assertion breach</p>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-500/30 bg-[#131F25]/90 backdrop-blur-xl">
          <div className="flex items-center justify-between text-emerald-400 mb-1">
            <span className="font-bold text-[11px] uppercase">Global Canary Uptime</span>
            <Globe className="h-4 w-4" />
          </div>
          <span className="text-2xl font-bold text-emerald-400">99.82% SLA</span>
          <p className="text-[11px] text-slate-400 mt-0.5">Across US-East, EU-Central, AP-South</p>
        </div>
      </div>

      {/* 2. Scripted Flow Runner & Multi-Region Status Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Scripted Synthetic Monitors List (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#131B2E] overflow-hidden flex flex-col shadow-xl">
          <div className="p-3.5 bg-[#0B0F17] border-b border-slate-800 flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span className="text-white">Scripted Synthetic Workflows</span>
            <span>{monitors.length} Monitors</span>
          </div>

          <div className="p-3 space-y-2.5 overflow-y-auto max-h-[460px]">
            {monitors.map((mon) => {
              const isSelected = mon.id === activeMonitor?.id;
              const isPassing = mon.status === 'passing';
              const isRunning = runningId === mon.id;

              return (
                <div
                  key={mon.id}
                  onClick={() => setSelectedMonitorId(mon.id)}
                  className={`p-3.5 rounded-xl cursor-pointer border transition-all ${
                    isSelected
                      ? isPassing
                        ? 'border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                        : 'border-rose-500/50 bg-rose-950/30 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                      : 'border-slate-800/80 bg-[#0B0F17]/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        isPassing
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {mon.status}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRunNow(mon.id);
                      }}
                      disabled={isRunning}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold shadow-sm disabled:opacity-50 transition-colors"
                    >
                      <Play className="h-3 w-3" />
                      <span>{isRunning ? 'Probing...' : 'Run Now'}</span>
                    </button>
                  </div>

                  <h4 className="font-bold text-white text-xs">{mon.name}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate font-mono">
                    {mon.targetUrl}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-800/60 pt-2">
                    <span>Freq: every {mon.frequencyMinutes}m</span>
                    <span>{mon.steps.length} Assertions</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Step Execution Breakdown & Regional Latency Matrix (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#131B2E] overflow-hidden flex flex-col shadow-xl">
          <div className="p-3.5 bg-[#0B0F17] border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <Terminal className="h-4 w-4 text-indigo-400" />
              <span className="font-semibold text-xs">
                {activeMonitor?.name} — Execution Breakdown
              </span>
            </div>

            <button
              onClick={() => handleRunNow(activeMonitor.id)}
              disabled={runningId === activeMonitor.id}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-[0_0_12px_rgba(99,102,241,0.3)] disabled:opacity-50"
            >
              <Play className="h-3 w-3" />
              <span>{runningId === activeMonitor.id ? 'Executing...' : 'Re-run Workflow'}</span>
            </button>
          </div>

          <div className="p-4 space-y-4 overflow-y-auto max-h-[460px]">
            {/* Multi-Region Latency Status Grid */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Multi-Region Agent Latency &amp; Status
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {activeMonitor?.regions.map((reg) => (
                  <div
                    key={reg.regionId}
                    className={`p-2.5 rounded-xl border flex items-center justify-between ${
                      reg.status === 'ok'
                        ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                        : 'border-rose-500/30 bg-rose-950/20 text-rose-300'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-[11px] block text-white">{reg.name}</span>
                      <span className="text-[10px] text-slate-400">{reg.latencyMs}ms roundtrip</span>
                    </div>
                    {reg.status === 'ok' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step-by-Step Script Assertions */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Step-by-Step Assertions ({activeMonitor?.steps.length} Steps)
              </span>

              <div className="space-y-2">
                {activeMonitor?.steps.map((step) => {
                  const isPassed = step.status === 'passed';
                  return (
                    <div
                      key={step.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isPassed
                          ? 'border-slate-800 bg-[#0B0F17]'
                          : 'border-rose-500/40 bg-rose-950/20 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex items-center justify-center h-5 w-5 rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">
                            {step.stepNumber}
                          </span>
                          <span className="font-bold text-white text-xs">{step.name}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {step.durationMs}ms
                          </span>
                          {isPassed ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              PASS
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                              FAIL
                            </span>
                          )}
                        </div>
                      </div>

                      {step.assertionMessage && (
                        <div className="mt-2 p-2 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-200 text-[11px] font-mono whitespace-pre-wrap">
                          {step.assertionMessage}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
