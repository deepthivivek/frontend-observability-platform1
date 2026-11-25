'use client';

import React, { Suspense, useState } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import { AppShell } from '@/src/components/layout/AppShell';
import { DashboardLoadingSkeleton } from '@/src/components/DashboardStateViews';
import { HealthDashboard } from '@/src/components/system/HealthDashboard';
import { useDashboardMetrics } from '@/src/hooks/useDashboardMetrics';

function SettingsContent() {
  const { data } = useDashboardMetrics('24h');
  const [latencyBudgetMs, setLatencyBudgetMs] = useState(250);
  const [uptimeTargetPct, setUptimeTargetPct] = useState(99.9);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <AppShell
      title="Settings"
      subtitle="SLA alert thresholds and system liveness/readiness probes"
      isSynthetic={data?.isSynthetic ?? true}
      endpoints={data?.endpoints ?? []}
    >
      <section
        aria-label="Monitoring threshold configuration"
        className="glass-card chromatic-rim rounded-2xl p-5 space-y-4"
      >
        <div>
          <h2 className="text-sm font-semibold text-customText">
            SLA &amp; Alerting Thresholds
          </h2>
          <p className="text-xs text-mutedText">
            Configure target latency budgets and minimum uptime targets for dashboard notifications.
          </p>
        </div>

        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1.5 text-xs">
            <span className="font-medium text-customText block">
              Latency Warning Budget (ms)
            </span>
            <input
              type="number"
              min={50}
              max={5000}
              value={latencyBudgetMs}
              onChange={(e) => setLatencyBudgetMs(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-xl border border-subtleBorder bg-surface text-sm font-mono tabular-nums text-customText focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            />
          </label>

          <label className="space-y-1.5 text-xs">
            <span className="font-medium text-customText block">
              Minimum Uptime Target (%)
            </span>
            <input
              type="number"
              step={0.01}
              min={90}
              max={100}
              value={uptimeTargetPct}
              onChange={(e) => setUptimeTargetPct(Number(e.target.value) || 99)}
              className="w-full px-3 py-2 rounded-xl border border-subtleBorder bg-surface text-sm font-mono tabular-nums text-customText focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            />
          </label>

          <div className="sm:col-span-2 flex items-center gap-3 pt-1">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Thresholds</span>
            </button>

            {savedNotice && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Settings applied for current session</span>
              </span>
            )}
          </div>
        </form>
      </section>

      <HealthDashboard />
    </AppShell>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Settings" subtitle="Loading monitoring settings...">
          <DashboardLoadingSkeleton />
        </AppShell>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
