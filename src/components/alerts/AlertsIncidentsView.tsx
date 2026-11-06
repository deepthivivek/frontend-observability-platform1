'use client';

import React, { useState } from 'react';
import { AlertRule, Incident, NotificationChannel, OnCallShift } from '../../types/alert';
import { AlertRuleBuilder } from './AlertRuleBuilder';
import { ActiveIncidentsBanner } from './ActiveIncidentsBanner';
import { NotificationChannels } from './NotificationChannels';
import {
  Bell,
  PlusCircle,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Filter,
} from 'lucide-react';

interface AlertsIncidentsViewProps {
  rules: AlertRule[];
  onSaveRule: (rule: AlertRule) => void;
  onToggleRule: (ruleId: string) => void;
  onDeleteRule: (ruleId: string) => void;
  incidents: Incident[];
  onAcknowledgeIncident: (id: string, notes: string) => void;
  onResolveIncident: (id: string) => void;
  onInspectTrace: (traceId: string) => void;
  onTriggerRemediation: (id: string) => void;
  channels: NotificationChannel[];
  onCall: OnCallShift;
  onSendTestNotification: (channelId: string) => Promise<boolean>;
}

export const AlertsIncidentsView: React.FC<AlertsIncidentsViewProps> = ({
  rules,
  onSaveRule,
  onToggleRule,
  onDeleteRule,
  incidents,
  onAcknowledgeIncident,
  onResolveIncident,
  onInspectTrace,
  onTriggerRemediation,
  channels,
  onCall,
  onSendTestNotification,
}) => {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'incidents' | 'rules' | 'channels'>('incidents');

  const firingCount = incidents.filter((i) => i.status === 'firing').length;

  return (
    <div className="space-y-6 font-sans">
      {/* View Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-800/80 bg-[#131B2E]/90 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2.5">
              Alerts &amp; Incident Management Engine
              {firingCount > 0 && (
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                  {firingCount} Firing
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Worker-driven threshold evaluation, automated flapping damping, and deduplication.
            </p>
          </div>
        </div>

        {/* Create Rule Trigger */}
        <button
          onClick={() => setIsBuilderOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-indigo-400/40 transition-all"
        >
          <PlusCircle className="h-4 w-4" />
          Create Alert Rule
        </button>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0B0F17] border border-slate-800 w-fit font-mono text-xs">
        <button
          onClick={() => setActiveTab('incidents')}
          className={`px-4 py-1.5 rounded-lg transition-all ${
            activeTab === 'incidents'
              ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Active Incidents ({incidents.length})
        </button>

        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-1.5 rounded-lg transition-all ${
            activeTab === 'rules'
              ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Alert Rules ({rules.length})
        </button>

        <button
          onClick={() => setActiveTab('channels')}
          className={`px-4 py-1.5 rounded-lg transition-all ${
            activeTab === 'channels'
              ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Notification Channels &amp; Canaries
        </button>
      </div>

      {/* Tab 1: Active Incidents */}
      {activeTab === 'incidents' && (
        <ActiveIncidentsBanner
          incidents={incidents}
          onAcknowledge={onAcknowledgeIncident}
          onResolve={onResolveIncident}
          onInspectTrace={onInspectTrace}
          onTriggerRemediation={onTriggerRemediation}
        />
      )}

      {/* Tab 2: Configured Alert Rules */}
      {activeTab === 'rules' && (
        <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E]/80 p-5 backdrop-blur-xl shadow-xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <span className="font-semibold text-white text-sm">Configured Metric Detection Rules</span>
            <span className="text-slate-400 text-xs">{rules.length} active monitors</span>
          </div>

          <div className="space-y-2.5">
            {rules.map((rule) => {
              return (
                <div
                  key={rule.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800/80 bg-[#0B0F17]/80 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onToggleRule(rule.id)}
                      className="text-indigo-400 hover:text-indigo-300"
                      title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      {rule.enabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6 text-slate-600" />}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{rule.name}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            rule.severity === 'P1-Critical'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {rule.severity}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Condition: <strong>{rule.metric} {rule.operator} {rule.threshold}{rule.unit}</strong> • {rule.environment} ({rule.serviceScope || 'All'}) • Flap damp: {rule.flappingDampingCount}x
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {rule.remediationAction && rule.remediationAction !== 'None' && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        {rule.remediationAction}
                      </span>
                    )}

                    <button
                      onClick={() => onDeleteRule(rule.id)}
                      className="p-1.5 rounded-lg hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete alert rule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Notification Channels */}
      {activeTab === 'channels' && (
        <NotificationChannels
          channels={channels}
          onCall={onCall}
          onSendTestNotification={onSendTestNotification}
        />
      )}

      {/* Modal Builder */}
      <AlertRuleBuilder
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        onSaveRule={onSaveRule}
      />
    </div>
  );
};
