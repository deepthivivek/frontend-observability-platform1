'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { DashboardContainer } from '@/src/components/dashboard/DashboardContainer';
import { AuthPortal } from '@/src/components/auth/AuthPortal';
import { AuthSessionPayload } from '@/src/types/auth';
import {
  loadNeonChasmSettings,
  saveNeonChasmSettings,
  safeApiFetchJson,
} from '@/src/utils/apiClient';

export default function HomePage() {
  const [session, setSession] = useState<AuthSessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionReason, setSessionReason] = useState<string | null>(null);
  const [showWorkspacePortal, setShowWorkspacePortal] = useState(false);

  const syncSettingsToTenant = useCallback((payload: AuthSessionPayload | null) => {
    if (!payload?.tenant) return;
    const current = loadNeonChasmSettings();
    if (current.tenantId !== payload.tenant.tenantId) {
      saveNeonChasmSettings({
        ...current,
        tenantId: payload.tenant.tenantId,
        latencyWarnMs: payload.tenant.latencyWarnMs,
        latencyCritMs: payload.tenant.latencyCritMs,
        errorRateThresholdPct: payload.tenant.errorRateThresholdPct,
      });
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const res = await safeApiFetchJson<AuthSessionPayload>('/api/v1/auth/session');
    if (res.ok && res.data) {
      setSession(res.data);
      syncSettingsToTenant(res.data);
    } else {
      setSession({
        authenticated: false,
        hasUsers: true,
        user: null,
        tenant: null,
        tenants: [],
        role: null,
        sessions: [],
      });
    }
    setLoading(false);
  }, [syncSettingsToTenant]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void refreshSession();
    }, 0);

    const handleExpired = () => {
      const current = loadNeonChasmSettings();
      if (current.tenantApiKey) {
        saveNeonChasmSettings({ ...current, tenantApiKey: '' });
      }
      setSessionReason('expired');
      setShowWorkspacePortal(false);
      setSession({
        authenticated: false,
        hasUsers: true,
        user: null,
        tenant: null,
        tenants: [],
        role: null,
        sessions: [],
      });
    };

    window.addEventListener('neon-chasm-session-expired', handleExpired);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('neon-chasm-session-expired', handleExpired);
    };
  }, [refreshSession]);

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-3 text-indigo-500">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="text-xs font-mono text-mutedText">Verifying organization workspace...</span>
      </div>
    );
  }

  if (!session?.authenticated || !session.tenant || showWorkspacePortal) {
    return (
      <AuthPortal
        initialReason={sessionReason}
        initialSession={session}
        onAuthenticated={(nextSession) => {
          setSessionReason(null);
          setShowWorkspacePortal(false);
          setSession(nextSession);
          syncSettingsToTenant(nextSession);
        }}
        onWorkspaceSwitched={(nextSession) => {
          setSessionReason(null);
          setShowWorkspacePortal(false);
          setSession(nextSession);
          syncSettingsToTenant(nextSession);
        }}
        onSignedOut={() => {
          const current = loadNeonChasmSettings();
          if (current.tenantApiKey) {
            saveNeonChasmSettings({ ...current, tenantApiKey: '' });
          }
          setSessionReason(null);
          setShowWorkspacePortal(false);
          setSession({
            authenticated: false,
            hasUsers: true,
            user: null,
            tenant: null,
            tenants: [],
            role: null,
            sessions: [],
          });
        }}
        onClosePortal={
          session?.authenticated && session.tenant
            ? () => setShowWorkspacePortal(false)
            : undefined
        }
      />
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <DashboardContainer
        key={session.tenant.tenantId}
        authSession={session}
        onOpenWorkspaceSwitcher={() => setShowWorkspacePortal(true)}
        onSwitchTenant={async (tenantId) => {
          const res = await safeApiFetchJson<{
            ok: boolean;
            tenant: AuthSessionPayload['tenant'];
            tenants: AuthSessionPayload['tenants'];
            role: AuthSessionPayload['role'];
          }>('/api/v1/auth/switch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId }),
          });
          if (res.ok && res.data && res.data.tenant) {
            const nextSession: AuthSessionPayload = {
              ...session,
              tenant: res.data.tenant,
              tenants: res.data.tenants,
              role: res.data.role,
            };
            syncSettingsToTenant(nextSession);
            setSession(nextSession);
          }
        }}
        onSignOut={async () => {
          await safeApiFetchJson('/api/v1/auth/logout', { method: 'POST' });
          const current = loadNeonChasmSettings();
          if (current.tenantApiKey) {
            saveNeonChasmSettings({ ...current, tenantApiKey: '' });
          }
          setShowWorkspacePortal(false);
          setSession({
            authenticated: false,
            hasUsers: true,
            user: null,
            tenant: null,
            tenants: [],
            role: null,
            sessions: [],
          });
        }}
      />
    </Suspense>
  );
}
