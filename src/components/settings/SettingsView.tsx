'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  KeyRound,
  Plus,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Users,
  PauseCircle,
  PlayCircle,
  Activity,
  Lock,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import {
  NeonChasmSettings,
  DEFAULT_NEON_CHASM_SETTINGS,
  loadNeonChasmSettings,
  saveNeonChasmSettings,
  buildCorrelationHeaders,
  safeApiFetchJson,
} from '../../utils/apiClient';
import { DensityMode, TimezoneMode } from '../../types/telemetry';
import { AuthRole, TenantWorkspaceSummary } from '../../types/auth';

interface TenantApiKeySummary {
  keyId: string;
  name: string;
  prefix: string;
  scopes: ('ingest:write' | 'telemetry:read')[];
  allowedCidrs?: string[];
  expiresAt?: string;
  graceExpiresAt?: number;
  createdAt: string;
  revokedAt?: string;
}

interface TenantMemberSummary {
  userId: string;
  email: string;
  name: string;
  role: AuthRole;
  joinedAt: string;
}

interface PlatformTelemetryStats {
  activeSseSubscribers: number;
  totalTenants: number;
  totalUsers: number;
  totalBufferedRecords: number;
  estimatedBufferBytes: number;
  authChecksTotal: number;
  authChecksDenied: number;
  totalIngestBatches: number;
  totalIngestedRecords: number;
  redactedSecretsTotal?: number;
  ingestionEventsPerSec: number;
  uptimeSeconds: number;
}

interface SettingsViewProps {
  density: DensityMode;
  onToggleDensity: () => void;
  timezone: TimezoneMode;
  onTimezoneChange: (tz: TimezoneMode) => void;
  onSettingsApplied?: (settings: NeonChasmSettings) => void;
  authRole?: AuthRole;
  activeTenant?: TenantWorkspaceSummary | null;
  onTelemetryPurged?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  density,
  onToggleDensity,
  timezone,
  onTimezoneChange,
  onSettingsApplied,
  authRole = 'admin',
  activeTenant,
  onTelemetryPurged,
}) => {
  const [form, setForm] = useState<NeonChasmSettings>(DEFAULT_NEON_CHASM_SETTINGS);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Governance, Guardrails, Encrypted Outbound Webhook, API Keys & Team RBAC
  const [ingestionPaused, setIngestionPaused] = useState<boolean>(Boolean(activeTenant?.ingestionPaused));
  const [rateLimitRps, setRateLimitRps] = useState<number>(activeTenant?.ingestionRateLimitRps || 1000);
  const [retentionTtlDays, setRetentionTtlDays] = useState<number>(activeTenant?.retentionTtlDays || 30);
  const [webhookUrlInput, setWebhookUrlInput] = useState<string>('');
  const [maskedWebhookUrl, setMaskedWebhookUrl] = useState<string | null>(activeTenant?.maskedWebhookUrl ?? null);

  const [apiKeys, setApiKeys] = useState<TenantApiKeySummary[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyCidrs, setNewKeyCidrs] = useState('');
  const [newKeyScopeWrite, setNewKeyScopeWrite] = useState(true);
  const [newKeyScopeRead, setNewKeyScopeRead] = useState(true);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [members, setMembers] = useState<TenantMemberSummary[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AuthRole>('editor');
  const [generatedInviteToken, setGeneratedInviteToken] = useState<string | null>(null);
  const [platformTelemetry, setPlatformTelemetry] = useState<PlatformTelemetryStats | null>(null);

  // TOTP MFA, Password Policy & Step-Up State
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [recoveryRemaining, setRecoveryRemaining] = useState(0);
  const [stepUpActive, setStepUpActive] = useState(false);
  const [showStepUpModal, setShowStepUpModal] = useState(false);
  const [stepUpPassword, setStepUpPassword] = useState('');
  const [stepUpTotpCode, setStepUpTotpCode] = useState('');

  const [pendingTotpSetup, setPendingTotpSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [totpConfirmCode, setTotpConfirmCode] = useState('');
  const [recoveryCodesOnce, setRecoveryCodesOnce] = useState<string[] | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deactivateConfirming, setDeactivateConfirming] = useState(false);

  const isAdmin = authRole === 'admin';
  const isViewer = authRole === 'viewer';

  const loadGovernanceData = useCallback(async () => {
    const [settingsRes, keysRes, membersRes, readyRes, mfaRes] = await Promise.all([
      safeApiFetchJson<{
        settings?: Partial<NeonChasmSettings> & {
          ingestionPaused?: boolean;
          ingestionRateLimitRps?: number;
          retentionTtlDays?: number;
          maskedWebhookUrl?: string | null;
        };
      }>('/api/v1/settings'),
      safeApiFetchJson<{ keys?: TenantApiKeySummary[] }>('/api/v1/auth/apikeys'),
      safeApiFetchJson<{ members?: TenantMemberSummary[] }>('/api/v1/auth/members'),
      safeApiFetchJson<{ platformTelemetry?: PlatformTelemetryStats }>('/readyz'),
      safeApiFetchJson<{
        totpEnabled?: boolean;
        recoveryCodesRemaining?: number;
        stepUpActive?: boolean;
      }>('/api/v1/auth/mfa'),
    ]);

    if (settingsRes.ok && settingsRes.data?.settings) {
      const srv = settingsRes.data.settings;
      const local = loadNeonChasmSettings();
      setForm({
        ...DEFAULT_NEON_CHASM_SETTINGS,
        ...local,
        ...srv,
        tenantApiKey: local.tenantApiKey,
      });
      if (typeof srv.ingestionPaused === 'boolean') setIngestionPaused(srv.ingestionPaused);
      if (typeof srv.ingestionRateLimitRps === 'number') setRateLimitRps(srv.ingestionRateLimitRps);
      if (typeof srv.retentionTtlDays === 'number') setRetentionTtlDays(srv.retentionTtlDays);
      setMaskedWebhookUrl(srv.maskedWebhookUrl ?? null);
    }

    if (keysRes.ok && Array.isArray(keysRes.data?.keys)) {
      setApiKeys(keysRes.data.keys);
    }

    if (membersRes.ok && Array.isArray(membersRes.data?.members)) {
      setMembers(membersRes.data.members);
    }

    if (readyRes.ok && readyRes.data?.platformTelemetry) {
      setPlatformTelemetry(readyRes.data.platformTelemetry);
    }

    if (mfaRes.ok && mfaRes.data) {
      setTotpEnabled(Boolean(mfaRes.data.totpEnabled));
      setRecoveryRemaining(mfaRes.data.recoveryCodesRemaining ?? 0);
      setStepUpActive(Boolean(mfaRes.data.stepUpActive));
    }
  }, []);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setMounted(true);
      setIsDarkMode(document.documentElement.classList.contains('dark'));
      setForm(loadNeonChasmSettings());
      void loadGovernanceData();
    }, 0);

    return () => {
      window.clearTimeout(syncTimer);
    };
  }, [loadGovernanceData]);

  const handleToggleTheme = (targetDark: boolean) => {
    setIsDarkMode(targetDark);
    if (targetDark) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('theme', 'dark');
      } catch {
        // Ignore
      }
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('theme', 'light');
      } catch {
        // Ignore
      }
    }
  };

  const handleStepUpPromptIfRequired = (data: unknown, fallbackMsg: string) => {
    const code = (data as { code?: string } | null)?.code;
    if (code === 'STEP_UP_REQUIRED') {
      setStepUpActive(false);
      setShowStepUpModal(true);
      setStatusMessage({
        type: 'error',
        text: 'Step-up re-authentication required. Confirm your identity below to unlock privileged actions for 5 minutes.',
      });
      return true;
    }
    setStatusMessage({ type: 'error', text: fallbackMsg });
    return false;
  };

  const handleSubmitStepUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    const res = await safeApiFetchJson<{ ok?: boolean; stepUpActive?: boolean; error?: string }>(
      '/api/v1/auth/step-up',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(stepUpPassword ? { password: stepUpPassword } : {}),
          ...(stepUpTotpCode ? { totpCode: stepUpTotpCode } : {}),
        }),
      }
    );

    if (!res.ok || !res.data?.ok) {
      setStatusMessage({ type: 'error', text: res.error || 'Step-up verification failed.' });
      return;
    }

    setStepUpActive(true);
    setShowStepUpModal(false);
    setStepUpPassword('');
    setStepUpTotpCode('');
    setStatusMessage({
      type: 'success',
      text: 'Step-up identity verified. Privileged actions unlocked for 5 minutes.',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) {
      setStatusMessage({ type: 'error', text: 'Viewer role is read-only and cannot modify workspace settings.' });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    const saved = saveNeonChasmSettings(form);
    setForm(saved);

    const payload: Record<string, unknown> = {
      otlpEndpoint: saved.otlpEndpoint,
      wsUrl: saved.wsUrl,
      sseUrl: saved.sseUrl,
      latencyWarnMs: Number(saved.latencyWarnMs) || 200,
      latencyCritMs: Number(saved.latencyCritMs) || 300,
      errorRateThresholdPct: Number(saved.errorRateThresholdPct) || 5,
    };

    if (isAdmin) {
      payload.ingestionPaused = ingestionPaused;
      payload.ingestionRateLimitRps = Number(rateLimitRps) || 1000;
      payload.retentionTtlDays = Number(retentionTtlDays) || 30;
      if (webhookUrlInput.trim()) {
        payload.webhookUrl = webhookUrlInput.trim();
      }
    }

    const res = await safeApiFetchJson<{
      saved?: boolean;
      error?: string;
      settings?: { maskedWebhookUrl?: string | null };
    }>('/api/v1/settings', {
      method: 'POST',
      headers: buildCorrelationHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      onSettingsApplied?.(saved);
      setStatusMessage({
        type: 'error',
        text: res.error || `Backend sync failed (HTTP ${res.status})`,
      });
      return;
    }

    if (webhookUrlInput.trim()) {
      setWebhookUrlInput('');
      setMaskedWebhookUrl(res.data?.settings?.maskedWebhookUrl ?? null);
    }

    onSettingsApplied?.(saved);
    setStatusMessage({
      type: 'success',
      text: 'Workspace settings, encrypted webhook configuration, ingestion guardrails, and SLO thresholds saved.',
    });
  };

  const handleBeginTotpSetup = async () => {
    setStatusMessage(null);
    const res = await safeApiFetchJson<{ ok?: boolean; secret?: string; otpauthUri?: string }>(
      '/api/v1/auth/mfa',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      }
    );
    if (!res.ok || !res.data?.secret || !res.data.otpauthUri) {
      setStatusMessage({ type: 'error', text: res.error || 'Unable to start TOTP setup.' });
      return;
    }
    setPendingTotpSetup({ secret: res.data.secret, otpauthUri: res.data.otpauthUri });
  };

  const handleConfirmTotpSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    const res = await safeApiFetchJson<{ ok?: boolean; recoveryCodes?: string[] }>(
      '/api/v1/auth/mfa',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', code: totpConfirmCode.trim() }),
      }
    );
    if (!res.ok || !res.data?.ok) {
      setStatusMessage({ type: 'error', text: res.error || 'Invalid TOTP confirmation code.' });
      return;
    }
    setPendingTotpSetup(null);
    setTotpConfirmCode('');
    setTotpEnabled(true);
    const codes = res.data.recoveryCodes || [];
    setRecoveryCodesOnce(codes);
    setRecoveryRemaining(codes.length);
    setStatusMessage({
      type: 'success',
      text: 'RFC 6238 TOTP MFA enabled. Save your single-use backup recovery codes below.',
    });
  };

  const handleDisableTotp = async () => {
    setStatusMessage(null);
    const res = await safeApiFetchJson<{ ok?: boolean; code?: string }>('/api/v1/auth/mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'disable' }),
    });
    if (!res.ok) {
      handleStepUpPromptIfRequired(res.data, res.error || 'Failed to disable TOTP MFA.');
      return;
    }
    setTotpEnabled(false);
    setRecoveryRemaining(0);
    setRecoveryCodesOnce(null);
    setStatusMessage({ type: 'success', text: 'Two-factor TOTP authentication disabled.' });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    const res = await safeApiFetchJson<{ ok?: boolean }>('/api/v1/auth/mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'change_password',
        currentPassword,
        newPassword,
      }),
    });
    if (!res.ok) {
      setStatusMessage({ type: 'error', text: res.error || 'Password change failed.' });
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setStepUpActive(true);
    setStatusMessage({
      type: 'success',
      text: 'Password updated cleanly (other active browser sessions have been revoked).',
    });
  };

  const handleCreateApiKey = async () => {
    if (!newKeyName.trim()) return;
    setStatusMessage(null);
    const scopes: ('ingest:write' | 'telemetry:read')[] = [];
    if (newKeyScopeWrite) scopes.push('ingest:write');
    if (newKeyScopeRead) scopes.push('telemetry:read');
    if (scopes.length === 0) scopes.push('ingest:write');

    const allowedCidrs = newKeyCidrs
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const res = await safeApiFetchJson<{
      plainSecret?: string;
      keys?: TenantApiKeySummary[];
    }>('/api/v1/auth/apikeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        name: newKeyName.trim(),
        scopes,
        ...(allowedCidrs.length > 0 ? { allowedCidrs } : {}),
      }),
    });

    if (!res.ok || !res.data) {
      setStatusMessage({ type: 'error', text: res.error || 'Failed to create API key.' });
      return;
    }

    setNewKeyName('');
    setNewKeyCidrs('');
    if (res.data.plainSecret) setRevealedSecret(res.data.plainSecret);
    if (res.data.keys) setApiKeys(res.data.keys);
    setStatusMessage({ type: 'success', text: 'Scoped SHA-256 API key created. Copy the secret now; it is shown once.' });
  };

  const handleRotateApiKey = async (keyId: string) => {
    setStatusMessage(null);
    const res = await safeApiFetchJson<{
      plainSecret?: string;
      previousGraceExpiresAt?: string;
      keys?: TenantApiKeySummary[];
      code?: string;
    }>('/api/v1/auth/apikeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rotate', keyId, graceMinutes: 60 }),
    });

    if (!res.ok || !res.data) {
      handleStepUpPromptIfRequired(res.data, res.error || 'Failed to rotate API key.');
      return;
    }

    if (res.data.plainSecret) setRevealedSecret(res.data.plainSecret);
    if (res.data.keys) setApiKeys(res.data.keys);
    setStatusMessage({
      type: 'success',
      text: `Zero-downtime rotation complete. Previous key stays valid until ${
        res.data.previousGraceExpiresAt ? new Date(res.data.previousGraceExpiresAt).toLocaleTimeString() : 'grace expiry'
      }.`,
    });
  };

  const handleRevokeApiKey = async (keyId: string) => {
    setStatusMessage(null);
    const res = await safeApiFetchJson<{ keys?: TenantApiKeySummary[]; code?: string }>('/api/v1/auth/apikeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'revoke', keyId }),
    });
    if (!res.ok || !res.data) {
      handleStepUpPromptIfRequired(res.data, res.error || 'Failed to revoke API key.');
      return;
    }
    if (res.data.keys) setApiKeys(res.data.keys);
    setStatusMessage({ type: 'success', text: 'API key revoked immediately.' });
  };

  const handleCreateInvite = async () => {
    if (!inviteEmail.trim()) return;
    setStatusMessage(null);
    const res = await safeApiFetchJson<{ invite?: { inviteToken: string } }>('/api/v1/auth/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invite', email: inviteEmail.trim(), role: inviteRole }),
    });
    if (!res.ok || !res.data) {
      setStatusMessage({ type: 'error', text: res.error || 'Unable to create invitation.' });
      return;
    }
    setInviteEmail('');
    setGeneratedInviteToken(res.data.invite?.inviteToken || null);
    setStatusMessage({ type: 'success', text: 'Single-use workspace invite token created (48h expiry).' });
  };

  const handleRoleChange = async (userId: string, role: AuthRole) => {
    setStatusMessage(null);
    const res = await safeApiFetchJson<{ members?: TenantMemberSummary[]; code?: string }>('/api/v1/auth/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_role', userId, role }),
    });
    if (!res.ok || !res.data) {
      handleStepUpPromptIfRequired(res.data, res.error || 'Failed to update member role.');
      return;
    }
    if (res.data.members) setMembers(res.data.members);
    setStatusMessage({ type: 'success', text: `Member role updated to ${role}.` });
  };

  const handleRemoveMember = async (userId: string) => {
    setStatusMessage(null);
    const res = await safeApiFetchJson<{ members?: TenantMemberSummary[]; code?: string }>('/api/v1/auth/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove_member', userId }),
    });
    if (!res.ok || !res.data) {
      handleStepUpPromptIfRequired(res.data, res.error || 'Failed to remove workspace member.');
      return;
    }
    if (res.data.members) setMembers(res.data.members);
    setStatusMessage({ type: 'success', text: 'Member removed from workspace.' });
  };

  const handlePurgeTenantTelemetry = async () => {
    setStatusMessage(null);
    const res = await safeApiFetchJson<{ purgedCount?: number; code?: string }>('/api/v1/telemetry/recent', {
      method: 'DELETE',
    });
    if (!res.ok) {
      handleStepUpPromptIfRequired(res.data, res.error || 'Failed to purge tenant telemetry.');
      return;
    }
    onTelemetryPurged?.();
    setStatusMessage({
      type: 'success',
      text: `Purged ${res.data?.purgedCount ?? 0} telemetry events for this workspace.`,
    });
  };

  const handleDeactivateWorkspace = async () => {
    setStatusMessage(null);
    const res = await safeApiFetchJson<{ ok?: boolean; code?: string }>('/api/v1/auth/workspaces', {
      method: 'DELETE',
    });
    if (!res.ok) {
      setDeactivateConfirming(false);
      handleStepUpPromptIfRequired(res.data, res.error || 'Failed to deactivate workspace.');
      return;
    }
    window.location.assign('/');
  };

  const handleResetDefaults = () => {
    const reset = saveNeonChasmSettings({
      ...DEFAULT_NEON_CHASM_SETTINGS,
      tenantId: activeTenant?.tenantId || form.tenantId,
    });
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
              Workspace Settings, MFA, Step-Up Auth &amp; RBAC
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Tenant <code className="font-mono text-cyan-600 dark:text-cyan-400">{activeTenant?.name || form.tenantId}</code> &bull; Role:{' '}
              <span className="font-mono uppercase font-semibold">{authRole}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowStepUpModal((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 ${
              stepUpActive
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{stepUpActive ? 'Step-Up Unlocked (5m)' : 'Unlock Step-Up Auth'}</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] text-xs font-mono text-[var(--text-main)] transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 text-xs font-mono ${
            statusMessage.type === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'
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

      {/* Server-Enforced Step-Up Re-Authentication Bar */}
      {showStepUpModal && (
        <form
          onSubmit={(e) => void handleSubmitStepUp(e)}
          className="glass-card rounded-2xl border border-amber-500/50 bg-amber-500/5 p-5 space-y-3 font-mono text-xs"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold">
              <Lock className="h-4 w-4" />
              <span>Step-Up Re-Authentication Required (5-Minute Privileged Window)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowStepUpModal(false)}
              className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              Close
            </button>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Enter your account password{totpEnabled ? ' or current 6-digit TOTP authenticator code' : ''} to authorize key rotation, revocation, admin RBAC edits, telemetry purges, or workspace deactivation.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="password"
              value={stepUpPassword}
              onChange={(e) => setStepUpPassword(e.target.value)}
              placeholder="Current account password"
              className="px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-[var(--text-main)] outline-none focus:border-amber-500"
            />
            {totpEnabled && (
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={stepUpTotpCode}
                onChange={(e) => setStepUpTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Or 6-digit TOTP code"
                className="px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-[var(--text-main)] outline-none focus:border-amber-500"
              />
            )}
            <button
              type="submit"
              disabled={!stepUpPassword && stepUpTotpCode.length < 6}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold disabled:opacity-50"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Verify &amp; Unlock</span>
            </button>
          </div>
        </form>
      )}

      {/* TOTP Authenticator MFA & Strong Password Management */}
      <section className="glass-card rounded-2xl p-5 space-y-4 font-mono text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-sans font-semibold text-[var(--text-main)]">
              RFC 6238 TOTP Multi-Factor Authentication &amp; Password Policy
            </h2>
          </div>
          <span
            className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
              totpEnabled
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-slate-500/15 text-[var(--text-muted)] border-[var(--border-color)]'
            }`}
          >
            {totpEnabled ? `ENABLED (${recoveryRemaining} backup codes left)` : 'DISABLED'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* TOTP Enrollment */}
          <div className="space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-4">
            <div className="text-xs font-sans font-semibold text-[var(--text-main)]">
              Authenticator App (HMAC-SHA1, ±1 Step Skew, Anti-Replay)
            </div>
            {!totpEnabled && !pendingTotpSetup && (
              <button
                type="button"
                onClick={() => void handleBeginTotpSetup()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Enroll TOTP Authenticator</span>
              </button>
            )}

            {pendingTotpSetup && (
              <form onSubmit={(e) => void handleConfirmTotpSetup(e)} className="space-y-2.5">
                <div className="p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] space-y-1">
                  <div className="text-[10px] text-[var(--text-muted)]">Manual Base32 Secret Key (encrypted at rest via AES-256-GCM):</div>
                  <code className="block text-cyan-600 dark:text-cyan-400 break-all font-bold">{pendingTotpSetup.secret}</code>
                  <div className="text-[10px] text-[var(--text-muted)] break-all pt-1">{pendingTotpSetup.otpauthUri}</div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={totpConfirmCode}
                    onChange={(e) => setTotpConfirmCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    className="flex-1 px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-[var(--text-main)] outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  >
                    Verify &amp; Enable
                  </button>
                </div>
              </form>
            )}

            {totpEnabled && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleDisableTotp()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Disable TOTP MFA</span>
                </button>
              </div>
            )}

            {recoveryCodesOnce && recoveryCodesOnce.length > 0 && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-1.5">
                <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  Single-Use Backup Recovery Codes (shown once — store offline):
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {recoveryCodesOnce.map((c) => (
                    <code key={c} className="px-2 py-1 rounded bg-[var(--bg-canvas)] border border-[var(--border-color)]">
                      {c}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Password Change */}
          <form
            onSubmit={(e) => void handleChangePassword(e)}
            className="space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-4"
          >
            <div className="text-xs font-sans font-semibold text-[var(--text-main)]">
              Rotate Account Password (Min 12 Chars, Revokes Other Sessions)
            </div>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-[var(--text-main)] outline-none focus:border-indigo-500"
            />
            <input
              type="password"
              required
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New strong password (12+ chars)"
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-[var(--text-main)] outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={!currentPassword || newPassword.length < 12}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold disabled:opacity-50"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Update Password</span>
            </button>
          </form>
        </div>
      </section>

      <form onSubmit={(e) => void handleSave(e)} className="space-y-6">
        {/* 1. Telemetry Ingestion Guardrails & Kill-Switch */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              <h2 className="text-sm font-semibold text-[var(--text-main)]">
                OTLP Ingestion Guardrails, Kill-Switch &amp; Retention
              </h2>
            </div>

            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIngestionPaused((p) => !p)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-semibold transition-colors ${
                    ingestionPaused
                      ? 'border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  {ingestionPaused ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}
                  <span>{ingestionPaused ? 'Ingestion Paused (503)' : 'Ingestion Active'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handlePurgeTenantTelemetry()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-mono font-semibold"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Purge Workspace Events</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="settings-otlp-endpoint" className="block text-xs font-mono text-[var(--text-muted)] mb-1.5">
                OTLP HTTP Endpoint URL
              </label>
              <input
                id="settings-otlp-endpoint"
                type="text"
                disabled={isViewer}
                value={form.otlpEndpoint}
                onChange={(e) => setForm((prev) => ({ ...prev, otlpEndpoint: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="settings-rate-limit" className="block text-xs font-mono text-[var(--text-muted)] mb-1.5">
                Rate Quota (req/sec)
              </label>
              <input
                id="settings-rate-limit"
                type="number"
                min={10}
                max={100000}
                disabled={!isAdmin}
                value={rateLimitRps}
                onChange={(e) => setRateLimitRps(Number(e.target.value) || 1000)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="settings-retention-ttl" className="block text-xs font-mono text-[var(--text-muted)] mb-1.5">
                Retention TTL (Days)
              </label>
              <input
                id="settings-retention-ttl"
                type="number"
                min={1}
                max={3650}
                disabled={!isAdmin}
                value={retentionTtlDays}
                onChange={(e) => setRetentionTtlDays(Number(e.target.value) || 30)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
            </div>
          </div>
        </section>

        {/* 2. Client Collector Bearer Header & Encrypted Outbound Webhook URL */}
        <section className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-color)]">
            <Shield className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-semibold text-[var(--text-main)]">
              Workspace Correlation Headers &amp; Encrypted Alert Webhook
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="settings-tenant-id" className="block text-xs font-mono text-[var(--text-muted)] mb-1.5">
                Active Company Tenant ID
              </label>
              <input
                id="settings-tenant-id"
                type="text"
                readOnly
                value={activeTenant?.tenantId || form.tenantId}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] text-xs font-mono text-cyan-600 dark:text-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="settings-tenant-key" className="block text-xs font-mono text-[var(--text-muted)] mb-1.5">
                Optional Collector Bearer Key
              </label>
              <div className="relative">
                <input
                  id="settings-tenant-key"
                  type={showApiKey ? 'text' : 'password'}
                  value={form.tenantApiKey}
                  onChange={(e) => setForm((prev) => ({ ...prev, tenantApiKey: e.target.value }))}
                  placeholder="Optional nc_live_... token"
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

            <div>
              <label htmlFor="settings-webhook-url" className="block text-xs font-mono text-[var(--text-muted)] mb-1.5">
                Outbound Alert Webhook (AES-256-GCM Encrypted)
              </label>
              <input
                id="settings-webhook-url"
                type="url"
                disabled={!isAdmin}
                value={webhookUrlInput}
                onChange={(e) => setWebhookUrlInput(e.target.value)}
                placeholder={maskedWebhookUrl || 'https://hooks.example.com/services/...'}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
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
              <label htmlFor="settings-lat-warn" className="block text-xs font-mono text-[var(--text-muted)] mb-1.5">
                Latency Warning (ms)
              </label>
              <input
                id="settings-lat-warn"
                type="number"
                min={1}
                max={60000}
                disabled={isViewer}
                value={form.latencyWarnMs}
                onChange={(e) => setForm((prev) => ({ ...prev, latencyWarnMs: Number(e.target.value) || 200 }))}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono tabular-nums text-[var(--text-main)] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="settings-lat-crit" className="block text-xs font-mono text-[var(--text-muted)] mb-1.5">
                Latency Critical SLA (ms)
              </label>
              <input
                id="settings-lat-crit"
                type="number"
                min={1}
                max={60000}
                disabled={isViewer}
                value={form.latencyCritMs}
                onChange={(e) => setForm((prev) => ({ ...prev, latencyCritMs: Number(e.target.value) || 300 }))}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono tabular-nums text-[var(--text-main)] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label htmlFor="settings-err-pct" className="block text-xs font-mono text-[var(--text-muted)] mb-1.5">
                Error Rate Threshold (%)
              </label>
              <input
                id="settings-err-pct"
                type="number"
                min={0}
                max={100}
                step={0.5}
                disabled={isViewer}
                value={form.errorRateThresholdPct}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, errorRateThresholdPct: Number(e.target.value) || 0 }))
                }
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono tabular-nums text-[var(--text-main)] focus:outline-none focus:border-indigo-500 disabled:opacity-60"
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
                <div className="text-[11px] font-mono capitalize text-[var(--text-muted)]">{density}</div>
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
                <div className="text-[11px] font-mono uppercase text-[var(--text-muted)]">{timezone}</div>
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

        {!isViewer && (
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
        )}
      </form>

      {/* 5. Zero-Downtime Scoped API Keys */}
      <section className="glass-card rounded-2xl p-5 space-y-4 font-mono text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-sm font-sans font-semibold text-[var(--text-main)]">
              Scoped API Keys &amp; Zero-Downtime Rotation
            </h2>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
            SHA-256 Hashed + Step-Up Protected
          </span>
        </div>

        {revealedSecret && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                Save this API Key secret now — it will never be displayed again:
              </div>
              <code className="block mt-1 text-xs text-[var(--text-main)] break-all">{revealedSecret}</code>
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  void navigator.clipboard.writeText(revealedSecret);
                  setCopiedSecret(true);
                  window.setTimeout(() => setCopiedSecret(false), 1800);
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-[var(--bg-surface)] text-xs inline-flex items-center gap-1.5 shrink-0"
            >
              {copiedSecret ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedSecret ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}

        {isAdmin ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Collector / CI key name"
              className="md:col-span-1 px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-[var(--text-main)] outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              value={newKeyCidrs}
              onChange={(e) => setNewKeyCidrs(e.target.value)}
              placeholder="Optional CIDRs (e.g. 10.0.0.0/8)"
              className="md:col-span-1 px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-[var(--text-main)] outline-none focus:border-indigo-500"
            />
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)]">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newKeyScopeWrite}
                  onChange={(e) => setNewKeyScopeWrite(e.target.checked)}
                />
                <span>ingest:write</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newKeyScopeRead}
                  onChange={(e) => setNewKeyScopeRead(e.target.checked)}
                />
                <span>telemetry:read</span>
              </label>
            </div>
            <button
              type="button"
              onClick={() => void handleCreateApiKey()}
              disabled={newKeyName.trim().length < 2}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Generate API Key</span>
            </button>
          </div>
        ) : (
          <div className="text-[11px] text-[var(--text-muted)]">
            Administrator privileges are required to generate, rotate, or revoke tenant API keys.
          </div>
        )}

        <div className="space-y-2">
          {apiKeys.length === 0 ? (
            <div className="py-4 text-center text-[var(--text-muted)]">
              No API keys issued yet for this company workspace.
            </div>
          ) : (
            apiKeys.map((k) => (
              <div
                key={k.keyId}
                className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="font-semibold text-[var(--text-main)] flex items-center gap-2">
                    <span>{k.name}</span>
                    <code className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-canvas)] border border-[var(--border-color)]">
                      {k.prefix}...
                    </code>
                    {k.revokedAt ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400">
                        REVOKED
                      </span>
                    ) : k.graceExpiresAt ? (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        ROTATING GRACE
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Scopes: {k.scopes.join(', ')}
                    {k.allowedCidrs?.length ? ` • Allowlist: ${k.allowedCidrs.join(', ')}` : ''}
                  </div>
                </div>

                {isAdmin && !k.revokedAt && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleRotateApiKey(k.keyId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[11px]"
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Zero-Downtime Rotate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRevokeApiKey(k.keyId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px]"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Revoke</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* 6. Team Membership, Single-Use Invites & Last-Admin RBAC */}
      <section className="glass-card rounded-2xl p-5 space-y-4 font-mono text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-sm font-sans font-semibold text-[var(--text-main)]">
              Organization Members &amp; Single-Use Invitations
            </h2>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">{members.length} members</span>
        </div>

        {generatedInviteToken && (
          <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                Single-Use Invite Token (share securely with invited teammate):
              </div>
              <code className="block mt-1 text-xs break-all text-[var(--text-main)]">{generatedInviteToken}</code>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-[var(--text-main)] outline-none focus:border-indigo-500"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as AuthRole)}
              className="px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-canvas)] text-[var(--text-main)]"
            >
              <option value="admin">admin</option>
              <option value="editor">editor</option>
              <option value="viewer">viewer</option>
            </select>
            <button
              type="button"
              onClick={() => void handleCreateInvite()}
              disabled={!inviteEmail.includes('@')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Invite</span>
            </button>
          </div>
        )}

        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.userId}
              className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] flex items-center justify-between gap-3"
            >
              <div>
                <div className="font-semibold text-[var(--text-main)]">{m.name}</div>
                <div className="text-[11px] text-[var(--text-muted)]">{m.email}</div>
              </div>
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <select
                    value={m.role}
                    onChange={(e) => void handleRoleChange(m.userId, e.target.value as AuthRole)}
                    className="px-2.5 py-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs font-mono text-[var(--text-main)]"
                  >
                    <option value="admin">admin</option>
                    <option value="editor">editor</option>
                    <option value="viewer">viewer</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleRemoveMember(m.userId)}
                    title="Remove member"
                    className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <span className="px-2.5 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] text-xs uppercase">
                  {m.role}
                </span>
              )}
            </div>
          ))}
        </div>

        {isAdmin && (
          <div className="pt-4 border-t border-[var(--border-color)] flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-sans font-semibold text-rose-600 dark:text-rose-400">
                Danger Zone: Deactivate Workspace
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Revokes all active workspace sessions and API keys immediately (requires Step-Up confirmation).
              </div>
            </div>
            {deactivateConfirming ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleDeactivateWorkspace()}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                >
                  Confirm Deactivation
                </button>
                <button
                  type="button"
                  onClick={() => setDeactivateConfirming(false)}
                  className="px-3 py-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDeactivateConfirming(true)}
                className="px-3.5 py-2 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-semibold"
              >
                Deactivate Organization
              </button>
            )}
          </div>
        )}
      </section>

      {/* 7. Platform Self-Telemetry Diagnostics (/readyz) */}
      <section className="glass-card rounded-2xl p-5 space-y-4 font-mono text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-sans font-semibold text-[var(--text-main)]">
              Platform Self-Telemetry &amp; Engine Runtime Counters
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void loadGovernanceData()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] hover:border-indigo-500/40 text-[11px] text-[var(--text-main)]"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Refresh /readyz</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)]">
            <div className="text-[11px] text-[var(--text-muted)]">Active SSE Streams</div>
            <div className="text-base font-bold tabular-nums text-[var(--text-main)] mt-0.5">
              {platformTelemetry?.activeSseSubscribers ?? 0}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)]">
            <div className="text-[11px] text-[var(--text-muted)]">Ingestion Rate</div>
            <div className="text-base font-bold tabular-nums text-[var(--text-main)] mt-0.5">
              {platformTelemetry?.ingestionEventsPerSec ?? 0} EPS
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)]">
            <div className="text-[11px] text-[var(--text-muted)]">Buffer Memory</div>
            <div className="text-base font-bold tabular-nums text-[var(--text-main)] mt-0.5">
              {((platformTelemetry?.estimatedBufferBytes ?? 0) / 1024).toFixed(1)} KB
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)]">
            <div className="text-[11px] text-[var(--text-muted)]">Ingested Batches</div>
            <div className="text-base font-bold tabular-nums text-[var(--text-main)] mt-0.5">
              {platformTelemetry?.totalIngestBatches ?? 0} ({platformTelemetry?.totalIngestedRecords ?? 0} rec)
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)]">
            <div className="text-[11px] text-[var(--text-muted)]">Auth Gate Denials</div>
            <div className="text-base font-bold tabular-nums text-[var(--text-main)] mt-0.5">
              {platformTelemetry?.authChecksDenied ?? 0} / {platformTelemetry?.authChecksTotal ?? 0}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)]">
            <div className="text-[11px] text-[var(--text-muted)]">Redacted Secrets</div>
            <div className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
              {platformTelemetry?.redactedSecretsTotal ?? 0}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
