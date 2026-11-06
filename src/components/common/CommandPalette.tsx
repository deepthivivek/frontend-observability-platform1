'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  SlidersHorizontal,
  Download,
  Activity,
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
} from 'lucide-react';
import { DashboardView } from '../../types/telemetry';

export interface CommandAction {
  id: string;
  title: string;
  category: 'Navigation' | 'Actions' | 'Filters';
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
  onToggleLiveMode: () => void;
  onResetMetrics: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onClearFilters,
  onExportLogs,
  onToggleLiveMode,
  onResetMetrics,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const lastActiveElement = useRef<HTMLElement | null>(null);

  const actions: CommandAction[] = [
    // Navigation
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
      title: 'Go to Request Log Explorer',
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
      title: 'Go to Distributed Traces & Flamegraph Waterfall',
      category: 'Navigation',
      shortcut: 'G T',
      icon: <FileText className="h-4 w-4 text-indigo-400" />,
      onSelect: () => {
        onNavigate('traces');
        onClose();
      },
    },
    {
      id: 'nav-analytics',
      title: 'Go to Analytics & Time Series Charts',
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
      icon: <SlidersHorizontal className="h-4 w-4 text-cyan-400" />,
      onSelect: () => {
        onNavigate('metrics');
        onClose();
      },
    },
    {
      id: 'nav-anomalies',
      title: 'Go to Anomaly Detection Rules',
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
      title: 'Go to RUM, Session Replay & Web Vitals',
      category: 'Navigation',
      shortcut: 'G U',
      icon: <Users className="h-4 w-4" />,
      onSelect: () => {
        onNavigate('rum');
        onClose();
      },
    },
    {
      id: 'nav-incidents',
      title: 'Go to Incident Command Center & AI Triage',
      category: 'Navigation',
      shortcut: 'G I',
      icon: <Flame className="h-4 w-4 text-rose-400" />,
      onSelect: () => {
        onNavigate('incidents');
        onClose();
      },
    },
    {
      id: 'nav-governance',
      title: 'Go to FinOps, Cardinality, ZKP & Chaos Governance',
      category: 'Navigation',
      shortcut: 'G G',
      icon: <ShieldCheck className="h-4 w-4 text-cyan-400" />,
      onSelect: () => {
        onNavigate('governance');
        onClose();
      },
    },
    {
      id: 'nav-compliance',
      title: 'Go to SOC2 & GDPR Compliance Studio',
      category: 'Navigation',
      shortcut: 'G C',
      icon: <ShieldCheck className="h-4 w-4 text-emerald-400" />,
      onSelect: () => {
        onNavigate('compliance');
        onClose();
      },
    },
    {
      id: 'nav-synthetic',
      title: 'Go to Global Synthetic & Edge Latency Map',
      category: 'Navigation',
      shortcut: 'G S',
      icon: <Globe className="h-4 w-4 text-sky-400" />,
      onSelect: () => {
        onNavigate('synthetic');
        onClose();
      },
    },
    {
      id: 'nav-settings',
      title: 'Go to Observability Settings',
      category: 'Navigation',
      shortcut: 'G ,',
      icon: <Settings className="h-4 w-4" />,
      onSelect: () => {
        onNavigate('settings');
        onClose();
      },
    },

    // Actions
    {
      id: 'act-clear-filters',
      title: 'Clear All Active Filters',
      category: 'Actions',
      icon: <SlidersHorizontal className="h-4 w-4 text-indigo-400" />,
      onSelect: () => {
        onClearFilters();
        onClose();
      },
    },
    {
      id: 'act-export',
      title: 'Export Active Logs to JSON',
      category: 'Actions',
      icon: <Download className="h-4 w-4 text-emerald-400" />,
      onSelect: () => {
        onExportLogs();
        onClose();
      },
    },
    {
      id: 'act-toggle-live',
      title: 'Toggle Live Ingestion Stream',
      category: 'Actions',
      icon: <Activity className="h-4 w-4 text-amber-400" />,
      onSelect: () => {
        onToggleLiveMode();
        onClose();
      },
    },
    {
      id: 'act-reset',
      title: 'Reset Metrics & In-Memory Store',
      category: 'Actions',
      icon: <RotateCcw className="h-4 w-4 text-rose-400" />,
      onSelect: () => {
        onResetMetrics();
        onClose();
      },
    },
  ];

  const filteredActions = actions.filter((act) =>
    act.title.toLowerCase().includes(query.toLowerCase()) ||
    act.category.toLowerCase().includes(query.toLowerCase())
  );

  // Focus trapping and keyboard lifecycle
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
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 bg-[#080C14]/80 backdrop-blur-md p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-xl rounded-2xl border border-slate-800 bg-[#131B2E] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col text-slate-200 backdrop-blur-xl"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800 bg-[#0B0F17]/90">
          <Search className="h-5 w-5 text-indigo-400 shrink-0" />
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
            placeholder="Type a command, view, or action..."
            className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-slate-500 focus:outline-none font-sans"
          />
          <button
            onClick={onClose}
            aria-label="Close Command Palette"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Command List */}
        <div id="command-list" role="listbox" className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredActions.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No matching commands or actions found for &quot;{query}&quot;.
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
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-600/25 text-indigo-200 border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                      : 'text-slate-300 hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={isSelected ? 'text-indigo-400' : 'text-slate-400'}>
                      {action.icon}
                    </span>
                    <span className="font-medium text-white">{action.title}</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800">
                      {action.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {action.shortcut && (
                      <kbd className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800">
                        {action.shortcut}
                      </kbd>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="h-3.5 w-3.5 text-indigo-400 ml-1" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-4 py-2.5 border-t border-slate-800 bg-[#0B0F17]/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3 font-mono">
            <span>
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400">↵</kbd> select
            </span>
            <span>
              <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-slate-400">esc</kbd> close
            </span>
          </div>
          <span className="font-mono text-[11px] text-indigo-400">Neon Chasm OS</span>
        </div>
      </div>
    </div>
  );
};
