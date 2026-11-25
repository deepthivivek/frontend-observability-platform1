'use client';

import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Server,
  LineChart,
  FileText,
  ShieldAlert,
  Settings,
  Bell,
  Sun,
  Moon,
  Menu,
  X,
  AlertTriangle,
  XCircle,
  KeyRound,
  Activity,
} from 'lucide-react';
import type { EndpointRow } from '@/src/lib/metrics';

interface NavRoute {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const PRIMARY_NAV_ROUTES: NavRoute[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/endpoints', label: 'Endpoints', icon: Server },
  { href: '/analytics', label: 'Analytics', icon: LineChart },
  { href: '/logs', label: 'Request Logs', icon: FileText },
  { href: '/anomalies', label: 'Anomalies', icon: ShieldAlert },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function subscribeEmpty() {
  return () => {};
}

function useIsHydrated() {
  return useSyncExternalStore(
    subscribeEmpty,
    () => true,
    () => false
  );
}

export interface AppShellProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  isSynthetic?: boolean;
  endpoints?: readonly EndpointRow[];
}

export function AppShell({
  children,
  title,
  subtitle,
  isSynthetic = true,
  endpoints = [],
}: AppShellProps) {
  const pathname = usePathname();
  const isHydrated = useIsHydrated();
  const [isDark, setIsDark] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const alertEndpoints = endpoints.filter(
    (ep) => ep.status === 'Warning' || ep.status === 'Failed'
  );

  useEffect(() => {
    if (!isHydrated) return;
    const syncTimer = window.setTimeout(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [isHydrated]);

  useEffect(() => {
    if (!isNotificationsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsNotificationsOpen(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsNotificationsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotificationsOpen]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
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

  return (
    <div className="min-h-screen bg-canvas text-customText flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-subtleBorder bg-surface/60 backdrop-blur-xl sticky top-0 h-screen shrink-0">
        <div className="h-16 px-5 border-b border-subtleBorder flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-mono font-bold text-sm shrink-0">
            Ω
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-customText truncate">
              The Neon Chasm
            </div>
            <div className="text-[11px] font-mono text-mutedText truncate">
              Telemetry Monitor
            </div>
          </div>
        </div>

        <nav
          aria-label="Primary navigation"
          className="flex-1 p-3 space-y-1 overflow-y-auto"
        >
          {PRIMARY_NAV_ROUTES.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-[0_0_18px_rgba(99,102,241,0.16)]'
                    : 'text-mutedText hover:text-customText hover:bg-elevated border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3 truncate">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-indigo-400' : 'text-mutedText'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.href === '/anomalies' && alertEndpoints.length > 0 && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold tabular-nums bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    {alertEndpoints.length}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-subtleBorder space-y-2">
          <Link
            href="/login"
            className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-mutedText hover:text-customText bg-elevated/60 hover:bg-elevated border border-subtleBorder transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <span className="flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5 text-cyan-400" />
              <span>Workspace Auth</span>
            </span>
            <span className="font-mono text-[10px] text-mutedText">/login</span>
          </Link>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-subtleBorder bg-canvas/85 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={isMobileMenuOpen}
              className="md:hidden p-2 rounded-xl border border-subtleBorder bg-surface text-mutedText hover:text-customText hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              {isMobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-base sm:text-lg font-semibold tracking-tight text-customText truncate">
                  {title}
                </h1>
                {isSynthetic && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-amber-500/35 bg-amber-500/10 text-amber-300 text-[11px] font-mono font-medium shrink-0"
                    title="Metrics below are served as synthetic demo telemetry from /api/metrics"
                  >
                    <Activity className="h-3 w-3" />
                    Demo data
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="hidden sm:block text-xs text-mutedText truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Notifications Bell Popover */}
            <div className="relative" ref={popoverRef}>
              <button
                type="button"
                aria-label="Notifications"
                aria-expanded={isNotificationsOpen}
                aria-haspopup="dialog"
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                className="relative p-2 rounded-xl border border-subtleBorder bg-surface hover:bg-elevated text-customText transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <Bell className="h-4 w-4 text-indigo-400" />
                {alertEndpoints.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold flex items-center justify-center tabular-nums">
                    {alertEndpoints.length}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <div
                  role="dialog"
                  aria-label="Endpoint Alerts"
                  className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl border border-subtleBorder bg-surface shadow-2xl p-4 z-30 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-subtleBorder pb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-customText">
                      Active Endpoint Alerts
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsNotificationsOpen(false)}
                      aria-label="Close notifications"
                      className="p-1 rounded-lg text-mutedText hover:text-customText hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {alertEndpoints.length === 0 ? (
                    <p className="text-xs text-mutedText py-2">
                      All monitored endpoints are currently operating within SLA thresholds.
                    </p>
                  ) : (
                    <ul className="space-y-2 max-h-64 overflow-y-auto">
                      {alertEndpoints.map((ep) => (
                        <li
                          key={ep.id}
                          className="rounded-xl border border-subtleBorder bg-elevated/70 p-2.5 flex items-start gap-2.5"
                        >
                          {ep.status === 'Failed' ? (
                            <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-customText truncate">
                                {ep.name}
                              </span>
                              <span
                                className={`text-[10px] font-mono font-semibold ${
                                  ep.status === 'Failed'
                                    ? 'text-rose-400'
                                    : 'text-amber-400'
                                }`}
                              >
                                {ep.status}
                              </span>
                            </div>
                            <p className="text-[11px] font-mono text-mutedText truncate">
                              {ep.method} {ep.path} · {ep.responseTimeMs} ms
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="pt-1 border-t border-subtleBorder flex justify-end">
                    <Link
                      href="/anomalies"
                      onClick={() => setIsNotificationsOpen(false)}
                      className="text-xs font-medium text-indigo-400 hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 rounded"
                    >
                      View all anomalies →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="p-2 rounded-xl border border-subtleBorder bg-surface hover:bg-elevated text-customText transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              {!isHydrated || isDark ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-500" />
              )}
            </button>
          </div>
        </header>

        {/* Mobile Nav Drawer */}
        {isMobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="md:hidden border-b border-subtleBorder bg-surface p-3 space-y-1"
          >
            {PRIMARY_NAV_ROUTES.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                      : 'text-mutedText hover:text-customText hover:bg-elevated'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        <main className="flex-1 min-w-0 p-4 sm:p-6 space-y-6">{children}</main>
      </div>
    </div>
  );
}
