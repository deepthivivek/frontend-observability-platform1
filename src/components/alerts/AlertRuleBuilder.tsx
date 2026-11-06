'use client';

import React, { useState } from 'react';
import { AlertRule, AlertMetricType, AlertSeverity, AlertOperator } from '../../types/alert';
import {
  X,
  Bell,
  ShieldAlert,
  Sliders,
  Clock,
  Zap,
  Calendar,
  Check,
  Server,
} from 'lucide-react';

interface AlertRuleBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveRule: (rule: AlertRule) => void;
  initialRule?: Partial<AlertRule> | null;
}

export const AlertRuleBuilder: React.FC<AlertRuleBuilderProps> = ({
  isOpen,
  onClose,
  onSaveRule,
  initialRule,
}) => {
  const [name, setName] = useState(initialRule?.name || '');
  const [metric, setMetric] = useState<AlertMetricType>(initialRule?.metric || 'latency');
  const [operator, setOperator] = useState<AlertOperator>(initialRule?.operator || '>');
  const [threshold, setThreshold] = useState<number>(initialRule?.threshold ?? 250);
  const [windowMinutes, setWindowMinutes] = useState<number>(initialRule?.windowMinutes ?? 5);
  const [environment, setEnvironment] = useState<'Production' | 'Staging' | 'All'>(
    initialRule?.environment || 'Production'
  );
  const [serviceScope, setServiceScope] = useState(initialRule?.serviceScope || 'All Services');
  const [severity, setSeverity] = useState<AlertSeverity>(initialRule?.severity || 'P1-Critical');
  const [flappingDampingCount, setFlappingDampingCount] = useState<number>(
    initialRule?.flappingDampingCount ?? 3
  );
  const [autoEscalateMinutes, setAutoEscalateMinutes] = useState<number>(
    initialRule?.autoEscalateMinutes ?? 5
  );
  const [remediationAction, setRemediationAction] = useState<
    'Flush Redis Cache' | 'Rollback Release' | 'Scale Out Pods' | 'None'
  >(initialRule?.remediationAction || 'None');

  // Maintenance Silencing Window
  const [silencingEnabled, setSilencingEnabled] = useState(
    initialRule?.silencingWindow?.enabled ?? false
  );
  const [silencingReason, setSilencingReason] = useState(
    initialRule?.silencingWindow?.reason || 'Scheduled Maintenance Deployment Window'
  );

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const unit =
      metric === 'latency'
        ? 'ms'
        : metric === 'error_rate'
        ? '%'
        : metric === 'rps'
        ? 'req/s'
        : 'burn_x';

    const newRule: AlertRule = {
      id: initialRule?.id || `rule-${Date.now()}`,
      name: name.trim() || `${severity} ${metric.toUpperCase()} Breach Rule`,
      metric,
      operator,
      threshold: Number(threshold),
      unit,
      windowMinutes: Number(windowMinutes),
      environment,
      serviceScope,
      severity,
      flappingDampingCount: Number(flappingDampingCount),
      autoEscalateMinutes: Number(autoEscalateMinutes),
      remediationAction,
      silencingWindow: silencingEnabled
        ? {
            enabled: true,
            startIso: new Date().toISOString(),
            endIso: new Date(Date.now() + 3600000 * 2).toISOString(),
            reason: silencingReason,
          }
        : undefined,
      enabled: true,
    };

    onSaveRule(newRule);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Alert Rule Builder Modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#080C14]/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-[#131B2E] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col text-slate-200 backdrop-blur-xl max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#0B0F17]/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-base">Alert Rule Builder &amp; Scoping</h2>
              <p className="text-xs text-slate-400 font-mono">
                Define automated threshold detectors, flapping damping, and self-healing actions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close builder"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto font-mono text-xs">
          {/* Rule Name */}
          <div>
            <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
              Rule Name
            </label>
            <input
              type="text"
              placeholder="e.g. Critical P99 Payment Latency Degradation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-[#0B0F17] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
              required
            />
          </div>

          {/* Metric Selector & Threshold */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
                Metric Target
              </label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value as AlertMetricType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-[#0B0F17] text-indigo-300 font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value="latency">P99 Latency (ms)</option>
                <option value="error_rate">Error Rate (%)</option>
                <option value="rps">Throughput (RPS)</option>
                <option value="slo_burn">SLO Burn Rate (x)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
                Condition
              </label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as AlertOperator)}
                className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-[#0B0F17] text-white font-semibold focus:outline-none focus:border-indigo-500"
              >
                <option value=">">Greater than (&gt;)</option>
                <option value="<">Less than (&lt;)</option>
                <option value="=">Equals (=)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
                Threshold Value
              </label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-[#0B0F17] text-amber-300 font-bold focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          {/* Environment & Service Scoping */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
                Environment Scope
              </label>
              <select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as 'Production' | 'Staging' | 'All')}
                className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-[#0B0F17] text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Production">Production Cluster</option>
                <option value="Staging">Staging Environment</option>
                <option value="All">All Environments</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
                Severity Level
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
                className={`w-full px-3 py-2 rounded-xl border bg-[#0B0F17] font-bold focus:outline-none ${
                  severity === 'P1-Critical'
                    ? 'border-rose-500/50 text-rose-400'
                    : severity === 'P2-Warning'
                    ? 'border-amber-500/50 text-amber-400'
                    : 'border-indigo-500/50 text-indigo-400'
                }`}
              >
                <option value="P1-Critical">P1 - Critical Page</option>
                <option value="P2-Warning">P2 - Warning Alert</option>
                <option value="P3-Info">P3 - Informational</option>
              </select>
            </div>
          </div>

          {/* Flapping Damping & Auto-Escalation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
                Flapping Damping (Consecutive Intervals)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={flappingDampingCount}
                onChange={(e) => setFlappingDampingCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-[#0B0F17] text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Suppresses noisy alert toggling until sustained for {flappingDampingCount} intervals.
              </span>
            </div>

            <div>
              <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
                Auto-Escalation Timer (Minutes)
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={autoEscalateMinutes}
                onChange={(e) => setAutoEscalateMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-[#0B0F17] text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                Escalates to Secondary On-Call if unacknowledged after {autoEscalateMinutes}m.
              </span>
            </div>
          </div>

          {/* Self-Healing Automated Remediation Webhook */}
          <div>
            <label className="block text-[11px] uppercase font-bold text-slate-400 mb-1 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              Automated Remediation Webhook Trigger
            </label>
            <select
              value={remediationAction}
              onChange={(e) => setRemediationAction(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-[#0B0F17] text-emerald-300 font-semibold focus:outline-none focus:border-indigo-500"
            >
              <option value="None">None (Manual Investigation Only)</option>
              <option value="Flush Redis Cache">Execute Webhook: Flush Redis L2 Cache</option>
              <option value="Rollback Release">Execute Webhook: Trigger Canary Rollback</option>
              <option value="Scale Out Pods">Execute Webhook: Provision +5 Replica Pods</option>
            </select>
          </div>

          {/* Maintenance Silencing Windows */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-[#0B0F17]/80 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 cursor-pointer">
                <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                Schedule Maintenance Silencing Window
              </label>
              <input
                type="checkbox"
                checked={silencingEnabled}
                onChange={(e) => setSilencingEnabled(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-indigo-500 cursor-pointer"
              />
            </div>

            {silencingEnabled && (
              <div className="pt-2 border-t border-slate-800/80">
                <input
                  type="text"
                  placeholder="Reason for silence (e.g. DB Migration v3.2)"
                  value={silencingReason}
                  onChange={(e) => setSilencingReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-700 bg-[#080C14] text-xs text-slate-200"
                />
                <span className="text-[10px] text-amber-400/80 mt-1 block">
                  Alerts will be suppressed for the next 2 hours.
                </span>
              </div>
            )}
          </div>

          {/* Footer Submit Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-mono font-medium bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-indigo-400/40 transition-all flex items-center gap-1.5"
            >
              <Check className="h-3.5 w-3.5" />
              Save Alert Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
