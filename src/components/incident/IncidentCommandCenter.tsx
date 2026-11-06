'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Flame,
  Clock,
  Sparkles,
  Terminal,
  Activity,
  Layers,
  FileText,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  User,
  Zap,
} from 'lucide-react';
import { Incident, IncidentStatus, RunbookDefinition, RunbookExecutionResult } from '../../types/incident';
import { IncidentChatDrawer } from './IncidentChatDrawer';
import { RunbookActionModal } from './RunbookActionModal';
import { BlastRadiusVisualizer } from './BlastRadiusVisualizer';
import { PostMortemView } from './PostMortemView';

interface IncidentCommandCenterProps {
  canExecuteRunbooks?: boolean;
  canViewIncidents?: boolean;
  currentUser?: { name: string; role: string };
  onNavigateToTraces?: (traceId: string) => void;
}

export const IncidentCommandCenter: React.FC<IncidentCommandCenterProps> = ({
  canExecuteRunbooks = true,
  canViewIncidents = true,
  currentUser = { name: 'Alex Rivera', role: 'SRE Staff' },
  onNavigateToTraces,
}) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('inc-2026-8812');
  const [activeTab, setActiveTab] = useState<'overview' | 'blast_radius' | 'runbooks' | 'post_mortem'>('overview');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedRunbook, setSelectedRunbook] = useState<RunbookDefinition | null>(null);
  const [isRunbookModalOpen, setIsRunbookModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchIncidents = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/incidents');
      if (res.ok) {
        const data = await res.json();
        if (data.incidents && data.incidents.length > 0) {
          setIncidents(data.incidents);
          if (!selectedIncidentId || !data.incidents.some((i: Incident) => i.id === selectedIncidentId)) {
            setSelectedIncidentId(data.incidents[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch incidents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchIncidents();
  }, []);

  const activeIncident = incidents.find((i) => i.id === selectedIncidentId) || incidents[0];

  const handleUpdateStatus = async (newStatus: IncidentStatus) => {
    if (!activeIncident || statusUpdating) return;
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/v1/incidents/${activeIncident.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          actor: currentUser.name,
          message: `Incident status updated to ${newStatus} by ${currentUser.name}`,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      }
    } catch (err) {
      console.error('Failed to update incident status:', err);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleTriggerRunbook = (rb: RunbookDefinition) => {
    setSelectedRunbook(rb);
    setIsRunbookModalOpen(true);
  };

  const handleRunbookSuccess = (result: RunbookExecutionResult) => {
    // Refresh incident state to reflect remediation timeline entry
    fetchIncidents();
  };

  if (!canViewIncidents) {
    return (
      <div className="p-8 text-center bg-[#0F172A] border border-slate-800 rounded-2xl text-slate-400 space-y-3">
        <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
        <h3 className="font-semibold text-white">Access Restricted</h3>
        <p className="text-xs max-w-md mx-auto">
          Your current role does not have <code className="text-cyan-300">canViewIncidents</code> permission. Contact your
          organization administrator or request JIT Break-Glass access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Incident Selector & Live Status Banner */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-lg font-bold text-white tracking-wide">AI Incident Command Center</h2>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                {incidents.filter((i) => i.status !== 'RESOLVED').length} ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated RAG triage, blast radius estimation, HITL remediation guards, and blameless retrospectives.
            </p>
          </div>
        </div>

        {/* Incident Selector Dropdown */}
        <div className="flex items-center space-x-3">
          <label className="text-xs font-mono text-slate-400 shrink-0">Incident:</label>
          <select
            value={selectedIncidentId}
            onChange={(e) => setSelectedIncidentId(e.target.value)}
            className="bg-[#0B0F17] border border-slate-700 text-slate-200 text-xs font-mono rounded-xl px-3.5 py-2 focus:outline-none focus:border-indigo-500 transition"
          >
            {incidents.map((inc) => (
              <option key={inc.id} value={inc.id}>
                [{inc.severity}] {inc.id} - {inc.title.substring(0, 40)}...
              </option>
            ))}
          </select>

          <button
            onClick={() => setIsChatOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
          >
            <Sparkles className="w-4 h-4" />
            <span>Ask AI Assistant</span>
          </button>
        </div>
      </div>

      {/* 2. Active Incident Ribbon & Quick Status Controls */}
      {activeIncident && (
        <div className="bg-[#0B0F17]/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                    activeIncident.severity === 'P1-CRITICAL'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {activeIncident.severity}
                </span>
                <h3 className="font-bold text-base text-white">{activeIncident.title}</h3>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Root Service: <strong className="text-cyan-300">{activeIncident.primaryService}</strong> &bull; Incident
                Commander: <strong className="text-indigo-300">{activeIncident.leadSre}</strong> &bull; Started:{' '}
                {new Date(activeIncident.startedAt).toLocaleTimeString()}
              </p>
            </div>

            {/* Lifecycle Phase Status Selector */}
            <div className="flex items-center space-x-2 bg-[#0F172A] p-1.5 rounded-xl border border-slate-800 text-xs font-mono">
              <span className="text-[10px] uppercase text-slate-500 px-2">Status:</span>
              {(['INVESTIGATING', 'IDENTIFIED', 'MITIGATING', 'RESOLVED'] as IncidentStatus[]).map((st) => (
                <button
                  key={st}
                  onClick={() => handleUpdateStatus(st)}
                  disabled={statusUpdating}
                  className={`px-3 py-1 rounded-lg text-xs transition ${
                    activeIncident.status === st
                      ? st === 'RESOLVED'
                        ? 'bg-emerald-600 text-white font-bold shadow'
                        : 'bg-indigo-600 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80 font-mono text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block">Peak Error Rate</span>
              <span className="font-bold text-rose-400">{activeIncident.errorRatePeak}%</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">P99 Latency</span>
              <span className="font-bold text-amber-400">{activeIncident.p99LatencyMs}ms</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">Impacted User Sessions</span>
              <span className="font-bold text-cyan-300">
                {activeIncident.blastRadius.affectedUserSessions.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">SLO Budget Burn</span>
              <span className="font-bold text-rose-400">{activeIncident.blastRadius.sloBurnRate}x</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 font-mono text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'overview'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Overview & Timeline</span>
        </button>

        <button
          onClick={() => setActiveTab('blast_radius')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'blast_radius'
              ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Blast Radius Visualizer</span>
        </button>

        <button
          onClick={() => setActiveTab('runbooks')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'runbooks'
              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Automated Runbooks ({activeIncident?.suggestedRunbooks.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('post_mortem')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'post_mortem'
              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Post-Mortem Studio</span>
        </button>
      </div>

      {/* 4. Tab Panels */}
      {activeIncident && (
        <div>
          {/* Tab 1: Overview & Timeline */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Top Errors & Root Cause */}
              <div className="lg:col-span-7 space-y-5">
                {/* Root Cause Card */}
                <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400 flex items-center space-x-1.5">
                    <Zap className="w-4 h-4" />
                    <span>Identified Root-Cause Bottleneck</span>
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed bg-[#0B0F17] p-3.5 rounded-xl border border-slate-800 font-mono">
                    {activeIncident.rootCause || 'Root cause investigation in progress.'}
                  </p>
                </div>

                {/* Top Error Exceptions */}
                <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                      Top Correlated Exception Traces
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {activeIncident.topErrors.length} unique signatures
                    </span>
                  </div>

                  <div className="space-y-3">
                    {activeIncident.topErrors.map((err, idx) => (
                      <div
                        key={idx}
                        className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3.5 space-y-2 font-mono text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                            {err.service}
                          </span>
                          <span className="text-slate-400 text-[10px]">{err.count} occurrences</span>
                        </div>
                        <div className="text-slate-200 font-semibold">{err.message}</div>
                        {err.stack && (
                          <pre className="text-[11px] text-slate-500 bg-slate-900/80 p-2.5 rounded-lg overflow-x-auto whitespace-pre leading-relaxed border border-slate-800/80">
                            {err.stack}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Correlated Trace Links */}
                {activeIncident.correlatedTraceIds.length > 0 && (
                  <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
                      Correlated Distributed Traces
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {activeIncident.correlatedTraceIds.map((traceId) => (
                        <button
                          key={traceId}
                          onClick={() => onNavigateToTraces && onNavigateToTraces(traceId)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 hover:text-white transition"
                        >
                          <Layers className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{traceId}</span>
                          <ChevronRight className="w-3 h-3 text-slate-500" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Incident Timeline */}
              <div className="lg:col-span-5 bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-white flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <span>Incident Event Timeline</span>
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">{activeIncident.timeline.length} events</span>
                </div>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                  {activeIncident.timeline.map((evt, idx) => (
                    <div key={idx} className="relative group">
                      <div className="absolute -left-[29px] top-1 w-3.5 h-3.5 rounded-full bg-[#0F172A] border-2 border-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span
                            className={`px-1.5 py-0.2 rounded font-bold ${
                              evt.type === 'DETECTION'
                                ? 'bg-amber-500/20 text-amber-300'
                                : evt.type === 'ESCALATION'
                                ? 'bg-rose-500/20 text-rose-300'
                                : evt.type === 'MITIGATION'
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {evt.type}
                          </span>
                          <span className="text-slate-500">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{evt.message}</p>
                        <span className="text-[10px] font-mono text-slate-500 block">Actor: {evt.actor}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Blast Radius Visualizer */}
          {activeTab === 'blast_radius' && <BlastRadiusVisualizer incident={activeIncident} />}

          {/* Tab 3: Runbooks */}
          {activeTab === 'runbooks' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeIncident.suggestedRunbooks.map((rb) => (
                  <div
                    key={rb.actionId}
                    className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4 hover:border-slate-700 transition"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            rb.riskLevel === 'HIGH'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          {rb.riskLevel} RISK
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">{rb.targetService}</span>
                      </div>
                      <h4 className="font-bold text-sm text-white">{rb.title}</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">{rb.description}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-500">
                        {rb.requiresHitlApproval ? 'Requires HITL' : 'Auto-Approvable'}
                      </span>
                      <button
                        onClick={() => handleTriggerRunbook(rb)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Inspect & Run</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Post-Mortem Studio */}
          {activeTab === 'post_mortem' && (
            <PostMortemView incident={activeIncident} currentUser={currentUser} />
          )}
        </div>
      )}

      {/* Slide-Out Incident Chat Drawer */}
      {activeIncident && (
        <IncidentChatDrawer
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          incident={activeIncident}
          currentUser={currentUser}
          onSelectRunbook={(rb) => {
            setIsChatOpen(false);
            handleTriggerRunbook(rb);
          }}
        />
      )}

      {/* Automated Remediation & Approval Modal */}
      {activeIncident && (
        <RunbookActionModal
          isOpen={isRunbookModalOpen}
          onClose={() => setIsRunbookModalOpen(false)}
          runbook={selectedRunbook}
          incidentId={activeIncident.id}
          canExecuteRunbooks={canExecuteRunbooks}
          currentUser={currentUser}
          onSuccess={handleRunbookSuccess}
        />
      )}
    </div>
  );
};
