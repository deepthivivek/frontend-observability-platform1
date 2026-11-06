'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Archive,
  Shield,
  ShieldCheck,
  Check,
  Split,
  Eye,
  CheckSquare,
  Square,
  AlertCircle,
  Copy,
} from 'lucide-react';
import { ApiRequestLog } from '../../types/telemetry';
import {
  ExportFormat,
  ExportScope,
  ExportField,
  ExportOptions,
} from '../../types/logStream';
import {
  ALL_EXPORT_FIELDS,
  generateLogExport,
  diffPayloads,
} from '../../utils/logExportUtils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredLogs: ApiRequestLog[];
  allLogs: ApiRequestLog[];
  selectedLogIds: Set<string>;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  filteredLogs,
  allLogs,
  selectedLogIds,
}) => {
  const [format, setFormat] = useState<ExportFormat>('json');
  const [scope, setScope] = useState<ExportScope>(
    selectedLogIds.size > 0 ? 'selected' : 'filtered'
  );
  const [selectedFields, setSelectedFields] = useState<Set<ExportField>>(
    new Set([
      'timestamp',
      'method',
      'endpoint',
      'statusCode',
      'latencyMs',
      'traceId',
      'clientIp',
      'errorDetails',
    ])
  );
  const [redactPii, setRedactPii] = useState(true);
  const [activeTab, setActiveTab] = useState<'export' | 'diff'>('export');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Payload Diff state: select two logs to compare
  const [baselineIndex, setBaselineIndex] = useState<number>(0);
  const [targetIndex, setTargetIndex] = useState<number>(
    Math.min(1, Math.max(0, filteredLogs.length - 1))
  );

  const baselineLog = filteredLogs[baselineIndex] || allLogs[0];
  const targetLog = filteredLogs[targetIndex] || allLogs[1] || allLogs[0];

  const diffEntries = useMemo(() => {
    if (!baselineLog || !targetLog) return [];
    return diffPayloads(
      {
        method: baselineLog.method,
        endpoint: baselineLog.endpoint,
        statusCode: baselineLog.statusCode,
        requestBody: baselineLog.requestBody,
        responseBody: baselineLog.responseBody,
        requestHeaders: baselineLog.requestHeaders,
      },
      {
        method: targetLog.method,
        endpoint: targetLog.endpoint,
        statusCode: targetLog.statusCode,
        requestBody: targetLog.requestBody,
        responseBody: targetLog.responseBody,
        requestHeaders: targetLog.requestHeaders,
      }
    );
  }, [baselineLog, targetLog]);

  // Resolve which logs to export
  const targetLogs = useMemo(() => {
    if (scope === 'selected') {
      return allLogs.filter((l) => selectedLogIds.has(l.id));
    }
    if (scope === 'all') {
      return allLogs;
    }
    return filteredLogs;
  }, [scope, allLogs, filteredLogs, selectedLogIds]);

  const toggleField = (field: ExportField) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        if (next.size > 1) next.delete(field); // Keep at least one
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const handleSelectAllFields = () => {
    setSelectedFields(new Set(ALL_EXPORT_FIELDS.map((f) => f.key)));
  };

  const handleClearFields = () => {
    setSelectedFields(new Set(['timestamp', 'method', 'endpoint', 'statusCode']));
  };

  const handleExecuteExport = () => {
    const exportOptions: ExportOptions = {
      format,
      scope,
      fields: Array.from(selectedFields),
      redactPii,
    };

    const { content, mimeType, filename } = generateLogExport(targetLogs, exportOptions);

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => {
      setDownloadSuccess(false);
      onClose();
    }, 1500);
  };

  const FORMAT_OPTIONS: { id: ExportFormat; title: string; ext: string; desc: string; icon: React.ReactNode }[] = [
    {
      id: 'json',
      title: 'JSON Array',
      ext: '.json',
      desc: 'Standard JSON array format for APIs, tooling, and scripting.',
      icon: <FileJson className="h-4 w-4 text-indigo-400" />,
    },
    {
      id: 'csv',
      title: 'CSV Spreadsheet',
      ext: '.csv',
      desc: 'Comma-separated values ready for Excel, Sheets, or BI dashboards.',
      icon: <FileSpreadsheet className="h-4 w-4 text-emerald-400" />,
    },
    {
      id: 'ndjson',
      title: 'Newline Delimited JSON',
      ext: '.ndjson',
      desc: 'Stream-friendly format for BigQuery, Elasticsearch, and ClickHouse.',
      icon: <FileText className="h-4 w-4 text-amber-400" />,
    },
    {
      id: 'bundle',
      title: 'Diagnostic Bundle',
      ext: '.json',
      desc: 'Telemetry logs bundled with system metrics and environment info.',
      icon: <Archive className="h-4 w-4 text-purple-400" />,
    },
  ];

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080C14]/85 backdrop-blur-md p-4 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#131B2E] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col text-slate-200 backdrop-blur-xl max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0B0F17]/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-base">
                Advanced Log Export Studio &amp; Diagnostic Suite
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Multi-format serialization, compliance PII redaction, and structural payload diffing.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switching: Export Studio vs Payload Diff Viewer */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-800/80 bg-[#0B0F17]/40 font-mono text-xs">
          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2 border-b-2 font-bold transition-all ${
              activeTab === 'export'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Export Generator
          </button>
          <button
            onClick={() => setActiveTab('diff')}
            className={`flex items-center gap-1.5 px-4 py-2 border-b-2 font-bold transition-all ${
              activeTab === 'diff'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Split className="h-3.5 w-3.5" />
            <span>Payload Diff Viewer</span>
          </button>
        </div>

        {/* Tab 1: Export Studio */}
        {activeTab === 'export' && (
          <div className="p-6 space-y-5 overflow-y-auto font-mono text-xs">
            {/* Scope Selection */}
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-2">
                1. Export Scope
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setScope('filtered')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    scope === 'filtered'
                      ? 'border-indigo-500 bg-indigo-500/15 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                      : 'border-slate-800 bg-[#0B0F17]/80 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-white block">Filtered View</span>
                  <span className="text-[11px] text-slate-400">
                    {filteredLogs.length} matching logs
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('selected')}
                  disabled={selectedLogIds.size === 0}
                  className={`p-3 rounded-xl border text-left transition-all disabled:opacity-40 ${
                    scope === 'selected'
                      ? 'border-indigo-500 bg-indigo-500/15 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                      : 'border-slate-800 bg-[#0B0F17]/80 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-white block">Selected Rows</span>
                  <span className="text-[11px] text-slate-400">
                    {selectedLogIds.size} rows checked
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    scope === 'all'
                      ? 'border-indigo-500 bg-indigo-500/15 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                      : 'border-slate-800 bg-[#0B0F17]/80 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-white block">Entire Buffer</span>
                  <span className="text-[11px] text-slate-400">{allLogs.length} total logs</span>
                </button>
              </div>
            </div>

            {/* Format Selection Radio Cards */}
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-2">
                2. Output File Format
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {FORMAT_OPTIONS.map((f) => {
                  const isSelected = format === f.id;
                  return (
                    <div
                      key={f.id}
                      onClick={() => setFormat(f.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-500/80 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                          : 'border-slate-800 bg-[#0B0F17]/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {f.icon}
                          <span className="font-bold text-white">{f.title}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            {f.ext}
                          </span>
                        </div>
                        <input
                          type="radio"
                          name="format"
                          checked={isSelected}
                          onChange={() => setFormat(f.id)}
                          className="accent-indigo-500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 font-sans">{f.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PII Masking & Redaction Toggle */}
            <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-bold text-white block">
                    Automatic Compliance PII Masking
                  </span>
                  <p className="text-[11px] text-emerald-200/80 font-sans">
                    Redacts Authorization Bearer tokens, cookies, passwords, API keys, emails, and IP subnets.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={redactPii}
                  onChange={(e) => setRedactPii(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500" />
              </label>
            </div>

            {/* Field Selectors */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] uppercase font-bold text-slate-400">
                  3. Field Selection ({selectedFields.size} of {ALL_EXPORT_FIELDS.length})
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFields}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Select All
                  </button>
                  <span className="text-slate-600">•</span>
                  <button
                    type="button"
                    onClick={handleClearFields}
                    className="text-[11px] text-slate-400 hover:text-slate-200 underline"
                  >
                    Reset Defaults
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_EXPORT_FIELDS.map((f) => {
                  const isChecked = selectedFields.has(f.key);
                  return (
                    <label
                      key={f.key}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        isChecked
                          ? 'border-indigo-500/50 bg-indigo-950/20 text-white'
                          : 'border-slate-800 bg-[#0B0F17]/60 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleField(f.key)}
                        className="accent-indigo-500 rounded"
                      />
                      <span className="text-[11px] truncate">{f.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Payload Diff Viewer */}
        {activeTab === 'diff' && (
          <div className="p-6 space-y-4 overflow-y-auto font-mono text-xs">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-[#0B0F17]/90 border border-slate-800">
              <div className="flex items-center gap-2 w-full sm:w-1/2">
                <span className="text-slate-400 text-[11px]">Baseline:</span>
                <select
                  value={baselineIndex}
                  onChange={(e) => setBaselineIndex(Number(e.target.value))}
                  className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-[11px]"
                >
                  {filteredLogs.slice(0, 10).map((l, i) => (
                    <option key={l.id} value={i}>
                      #{i + 1} {l.method} {l.endpoint} ({l.statusCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-1/2">
                <span className="text-slate-400 text-[11px]">Target:</span>
                <select
                  value={targetIndex}
                  onChange={(e) => setTargetIndex(Number(e.target.value))}
                  className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-[11px]"
                >
                  {filteredLogs.slice(0, 10).map((l, i) => (
                    <option key={l.id} value={i}>
                      #{i + 1} {l.method} {l.endpoint} ({l.statusCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Structural Delta View */}
            <div className="rounded-xl border border-slate-800 bg-[#0B0F17] overflow-hidden">
              <div className="grid grid-cols-12 bg-slate-900/80 px-4 py-2 border-b border-slate-800 text-[10px] text-slate-400 uppercase font-bold">
                <span className="col-span-4">Payload Key / Path</span>
                <span className="col-span-4">Baseline Value</span>
                <span className="col-span-4">Target Value</span>
              </div>

              <div className="divide-y divide-slate-800/60 max-h-80 overflow-y-auto">
                {diffEntries.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    No structural payload differences detected between selected requests.
                  </div>
                ) : (
                  diffEntries.map((entry, idx) => {
                    const statusClass =
                      entry.status === 'added'
                        ? 'bg-emerald-950/20 text-emerald-300'
                        : entry.status === 'removed'
                        ? 'bg-rose-950/20 text-rose-300'
                        : entry.status === 'modified'
                        ? 'bg-amber-950/20 text-amber-300'
                        : 'text-slate-400';

                    return (
                      <div
                        key={idx}
                        className={`grid grid-cols-12 px-4 py-2 text-[11px] items-center hover:bg-slate-800/40 transition-colors ${statusClass}`}
                      >
                        <span className="col-span-4 font-bold flex items-center gap-1.5 truncate">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              entry.status === 'added'
                                ? 'bg-emerald-400'
                                : entry.status === 'removed'
                                ? 'bg-rose-400'
                                : entry.status === 'modified'
                                ? 'bg-amber-400'
                                : 'bg-slate-600'
                            }`}
                          />
                          {entry.path}
                        </span>

                        <span className="col-span-4 truncate text-slate-400">
                          {entry.baselineValue === undefined
                            ? '<none>'
                            : JSON.stringify(entry.baselineValue)}
                        </span>

                        <span className="col-span-4 truncate font-semibold">
                          {entry.targetValue === undefined
                            ? '<removed>'
                            : JSON.stringify(entry.targetValue)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#0B0F17]/90 font-mono text-xs">
          <div className="text-slate-400">
            Exporting <strong className="text-white">{targetLogs.length}</strong> log records as{' '}
            <strong className="text-indigo-400 uppercase">.{format}</strong>
            {redactPii && <span className="text-emerald-400 ml-1.5">(PII Masked)</span>}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleExecuteExport}
              disabled={targetLogs.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-indigo-400/40 transition-all disabled:opacity-50"
            >
              {downloadSuccess ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span>Downloaded!</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Generate &amp; Download</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
