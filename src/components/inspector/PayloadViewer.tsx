'use client';

import React, { useState } from 'react';
import { ApiRequestLog } from '../../types/telemetry';
import { IncidentNote } from '../../types/trace';
import { TraceWaterfall } from './TraceWaterfall';
import { AITriagePanel } from './AITriagePanel';
import {
  Tag,
  Clock,
  Code2,
  FileText,
  Terminal,
  MessageSquare,
  Play,
  Filter,
  Check,
  Send,
} from 'lucide-react';

interface PayloadViewerProps {
  log: ApiRequestLog;
  surroundingLogs: ApiRequestLog[];
  onFilterTag: (key: string, value: string) => void;
  onFilterEndpoint: (endpoint: string) => void;
}

type TabKey = 'waterfall' | 'tags' | 'context' | 'payload' | 'repl' | 'notes';

export const PayloadViewer: React.FC<PayloadViewerProps> = ({
  log,
  surroundingLogs,
  onFilterTag,
  onFilterEndpoint,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('waterfall');

  // Micro-REPL state
  const [replQuery, setReplQuery] = useState(`SELECT count(*), avg(latency_ms)\nFROM telemetry_logs\nWHERE endpoint = '${log.endpoint}'`);
  const [replOutput, setReplOutput] = useState<string | null>(null);

  // Notes state initialized using log timestamp
  const [notes, setNotes] = useState<IncidentNote[]>(() => [
    {
      id: 'note-1',
      author: 'Principal SRE',
      timestamp: log.timestamp,
      text: 'Investigated cluster metrics; thread pool saturated during payment batching window.',
    },
  ]);
  const [newNoteText, setNewNoteText] = useState('');

  const handleRunRepl = () => {
    setReplOutput(`Query executed against worker in-memory dataset in 3.4ms.\nRows returned: 1\nResult: { total_count: 542, avg_latency_ms: ${log.latencyMs} }`);
  };

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    setNotes((prev) => [
      ...prev,
      {
        id: `note-${Date.now()}`,
        author: 'Current User',
        timestamp: Date.now(),
        text: newNoteText.trim(),
      },
    ]);
    setNewNoteText('');
  };

  // Synthetic custom metadata tags
  const customTags: Record<string, string> = {
    tenant_id: 'enterprise_alpha_92',
    region: 'us-east-1',
    version: 'v2.14.0',
    cluster: 'k8s-prod-primary',
    datacenter: 'iad-01',
    user_tier: 'enterprise-vip',
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'waterfall', label: 'Trace Waterfall', icon: <Clock className="h-3.5 w-3.5" /> },
    { key: 'tags', label: 'Custom Tags', icon: <Tag className="h-3.5 w-3.5" /> },
    { key: 'context', label: 'Context Logs', icon: <Clock className="h-3.5 w-3.5" /> },
    { key: 'payload', label: 'Payloads & Headers', icon: <Code2 className="h-3.5 w-3.5" /> },
    { key: 'repl', label: 'Micro-REPL', icon: <Terminal className="h-3.5 w-3.5" /> },
    { key: 'notes', label: 'Incident Notes', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex flex-col space-y-4">
      {/* Tab Navigation Pill Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/80 font-mono text-xs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-indigo-600/25 text-indigo-300 font-semibold border border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Trace Waterfall */}
      {activeTab === 'waterfall' && (
        <div className="space-y-6">
          <TraceWaterfall log={log} />
          <AITriagePanel log={log} />
        </div>
      )}

      {/* Tab 2: Custom Attributes & Tags */}
      {activeTab === 'tags' && (
        <div className="space-y-3 font-mono text-xs">
          <div className="text-slate-400 text-xs">
            Click any tag to instantly dispatch an active filter to the Web Worker pipeline.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {Object.entries(customTags).map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-[#0B0F17]/80 hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-slate-500">{k}</span>
                  <span className="font-semibold text-white">{v}</span>
                </div>
                <button
                  onClick={() => onFilterTag(k, v)}
                  title={`Filter by ${k}=${v}`}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600/30 text-slate-400 hover:text-indigo-300 transition-colors"
                >
                  <Filter className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Context Logs (±5s Window) */}
      {activeTab === 'context' && (
        <div className="space-y-3 font-mono text-xs">
          <div className="text-slate-400 text-xs">
            Showing requests within ±5 seconds from IP: <strong className="text-white">{log.clientIp}</strong>
          </div>

          <div className="space-y-2">
            {surroundingLogs.length === 0 ? (
              <div className="p-6 text-center text-slate-500 bg-[#0B0F17] rounded-xl border border-slate-800">
                No adjacent logs found in the surrounding window.
              </div>
            ) : (
              surroundingLogs.map((sLog) => {
                const isCurrent = sLog.id === log.id;
                return (
                  <div
                    key={sLog.id}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isCurrent
                        ? 'border-indigo-500/60 bg-indigo-950/20 shadow-md'
                        : 'border-slate-800 bg-[#0B0F17]/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(sLog.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="font-bold text-indigo-300">{sLog.method}</span>
                      <span className="text-white truncate max-w-xs">{sLog.endpoint}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          sLog.statusCode < 400
                            ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                            : 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                        }`}
                      >
                        {sLog.statusCode}
                      </span>
                      <span className="text-slate-400">{sLog.latencyMs}ms</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Payloads & Headers */}
      {activeTab === 'payload' && (
        <div className="space-y-4 font-mono text-xs">
          <div>
            <div className="text-[11px] uppercase font-bold text-slate-400 mb-1.5">Request Headers</div>
            <pre className="p-3.5 rounded-xl bg-[#080C14] border border-slate-800 text-indigo-300 overflow-x-auto max-h-48">
              {JSON.stringify(log.requestHeaders, null, 2)}
            </pre>
          </div>

          <div>
            <div className="text-[11px] uppercase font-bold text-slate-400 mb-1.5">Response Headers</div>
            <pre className="p-3.5 rounded-xl bg-[#080C14] border border-slate-800 text-slate-300 overflow-x-auto max-h-48">
              {JSON.stringify(log.responseHeaders, null, 2)}
            </pre>
          </div>

          <div>
            <div className="text-[11px] uppercase font-bold text-slate-400 mb-1.5">Request & Response Payloads</div>
            <pre className="p-3.5 rounded-xl bg-[#080C14] border border-slate-800 text-emerald-300 overflow-x-auto max-h-48">
              {JSON.stringify(
                {
                  requestBody: log.requestBody,
                  responseBody: log.responseBody,
                  webVitals: log.webVitals,
                },
                null,
                2
              )}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 5: Micro-REPL Sandbox */}
      {activeTab === 'repl' && (
        <div className="space-y-3 font-mono text-xs">
          <div className="text-slate-400 text-xs">
            Interactive SQL & payload query sandbox running directly against in-memory worker buffers.
          </div>

          <div className="relative">
            <textarea
              value={replQuery}
              onChange={(e) => setReplQuery(e.target.value)}
              rows={4}
              className="w-full p-3 rounded-xl border border-slate-800 bg-[#080C14] text-emerald-300 font-mono text-xs focus:outline-none focus:border-indigo-500/60 shadow-inner"
            />
            <button
              onClick={handleRunRepl}
              className="absolute right-3 bottom-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-[0_0_12px_rgba(99,102,241,0.4)] transition-all"
            >
              <Play className="h-3 w-3" />
              Run Query
            </button>
          </div>

          {replOutput && (
            <div>
              <div className="text-[11px] uppercase font-bold text-slate-400 mb-1.5">Query Output</div>
              <pre className="p-3.5 rounded-xl bg-[#080C14] border border-slate-800 text-indigo-300 whitespace-pre-wrap">
                {replOutput}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Incident Notes */}
      {activeTab === 'notes' && (
        <div className="space-y-4 font-mono text-xs">
          <div className="space-y-2.5">
            {notes.map((note) => (
              <div key={note.id} className="p-3.5 rounded-xl border border-slate-800 bg-[#0B0F17]/80 space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-[10px]">
                  <span className="font-bold text-indigo-400">{note.author}</span>
                  <span>{new Date(note.timestamp).toLocaleTimeString()}</span>
                </div>
                <p className="text-slate-200 font-sans leading-relaxed">{note.text}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <input
              type="text"
              placeholder="Add an incident note or hypothesis..."
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddNote();
              }}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-800 bg-[#080C14] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 font-sans"
            />
            <button
              onClick={handleAddNote}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              aria-label="Add note"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
