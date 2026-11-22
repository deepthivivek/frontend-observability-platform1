'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FileText,
  LineChart,
  ShieldAlert,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  Search,
  Command,
  Globe,
  Sliders,
  Menu,
  X,
  Shield,
  Layers,
  Flame,
  ShieldCheck,
  Sun,
  Moon,
  Cpu,
  Sparkles,
  BrainCircuit,
  Dna,
  Network,
  Radio,
  RefreshCw,
  WifiOff,
  Building2,
  LogOut,
  Activity,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { AuthRole } from '../../types/auth';
import {
  DashboardView,
  TimeRangePreset,
  TimezoneMode,
  DensityMode,
} from '../../types/telemetry';
import {
  TelemetryConnectionStatus,
  TelemetryStreamTransport,
} from '../../hooks/useTelemetryStream';

interface NavItem {
  id: DashboardView;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
  badge?: string | number;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  onOpenCommandPalette: () => void;
  // Preferences
  timeRange: TimeRangePreset;
  onTimeRangeChange: (preset: TimeRangePreset) => void;
  timezone?: TimezoneMode;
  onTimezoneChange?: (tz: TimezoneMode) => void;
  density: DensityMode;
  onToggleDensity?: () => void;
  // Search & Global state
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  throughput?: number;
  isIngesting?: boolean;
  totalLogs: number;
  activeAnomaliesCount: number;
  liveAnnouncement?: string;
  // Live Stream status pill
  streamStatus?: TelemetryConnectionStatus;
  streamTransport?: TelemetryStreamTransport;
  onReconnectStream?: () => void;
  // Multi-tenant auth header controls
  activeTenantName?: string;
  activeUserEmail?: string;
  activeRole?: AuthRole;
  onOpenWorkspaceSwitcher?: () => void;
  onSignOut?: () => void;
  // Opt-in Live OTLP Traffic Simulator
  isSimulatingTraffic?: boolean;
  canSimulateTraffic?: boolean;
  onToggleTrafficSimulation?: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeView,
  onNavigate,
  onOpenCommandPalette,
  timeRange,
  onTimeRangeChange,
  density,
  searchQuery = '',
  onSearchChange,
  totalLogs,
  activeAnomaliesCount,
  liveAnnouncement = '',
  streamStatus = 'connecting',
  streamTransport = 'websocket',
  onReconnectStream,
  activeTenantName,
  activeUserEmail,
  activeRole,
  onOpenWorkspaceSwitcher,
  onSignOut,
  isSimulatingTraffic = false,
  canSimulateTraffic = false,
  onToggleTrafficSimulation,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMounted(true);
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('theme', 'dark');
      } catch {
        // Ignore storage errors
      }
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('theme', 'light');
      } catch {
        // Ignore storage errors
      }
    }
  };

  // Keyboard navigation shortcuts: '/' or Cmd+K for Command Palette, 'G + ...' & chords for views
  useEffect(() => {
    let lastKey = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditableTarget =
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        Boolean(target?.isContentEditable);

      // Open command palette with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      if (isEditableTarget || e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      // Open Quick Actions / Search with '/'
      if (e.key === '/') {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      const now = Date.now();
      const currentKey = e.key.toLowerCase();

      if (lastKey === 'l' && currentKey === 'l' && now - lastKeyTime < 800) {
        e.preventDefault();
        onNavigate('logs');
        lastKey = '';
        return;
      }

      if (lastKey === 'd' && currentKey === 't' && now - lastKeyTime < 800) {
        e.preventDefault();
        onNavigate('capstone-ultimate');
        lastKey = '';
        return;
      }

      if (lastKey === 'd' && currentKey === 's' && now - lastKeyTime < 800) {
        e.preventDefault();
        onNavigate('synthetic-dream');
        lastKey = '';
        return;
      }

      if (lastKey === 'i' && currentKey === 's' && now - lastKeyTime < 800) {
        e.preventDefault();
        onNavigate('immune-system');
        lastKey = '';
        return;
      }

      if (lastKey === 'n' && currentKey === 'm' && now - lastKeyTime < 800) {
        e.preventDefault();
        onNavigate('neuromorphic-mesh');
        lastKey = '';
        return;
      }

      if (lastKey === 'a' && currentKey === 's' && now - lastKeyTime < 800) {
        e.preventDefault();
        onNavigate('autonomous-swarm');
        lastKey = '';
        return;
      }

      if (lastKey === 'a' && currentKey === 'k' && now - lastKeyTime < 800) {
        e.preventDefault();
        onNavigate('akasha-omega');
        lastKey = '';
        return;
      }

      if (lastKey === 'g' && now - lastKeyTime < 800) {
        if (currentKey === 'd') {
          e.preventDefault();
          onNavigate('dashboard');
        } else if (currentKey === 'r') {
          e.preventDefault();
          onNavigate('logs');
        } else if (currentKey === 'a') {
          e.preventDefault();
          onNavigate('analytics');
        } else if (currentKey === 'm') {
          e.preventDefault();
          onNavigate('metrics');
        } else if (currentKey === 't') {
          e.preventDefault();
          onNavigate('traces');
        } else if (currentKey === 'n') {
          e.preventDefault();
          onNavigate('anomalies');
        } else if (currentKey === 'u') {
          e.preventDefault();
          onNavigate('rum');
        } else if (currentKey === 'i') {
          e.preventDefault();
          onNavigate('incidents');
        } else if (currentKey === 'c') {
          e.preventDefault();
          onNavigate('compliance');
        } else if (currentKey === 's') {
          e.preventDefault();
          onNavigate('synthetic');
        } else if (currentKey === 'g') {
          e.preventDefault();
          onNavigate('governance');
        } else if (currentKey === 'h') {
          e.preventDefault();
          onNavigate('self-healing');
        } else if (currentKey === ',') {
          e.preventDefault();
          onNavigate('settings');
        }
        lastKey = '';
        return;
      }

      if (lastKey === 'h' && currentKey === 'h' && now - lastKeyTime < 800) {
        e.preventDefault();
        onNavigate('self-healing');
        lastKey = '';
        return;
      }

      lastKey = currentKey;
      lastKeyTime = now;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate, onOpenCommandPalette]);

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Overview',
      shortcut: 'G D',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      id: 'logs',
      label: 'Request Logs',
      shortcut: 'G R',
      icon: <FileText className="h-4 w-4" />,
      badge: totalLogs > 0 ? totalLogs.toLocaleString() : undefined,
    },
    {
      id: 'traces',
      label: 'Distributed Traces',
      shortcut: 'G T',
      icon: <Layers className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      shortcut: 'G A',
      icon: <LineChart className="h-4 w-4" />,
    },
    {
      id: 'metrics',
      label: 'Metrics & Studio',
      shortcut: 'G M',
      icon: <Sliders className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />,
    },
    {
      id: 'anomalies',
      label: 'Anomalies',
      shortcut: 'G N',
      icon: <ShieldAlert className="h-4 w-4" />,
      badge: activeAnomaliesCount > 0 ? activeAnomaliesCount : undefined,
    },
    {
      id: 'rum',
      label: 'RUM & Replay',
      shortcut: 'G U',
      icon: <Users className="h-4 w-4" />,
    },
    {
      id: 'synthetic',
      label: 'Global Synthetic',
      shortcut: 'G S',
      icon: <Globe className="h-4 w-4 text-sky-500 dark:text-sky-400" />,
    },
    {
      id: 'incidents',
      label: 'Incident Command',
      shortcut: 'G I',
      icon: <Flame className="h-4 w-4 text-rose-500 dark:text-rose-400" />,
    },
    {
      id: 'governance',
      label: 'Governance & Security',
      shortcut: 'G G',
      icon: <Shield className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />,
    },
    {
      id: 'compliance',
      label: 'Compliance & SIEM',
      shortcut: 'G C',
      icon: <ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />,
    },
    {
      id: 'self-healing',
      label: 'Self-Healing Studio',
      shortcut: 'H H',
      icon: <Cpu className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />,
    },
    {
      id: 'capstone-ultimate',
      label: 'Ultimate Governance',
      shortcut: 'D T',
      icon: <Sparkles className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />,
    },
    {
      id: 'neuromorphic-mesh',
      label: 'Neuromorphic Mesh',
      shortcut: 'N M',
      icon: <BrainCircuit className="h-4 w-4 text-violet-500 dark:text-violet-400" />,
    },
    {
      id: 'synthetic-dream',
      label: 'Synthetic Dream',
      shortcut: 'D S',
      icon: <Dna className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />,
    },
    {
      id: 'autonomous-swarm',
      label: 'Autonomous Swarm',
      shortcut: 'A S',
      icon: <Network className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />,
    },
    {
      id: 'akasha-omega',
      label: 'Akasha-Omega',
      shortcut: 'A K',
      icon: <InfinityIcon className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />,
    },
    {
      id: 'settings',
      label: 'Settings',
      shortcut: 'G ,',
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  const activeNavItem =
    navItems.find((item) => item.id === activeView) || navItems[0];

  const streamPillStyles =
    streamStatus === 'connected'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
      : streamStatus === 'reconnecting' || streamStatus === 'connecting'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
      : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20';

  const streamLabel =
    streamStatus === 'connected'
      ? `Live · ${streamTransport === 'websocket' ? 'WS' : streamTransport.toUpperCase()}`
      : streamStatus === 'reconnecting'
      ? 'Reconnecting'
      : streamStatus === 'connecting'
      ? 'Live (Idle)'
      : streamStatus === 'degraded'
      ? 'Degraded'
      : 'Offline';

  return (
    <div className="min-h-screen bg-canvas text-customText flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200 transition-colors duration-200">
      {/* Central ARIA Live Region for accessibility announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="aria-live-stream"
      >
        {liveAnnouncement}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sole Left Vertical Sidebar - Independent Scrolling */}
        <aside
          aria-label="Primary Observability Navigation"
          className={`hidden md:flex flex-col border-r border-subtleBorder bg-canvas h-screen sticky top-0 shrink-0 transition-all duration-200 z-20 ${
            isSidebarCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          {/* Logo & Brand Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-subtleBorder shrink-0">
            {!isSidebarCollapsed ? (
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-mono font-bold text-sm shadow-[0_0_15px_rgba(99,102,241,0.2)] shrink-0">
                  Ω
                </div>
                <div className="truncate">
                  <div className="font-semibold text-sm tracking-tight text-customText">
                    Neon Chasm
                  </div>
                  <div className="text-[10px] font-mono text-mutedText leading-none">
                    Observability Engine
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-8 w-8 mx-auto rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-mono font-bold text-sm shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                Ω
              </div>
            )}

            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              aria-label={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              className="p-1.5 rounded-lg text-mutedText hover:text-customText hover:bg-elevated transition-colors shrink-0"
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Independently Scrollable Sidebar Links */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={isSidebarCollapsed ? `${item.label} (${item.shortcut})` : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/40 shadow-[0_0_18px_rgba(99,102,241,0.16)]'
                      : 'text-mutedText hover:text-customText hover:bg-elevated border border-transparent'
                  } ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className={isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-mutedText'}>
                      {item.icon}
                    </span>
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isSidebarCollapsed && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.badge !== undefined && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tabular-nums border ${
                            item.id === 'anomalies'
                              ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40'
                              : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      <kbd className="text-[10px] font-mono text-mutedText bg-surface px-1.5 py-0.5 rounded border border-subtleBorder">
                        {item.shortcut}
                      </kbd>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer Command Trigger */}
          <div className="p-3 border-t border-subtleBorder shrink-0">
            <button
              onClick={onOpenCommandPalette}
              className={`w-full flex items-center gap-2 py-2.5 px-3 rounded-xl border border-subtleBorder hover:border-indigo-500/40 bg-surface text-mutedText hover:text-customText transition-all text-xs ${
                isSidebarCollapsed ? 'justify-center' : 'justify-between'
              }`}
            >
              <div className="flex items-center gap-2">
                <Command className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                {!isSidebarCollapsed && <span>Quick Actions</span>}
              </div>
              {!isSidebarCollapsed && (
                <kbd className="font-mono text-[10px] bg-elevated px-1.5 py-0.5 rounded text-mutedText border border-subtleBorder">
                  ⌘K
                </kbd>
              )}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 bg-canvas">
          {/* Compact Streamlined Global Header */}
          <header className="h-16 border-b border-subtleBorder bg-canvas/85 backdrop-blur-md sticky top-0 z-10 px-4 sm:px-6 flex items-center justify-between gap-3 transition-colors duration-200">
            {/* Left: Mobile Drawer Toggle & Active View Title */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-mutedText hover:text-customText hover:bg-elevated shrink-0"
                aria-label="Toggle Mobile Navigation"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-indigo-600 dark:text-indigo-400 shrink-0">
                  {activeNavItem.icon}
                </span>
                <h2 className="text-sm sm:text-base font-semibold tracking-tight text-customText truncate">
                  {activeNavItem.label}
                </h2>
                {searchQuery && onSearchChange && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    title="Clear active search filter"
                    className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-indigo-500/30 bg-indigo-500/10 text-[11px] font-mono text-indigo-700 dark:text-indigo-300 whitespace-nowrap shrink-0"
                  >
                    <span>Filter: {searchQuery}</span>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Right: Time Range, Clickable Stream Pill, Quick Actions (⌘K / /), Theme Toggle */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Time Range Selector */}
              <div
                role="group"
                aria-label="Time Range Selector"
                className="flex items-center rounded-xl border border-subtleBorder bg-surface p-1 text-xs font-mono"
              >
                {(['15m', '1h', '24h', '7d'] as TimeRangePreset[]).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => onTimeRangeChange(preset)}
                    className={`px-2 sm:px-2.5 py-1 rounded-lg transition-all whitespace-nowrap shrink-0 ${
                      timeRange === preset
                        ? 'bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-500/30'
                        : 'text-mutedText hover:text-customText'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Clickable Stream Status Pill */}
              <button
                type="button"
                onClick={() => onReconnectStream?.()}
                title="Click to reconnect WebSocket / SSE telemetry stream"
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${streamPillStyles}`}
              >
                {streamStatus === 'connected' ? (
                  <Radio className="h-3.5 w-3.5" />
                ) : streamStatus === 'reconnecting' || streamStatus === 'connecting' ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5" />
                )}
                <span>{streamLabel}</span>
              </button>

              {/* Opt-in Live OTLP Traffic Simulator Toggle (Admin / Editor only) */}
              {onToggleTrafficSimulation && (
                <button
                  type="button"
                  onClick={() => onToggleTrafficSimulation()}
                  disabled={!canSimulateTraffic}
                  title={
                    canSimulateTraffic
                      ? isSimulatingTraffic
                        ? 'Stop live microservice OTLP traffic generator'
                        : 'Simulate Live Microservice Traffic through POST /api/v1/telemetry'
                      : 'Viewer role is read-only and cannot emit simulated OTLP traffic'
                  }
                  aria-pressed={isSimulatingTraffic}
                  className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed ${
                    isSimulatingTraffic
                      ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'border-subtleBorder bg-surface hover:bg-elevated hover:border-indigo-500/40 text-customText'
                  }`}
                >
                  <Activity className={`h-3.5 w-3.5 ${isSimulatingTraffic ? 'animate-pulse text-emerald-500' : 'text-indigo-500 dark:text-indigo-400'}`} />
                  <span className="hidden xl:inline">
                    {isSimulatingTraffic ? 'Stop Traffic Sim' : 'Simulate Live Microservice Traffic'}
                  </span>
                  <span className="xl:hidden">
                    {isSimulatingTraffic ? 'Stop Sim' : 'Sim Traffic'}
                  </span>
                </button>
              )}

              {/* Quick Actions Trigger (⌘K / /) */}
              <button
                type="button"
                onClick={onOpenCommandPalette}
                title="Open Quick Actions & Search (⌘K or /)"
                className="inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border border-subtleBorder bg-surface hover:bg-elevated hover:border-indigo-500/40 text-xs font-mono text-mutedText hover:text-customText transition-colors whitespace-nowrap shrink-0"
              >
                <Search className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                <span className="hidden lg:inline">Quick Actions</span>
                <kbd className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded bg-elevated border border-subtleBorder text-mutedText">
                  ⌘K /
                </kbd>
              </button>

              {/* Workspace / Login Switcher */}
              <button
                type="button"
                onClick={() => {
                  if (onOpenWorkspaceSwitcher) {
                    onOpenWorkspaceSwitcher();
                  } else {
                    window.location.href = '/login';
                  }
                }}
                title={
                  activeUserEmail
                    ? `Signed in as ${activeUserEmail} (${activeRole || 'member'}). Click to switch company or manage sessions.`
                    : 'Switch Company Workspace or Sign In'
                }
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 max-w-[200px]"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline truncate">
                  {activeTenantName || 'Workspace / Login'}
                </span>
                {activeRole && (
                  <span className="hidden xl:inline text-[10px] uppercase px-1.5 py-0.2 rounded bg-cyan-500/20 border border-cyan-500/30">
                    {activeRole}
                  </span>
                )}
              </button>

              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  title="Sign Out"
                  aria-label="Sign Out"
                  className="p-2 rounded-xl border border-subtleBorder bg-surface hover:bg-rose-500/10 hover:border-rose-500/40 text-mutedText hover:text-rose-600 dark:hover:text-rose-400 transition-colors shrink-0"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              )}

              {/* Seamless Light/Dark Mode Switcher */}
              <button
                type="button"
                onClick={toggleTheme}
                title={mounted ? (isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode') : 'Toggle theme mode'}
                aria-label="Toggle theme mode"
                className="p-2 rounded-xl border border-subtleBorder bg-surface hover:bg-elevated text-customText transition-colors shrink-0"
              >
                {!mounted || isDarkMode ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-600" />
                )}
              </button>
            </div>
          </header>

          {/* Mobile Navigation Drawer */}
          {isMobileMenuOpen && (
            <nav
              aria-label="Mobile Navigation"
              className="md:hidden border-b border-subtleBorder bg-canvas p-4 space-y-1.5 max-h-[75vh] overflow-y-auto"
            >
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium ${
                    activeView === item.id
                      ? 'bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/40'
                      : 'text-customText hover:bg-elevated'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono tabular-nums bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          )}

          {/* Main Dashboard Panel Body */}
          <main
            className={`flex-1 overflow-y-auto ${
              density === 'compact' ? 'p-3 space-y-3' : 'p-5 sm:p-6 space-y-6'
            }`}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
