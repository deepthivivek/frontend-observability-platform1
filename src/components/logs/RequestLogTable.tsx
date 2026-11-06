'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Terminal,
  ExternalLink,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  AlertCircle,
  Clock,
  Radio,
  Eye,
} from 'lucide-react';
import { ApiRequestLog, DensityMode, HttpMethod } from '../../types/telemetry';
import { SortConfig, SortField } from '../../hooks/useTableSorting';
import { HistogramHeader } from './HistogramHeader';
import { TimeBucket } from '../../types/telemetry';

interface RequestLogTableProps {
  logs: ApiRequestLog[];
  totalLogsCount: number;
  timeBuckets: TimeBucket[];
  anomalousIds?: Set<string>;
  density: DensityMode;
  sortConfig: SortConfig;
  onSort: (field: SortField) => void;
  onRowContextMenu: (e: React.MouseEvent, log: ApiRequestLog) => void;
  onMethodClick: (method: HttpMethod) => void;
  onStatusClick: (statusCode: number) => void;
  selectedLogIds: Set<string>;
  onToggleSelectRow: (id: string) => void;
  onToggleSelectAll: () => void;
  searchTerm?: string;
  isAutoTailActive: boolean;
  onResumeAutoTail: () => void;
  onInspectLog?: (log: ApiRequestLog) => void;
}

export const RequestLogTable: React.FC<RequestLogTableProps> = ({
  logs,
  totalLogsCount,
  timeBuckets,
  anomalousIds = new Set(),
  density,
  sortConfig,
  onSort,
  onRowContextMenu,
  onMethodClick,
  onStatusClick,
  selectedLogIds,
  onToggleSelectRow,
  onToggleSelectAll,
  searchTerm = '',
  isAutoTailActive,
  onResumeAutoTail,
  onInspectLog,
}) => {
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Toggle inline accordion expansion
  const toggleRowExpansion = useCallback((id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Quick Copy Trace ID with visual feedback
  const handleCopyTraceId = (e: React.MouseEvent, traceId: string, id: string) => {
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(traceId);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  // Generate and Copy as cURL
  const handleCopyCurl = (e: React.MouseEvent, log: ApiRequestLog) => {
    e.stopPropagation();
    const headersList = Object.entries(log.requestHeaders || {})
      .map(([k, v]) => `-H '${k}: ${v}'`)
      .join(' ');
    const bodyPart =
      log.requestBody && log.method !== 'GET' && log.method !== 'HEAD'
        ? `-d '${JSON.stringify(log.requestBody)}'`
        : '';
    const curlCommand = `curl -X ${log.method} 'https://api.enterprise-observability.io${log.endpoint}' ${headersList} ${bodyPart}`.trim();

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(curlCommand);
      setCopiedId(`curl_${log.id}`);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="h-3 w-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-indigo-400" />
    ) : (
      <ArrowDown className="h-3 w-3 text-indigo-400" />
    );
  };

  const rowPaddingClass = density === 'compact' ? 'py-1.5 px-3 text-xs' : 'py-3 px-4 text-xs';

  return (
    <div className="relative flex flex-col h-full rounded-2xl border border-slate-800/80 bg-[#131B2E]/80 backdrop-blur-xl shadow-xl overflow-hidden">
      {/* Time-Bucket Density Histogram Bar */}
      <HistogramHeader buckets={timeBuckets} totalLogsCount={totalLogsCount} />

      {/* Table Body with Horizontal/Vertical Scroll & Column Pinning */}
      <div
        ref={tableContainerRef}
        className="flex-1 overflow-auto relative font-mono text-slate-300"
      >
        <table className="w-full border-collapse text-left min-w-[900px]">
          {/* Table Header */}
          <thead className="sticky top-0 z-20 bg-[#0B0F17]/95 border-b border-slate-800/80 text-[10px] uppercase tracking-wider text-slate-400 backdrop-blur-md">
            <tr>
              {/* Pinned Checkbox & Method & Endpoint */}
              <th className="py-2.5 px-3 sticky left-0 z-30 bg-[#0B0F17] w-10 text-center">
                <input
                  type="checkbox"
                  aria-label="Select all visible logs"
                  checked={logs.length > 0 && selectedLogIds.size === logs.length}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
              </th>

              <th className="py-2.5 px-3 sticky left-10 z-30 bg-[#0B0F17] w-12 text-center">
                <span className="sr-only">Expand</span>
              </th>

              <th
                onClick={() => onSort('method')}
                className="py-2.5 px-3 sticky left-[88px] z-30 bg-[#0B0F17] cursor-pointer group select-none w-24"
              >
                <div className="flex items-center gap-1.5">
                  <span>Method</span>
                  {getSortIcon('method')}
                </div>
              </th>

              <th
                onClick={() => onSort('endpoint')}
                className="py-2.5 px-4 sticky left-[184px] z-30 bg-[#0B0F17] cursor-pointer group select-none min-w-[220px] shadow-[4px_0_12px_rgba(0,0,0,0.5)] border-r border-slate-800/60"
              >
                <div className="flex items-center gap-1.5">
                  <span>Endpoint</span>
                  {getSortIcon('endpoint')}
                </div>
              </th>

              {/* Unpinned Scrollable Columns */}
              <th
                onClick={() => onSort('statusCode')}
                className="py-2.5 px-4 cursor-pointer group select-none w-28"
              >
                <div className="flex items-center gap-1.5">
                  <span>Status</span>
                  {getSortIcon('statusCode')}
                </div>
              </th>

              <th
                onClick={() => onSort('latencyMs')}
                className="py-2.5 px-4 cursor-pointer group select-none w-28"
              >
                <div className="flex items-center gap-1.5">
                  <span>Latency</span>
                  {getSortIcon('latencyMs')}
                </div>
              </th>

              <th className="py-2.5 px-4 min-w-[180px]">Trace ID</th>

              <th
                onClick={() => onSort('timestamp')}
                className="py-2.5 px-4 cursor-pointer group select-none w-36"
              >
                <div className="flex items-center gap-1.5">
                  <span>Timestamp</span>
                  {getSortIcon('timestamp')}
                </div>
              </th>

              <th className="py-2.5 px-4 text-right w-24">Actions</th>
            </tr>
          </thead>

          {/* Table Rows */}
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {logs.map((log) => {
              const isSelected = selectedLogIds.has(log.id);
              const isExpanded = expandedLogIds.has(log.id);
              const isAnomalous = anomalousIds.has(log.id) || (log.statusCode >= 500 && log.latencyMs > 300);

              // Vibrant Accents according to status code and method
              const methodBadgeClass =
                log.method === 'GET'
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.12)]'
                  : log.method === 'POST'
                  ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.12)]'
                  : log.method === 'PUT'
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/30';

              const statusBadgeClass =
                log.statusCode < 300
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : log.statusCode < 400
                  ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30'
                  : log.statusCode < 500
                  ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                  : 'text-rose-400 bg-rose-500/10 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.25)]';

              return (
                <React.Fragment key={log.id}>
                  <tr
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onRowContextMenu(e, log);
                    }}
                    onClick={() => toggleRowExpansion(log.id)}
                    className={`group transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-indigo-950/40'
                        : isAnomalous
                        ? 'bg-rose-950/20 hover:bg-rose-950/30'
                        : 'hover:bg-slate-800/40'
                    } ${isAnomalous ? 'border-l-2 border-l-rose-500 animate-pulse' : ''}`}
                  >
                    {/* Pinned Checkbox */}
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className={`${rowPaddingClass} sticky left-0 z-10 bg-[#0B0F17] text-center w-10`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select row ${log.id}`}
                        checked={isSelected}
                        onChange={() => onToggleSelectRow(log.id)}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 cursor-pointer"
                      />
                    </td>

                    {/* Expand Arrow */}
                    <td className={`${rowPaddingClass} sticky left-10 z-10 bg-[#0B0F17] text-center w-12 text-slate-400`}>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-indigo-400 mx-auto" />
                      ) : (
                        <ChevronRight className="h-4 w-4 mx-auto group-hover:text-slate-200" />
                      )}
                    </td>

                    {/* Method with Faceted Click */}
                    <td className={`${rowPaddingClass} sticky left-[88px] z-10 bg-[#0B0F17] w-24`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMethodClick(log.method);
                        }}
                        title={`Filter by method: ${log.method}`}
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] border transition-transform active:scale-95 ${methodBadgeClass}`}
                      >
                        {log.method}
                      </button>
                    </td>

                    {/* Endpoint */}
                    <td className={`${rowPaddingClass} sticky left-[184px] z-10 bg-[#0B0F17] font-medium text-white max-w-xs truncate shadow-[4px_0_12px_rgba(0,0,0,0.5)] border-r border-slate-800/60`}>
                      {log.endpoint}
                    </td>

                    {/* Status Code with Faceted Click */}
                    <td className={rowPaddingClass}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusClick(log.statusCode);
                        }}
                        title={`Filter by status: ${log.statusCode}`}
                        className={`px-2 py-0.5 rounded-md font-bold text-[11px] border transition-transform active:scale-95 ${statusBadgeClass}`}
                      >
                        {log.statusCode}
                      </button>
                    </td>

                    {/* Latency */}
                    <td className={rowPaddingClass}>
                      <span
                        className={
                          log.latencyMs > 300
                            ? 'text-rose-400 font-bold'
                            : log.latencyMs > 150
                            ? 'text-amber-400 font-semibold'
                            : 'text-slate-300'
                        }
                      >
                        {log.latencyMs}ms
                      </span>
                    </td>

                    {/* Trace ID */}
                    <td className={rowPaddingClass}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400 max-w-[130px] truncate" title={log.traceId}>
                          {log.traceId}
                        </span>
                        <button
                          onClick={(e) => handleCopyTraceId(e, log.traceId, log.id)}
                          aria-label="Copy Trace ID"
                          className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors"
                        >
                          {copiedId === log.id ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Timestamp */}
                    <td className={`${rowPaddingClass} text-slate-400 whitespace-nowrap`}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>

                    {/* Quick Row Hover Action: Inspect Trace & Copy as cURL */}
                    <td className={`${rowPaddingClass} text-right`}>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {onInspectLog && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onInspectLog(log);
                            }}
                            title="Inspect Trace & Waterfalls"
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleCopyCurl(e, log)}
                          title="Copy as terminal-ready cURL command"
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors"
                        >
                          {copiedId === `curl_${log.id}` ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Terminal className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline Expanded JSON Accordion View */}
                  {isExpanded && (
                    <tr className="bg-[#0B0F17]/95 border-b border-slate-800">
                      <td colSpan={9} className="p-4 sm:p-5">
                        <div className="rounded-xl border border-slate-800 bg-[#131B2E] p-4 text-xs font-mono space-y-4 shadow-inner">
                          {/* Top Meta Bar */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800 text-slate-400">
                            <div className="flex items-center gap-3">
                              <span>Client IP: <strong className="text-white">{log.clientIp}</strong></span>
                              <span>Span: <strong className="text-indigo-400">{log.spanId}</strong></span>
                            </div>
                            <button
                              onClick={(e) => handleCopyCurl(e, log)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-emerald-400 text-xs transition-colors"
                            >
                              <Terminal className="h-3 w-3" />
                              Copy cURL
                            </button>
                          </div>

                          {/* Grid Columns for Headers, Body & Error details */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Request Headers */}
                            <div>
                              <div className="text-[11px] uppercase font-bold text-slate-400 mb-1.5">
                                Request Headers
                              </div>
                              <pre className="p-3 rounded-lg bg-[#080C14] border border-slate-800/80 text-indigo-200 overflow-x-auto max-h-40">
                                {JSON.stringify(log.requestHeaders, null, 2)}
                              </pre>
                            </div>

                            {/* Request / Response Body */}
                            <div>
                              <div className="text-[11px] uppercase font-bold text-slate-400 mb-1.5">
                                Payloads
                              </div>
                              <pre className="p-3 rounded-lg bg-[#080C14] border border-slate-800/80 text-emerald-200 overflow-x-auto max-h-40">
                                {JSON.stringify(
                                  {
                                    requestBody: log.requestBody,
                                    responseBody: log.responseBody,
                                  },
                                  null,
                                  2
                                )}
                              </pre>
                            </div>
                          </div>

                          {/* Error Stack Trace if exists */}
                          {log.errorDetails && (
                            <div className="pt-2 border-t border-slate-800">
                              <div className="text-[11px] uppercase font-bold text-rose-400 mb-1 flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Error Diagnostics
                              </div>
                              <pre className="p-3 rounded-lg bg-rose-950/30 border border-rose-900/50 text-rose-300 overflow-x-auto">
                                {log.errorDetails.message}
                                {log.errorDetails.stack && `\n\n${log.errorDetails.stack}`}
                              </pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Floating Smart "Tail -f" Resume Button */}
      {!isAutoTailActive && (
        <div className="absolute bottom-4 right-6 z-30">
          <button
            onClick={onResumeAutoTail}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-semibold shadow-[0_0_20px_rgba(99,102,241,0.5)] border border-indigo-400/40 transition-all animate-bounce"
          >
            <Radio className="h-3.5 w-3.5 text-emerald-300 animate-pulse" />
            Resume Live Tail (↓)
          </button>
        </div>
      )}
    </div>
  );
};
