'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Radio,
  Shield,
  Bell,
  Sun,
  Moon,
  Sliders,
  Globe,
} from 'lucide-react';
import {
  NeonChasmSettings,
  DEFAULT_NEON_CHASM_SETTINGS,
  loadNeonChasmSettings,
  saveNeonChasmSettings,
  buildCorrelationHeaders,
} from '../../utils/apiClient';
import { DensityMode, TimezoneMode } from '../../types/telemetry';

interface SettingsViewProps {
  density: DensityMode;
  onToggleDensity: () => void;
  timezone: TimezoneMode;
  onTimezoneChange: (tz: TimezoneMode) => void;
  onSettingsApplied?: (settings: NeonChasmSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  density,
  onToggleDensity,
  timezone,
  onTimezoneChange,
  onSettingsApplied,
}) => {
  const [form, setForm] = useState<NeonChasmSettings>(DEFAULT_NEON_CHASM_SETTINGS);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setMounted(true);
      setIsDarkMode(document.documentElement.classList.contains('dark'));
      setForm(loadNeonChasmSettings());
    }, 0);

    let cancelled = false;
    const fetchServerSettings = async () => {
      try {
        const res = await fetch('/api/v1/settings', {
          cache: 'no-store',
          headers: buildCorrelationHeaders(),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { settings?: Partial<NeonChasmSettings> };
        if (data.settings && !cancelled) {
          const local = loadNeonChasmSettings();
          const merged: NeonChasmSettings = {
            ...DEFAULT_NEON_CHASM_SETTINGS,
            ...data.settings,
            // Never overwrite locally stored bearer key if server doesn't store secrets
            tenantApiKey: local.tenantApiKey,
          };
          setForm(merged);
        }
      } catch {
        // Keep local settings if backend unreachable
      }
    };
    const fetchTimer = window.setTimeout(() => {
      void fetchServerSettings();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(syncTimer);
      window.clearTimeout(fetchTimer);
    };
  }, []);

  const handleToggleTheme = (targetDark: boolean) => {
    setIsDarkMode(targetDark);
    if (targetDark) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('theme', 'dark');
      } catch {
        // Ignore storage restrictions
      }
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('theme', 'light');
      } catch {
        // Ignore storage restrictions
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    const saved = saveNeonChasmSettings(form);
    setForm(saved);

    try {
      const res = await fetch('/api/v1/settings', {
        method: 'POST',
        headers: buildCorrelationHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          otlpEndpoint: saved.otlpEndpoint,
          wsUrl: saved.wsUrl,
          sseUrl: saved.sseUrl,
          tenantId: saved.tenantId,
          latencyWarnMs: Number(saved.latencyWarnMs) || 200,
          latencyCritMs: Number(saved.latencyCritMs) || 300,
          errorRateThresholdPct: Number(saved.errorRateThresholdPct) || 5,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      onSettingsApplied?.(saved);
      setStatusMessage({
        type: 'success',
        text: 'Settings persisted to localStorage & WAL backend (/api/v1/settings).',
      });
    } catch (err) {
      onSettingsApplied?.(saved);
      setStatusMessage({
        type: 'error',
        text: `Saved locally, but backend sync failed: ${err instanceof Error ? err.message : 'Network error'}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    const reset = saveNeonChasmSettings(DEFAULT_NEON_CHASM_SETTINGS);
    setForm(reset);
    onSettingsApplied?.(reset);
    setStatusMessage({
      type: 'success',
      text: 'Restored default OpenTelemetry endpoints and alert thresholds.',
    });
  };

  return (
    <div className="space-y-6 text-[var(--text-main)] max-w-5xl">
      {/* Header */}
      <div className="glass-card chromatic-rim rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--text-main)]">
              Observability Platform Settings
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Configure OpenTelemetry ingestion endpoints, multi-tenant correlation headers, alert SLO thresholds, and workspace appearance.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] text-xs font-mono text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {statusMessage && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 text-xs font-mono ${
            statusMessage.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
        {/* 1. Telemetry Ingestion & Stream Endpoints */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-color)]">
            <Radio className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-sm font-semibold text-[var(--text-main)]">
              OTLP Ingestion &amp; Live Stream Transport
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="settings-otlp-endpoint"
                className="block text-xs font-mono text-[var(--text-muted)] mb-1.5"
              >
                OTLP HTTP Endpoint URL
              </label>
              <input
                id="settings-otlp-endpoint"
                type="text"
                value={form.otlpEndpoint}
                onChange={(e) => setForm((prev) => ({ ...prev, otlpEndpoint: e.target.value }))}
                placeholder="/api/v1/telemetry"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="settings-ws-url"
                className="block text-xs font-mono text-[var(--text-muted)] mb-1.5"
              >
                WebSocket Stream URL (Optional)
              </label>
              <input
                id="settings-ws-url"
                type="text"
                value={form.wsUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, wsUrl: e.target.value }))}
                placeholder="Auto (/ws/telemetry)"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="settings-sse-url"
                className="block text-xs font-mono text-[var(--text-muted)] mb-1.5"
              >
                SSE Fallback Stream URL
              </label>
              <input
                id="settings-sse-url"
                type="text"
                value={form.sseUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, sseUrl: e.target.value }))}
                placeholder="/api/v1/stream/telemetry"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </section>

        {/* 2. Multi-Tenant Headers & Auth */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-color)]">
            <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-semibold text-[var(--text-main)]">
              Multi-Tenant Isolation &amp; Correlation Credentials
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="settings-tenant-id"
                className="block text-xs font-mono text-[var(--text-muted)] mb-1.5"
              >
                X-Tenant-ID Header
              </label>
              <input
                id="settings-tenant-id"
                type="text"
                value={form.tenantId}
                onChange={(e) => setForm((prev) => ({ ...prev, tenantId: e.target.value }))}
                placeholder="default-tenant"
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="settings-tenant-key"
                className="block text-xs font-mono text-[var(--text-muted)] mb-1.5"
              >
                Tenant Bearer API Key (Stored Client-Side Only)
              </label>
              <div className="relative">
                <input
                  id="settings-tenant-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={form.tenantApiKey}
                  onChange={(e) => setForm((prev) => ({ ...prev, tenantApiKey: e.target.value }))}
                  placeholder="Optional Bearer token attached to API calls"
                  className="w-full pl-3 pr-10 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey((prev) => !prev)}
                  aria-label={showApiKey ? 'Hide API Key' : 'Show API Key'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)]"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Alert & Anomaly Thresholds */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-color)]">
            <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-semibold text-[var(--text-main)]">
              SLO &amp; Anomaly Detection Thresholds
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="settings-lat-warn"
                className="block text-xs font-mono text-[var(--text-muted)] mb-1.5"
              >
                Latency Warning (ms)
              </label>
              <input
                id="settings-lat-warn"
                type="number"
                min={1}
                max={60000}
                value={form.latencyWarnMs}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, latencyWarnMs: Number(e.target.value) || 200 }))
                }
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono tabular-nums text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="settings-lat-crit"
                className="block text-xs font-mono text-[var(--text-muted)] mb-1.5"
              >
                Latency Critical SLA (ms)
              </label>
              <input
                id="settings-lat-crit"
                type="number"
                min={1}
                max={60000}
                value={form.latencyCritMs}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, latencyCritMs: Number(e.target.value) || 300 }))
                }
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono tabular-nums text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label
                htmlFor="settings-err-pct"
                className="block text-xs font-mono text-[var(--text-muted)] mb-1.5"
              >
                Error Rate Threshold (%)
              </label>
              <input
                id="settings-err-pct"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={form.errorRateThresholdPct}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    errorRateThresholdPct: Number(e.target.value) || 0,
                  }))
                }
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono tabular-nums text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </section>

        {/* 4. Theme, Density & Timezone */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-color)]">
            <Sliders className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold text-[var(--text-main)]">
              Workspace Display &amp; Locale
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-[var(--text-main)]">Color Theme</div>
                <div className="text-[11px] font-mono text-[var(--text-muted)]">
                  {mounted ? (isDarkMode ? 'Obsidian Dark' : 'Slate Light') : 'Obsidian Dark'}
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-1">
                <button
                  type="button"
                  onClick={() => handleToggleTheme(false)}
                  aria-label="Activate Light Mode"
                  className={`p-1.5 rounded-md transition-colors ${
                    mounted && !isDarkMode
                      ? 'bg-indigo-600 text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleTheme(true)}
                  aria-label="Activate Dark Mode"
                  className={`p-1.5 rounded-md transition-colors ${
                    !mounted || isDarkMode
                      ? 'bg-indigo-600 text-white'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-[var(--text-main)]">Table Density</div>
                <div className="text-[11px] font-mono capitalize text-[var(--text-muted)]">
                  {density}
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleDensity}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-indigo-500/40 text-xs font-mono text-[var(--text-main)] whitespace-nowrap shrink-0"
              >
                Toggle
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-3.5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                  Timezone
                </div>
                <div className="text-[11px] font-mono uppercase text-[var(--text-muted)]">
                  {timezone}
                </div>
              </div>
              <select
                value={timezone}
                onChange={(e) => onTimezoneChange(e.target.value as TimezoneMode)}
                aria-label="Timezone mode"
                className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-indigo-500"
              >
                <option value="local">Local</option>
                <option value="utc">UTC</option>
                <option value="relative">Relative</option>
              </select>
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold shadow-md shadow-indigo-600/25 transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving Configuration...' : 'Save & Apply Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
