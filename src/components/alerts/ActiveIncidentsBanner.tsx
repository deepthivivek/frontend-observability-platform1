'use client';

import React, { useState } from 'react';
import { Incident } from '../../types/alert';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Clock,
  Sparkles,
  Play,
  RotateCcw,
  Check,
  FileText,
  MessageSquare,
  Sliders,
  ChevronRight,
} from 'lucide-react';

interface ActiveIncidentsBannerProps {
  incidents: Incident[];
  onAcknowledge: (id: string, notes: string) => void;
  onResolve: (id: string) => void;
  onInspectTrace: (traceId: string) => void;
  onTriggerRemediation: (id: string) => void;
}

export const ActiveIncidentsBanner: React.FC<ActiveIncidentsBannerProps> = ({
  incidents,
  onAcknowledge,
  onResolve,
  onInspectTrace,
  onTriggerRemediation,
}) => {
  const [selectedIncidentForAck, setSelectedIncidentForAck] = useState<Incident | null>(null);
  const [ackNotes, setAckNotes] = useState('');
  const [activeScrubberStep, setActiveScrubberStep] = useState<number | null>(null);
  const [generatedPostMortem, setGeneratedPostMortem] = useState<string | null>(null);

  const firingIncidents = incidents.filter((inc) => inc.status === 'firing');
  const ackIncidents = incidents.filter((inc) => inc.status === 'acknowledged');
  const resolvedIncidents = incidents.filter((inc) => inc.status === 'resolved');

  const handleGeneratePostMortem = (inc: Incident) => {
    const report = `# Incident Post-Mortem Report: ${inc.title}
**Incident ID:** ${inc.id}
**Severity:** ${inc.severity}
**Environment:** ${inc.environment} (${inc.service})
**Impact Duration:** ${Math.round((Date.now() - inc.startedAt) / 60000)} minutes

### 1. Root Cause Summary
Automated telemetry analysis detected abnormal breach where current metric reached **${inc.currentValue}** against threshold of **${inc.threshold}**.
Deduplication grouped ${inc.subAlertsCount} cascading sub-alerts under this incident.

### 2. Timeline of Events
${inc.timeline.map((t) => `- **${new Date(t.timestamp).toLocaleTimeString()}:** ${t.event}${t.author ? ` (${t.author})` : ''}`).join('\n')}

### 3. Automated Remediation Trigger
${inc.remediationTriggered ? `Successfully executed automated playbook: \`${inc.remediationTriggered}\`.` : 'Manual engineer triage applied.'}

### 4. Preventive Action Items
- Add composite database index to prevent downstream thread pool starvation.
- Adjust auto-scaling threshold triggers from 5m down to 2m.
`;

    setGeneratedPostMortem(report);
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* 1. Header Banner showing firing alerts count */}
      {firingIncidents.length > 0 && (
        <div className="rounded-2xl border border-rose-500/50 bg-rose-950/20 p-4 text-rose-200 backdrop-blur-xl shadow-[0_0_25px_rgba(244,63,94,0.18)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-ping" />
            <div>
              <span className="font-semibold text-sm text-white flex items-center gap-2">
                {firingIncidents.length} Active Production Incidents Firing
              </span>
              <p className="text-xs text-rose-300/80">
                Cascading alerts deduplicated into root incident clusters.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
            Escalation Active
          </span>
        </div>
      )}

      {/* 2. List of Aggregated Root Incidents */}
      <div className="space-y-3">
        {incidents.length === 0 ? (
          <div className="p-8 rounded-2xl border border-slate-800 bg-[#131B2E]/60 text-center text-slate-500">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-80" />
            <h4 className="text-sm font-semibold text-white">All Systems Operational</h4>
            <p className="text-xs text-slate-400 mt-1">No active incidents or rule breaches in the buffer.</p>
          </div>
        ) : (
          incidents.map((inc) => {
            const isFiring = inc.status === 'firing';
            const isAck = inc.status === 'acknowledged';

            return (
              <div
                key={inc.id}
                className={`rounded-2xl border p-5 backdrop-blur-xl transition-all ${
                  isFiring
                    ? 'border-rose-500/50 bg-[#1E1724]/90 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                    : isAck
                    ? 'border-amber-500/40 bg-[#1E1E24]/90'
                    : 'border-slate-800 bg-[#131B2E]/70'
                }`}
              >
                {/* Top incident meta */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        inc.severity === 'P1-Critical'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {inc.severity}
                    </span>
                    <span className="font-semibold text-sm text-white font-sans">{inc.title}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      {inc.environment} • {inc.service}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                        isFiring
                          ? 'bg-rose-500 text-white animate-pulse'
                          : isAck
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {inc.status}
                    </span>
                    <span className="text-slate-400 text-xs">
                      Started: {new Date(inc.startedAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Sub-Alert Deduplication & Metrics Breakdown */}
                <div className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Observed vs Threshold</span>
                      <strong className={isFiring ? 'text-rose-400' : 'text-slate-200'}>
                        {inc.currentValue} / {inc.threshold}
                      </strong>
                    </div>

                    <div className="h-6 w-px bg-slate-800" />

                    <div>
                      <span className="text-slate-500 text-[10px] block">Deduplicated Sub-Alerts</span>
                      <span className="text-indigo-400 font-bold">
                        {inc.subAlertsCount} sub-alerts bundled
                      </span>
                    </div>

                    {inc.remediationTriggered && (
                      <>
                        <div className="h-6 w-px bg-slate-800" />
                        <div>
                          <span className="text-slate-500 text-[10px] block">Self-Healing Remediation</span>
                          <span className="text-emerald-400 font-bold">
                            {inc.remediationTriggered} (Executed)
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Deep Link to Trace */}
                    {inc.rootCauseTraceId && (
                      <button
                        onClick={() => onInspectTrace(inc.rootCauseTraceId!)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 font-semibold transition-colors shadow-[0_0_10px_rgba(99,102,241,0.2)]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Inspect Root Cause Trace
                      </button>
                    )}

                    {/* Acknowledge Button */}
                    {isFiring && (
                      <button
                        onClick={() => setSelectedIncidentForAck(inc)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold transition-colors"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Acknowledge &amp; Note
                      </button>
                    )}

                    {/* Resolve Button */}
                    {!inc.resolvedAt && (
                      <button
                        onClick={() => onResolve(inc.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-semibold transition-colors"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Resolve Incident
                      </button>
                    )}

                    {/* Self-Healing Trigger */}
                    {isFiring && !inc.remediationTriggered && (
                      <button
                        onClick={() => onTriggerRemediation(inc.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-semibold transition-colors"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Run Remediation
                      </button>
                    )}

                    {/* AI Post-Mortem Export */}
                    <button
                      onClick={() => handleGeneratePostMortem(inc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      AI Post-Mortem
                    </button>
                  </div>
                </div>

                {/* Acknowledged Engineer Notes preview */}
                {inc.acknowledgementNotes && (
                  <div className="mt-2 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-300 font-sans">
                    <strong>Triage Note ({inc.acknowledgedBy || 'Engineer'}):</strong> {inc.acknowledgementNotes}
                  </div>
                )}

                {/* 3. Incident Timeline Replay Scrubber */}
                <div className="mt-3 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span className="flex items-center gap-1.5 font-bold uppercase text-slate-400">
                      <Clock className="h-3.5 w-3.5 text-indigo-400" />
                      Incident Timeline Playback Scrubber
                    </span>
                    <span>{inc.timeline.length} Recorded State Transitions</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {inc.timeline.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-[#0B0F17] border border-slate-800 text-[11px]"
                      >
                        <div className="text-slate-500 text-[10px]">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="font-semibold text-slate-200 truncate">{item.event}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Triage Acknowledge Modal */}
      {selectedIncidentForAck && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#080C14]/80 backdrop-blur-md p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#131B2E] p-5 space-y-4">
            <h3 className="font-semibold text-white text-sm">
              Acknowledge Incident: {selectedIncidentForAck.title}
            </h3>
            <p className="text-xs text-slate-400">
              Provide triage context and notes for the incident responder thread.
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Scaling up database read replica pool to clear queued lock threads..."
              value={ackNotes}
              onChange={(e) => setAckNotes(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-800 bg-[#0B0F17] text-white text-xs focus:outline-none focus:border-indigo-500 font-sans"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setSelectedIncidentForAck(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onAcknowledge(selectedIncidentForAck.id, ackNotes);
                  setSelectedIncidentForAck(null);
                  setAckNotes('');
                }}
                className="px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
              >
                Confirm Acknowledgement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Post-Mortem Report Drawer Modal */}
      {generatedPostMortem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#080C14]/80 backdrop-blur-md p-4"
          onClick={() => setGeneratedPostMortem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-slate-800 bg-[#131B2E] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-white text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                AI Incident Post-Mortem Report
              </h3>
              <button
                onClick={() => setGeneratedPostMortem(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-[#080C14] border border-slate-800 text-indigo-200 text-xs whitespace-pre-wrap font-mono">
              {generatedPostMortem}
            </pre>
            <div className="text-right">
              <button
                onClick={() => {
                  if (navigator.clipboard) navigator.clipboard.writeText(generatedPostMortem);
                  setGeneratedPostMortem(null);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
              >
                Copy to Clipboard &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
