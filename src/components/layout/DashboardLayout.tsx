'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Shield,
  Layers,
  Flame,
  ShieldCheck,
} from 'lucide-react';
import {
  DashboardView,
  TimeRangePreset,
  TimezoneMode,
  DensityMode,
} from '../../types/telemetry';
import { LiveThroughputMeter } from './LiveThroughputMeter';

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  onOpenCommandPalette: () => void;
  // Preferences
  timeRange: TimeRangePreset;
  onTimeRangeChange: (preset: TimeRangePreset) => void;
  timezone: TimezoneMode;
  onTimezoneChange: (tz: TimezoneMode) => void;
  density: DensityMode;
  onToggleDensity: () => void;
  // Search & Global state
  searchQuery: string;
  onSearchChange: (query: string) => void;
  throughput: number;
  isIngesting: boolean;
  totalLogs: number;
  activeAnomaliesCount: number;
  liveAnnouncement?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  activeView,
  onNavigate,
  onOpenCommandPalette,
  timeRange,
  onTimeRangeChange,
  timezone,
  onTimezoneChange,
  density,
  onToggleDensity,
  searchQuery,
  onSearchChange,
  throughput,
  isIngesting,
  totalLogs,
  activeAnomaliesCount,
  liveAnnouncement = '',
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard navigation shortcuts: '/' for search, 'G + ...' for views
  useEffect(() => {
    let lastKey = '';
    let lastKeyTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isInput = targetTag === 'input' || targetTag === 'textarea';

      // Focus search with '/'
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Open command palette with Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenCommandPalette();
        return;
      }

      if (isInput) return;

      const now = Date.now();
      const currentKey = e.key.toLowerCase();

      // Two-key quick-jump sequence (G then D/R/A/N/S)
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
        }
        lastKey = '';
        return;
      }

      lastKey = currentKey;
      lastKeyTime = now;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate, onOpenCommandPalette]);

  const navItems = [
    {
      id: 'dashboard' as DashboardView,
      label: 'Overview',
      shortcut: 'G D',
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      id: 'logs' as DashboardView,
      label: 'Request Logs',
      shortcut: 'G R',
      icon: <FileText className="h-4 w-4" />,
    },
    {
      id: 'traces' as DashboardView,
      label: 'Distributed Traces',
      shortcut: 'G T',
      icon: <Layers className="h-4 w-4 text-indigo-400" />,
    },
    {
      id: 'analytics' as DashboardView,
      label: 'Analytics',
      shortcut: 'G A',
      icon: <LineChart className="h-4 w-4" />,
    },
    {
      id: 'metrics' as DashboardView,
      label: 'Metrics & Studio',
      shortcut: 'G M',
      icon: <Sliders className="h-4 w-4 text-cyan-400" />,
    },
    {
      id: 'anomalies' as DashboardView,
      label: 'Anomalies',
      shortcut: 'G N',
      icon: <ShieldAlert className="h-4 w-4" />,
      badge: activeAnomaliesCount > 0 ? activeAnomaliesCount : undefined,
    },
    {
      id: 'rum' as DashboardView,
      label: 'RUM & Replay',
      shortcut: 'G U',
      icon: <Users className="h-4 w-4" />,
    },
    {
      id: 'synthetic' as DashboardView,
      label: 'Global Synthetic',
      shortcut: 'G S',
      icon: <Globe className="h-4 w-4 text-sky-400" />,
      badge: 'SLO',
    },
    {
      id: 'incidents' as DashboardView,
      label: 'Incident Command',
      shortcut: 'G I',
      icon: <Flame className="h-4 w-4 text-rose-400" />,
      badge: 'AI',
    },
    {
      id: 'governance' as DashboardView,
      label: 'Governance & Security',
      shortcut: 'G G',
      icon: <Shield className="h-4 w-4 text-cyan-400" />,
    },
    {
      id: 'compliance' as DashboardView,
      label: 'Compliance & SIEM',
      shortcut: 'G C',
      icon: <ShieldCheck className="h-4 w-4 text-emerald-400" />,
      badge: 'SOC2',
    },
    {
      id: 'settings' as DashboardView,
      label: 'Settings',
      shortcut: 'G ,',
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Central ARIA Live Region for accessibility announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="aria-live-stream"
      >
        {liveAnnouncement}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Desktop - Deep Ocean Navy Container */}
        <aside
          className={`hidden md:flex flex-col border-r border-slate-800/80 bg-[#0B0F17] transition-all duration-200 z-20 ${
            isSidebarCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          {/* Logo & Brand Header with glowing accent */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
            {!isSidebarCollapsed ? (
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-mono font-bold text-sm shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                  Ω
                </div>
                <div className="truncate">
                  <div className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
                    Neon Chasm
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 leading-none">
                    Observability Engine
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-8 w-8 mx-auto rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-mono font-bold text-sm shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                Ω
              </div>
            )}

            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              aria-label={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Navigation Links with Glowing Indigo Pill Accents */}
          <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={isSidebarCollapsed ? `${item.label} (${item.shortcut})` : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-[0_0_18px_rgba(99,102,241,0.18)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  } ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className={isActive ? 'text-indigo-400' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isSidebarCollapsed && (
                    <div className="flex items-center gap-2">
                      {item.badge !== undefined && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]">
                          {item.badge}
                        </span>
                      )}
                      <kbd className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {item.shortcut}
                      </kbd>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer Command Trigger */}
          <div className="p-3 border-t border-slate-800/80">
            <button
              onClick={onOpenCommandPalette}
              className={`w-full flex items-center gap-2 py-2.5 px-3 rounded-xl border border-slate-800 hover:border-indigo-500/40 bg-[#131B2E] text-slate-400 hover:text-slate-200 transition-all text-xs ${
                isSidebarCollapsed ? 'justify-center' : 'justify-between'
              }`}
            >
              <div className="flex items-center gap-2">
                <Command className="h-3.5 w-3.5 text-indigo-400" />
                {!isSidebarCollapsed && <span>Quick Actions</span>}
              </div>
              {!isSidebarCollapsed && (
                <kbd className="font-mono text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400 border border-slate-800">
                  ⌘K
                </kbd>
              )}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#0B0F17]">
          {/* Sticky Frosted Header */}
          <header className="h-16 border-b border-slate-800/80 bg-[#0B0F17]/80 backdrop-blur-md sticky top-0 z-10 px-4 sm:px-6 flex items-center justify-between gap-3">
            {/* Left: Mobile hamburger & Global search input */}
            <div className="flex items-center gap-3 flex-1 max-w-xl">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                aria-label="Toggle Mobile Navigation"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search endpoint, IP, trace, error... Press '/' to focus"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-800/80 bg-[#131B2E]/90 text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono shadow-inner"
                />
                <kbd className="hidden sm:inline-block absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                  /
                </kbd>
              </div>
            </div>

            {/* Right: Controls & Throughput meter */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Isolated Throughput Meter */}
              <LiveThroughputMeter
                throughput={throughput}
                isIngesting={isIngesting}
                totalLogs={totalLogs}
              />

              {/* AI Incident Assistant Quick Trigger */}
              <button
                onClick={() => onNavigate('incidents')}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-mono text-rose-300 transition-all shadow-[0_0_12px_rgba(244,63,94,0.2)]"
                title="AI Incident Command Center (G I)"
              >
                <Flame className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
                <span className="font-bold">AI Incident</span>
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500/30 text-[10px] text-white">Active</span>
              </button>

              {/* Compliance Health Quick Trigger */}
              <button
                onClick={() => onNavigate('compliance')}
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-mono text-emerald-300 transition-all shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                title="SOC2 & GDPR Compliance Studio (G C)"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-bold">Compliance</span>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-[10px] text-white">100%</span>
              </button>

              {/* Global Edge Synthetic Probers Quick Trigger */}
              <button
                onClick={() => onNavigate('synthetic')}
                className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-xs font-mono text-sky-300 transition-all shadow-[0_0_12px_rgba(14,165,233,0.2)]"
                title="Global Edge Synthetic Probers & Latency Map (G S)"
              >
                <Globe className="h-3.5 w-3.5 text-sky-400" />
                <span className="font-bold">Edge SLO</span>
                <span className="px-1.5 py-0.2 rounded-full bg-sky-500/30 text-[10px] text-white">99.98%</span>
              </button>

              {/* FinOps & System Resilience Quick Trigger */}
              <button
                onClick={() => onNavigate('governance')}
                className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-xs font-mono text-indigo-300 transition-all shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                title="FinOps, Cardinality & Chaos Governance (G G)"
              >
                <Shield className="h-3.5 w-3.5 text-indigo-400" />
                <span className="font-bold">FinOps</span>
                <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/30 text-[10px] text-white">$3.4k/mo · 94% Resil</span>
              </button>

              {/* Time Range Selector */}
              <div className="flex items-center rounded-xl border border-slate-800/80 bg-[#131B2E] p-1 text-xs font-mono">
                {(['15m', '1h', '24h', '7d'] as TimeRangePreset[]).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => onTimeRangeChange(preset)}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      timeRange === preset
                        ? 'bg-indigo-600/25 text-indigo-300 font-semibold border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.15)]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Timezone Switcher */}
              <button
                onClick={() =>
                  onTimezoneChange(
                    timezone === 'local' ? 'utc' : timezone === 'utc' ? 'relative' : 'local'
                  )
                }
                title={`Timezone mode: ${timezone.toUpperCase()} (Click to cycle)`}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-800/80 bg-[#131B2E] hover:border-slate-700 text-xs font-mono text-slate-300 transition-colors"
              >
                <Globe className="h-3.5 w-3.5 text-indigo-400" />
                <span className="uppercase text-[11px] font-medium">{timezone}</span>
              </button>

              {/* Layout Density Toggle */}
              <button
                onClick={onToggleDensity}
                title={`Layout density: ${density} (Click to toggle)`}
                className="p-2 rounded-xl border border-slate-800/80 bg-[#131B2E] hover:border-slate-700 text-slate-300 transition-colors"
                aria-label="Toggle layout density"
              >
                <Sliders className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          </header>

          {/* Mobile Navigation Drawer */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-b border-slate-800/80 bg-[#0B0F17] p-4 space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium ${
                    activeView === item.id
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                      : 'text-slate-300 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Main Dashboard Panel Body with Viewport Scroll */}
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
