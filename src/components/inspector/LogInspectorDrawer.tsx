'use client';

import React, { useEffect, useState } from 'react';
import { ApiRequestLog } from '../../types/telemetry';
import { PayloadViewer } from './PayloadViewer';
import {
  X,
  Share2,
  Download,
  AlertTriangle,
  Play,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Check,
  Bell,
  MessageSquare,
} from 'lucide-react';

interface LogInspectorDrawerProps {
  log: ApiRequestLog | null;
  onClose: () => void;
  onNextLog?: () => void;
  onPrevLog?: () => void;
  surroundingLogs?: ApiRequestLog[];
  onFilterTag?: (key: string, value: string) => void;
  onFilterEndpoint?: (endpoint: string) => void;
}

export const LogInspectorDrawer: React.FC<LogInspectorDrawerProps> = ({
  log,
  onClose,
  onNextLog,
  onPrevLog,
  surroundingLogs = [],
  onFilterTag = () => {},
  onFilterEndpoint = () => {},
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [escalatedState, setEscalatedState] = useState<string | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySuccess, setReplaySuccess] = useState(false);

  // Keyboard navigation shortcuts: J (Next), K (Prev), Esc (Close)
  useEffect(() => {
    if (!log) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key.toLowerCase() === 'j' && onNextLog) {
        e.preventDefault();
        onNextLog();
      } else if (e.key.toLowerCase() === 'k' && onPrevLog) {
        e.preventDefault();
        onPrevLog();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [log, onClose, onNextLog, onPrevLog]);

  if (!log) return null;

  const handleCopyPermalink = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      const url = `${window.location.origin}?traceId=${encodeURIComponent(log.traceId)}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleExportBundle = () => {
    const bundle = {
      traceId: log.traceId,
      spanId: log.spanId,
      endpoint: log.endpoint,
      method: log.method,
      statusCode: log.statusCode,
      latencyMs: log.latencyMs,
      timestamp: log.timestamp,
      headers: {
        request: log.requestHeaders,
        response: log.responseHeaders,
      },
      payload: {
        request: log.requestBody,
        response: log.responseBody,
      },
      diagnostics: log.errorDetails,
      exportedAt: new Date().toISOString(),
    };

    const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(bundle, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonStr);
    downloadAnchor.setAttribute('download', `diagnostic_bundle_${log.traceId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleEscalate = (platform: 'slack' | 'pagerduty') => {
    setEscalatedState(platform);
    setTimeout(() => setEscalatedState(null), 3000);
  };

  const handleReplaySimulation = () => {
    setIsReplaying(true);
    setReplaySuccess(false);
    setTimeout(() => {
      setIsReplaying(false);
      setReplaySuccess(true);
      setTimeout(() => setReplaySuccess(false), 3000);
    }, 800);
  };

  // Status and method badges
  const methodBadgeClass =
    log.method === 'GET'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : log.method === 'POST'
      ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
      : 'text-amber-400 bg-amber-500/10 border-amber-500/30';

  const statusBadgeClass =
    log.statusCode < 400
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      : 'text-rose-400 bg-rose-500/10 border-rose-500/30';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trace and Log Inspector Drawer"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl h-full bg-[#0D1322]/95 backdrop-blur-2xl border-l border-slate-800/80 shadow-2xl flex flex-col text-slate-100 animate-in slide-in-from-right duration-200 overflow-hidden">
        {/* Header Bar */}
        <div className="p-5 border-b border-slate-800/80 bg-[#0B0F17]/80 flex flex-col gap-3">
          {/* Top navigation controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={onPrevLog}
                title="Previous Log [K]"
                aria-label="Previous Log"
                className="p-1.5 rounded-lg border border-slate-800 bg-[#080C14] hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={onNextLog}
                title="Next Log [J]"
                aria-label="Next Log"
                className="p-1.5 rounded-lg border border-slate-800 bg-[#080C14] hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono text-slate-500 ml-1">
                Use <kbd className="text-slate-300">J</kbd>/<kbd className="text-slate-300">K</kbd> to step
              </span>
            </div>

            <button
              onClick={onClose}
              aria-label="Close Inspector Drawer"
              className="p-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Log Identity Title */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded-md font-bold font-mono text-xs border ${methodBadgeClass}`}>
              {log.method}
            </span>
            <span className="text-base font-semibold text-white truncate max-w-md">
              {log.endpoint}
            </span>
            <span className={`px-2 py-0.5 rounded-md font-bold font-mono text-xs border ${statusBadgeClass}`}>
              {log.statusCode}
            </span>
            <span className="text-xs font-mono text-slate-400">
              {log.latencyMs}ms • {new Date(log.timestamp).toLocaleTimeString()}
            </span>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
            {/* Share Permalink */}
            <button
              onClick={handleCopyPermalink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-[#080C14] hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5 text-sky-400" />}
              {copiedLink ? 'Link Copied' : 'Share Trace'}
            </button>

            {/* Export Diagnostic Bundle */}
            <button
              onClick={handleExportBundle}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-[#080C14] hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-indigo-400" />
              Export Bundle
            </button>

            {/* Replay Simulation */}
            <button
              onClick={handleReplaySimulation}
              disabled={isReplaying}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-all shadow-[0_0_10px_rgba(245,158,11,0.15)] disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 text-amber-400" />
              {isReplaying ? 'Replaying...' : replaySuccess ? 'Replayed (200 OK)' : 'Replay Request'}
            </button>

            {/* Escalate Menu */}
            <button
              onClick={() => handleEscalate('slack')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-800 bg-[#080C14] hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
              {escalatedState === 'slack' ? 'Sent to #oncall' : 'Escalate to Slack'}
            </button>

            <button
              onClick={() => handleEscalate('pagerduty')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition-colors"
            >
              <Bell className="h-3.5 w-3.5 text-rose-400" />
              {escalatedState === 'pagerduty' ? 'Triggered' : 'PagerDuty'}
            </button>
          </div>
        </div>

        {/* Tabbed Inspector Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <PayloadViewer
            log={log}
            surroundingLogs={surroundingLogs}
            onFilterTag={onFilterTag}
            onFilterEndpoint={onFilterEndpoint}
          />
        </div>
      </div>
    </div>
  );
};
