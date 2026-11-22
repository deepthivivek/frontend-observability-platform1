'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Mail,
  User,
  Building2,
  ArrowRight,
  AlertCircle,
  KeyRound,
  LogOut,
  Plus,
  CheckCircle2,
  Laptop,
  Trash2,
  ArrowLeft,
  Sun,
  Moon,
  ExternalLink,
  Smartphone,
} from 'lucide-react';
import { AuthSessionPayload, TenantWorkspaceSummary } from '@/src/types/auth';
import {
  loadNeonChasmSettings,
  saveNeonChasmSettings,
  safeApiFetchJson,
} from '@/src/utils/apiClient';

interface AuthPortalProps {
  initialReason?: string | null;
  initialSession?: AuthSessionPayload | null;
  onAuthenticated?: (session: AuthSessionPayload) => void;
  onWorkspaceSwitched?: (session: AuthSessionPayload) => void;
  onSignedOut?: () => void;
  onClosePortal?: () => void;
}

export const AuthPortal: React.FC<AuthPortalProps> = ({
  initialReason = null,
  initialSession = null,
  onAuthenticated,
  onWorkspaceSwitched,
  onSignedOut,
  onClosePortal,
}) => {
  const [sessionState, setSessionState] = useState<AuthSessionPayload | null>(null);
  const session = sessionState ?? initialSession;
  const [modeOverride, setModeOverride] = useState<'login' | 'register' | null>(null);
  const mode: 'login' | 'register' =
    modeOverride ?? (session && !session.authenticated && !session.hasUsers ? 'register' : 'login');
  const setMode = (nextMode: 'login' | 'register') => setModeOverride(nextMode);
  const setSession = (
    updater:
      | AuthSessionPayload
      | null
      | ((prev: AuthSessionPayload | null) => AuthSessionPayload | null)
  ) => {
    setSessionState((prev) => {
      const base = prev ?? initialSession;
      return typeof updater === 'function' ? updater(base) : updater;
    });
  };
  const [useInviteToken, setUseInviteToken] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [inviteToken, setInviteToken] = useState('');

  // MFA challenge state on sign-in
  const [mfaChallengeActive, setMfaChallengeActive] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');

  const [newOrgName, setNewOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    initialReason === 'expired'
      ? 'Your session expired or was revoked. Please sign in again.'
      : null
  );
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (initialSession) return;
    let cancelled = false;
    void safeApiFetchJson<AuthSessionPayload>('/api/v1/auth/session').then((res) => {
      if (cancelled || !res.ok || !res.data) return;
      setSessionState(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [initialSession]);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
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

  const [cookieBlockedError, setCookieBlockedError] = useState(false);

  const syncSettingsTenant = (tenant: TenantWorkspaceSummary | null, clearApiKey = false) => {
    if (!tenant && !clearApiKey) return;
    const current = loadNeonChasmSettings();
    saveNeonChasmSettings({
      ...current,
      ...(clearApiKey ? { tenantApiKey: '' } : {}),
      ...(tenant
        ? {
            tenantId: tenant.tenantId,
            latencyWarnMs: tenant.latencyWarnMs ?? current.latencyWarnMs,
            latencyCritMs: tenant.latencyCritMs ?? current.latencyCritMs,
            errorRateThresholdPct: tenant.errorRateThresholdPct ?? current.errorRateThresholdPct,
          }
        : {}),
    });
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCookieBlockedError(false);
    setInfoMessage(null);
    setLoading(true);

    const endpoint = mode === 'register' ? '/api/v1/auth/register' : '/api/v1/auth/login';
    const body =
      mode === 'register'
        ? {
            email,
            password,
            name,
            ...(useInviteToken ? { inviteToken } : { companyName }),
          }
        : {
            email,
            password,
            ...(mfaChallengeActive && !useRecoveryCode && totpCode.trim() ? { totpCode: totpCode.trim() } : {}),
            ...(mfaChallengeActive && useRecoveryCode && recoveryCode.trim()
              ? { recoveryCode: recoveryCode.trim() }
              : {}),
          };

    const res = await safeApiFetchJson<AuthSessionPayload>(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.data) {
      setLoading(false);
      setError(res.error || 'Authentication failed.');
      return;
    }

    if (mode === 'login' && res.data.mfaRequired && !res.data.authenticated) {
      setLoading(false);
      setMfaChallengeActive(true);
      setInfoMessage('Enter the 6-digit code from your authenticator app or a backup recovery code.');
      return;
    }

    // Verify browser persisted and sends back the httpOnly session cookie (CHIPS/Partitioned check)
    const verifyRes = await safeApiFetchJson<AuthSessionPayload>('/api/v1/auth/session');
    setLoading(false);

    if (!verifyRes.ok || !verifyRes.data?.authenticated) {
      setCookieBlockedError(true);
      setError(
        'Your browser blocked the session cookie inside this embedded preview frame. Enable cookies for this frame or open the app in a standalone browser tab to sign in.'
      );
      return;
    }

    setMfaChallengeActive(false);
    setTotpCode('');
    setRecoveryCode('');
    setSession(verifyRes.data);
    syncSettingsTenant(verifyRes.data.tenant, true);
    if (onAuthenticated) {
      onAuthenticated(verifyRes.data);
    } else {
      window.location.assign('/');
    }
  };

  const handleSwitchTenant = async (targetTenantId: string) => {
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    const res = await safeApiFetchJson<{
      ok: boolean;
      tenant: TenantWorkspaceSummary;
      tenants: TenantWorkspaceSummary[];
      role: AuthSessionPayload['role'];
    }>('/api/v1/auth/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId: targetTenantId }),
    });

    setLoading(false);
    if (!res.ok || !res.data) {
      setError(res.error || 'Unable to switch company workspace.');
      return;
    }

    const updated: AuthSessionPayload = {
      ...(session || { authenticated: true, hasUsers: true, user: null, sessions: [] }),
      authenticated: true,
      tenant: res.data.tenant,
      tenants: res.data.tenants,
      role: res.data.role,
    };
    setSession(updated);
    syncSettingsTenant(res.data.tenant);
    setInfoMessage(`Switched active workspace to ${res.data.tenant.name}.`);

    if (onWorkspaceSwitched) {
      onWorkspaceSwitched(updated);
    } else {
      window.location.assign('/');
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    const res = await safeApiFetchJson<{
      ok: boolean;
      tenant: TenantWorkspaceSummary;
      tenants: TenantWorkspaceSummary[];
      role: AuthSessionPayload['role'];
    }>('/api/v1/auth/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: newOrgName.trim(), switchImmediately: true }),
    });

    setLoading(false);
    if (!res.ok || !res.data) {
      setError(res.error || 'Failed to create company workspace.');
      return;
    }

    setNewOrgName('');
    const updated: AuthSessionPayload = {
      ...(session || { authenticated: true, hasUsers: true, user: null, sessions: [] }),
      authenticated: true,
      tenant: res.data.tenant,
      tenants: res.data.tenants,
      role: res.data.role,
    };
    setSession(updated);
    syncSettingsTenant(res.data.tenant);
    setInfoMessage(`Created & activated isolated workspace: ${res.data.tenant.name}`);

    if (onWorkspaceSwitched) {
      onWorkspaceSwitched(updated);
    }
  };

  const handleTerminateSession = async (idPrefix: string) => {
    setError(null);
    const res = await safeApiFetchJson<{ ok: boolean; sessions: AuthSessionPayload['sessions'] }>(
      '/api/v1/auth/members',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'terminate_session', idPrefix }),
      }
    );

    if (!res.ok || !res.data) {
      setError(res.error || 'Unable to terminate session.');
      return;
    }

    setSession((prev) => (prev ? { ...prev, sessions: res.data!.sessions } : prev));
    setInfoMessage(`Terminated session ${idPrefix}...`);
  };

  const handleSignOut = async () => {
    setLoading(true);
    await safeApiFetchJson('/api/v1/auth/logout', { method: 'POST' });
    setLoading(false);
    syncSettingsTenant(null, true);
    setSession({
      authenticated: false,
      hasUsers: true,
      user: null,
      tenant: null,
      tenants: [],
      role: null,
      sessions: [],
    });
    if (onSignedOut) {
      onSignedOut();
    } else {
      window.location.assign('/');
    }
  };

  const isAuthenticated = Boolean(session?.authenticated && session?.user);

  return (
    <div className="min-h-screen bg-canvas text-customText flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-indigo-500/30">
      {/* Subtle Ambient Aura */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[340px] rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="absolute -bottom-24 right-1/4 w-[420px] h-[300px] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      {/* Theme Toggle & Back Button */}
      <div className="w-full max-w-xl flex items-center justify-between mb-4 relative z-10">
        {isAuthenticated && onClosePortal ? (
          <button
            type="button"
            onClick={onClosePortal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-subtleBorder bg-surface hover:bg-elevated text-xs font-mono text-customText transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Console</span>
          </button>
        ) : isAuthenticated ? (
          <button
            type="button"
            onClick={() => {
              window.location.assign('/');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-subtleBorder bg-surface hover:bg-elevated text-xs font-mono text-customText transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Open Observability Console</span>
          </button>
        ) : (
          <div className="text-[11px] font-mono text-mutedText">
            Zero-Mock Multi-Tenant Telemetry Engine
          </div>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-xl border border-subtleBorder bg-surface hover:bg-elevated text-customText transition-colors"
        >
          {isDarkMode ? (
            <Sun className="h-4 w-4 text-amber-400" />
          ) : (
            <Moon className="h-4 w-4 text-indigo-600" />
          )}
        </button>
      </div>

      <div className="w-full max-w-xl glass-card chromatic-rim rounded-2xl p-6 sm:p-8 relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-500 dark:text-indigo-400 mb-1">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-customText">
            The Neon Chasm
          </h1>
          <p className="text-xs font-mono text-mutedText">
            {isAuthenticated
              ? `Signed in as ${session?.user?.name} (${session?.user?.email})`
              : 'Isolated Company Workspaces, RBAC & Live OpenTelemetry Governance'}
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 space-y-2 text-rose-700 dark:text-rose-300 text-xs font-mono"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            {cookieBlockedError && (
              <div className="pl-6">
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-800 dark:text-rose-200 font-semibold transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Standalone Tab</span>
                </a>
              </div>
            )}
          </div>
        )}

        {infoMessage && (
          <div
            role="status"
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 text-xs font-mono"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{infoMessage}</span>
          </div>
        )}

        {isAuthenticated && session ? (
          <div className="space-y-6 font-mono text-xs">
            {/* Active Workspace & Switcher */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-mutedText">
                  Company Workspaces ({session.tenants.length})
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      session.user?.totpEnabled
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                    }`}
                  >
                    MFA: {session.user?.totpEnabled ? 'TOTP ACTIVE' : 'NOT ENROLLED'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase">
                    Role: {session.role}
                  </span>
                </div>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {session.tenants.map((t) => {
                  const isActive = t.tenantId === session.tenant?.tenantId;
                  return (
                    <div
                      key={t.tenantId}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                        isActive
                          ? 'border-indigo-500/50 bg-indigo-500/10'
                          : 'border-subtleBorder bg-elevated/60 hover:bg-elevated'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-customText flex items-center gap-2 truncate">
                          <Building2 className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                          <span className="truncate">{t.name}</span>
                          {isActive && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-mutedText mt-0.5 truncate">
                          ID: {t.tenantId} &bull; Role: {t.role || session.role}
                        </div>
                      </div>

                      {!isActive && (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => void handleSwitchTenant(t.tenantId)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shrink-0 disabled:opacity-50"
                        >
                          Switch
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Create Another Company Workspace */}
              <form onSubmit={(e) => void handleCreateWorkspace(e)} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Create another isolated company workspace..."
                  className="flex-1 bg-canvas border border-subtleBorder rounded-xl px-3 py-2 text-customText outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={loading || newOrgName.trim().length < 2}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold disabled:opacity-50 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Org</span>
                </button>
              </form>
            </div>

            {/* Active Sessions */}
            <div className="space-y-2.5 pt-4 border-t border-subtleBorder">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-mutedText">
                <Laptop className="h-3.5 w-3.5 text-indigo-500" />
                <span>Active Sessions ({session.sessions?.length || 0})</span>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {(session.sessions || []).map((s) => (
                  <div
                    key={s.idPrefix}
                    className="p-2.5 rounded-xl border border-subtleBorder bg-canvas/70 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-customText font-medium truncate">
                        {s.idPrefix}... {s.isCurrent ? '(Current Browser)' : ''}
                      </div>
                      <div className="text-[10px] text-mutedText truncate">
                        IP: {s.ipAddress || 'unknown'} &bull; Idle {new Date(s.idleExpiresAt || s.expiresAt).toLocaleTimeString()} &bull; Max {new Date(s.expiresAt).toLocaleTimeString()}
                      </div>
                    </div>
                    {!s.isCurrent && (
                      <button
                        type="button"
                        onClick={() => void handleTerminateSession(s.idPrefix)}
                        className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20"
                        title="Terminate session"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Sign Out */}
            <div className="pt-4 border-t border-subtleBorder flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleSignOut()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-semibold transition-colors disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
                <span>Sign Out</span>
              </button>

              {onClosePortal && (
                <button
                  type="button"
                  onClick={onClosePortal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  <span>Continue to Workspace</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl border border-subtleBorder bg-elevated/70 font-mono text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setMfaChallengeActive(false);
                  setError(null);
                }}
                className={`py-2 rounded-lg font-semibold transition-all ${
                  mode === 'login'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-mutedText hover:text-customText'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setMfaChallengeActive(false);
                  setError(null);
                }}
                className={`py-2 rounded-lg font-semibold transition-all ${
                  mode === 'register'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-mutedText hover:text-customText'
                }`}
              >
                Create Company Workspace
              </button>
            </div>

            {session && !session.hasUsers && mode === 'register' && (
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2.5 text-[11px] font-mono text-cyan-800 dark:text-cyan-200">
                Fresh zero-mock boot detected. Create your organization&apos;s administrator workspace below to initialize isolated telemetry ingestion.
              </div>
            )}

            <form onSubmit={(e) => void handleAuthSubmit(e)} className="space-y-4 font-mono text-xs">
              {mode === 'register' && (
                <>
                  <div>
                    <label htmlFor="auth-name" className="block text-mutedText mb-1.5 font-medium">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 w-4 h-4 text-mutedText" />
                      <input
                        id="auth-name"
                        type="text"
                        required
                        minLength={2}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Elena Vance"
                        className="w-full bg-canvas border border-subtleBorder rounded-xl pl-9 pr-3 py-2.5 text-customText outline-none focus:border-indigo-500 transition"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-mutedText">
                      {useInviteToken ? 'Joining an existing company via invite' : 'Provisioning a new isolated company'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setUseInviteToken((v) => !v)}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {useInviteToken ? 'Create new company instead' : 'Have an invite token?'}
                    </button>
                  </div>

                  {useInviteToken ? (
                    <div>
                      <label htmlFor="auth-invite" className="block text-mutedText mb-1.5 font-medium">
                        Single-Use Invite Token
                      </label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-mutedText" />
                        <input
                          id="auth-invite"
                          type="text"
                          required
                          value={inviteToken}
                          onChange={(e) => setInviteToken(e.target.value)}
                          placeholder="nci_..."
                          className="w-full bg-canvas border border-subtleBorder rounded-xl pl-9 pr-3 py-2.5 text-customText outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label htmlFor="auth-company" className="block text-mutedText mb-1.5 font-medium">
                        Company Workspace Name
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-mutedText" />
                        <input
                          id="auth-company"
                          type="text"
                          required
                          minLength={2}
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="Acme Telemetry Systems"
                          className="w-full bg-canvas border border-subtleBorder rounded-xl pl-9 pr-3 py-2.5 text-customText outline-none focus:border-indigo-500 transition"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-mutedText mb-1.5 font-medium">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-mutedText" />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setMfaChallengeActive(false);
                    }}
                    placeholder="engineer@company.com"
                    className="w-full bg-canvas border border-subtleBorder rounded-xl pl-9 pr-3 py-2.5 text-customText outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-mutedText mb-1.5 font-medium">
                  Password {mode === 'register' && <span className="opacity-70">(min 12 chars, strong passphrase)</span>}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-mutedText" />
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={mode === 'register' ? 12 : 1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-canvas border border-subtleBorder rounded-xl pl-9 pr-3 py-2.5 text-customText outline-none focus:border-indigo-500 transition"
                  />
                </div>
              </div>

              {mode === 'login' && mfaChallengeActive && (
                <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="auth-mfa-code"
                      className="text-indigo-700 dark:text-indigo-300 font-semibold flex items-center gap-1.5"
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      <span>{useRecoveryCode ? 'Backup Recovery Code' : 'Authenticator TOTP Code (6 digits)'}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setUseRecoveryCode((v) => !v);
                        setTotpCode('');
                        setRecoveryCode('');
                      }}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {useRecoveryCode ? 'Use 6-digit TOTP' : 'Use backup code'}
                    </button>
                  </div>
                  {useRecoveryCode ? (
                    <input
                      id="auth-mfa-code"
                      type="text"
                      required
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value)}
                      placeholder="XXXXX-XXXXX"
                      className="w-full bg-canvas border border-subtleBorder rounded-xl px-3 py-2 text-customText outline-none focus:border-indigo-500 tracking-wider uppercase"
                    />
                  ) : (
                    <input
                      id="auth-mfa-code"
                      type="text"
                      inputMode="numeric"
                      required
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="123456"
                      className="w-full bg-canvas border border-subtleBorder rounded-xl px-3 py-2 text-customText outline-none focus:border-indigo-500 tracking-widest text-center text-sm"
                    />
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 disabled:opacity-50"
              >
                <span>
                  {loading
                    ? 'Authenticating...'
                    : mode === 'register'
                    ? useInviteToken
                      ? 'Accept Invite & Join Company'
                      : 'Create Company Workspace'
                    : mfaChallengeActive
                    ? 'Verify MFA & Sign In'
                    : 'Sign In to Workspace'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
