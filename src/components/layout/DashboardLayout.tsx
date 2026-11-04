'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  FileText,
  LineChart,
  ShieldAlert,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
  Command,
  Clock,
  Globe,
  Sliders,
  Bell,
  Menu,
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
      // Don't trigger if user is typing in an input/textarea
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
        } else if (currentKey === 'n') {
          e.preventDefault();
          onNavigate('anomalies');
        } else if (currentKey === 's') {
          e.preventDefault();
          onNavigate('settings');
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
      id: 'analytics' as DashboardView,
      label: 'Analytics',
      shortcut: 'G A',
      icon: <LineChart className="h-4 w-4" />,
    },
    {
      id: 'anomalies' as DashboardView,
      label: 'Anomalies',
      shortcut: 'G N',
      icon: <ShieldAlert className="h-4 w-4" />,
      badge: activeAnomaliesCount > 0 ? activeAnomaliesCount : undefined,
    },
    {
      id: 'settings' as DashboardView,
      label: 'Settings',
      shortcut: 'G S',
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
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
        {/* Sidebar Desktop */}
        <aside
          className={`hidden md:flex flex-col border-r border-neutral-800 bg-neutral-900/60 backdrop-blur-md transition-all duration-200 z-20 ${
            isSidebarCollapsed ? 'w-16' : 'w-60'
          }`}
        >
          {/* Logo & Brand Header */}
          <div className="h-14 flex items-center justify-between px-3.5 border-b border-neutral-800">
            {!isSidebarCollapsed ? (
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="h-7 w-7 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 font-mono font-bold text-sm">
                  Ω
                </div>
                <div className="truncate">
                  <div className="font-semibold text-sm tracking-tight text-neutral-100">
                    Observability OS
                  </div>
                  <div className="text-[10px] font-mono text-neutral-400 leading-none">
                    Telemetry Engine
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-7 w-7 mx-auto rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 font-mono font-bold text-sm">
                Ω
              </div>
            )}

            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              aria-label={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={isSidebarCollapsed ? `${item.label} (${item.shortcut})` : undefined}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm shadow-sky-950/40'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                  } ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className={isActive ? 'text-sky-400' : 'text-neutral-400'}>
                      {item.icon}
                    </span>
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isSidebarCollapsed && (
                    <div className="flex items-center gap-1.5">
                      {item.badge !== undefined && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500 text-white">
                          {item.badge}
                        </span>
                      )}
                      <kbd className="text-[10px] font-mono text-neutral-500 bg-neutral-800 px-1 py-0.5 rounded border border-neutral-700/60">
                        {item.shortcut}
                      </kbd>
                    </div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer Command Helper */}
          <div className="p-3 border-t border-neutral-800">
            <button
              onClick={onOpenCommandPalette}
              className={`w-full flex items-center gap-2 py-2 px-2.5 rounded-lg border border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:border-neutral-700 transition-colors text-xs ${
                isSidebarCollapsed ? 'justify-center' : 'justify-between'
              }`}
            >
              <div className="flex items-center gap-2">
                <Command className="h-3.5 w-3.5" />
                {!isSidebarCollapsed && <span>Quick Actions</span>}
              </div>
              {!isSidebarCollapsed && (
                <kbd className="font-mono text-[10px] bg-neutral-800 px-1 py-0.5 rounded text-neutral-400">
                  ⌘K
                </kbd>
              )}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Sticky Header */}
          <header className="h-14 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-md sticky top-0 z-10 px-4 flex items-center justify-between gap-3">
            {/* Left: Mobile hamburger & Global search input */}
            <div className="flex items-center gap-3 flex-1 max-w-xl">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
                aria-label="Toggle Mobile Navigation"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Global search (endpoint, IP, trace, error)... Press '/' to focus"
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-neutral-800 bg-neutral-950/80 text-xs sm:text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 transition-all font-mono"
                />
                <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700">
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

              {/* Time Range Selector */}
              <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-950/80 p-0.5 text-xs font-mono">
                {(['15m', '1h', '24h', '7d'] as TimeRangePreset[]).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => onTimeRangeChange(preset)}
                    className={`px-2 py-1 rounded transition-colors ${
                      timeRange === preset
                        ? 'bg-neutral-800 text-sky-400 font-semibold'
                        : 'text-neutral-400 hover:text-neutral-200'
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
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-xs font-mono text-neutral-300 transition-colors"
              >
                <Globe className="h-3.5 w-3.5 text-neutral-400" />
                <span className="uppercase text-[11px]">{timezone}</span>
              </button>

              {/* Layout Density Toggle */}
              <button
                onClick={onToggleDensity}
                title={`Layout density: ${density} (Click to toggle)`}
                className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 transition-colors"
                aria-label="Toggle layout density"
              >
                <Sliders className="h-4 w-4 text-neutral-400" />
              </button>
            </div>
          </header>

          {/* Mobile Navigation Drawer */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-b border-neutral-800 bg-neutral-900 p-4 space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium ${
                    activeView === item.id
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'text-neutral-300 hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-rose-500 text-white">
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
