'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search,
  SlidersHorizontal,
  X,
  RotateCcw,
  Sparkles,
  Download,
  Trash2,
  Terminal,
  Filter,
  CheckSquare,
  HelpCircle,
} from 'lucide-react';
import { ApiRequestLog, DensityMode, HttpMethod, TimeBucket } from '../../types/telemetry';
import { RequestLogTable } from './RequestLogTable';
import { ContextMenu, ContextMenuPosition } from './ContextMenu';
import { KeyboardShortcutsModal } from '../common/KeyboardShortcutsModal';
import { LogInspectorDrawer } from '../inspector/LogInspectorDrawer';
import { TailStreamControls } from './TailStreamControls';
import { StreamTimeTravel } from './StreamTimeTravel';
import { ExportModal } from './ExportModal';
import { RegexLibrary } from './RegexLibrary';
import { useTableSorting, SortField } from '../../hooks/useTableSorting';
import { useLogStream } from '../../hooks/useLogStream';
import { evaluateLogQuery } from '../../utils/logQueryParser';

interface LogTableContainerProps {
  logs: ApiRequestLog[];
  totalLogsCount: number;
  timeBuckets: TimeBucket[];
  density: DensityMode;
  onFilterChange: (filters: { searchText?: string; methods?: HttpMethod[]; statusCode?: number }) => void;
  onInjectBurst: (count: number) => void;
  onExportLogs: () => void;
  isStreaming: boolean;
}

export const LogTableContainer: React.FC<LogTableContainerProps> = ({
  logs,
  totalLogsCount,
  timeBuckets,
  density,
  onFilterChange,
  onInjectBurst,
  onExportLogs,
  isStreaming,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [isRegexMode, setIsRegexMode] = useState(false);
  const [activeMethods, setActiveMethods] = useState<Set<HttpMethod>>(new Set());
  const [activeStatusCode, setActiveStatusCode] = useState<number | null>(null);
  const [activeEndpointFilter, setActiveEndpointFilter] = useState<string | null>(null);

  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [contextMenuPos, setContextMenuPos] = useState<ContextMenuPosition | null>(null);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isTimeTravelOpen, setIsTimeTravelOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Inspector Drawer state
  const [inspectingLog, setInspectingLog] = useState<ApiRequestLog | null>(null);

  // Day 8: Real-Time Stream, Tail-Mode, and Backpressure Monitor Hook
  const {
    isPaused,
    togglePause,
    isAutoScrollLocked,
    toggleAutoScrollLock,
    samplingMode,
    toggleSamplingMode,
    timeTravelOffset,
    setTimeTravelOffset,
    resetTimeTravel,
    isTimeTraveling,
    ingestionRate,
    backpressureRatio,
    recent5xxCount,
    hasRecent5xxBurst,
    pausedQueuedCount,
    visibleLogs,
  } = useLogStream(logs);

  const { sortConfig, toggleSort, sortLogs } = useTableSorting('timestamp', 'desc');

  // Multi-facet filtering logic
  const filteredLogs = useMemo(() => {
    let result = visibleLogs;

    // Search input (supports structured predicates, regex, and substring search)
    if (searchInput.trim()) {
      result = result.filter((l) => evaluateLogQuery(l, searchInput));
    }

    // Faceted Method filter
    if (activeMethods.size > 0) {
      result = result.filter((l) => activeMethods.has(l.method));
    }

    // Faceted Status filter
    if (activeStatusCode !== null) {
      result = result.filter((l) => l.statusCode === activeStatusCode);
    }

    // Faceted Endpoint filter
    if (activeEndpointFilter) {
      result = result.filter((l) => l.endpoint === activeEndpointFilter);
    }

    return sortLogs(result);
  }, [visibleLogs, searchInput, activeMethods, activeStatusCode, activeEndpointFilter, sortLogs]);

  // Keyboard shortcut listener for '?' cheat sheet
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close context menu on outside clicks
  useEffect(() => {
    const handleCloseMenu = () => setContextMenuPos(null);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, []);

  // Selection handlers
  const handleToggleSelectRow = useCallback((id: string) => {
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedLogIds((prev) => {
      if (prev.size === filteredLogs.length) return new Set();
      return new Set(filteredLogs.map((l) => l.id));
    });
  }, [filteredLogs]);

  const handleClearAllFilters = () => {
    setSearchInput('');
    setActiveMethods(new Set());
    setActiveStatusCode(null);
    setActiveEndpointFilter(null);
  };

  const hasActiveFilters =
    searchInput.trim().length > 0 ||
    activeMethods.size > 0 ||
    activeStatusCode !== null ||
    activeEndpointFilter !== null;

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* 1. Live Tail Stream Toolbar & Backpressure Meter */}
      <TailStreamControls
        isPaused={isPaused}
        onTogglePause={togglePause}
        isAutoScrollLocked={isAutoScrollLocked}
        onToggleAutoScroll={toggleAutoScrollLock}
        ingestionRate={ingestionRate}
        samplingMode={samplingMode}
        onToggleSampling={toggleSamplingMode}
        backpressureRatio={backpressureRatio}
        hasRecent5xxBurst={hasRecent5xxBurst}
        recent5xxCount={recent5xxCount}
        isTimeTraveling={isTimeTraveling}
        timeTravelOffset={timeTravelOffset}
        onOpenTimeTravel={() => setIsTimeTravelOpen((prev) => !prev)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        totalLogsCount={totalLogsCount}
        filteredLogsCount={filteredLogs.length}
        pausedQueuedCount={pausedQueuedCount}
      />

      {/* 2. Zero-Copy Time-Travel Buffer Scrubber Panel */}
      <StreamTimeTravel
        isOpen={isTimeTravelOpen}
        onClose={() => setIsTimeTravelOpen(false)}
        timeTravelOffset={timeTravelOffset}
        onOffsetChange={setTimeTravelOffset}
        onResetLive={resetTimeTravel}
        totalLogsCount={totalLogsCount}
        visibleLogsCount={visibleLogs.length}
        newestLogTimestamp={logs[0]?.timestamp || 0}
      />

      {/* 3. Smart Syntax Query Bar & Curated SRE Snippet Library */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-2xl border border-slate-800/80 bg-[#131B2E]/80 backdrop-blur-xl">
        <div className="flex-1">
          <RegexLibrary
            query={searchInput}
            onQueryChange={setSearchInput}
            onApplyQuery={(q) => setSearchInput(q)}
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          {hasActiveFilters && (
            <button
              onClick={handleClearAllFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset Filters
            </button>
          )}

          <button
            onClick={() => onInjectBurst(2000)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-mono transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)]"
          >
            <Sparkles className="h-3 w-3 text-amber-400" />
            +2k Burst
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-500/30 bg-[#1E293B] hover:bg-slate-800 text-indigo-300 text-xs font-mono transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export Studio
          </button>
        </div>
      </div>

      {/* Active Filter Chips Bar */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs font-mono text-slate-500">Filters:</span>

          {searchInput && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              Query: &quot;{searchInput}&quot; {isRegexMode && '(regex)'}
              <button onClick={() => setSearchInput('')} className="hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {Array.from(activeMethods).map((m) => (
            <span
              key={m}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
            >
              Method: {m}
              <button
                onClick={() => {
                  const next = new Set(activeMethods);
                  next.delete(m);
                  setActiveMethods(next);
                }}
                className="hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          {activeStatusCode !== null && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30">
              Status: {activeStatusCode}
              <button onClick={() => setActiveStatusCode(null)} className="hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {activeEndpointFilter && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
              Endpoint: {activeEndpointFilter}
              <button onClick={() => setActiveEndpointFilter(null)} className="hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Virtualized Table or Smart Empty State */}
      {filteredLogs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 rounded-2xl border border-slate-800/80 bg-[#131B2E]/50 text-center backdrop-blur-xl">
          <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-4 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            <Filter className="h-8 w-8" />
          </div>
          <h3 className="text-base font-semibold text-white">No Matching Telemetry Logs</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Current filters excluded all {totalLogsCount} indexed records. Clear your filters or inject synthetic traffic to populate the grid.
          </p>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleClearAllFilters}
              className="px-4 py-2 rounded-xl text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
            >
              Clear Active Filters
            </button>
            <button
              onClick={() => onInjectBurst(2000)}
              className="px-4 py-2 rounded-xl text-xs font-mono font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-indigo-400/40 transition-all"
            >
              Inject Synthetic Test Burst (+2,000 requests)
            </button>
          </div>
        </div>
      ) : (
        <RequestLogTable
          logs={filteredLogs}
          totalLogsCount={totalLogsCount}
          timeBuckets={timeBuckets}
          density={density}
          sortConfig={sortConfig}
          onSort={toggleSort}
          onRowContextMenu={(e, log) => {
            setContextMenuPos({ x: e.clientX, y: e.clientY, log });
          }}
          onMethodClick={(method) => {
            const next = new Set(activeMethods);
            if (next.has(method)) next.delete(method);
            else next.add(method);
            setActiveMethods(next);
          }}
          onStatusClick={(statusCode) => {
            setActiveStatusCode(activeStatusCode === statusCode ? null : statusCode);
          }}
          selectedLogIds={selectedLogIds}
          onToggleSelectRow={handleToggleSelectRow}
          onToggleSelectAll={handleToggleSelectAll}
          searchTerm={searchInput}
          isAutoTailActive={isAutoScrollLocked && !isPaused}
          onResumeAutoTail={() => {
            if (isPaused) togglePause();
            if (!isAutoScrollLocked) toggleAutoScrollLock();
          }}
          onInspectLog={(log) => setInspectingLog(log)}
        />
      )}

      {/* Floating Bulk Selection Action Banner */}
      {selectedLogIds.size > 0 && (
        <div className="sticky bottom-4 z-40 flex items-center justify-between px-5 py-3 rounded-2xl border border-indigo-500/40 bg-[#0B0F17]/95 backdrop-blur-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] text-white animate-in slide-in-from-bottom-3 duration-150">
          <div className="flex items-center gap-3">
            <CheckSquare className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-mono font-semibold">
              {selectedLogIds.size} of {filteredLogs.length} logs selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const selectedList = logs.filter((l) => selectedLogIds.has(l.id));
                const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(selectedList, null, 2))}`;
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute('href', jsonStr);
                downloadAnchor.setAttribute('download', `selected_telemetry_${Date.now()}.json`);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-mono bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              Export Selected
            </button>
            <button
              onClick={() => setSelectedLogIds(new Set())}
              className="px-3 py-1.5 rounded-xl text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Floating Context Menu */}
      <ContextMenu
        position={contextMenuPos}
        onClose={() => setContextMenuPos(null)}
        onInspect={(log) => {
          setInspectingLog(log);
        }}
        onCopyCurl={(log) => {
          const headersList = Object.entries(log.requestHeaders || {})
            .map(([k, v]) => `-H '${k}: ${v}'`)
            .join(' ');
          const bodyPart =
            log.requestBody && log.method !== 'GET' && log.method !== 'HEAD'
              ? `-d '${JSON.stringify(log.requestBody)}'`
              : '';
          const curl = `curl -X ${log.method} 'https://api.enterprise-observability.io${log.endpoint}' ${headersList} ${bodyPart}`.trim();
          if (navigator.clipboard) navigator.clipboard.writeText(curl);
        }}
        onFilterEndpoint={(ep) => setActiveEndpointFilter(ep)}
        onExcludeStatus={(status) => {
          setActiveStatusCode(null);
        }}
        onCopyTraceId={(tId) => {
          if (navigator.clipboard) navigator.clipboard.writeText(tId);
        }}
      />

      {/* Slide-Over Trace & Log Inspector Drawer */}
      <LogInspectorDrawer
        log={inspectingLog}
        onClose={() => setInspectingLog(null)}
        onNextLog={() => {
          if (!inspectingLog) return;
          const currentIndex = filteredLogs.findIndex((l) => l.id === inspectingLog.id);
          if (currentIndex !== -1 && currentIndex < filteredLogs.length - 1) {
            setInspectingLog(filteredLogs[currentIndex + 1]);
          }
        }}
        onPrevLog={() => {
          if (!inspectingLog) return;
          const currentIndex = filteredLogs.findIndex((l) => l.id === inspectingLog.id);
          if (currentIndex > 0) {
            setInspectingLog(filteredLogs[currentIndex - 1]);
          }
        }}
        surroundingLogs={
          inspectingLog
            ? logs
                .filter(
                  (l) =>
                    Math.abs(l.timestamp - inspectingLog.timestamp) <= 5000 &&
                    l.clientIp === inspectingLog.clientIp
                )
                .slice(0, 10)
            : []
        }
        onFilterTag={(k, v) => {
          setSearchInput(`${k}:${v}`);
        }}
        onFilterEndpoint={(ep) => {
          setActiveEndpointFilter(ep);
        }}
      />

      {/* Keyboard Shortcuts Cheat Sheet */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Advanced Log Export Studio Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        filteredLogs={filteredLogs}
        allLogs={logs}
        selectedLogIds={selectedLogIds}
      />
    </div>
  );
};
