'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  Download,
  RotateCcw,
  LayoutDashboard,
  FileText,
  LineChart,
  ShieldAlert,
  Settings,
  Users,
  X,
  CornerDownLeft,
  Flame,
  ShieldCheck,
  Globe,
  Cpu,
  Sparkles,
  BrainCircuit,
  Dna,
  Network,
  RefreshCw,
  Send,
  Layers,
  AlertTriangle,
  Infinity as InfinityIcon,
} from 'lucide-react';
import {
  ApiRequestLog,
  DashboardView,
  DetectedAnomaly,
} from '../../types/telemetry';
import { Incident } from '../../types/alert';

export interface CommandAction {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Actions' | 'Alerts' | 'Traces' | 'Endpoints';
  icon: React.ReactNode;
  shortcut?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: DashboardView) => void;
  onClearFilters: () => void;
  onExportLogs: () => void;
  onResetMetrics: () => void;
  onSyncTelemetry?: () => void;
  onSendDiagnosticSpan?: () => void;
  onInspectTrace?: (traceId: string) => void;
  onFilterEndpoint?: (endpoint: string) => void;
  logs?: ApiRequestLog[];
  anomalies?: DetectedAnomaly[];
  incidents?: Incident[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onClearFilters,
  onExportLogs,
  onResetMetrics,
  onSyncTelemetry,
  onSendDiagnosticSpan,
  onInspectTrace,
  onFilterEndpoint,
  logs = [],
  anomalies = [],
  incidents = [],
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);

  const actions = useMemo<CommandAction[]>(() => {
    const baseNavigation: CommandAction[] = [
      {
        id: 'nav-dashboard',
        title: 'Go to Overview Dashboard',
        category: 'Navigation',
        shortcut: 'G D',
        icon: <LayoutDashboard className="h-4 w-4" />,
        onSelect: () => {
          onNavigate('dashboard');
          onClose();
        },
      },
      {
        id: 'nav-logs',
        title: 'Go to Request Logs Explorer',
        category: 'Navigation',
        shortcut: 'G R',
        icon: <FileText className="h-4 w-4" />,
        onSelect: () => {
          onNavigate('logs');
          onClose();
        },
      },
      {
        id: 'nav-traces',
        title: 'Go to Distributed Traces & Waterfall',
        category: 'Navigation',
        shortcut: 'G T',
        icon: <Layers className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />,
        onSelect: () => {
          onNavigate('traces');
          onClose();
        },
      },
      {
        id: 'nav-analytics',
        title: 'Go to Analytics & Latency Charts',
        category: 'Navigation',
        shortcut: 'G A',
        icon: <LineChart className="h-4 w-4" />,
        onSelect: () => {
          onNavigate('analytics');
          onClose();
        },
      },
      {
        id: 'nav-metrics',
        title: 'Go to Metrics & PromQL Studio',
        category: 'Navigation',
        shortcut: 'G M',
        icon: <SlidersHorizontal className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />,
        onSelect: () => {
          onNavigate('metrics');
          onClose();
        },
      },
      {
        id: 'nav-anomalies',
        title: 'Go to Anomalies & Alert Rules',
        category: 'Navigation',
        shortcut: 'G N',
        icon: <ShieldAlert className="h-4 w-4" />,
        onSelect: () => {
          onNavigate('anomalies');
          onClose();
        },
      },
      {
        id: 'nav-rum',
        title: 'Go to RUM & Session Replay',
        category: 'Navigation',
        shortcut: 'G U',
        icon: <Users className="h-4 w-4" />,
      onSelect: () => {
          onNavigate('rum');
          onClose();
        },
      },
      {
        id: 'nav-synthetic',
        title: 'Go to Global Synthetic Probers',
        category: 'Navigation',
        shortcut: 'G S',
        icon: <Globe className="h-4 w-4 text-sky-500 dark:text-sky-400" />,
        onSelect: () => {
          onNavigate('synthetic');
          onClose();
        },
      },
      {
        id: 'nav-incidents',
        title: 'Go to Incident Command Center',
        category: 'Navigation',
        shortcut: 'G I',
        icon: <Flame className="h-4 w-4 text-rose-500 dark:text-rose-400" />,
        onSelect: () => {
          onNavigate('incidents');
          onClose();
        },
      },
      {
        id: 'nav-governance',
        title: 'Go to Governance & Security Suite',
        category: 'Navigation',
        shortcut: 'G G',
        icon: <ShieldCheck className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />,
        onSelect: () => {
          onNavigate('governance');
          onClose();
        },
      },
      {
        id: 'nav-compliance',
        title: 'Go to Compliance & SIEM Studio',
        category: 'Navigation',
        shortcut: 'G C',
        icon: <ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />,
        onSelect: () => {
          onNavigate('compliance');
          onClose();
        },
      },
      {
        id: 'nav-self-healing',
        title: 'Go to Self-Healing Studio',
        category: 'Navigation',
        shortcut: 'H H',
        icon: <Cpu className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />,
        onSelect: () => {
          onNavigate('self-healing');
          onClose();
        },
      },
      {
        id: 'nav-capstone-ultimate',
        title: 'Go to Ultimate Governance Studio',
        category: 'Navigation',
        shortcut: 'D T',
        icon: <Sparkles className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />,
        onSelect: () => {
          onNavigate('capstone-ultimate');
          onClose();
        },
      },
      {
        id: 'nav-neuromorphic-mesh',
        title: 'Go to Neuromorphic Mesh Studio',
        category: 'Navigation',
        shortcut: 'N M',
        icon: <BrainCircuit className="h-4 w-4 text-violet-500 dark:text-violet-400" />,
        onSelect: () => {
          onNavigate('neuromorphic-mesh');
          onClose();
        },
      },
      {
        id: 'nav-synthetic-dream',
        title: 'Go to Synthetic Dream Studio',
        category: 'Navigation',
        shortcut: 'D S',
        icon: <Dna className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />,
        onSelect: () => {
          onNavigate('synthetic-dream');
          onClose();
        },
      },
      {
        id: 'nav-autonomous-swarm',
        title: 'Go to Autonomous Swarm Command',
        category: 'Navigation',
        shortcut: 'A S',
        icon: <Network className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />,
        onSelect: () => {
          onNavigate('autonomous-swarm');
          onClose();
        },
      },
      {
        id: 'nav-akasha-omega',
        title: 'Go to Akasha-Omega Studio',
        category: 'Navigation',
        shortcut: 'A K',
        icon: <InfinityIcon className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />,
        onSelect: () => {
          onNavigate('akasha-omega');
          onClose();
        },
      },
      {
        id: 'nav-settings',
        title: 'Go to Settings',
        category: 'Navigation',
        shortcut: 'G ,',
        icon: <Settings className="h-4 w-4" />,
        onSelect: () => {
          onNavigate('settings');
          onClose();
        },
      },
    ];

    const quickActions: CommandAction[] = [
      ...(onSendDiagnosticSpan
        ? [
            {
              id: 'act-send-otlp-span',
              title: 'Send 1 Real OTLP Trace Span',
              subtitle: 'POST live W3C trace span to /api/v1/telemetry',
              category: 'Actions' as const,
              icon: <Send className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />,
              onSelect: () => {
                onSendDiagnosticSpan();
                onClose();
              },
            },
          ]
        : []),
      ...(onSyncTelemetry
        ? [
            {
              id: 'act-sync-otlp',
              title: 'Sync OTLP Telemetry Buffer',
              subtitle: 'Fetch latest records from /api/v1/telemetry/recent',
              category: 'Actions' as const,
              icon: <RefreshCw className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />,
              onSelect: () => {
                onSyncTelemetry();
                onClose();
              },
            },
          ]
        : []),
      {
        id: 'act-clear-filters',
        title: 'Clear All Active Filters',
        category: 'Actions',
        icon: <SlidersHorizontal className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />,
        onSelect: () => {
          onClearFilters();
          onClose();
        },
      },
      {
        id: 'act-export',
        title: 'Export Active Logs to JSON',
        category: 'Actions',
        icon: <Download className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />,
        onSelect: () => {
          onExportLogs();
          onClose();
        },
      },
      {
        id: 'act-reset',
        title: 'Reset Metrics & Worker Store',
        category: 'Actions',
        icon: <RotateCcw className="h-4 w-4 text-rose-500 dark:text-rose-400" />,
        onSelect: () => {
          onResetMetrics();
          onClose();
        },
      },
    ];

    const alertActions: CommandAction[] = [
      ...anomalies.slice(0, 6).map((a, idx) => ({
        id: `anom-${a.ruleId}-${idx}`,
        title: a.ruleName,
        subtitle: a.description,
        category: 'Alerts' as const,
        icon: <AlertTriangle className="h-4 w-4 text-rose-500 dark:text-rose-400" />,
        onSelect: () => {
          onNavigate('anomalies');
          onClose();
        },
      })),
      ...incidents
        .filter((i) => i.status !== 'resolved')
        .slice(0, 6)
        .map((inc) => ({
          id: `inc-${inc.id}`,
          title: inc.title,
          subtitle: `${inc.severity} · ${inc.service} (${inc.status})`,
          category: 'Alerts' as const,
          icon: <Flame className="h-4 w-4 text-amber-500 dark:text-amber-400" />,
          onSelect: () => {
            onNavigate('anomalies');
            onClose();
          },
        })),
    ];

    const seenTraces = new Set<string>();
    const traceActions: CommandAction[] = [];
    const seenEndpoints = new Set<string>();
    const endpointActions: CommandAction[] = [];

    for (const log of logs) {
      if (log.traceId && !seenTraces.has(log.traceId) && traceActions.length < 8) {
        seenTraces.add(log.traceId);
        traceActions.push({
          id: `trace-${log.traceId}`,
          title: `Inspect Trace ${log.traceId}`,
          subtitle: `${log.method} ${log.endpoint} (${log.latencyMs}ms · ${log.statusCode})`,
          category: 'Traces',
          icon: <Layers className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />,
          onSelect: () => {
            if (onInspectTrace) {
              onInspectTrace(log.traceId);
            } else {
              onNavigate('traces');
            }
            onClose();
          },
        });
      }

      if (log.endpoint && !seenEndpoints.has(log.endpoint) && endpointActions.length < 8) {
        seenEndpoints.add(log.endpoint);
        endpointActions.push({
          id: `endpoint-${log.endpoint}`,
          title: `Filter Endpoint ${log.endpoint}`,
          subtitle: `${log.method} · ${log.statusCode} (${log.latencyMs}ms)`,
          category: 'Endpoints',
          icon: <FileText className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />,
          onSelect: () => {
            if (onFilterEndpoint) {
              onFilterEndpoint(log.endpoint);
            }
            onNavigate('logs');
            onClose();
          },
        });
      }
    }

    return [
      ...quickActions,
      ...alertActions,
      ...traceActions,
      ...endpointActions,
      ...baseNavigation,
    ];
  }, [
    anomalies,
    incidents,
    logs,
    onClearFilters,
    onClose,
    onExportLogs,
    onFilterEndpoint,
    onInspectTrace,
    onNavigate,
    onResetMetrics,
    onSendDiagnosticSpan,
    onSyncTelemetry,
  ]);

  const filteredActions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (act) =>
        act.title.toLowerCase().includes(q) ||
        act.category.toLowerCase().includes(q) ||
        (act.subtitle && act.subtitle.toLowerCase().includes(q))
    );
  }, [actions, query]);

  useEffect(() => {
    if (isOpen) {
      lastActiveElement.current = document.activeElement as HTMLElement;

      const timer = setTimeout(() => {
        setQuery('');
        setSelectedIndex(0);
        inputRef.current?.focus();
      }, 0);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % (filteredActions.length || 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredActions.length) % (filteredActions.length || 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const target = filteredActions[selectedIndex];
          if (target) {
            target.onSelect();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      lastActiveElement.current?.focus();
    }
  }, [isOpen, filteredActions, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-xl rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)] shadow-[0_24px_60px_rgba(2,6,23,0.45)] overflow-hidden flex flex-col backdrop-blur-xl font-sans"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border-color)] bg-[var(--bg-canvas)]/75">
          <Search className="h-5 w-5 text-indigo-500 dark:text-indigo-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={filteredActions.length > 0}
            aria-controls="command-list"
            aria-autocomplete="list"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search modules, active alerts, live trace IDs, endpoints, or actions..."
            className="w-full bg-transparent text-sm sm:text-base text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none font-sans"
          />
          <button
            onClick={onClose}
            aria-label="Close Command Palette"
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Command List */}
        <div id="command-list" role="listbox" className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredActions.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--text-muted)]">
              No matching commands, traces, or views found for &quot;{query}&quot;.
            </div>
          ) : (
            filteredActions.map((action, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={action.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => action.onSelect()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-600/20 text-indigo-700 dark:text-indigo-200 border border-indigo-500/40'
                      : 'text-[var(--text-main)] hover:bg-[var(--bg-elevated)]/70 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={isSelected ? 'text-indigo-600 dark:text-indigo-400 shrink-0' : 'text-[var(--text-muted)] shrink-0'}>
                      {action.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text-main)] truncate">{action.title}</span>
                        <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-canvas)] border border-[var(--border-color)] shrink-0">
                          {action.category}
                        </span>
                      </div>
                      {action.subtitle && (
                        <div className="text-[11px] font-mono text-[var(--text-muted)] truncate mt-0.5">
                          {action.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {action.shortcut && (
                      <kbd className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[var(--bg-canvas)] text-[var(--text-muted)] border border-[var(--border-color)]">
                        {action.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400 ml-1" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2.5 border-t border-[var(--border-color)] bg-[var(--bg-canvas)]/75 flex items-center justify-between text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-3 font-mono">
            <span>
              <kbd className="bg-[var(--bg-surface)] px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-main)]">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="bg-[var(--bg-surface)] px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-main)]">↵</kbd> select
            </span>
            <span>
              <kbd className="bg-[var(--bg-surface)] px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-main)]">esc</kbd> close
            </span>
          </div>
          <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">Neon Chasm OS</span>
        </div>
      </div>
    </div>
  );
};
