'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Code2,
  Bookmark,
  Share2,
  Check,
  Sparkles,
  SlidersHorizontal,
  FolderPlus,
  Trash2,
  HelpCircle,
  Copy,
  Terminal,
} from 'lucide-react';
import { QuerySnippet, SavedQueryView } from '../../types/logStream';

export const CURATED_QUERY_SNIPPETS: QuerySnippet[] = [
  {
    id: 'snip-5xx',
    name: '5xx Server Faults',
    query: 'status >= 500',
    category: 'Errors',
    description: 'Catches critical 500, 502, 503, and 504 server-side infrastructure crashes.',
  },
  {
    id: 'snip-slow-db',
    name: 'Slow Database Queries',
    query: "duration > 500 AND span.type == 'db'",
    category: 'Performance',
    description: 'Pinpoints long-running queries locking connection pools above 500ms.',
  },
  {
    id: 'snip-auth-fail',
    name: 'Auth & Permission Failures',
    query: 'status IN (401, 403)',
    category: 'Security',
    description: 'Identifies unauthorized credential attempts or expired token surges.',
  },
  {
    id: 'snip-rate-limit',
    name: 'Rate Limit Breaches',
    query: 'status == 429',
    category: 'Capacity',
    description: 'Tracks clients exceeding upstream bucket quotas or DDoS spikes.',
  },
  {
    id: 'snip-payload-size',
    name: 'Payload Size Outliers',
    query: 'request_size > 102400',
    category: 'Capacity',
    description: 'Flags jumbo multipart payloads or uncompressed request bodies (>100KB).',
  },
  {
    id: 'snip-latency-spike',
    name: 'Critical Latency Spike',
    query: 'duration > 1000',
    category: 'Performance',
    description: 'Surfaces requests taking over 1 second to return to the client.',
  },
  {
    id: 'snip-payment-fail',
    name: 'Checkout & Payment Failures',
    query: "endpoint CONTAINS '/checkout' AND status >= 400",
    category: 'Errors',
    description: 'Monitors revenue-critical checkout routes experiencing client or server errors.',
  },
];

const AUTOCOMPLETE_SUGGESTIONS = [
  { key: 'status >= 500', label: 'status >= 500', desc: '5xx Server Errors' },
  { key: 'status == 429', label: 'status == 429', desc: 'Rate Limiting' },
  { key: 'status IN (401, 403)', label: 'status IN (401, 403)', desc: 'Auth Failures' },
  { key: 'duration > 500', label: 'duration > 500', desc: 'Latency > 500ms' },
  { key: 'duration > 1000', label: 'duration > 1000', desc: 'Critical Latency > 1s' },
  { key: "method == 'POST'", label: "method == 'POST'", desc: 'HTTP POST requests' },
  { key: "method == 'GET'", label: "method == 'GET'", desc: 'HTTP GET requests' },
  { key: "span.type == 'db'", label: "span.type == 'db'", desc: 'Database span traces' },
  { key: "endpoint CONTAINS '/api/'", label: "endpoint CONTAINS '/api/'", desc: 'API Sub-paths' },
];

interface RegexLibraryProps {
  query: string;
  onQueryChange: (q: string) => void;
  onApplyQuery: (q: string) => void;
}

export const RegexLibrary: React.FC<RegexLibraryProps> = ({
  query,
  onQueryChange,
  onApplyQuery,
}) => {
  const [isSnippetsOpen, setIsSnippetsOpen] = useState(false);
  const [isSavedViewsOpen, setIsSavedViewsOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [savedViews, setSavedViews] = useState<SavedQueryView[]>(() => {
    if (typeof window === 'undefined') {
      return [
        {
          id: 'v-1',
          name: 'P1 Production Outages',
          query: 'status >= 500',
          createdAt: 1700000000000,
        },
        {
          id: 'v-2',
          name: 'Database Latency Bottlenecks',
          query: "duration > 500 AND span.type == 'db'",
          createdAt: 1700000000000,
        },
      ];
    }
    try {
      const stored = localStorage.getItem('obs_saved_query_views');
      if (stored) return JSON.parse(stored);
    } catch {
      // Fallback
    }
    return [
      {
        id: 'v-1',
        name: 'P1 Production Outages',
        query: 'status >= 500',
        createdAt: 1700000000000,
      },
      {
        id: 'v-2',
        name: 'Database Latency Bottlenecks',
        query: "duration > 500 AND span.type == 'db'",
        createdAt: 1700000000000,
      },
    ];
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSaveCurrentView = () => {
    if (!newViewName.trim() || !query.trim()) return;
    const newView: SavedQueryView = {
      id: `view-${Date.now()}`,
      name: newViewName.trim(),
      query: query.trim(),
      createdAt: Date.now(),
    };
    const updated = [newView, ...savedViews];
    setSavedViews(updated);
    try {
      localStorage.setItem('obs_saved_query_views', JSON.stringify(updated));
    } catch {
      // Safe
    }
    setNewViewName('');
  };

  const handleDeleteView = (id: string) => {
    const updated = savedViews.filter((v) => v.id !== id);
    setSavedViews(updated);
    try {
      localStorage.setItem('obs_saved_query_views', JSON.stringify(updated));
    } catch {
      // Safe
    }
  };

  const handleCopyShareUrl = () => {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('q', query);
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url.toString());
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // Filtered auto-complete suggestions based on current query
  const suggestions = AUTOCOMPLETE_SUGGESTIONS.filter((s) =>
    s.key.toLowerCase().includes(query.toLowerCase()) && s.key !== query
  );

  return (
    <div className="space-y-2 font-mono text-xs">
      {/* Smart Query Input Bar */}
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-indigo-400">
            <Terminal className="h-4 w-4" />
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => {
              onQueryChange(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onApplyQuery(query);
                setShowSuggestions(false);
              }
            }}
            placeholder="Search syntax e.g. status >= 500, duration > 500, status IN (401, 403)..."
            className="w-full pl-10 pr-24 py-2.5 rounded-xl border border-slate-800 bg-[#0B0F17]/90 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 shadow-inner text-xs transition-all"
          />

          {/* Inline Action Badges */}
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center gap-1.5">
            {query && (
              <button
                type="button"
                onClick={() => {
                  onQueryChange('');
                  onApplyQuery('');
                }}
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                Clear
              </button>
            )}
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400">
              Enter ↵
            </kbd>
          </div>

          {/* Auto-Complete Suggestion Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-40 rounded-xl border border-slate-800 bg-[#131B2E] shadow-2xl overflow-hidden backdrop-blur-xl">
              <div className="px-3 py-1.5 text-[10px] text-slate-400 bg-slate-900/80 border-b border-slate-800">
                Syntax Auto-Complete Suggestions
              </div>
              <div className="divide-y divide-slate-800/60 max-h-48 overflow-y-auto">
                {suggestions.map((s) => (
                  <div
                    key={s.key}
                    onMouseDown={() => {
                      onQueryChange(s.key);
                      onApplyQuery(s.key);
                      setShowSuggestions(false);
                    }}
                    className="flex items-center justify-between px-3.5 py-2 hover:bg-indigo-600/20 cursor-pointer transition-colors"
                  >
                    <span className="text-indigo-300 font-bold">{s.label}</span>
                    <span className="text-slate-400 text-[11px]">{s.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Curated SRE Snippets Dropdown Trigger */}
        <button
          type="button"
          onClick={() => {
            setIsSnippetsOpen(!isSnippetsOpen);
            setIsSavedViewsOpen(false);
          }}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all ${
            isSnippetsOpen
              ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
              : 'bg-[#131B2E] text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
          title="Open Curated SRE Regex Query Snippets"
        >
          <Code2 className="h-4 w-4 text-indigo-400" />
          <span className="hidden sm:inline">Snippets</span>
        </button>

        {/* Saved Views Dropdown Trigger */}
        <button
          type="button"
          onClick={() => {
            setIsSavedViewsOpen(!isSavedViewsOpen);
            setIsSnippetsOpen(false);
          }}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border transition-all ${
            isSavedViewsOpen
              ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
              : 'bg-[#131B2E] text-slate-300 border-slate-800 hover:border-slate-700'
          }`}
          title="Saved Custom Query Views"
        >
          <Bookmark className="h-4 w-4 text-emerald-400" />
          <span className="hidden sm:inline">Views ({savedViews.length})</span>
        </button>

        {/* Share Deep-Link Button */}
        <button
          type="button"
          onClick={handleCopyShareUrl}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#131B2E] border border-slate-800 text-slate-300 hover:border-slate-700 transition-colors"
          title="Copy shareable query URL to clipboard"
        >
          {copiedLink ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Share2 className="h-4 w-4 text-slate-400" />
          )}
        </button>
      </div>

      {/* Snippet Drawer Panel */}
      {isSnippetsOpen && (
        <div className="p-4 rounded-2xl border border-indigo-500/30 bg-[#131B2E]/95 backdrop-blur-xl shadow-2xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-white text-xs flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              Curated SRE Query Snippets &amp; Diagnostics
            </span>
            <span className="text-[11px] text-slate-400">Click any pattern to apply</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {CURATED_QUERY_SNIPPETS.map((snip) => (
              <button
                key={snip.id}
                type="button"
                onClick={() => {
                  onQueryChange(snip.query);
                  onApplyQuery(snip.query);
                  setIsSnippetsOpen(false);
                }}
                className="p-2.5 rounded-xl border border-slate-800/80 bg-[#0B0F17]/80 hover:border-indigo-500/50 hover:bg-indigo-950/20 text-left transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-white text-[11px] group-hover:text-indigo-300 transition-colors">
                    {snip.name}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                    {snip.category}
                  </span>
                </div>
                <code className="text-[10px] text-emerald-400 font-mono block truncate">
                  {snip.query}
                </code>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 font-sans">
                  {snip.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Saved Views Panel */}
      {isSavedViewsOpen && (
        <div className="p-4 rounded-2xl border border-emerald-500/30 bg-[#131B2E]/95 backdrop-blur-xl shadow-2xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-bold text-white text-xs flex items-center gap-2">
              <Bookmark className="h-3.5 w-3.5 text-emerald-400" />
              Saved Query Views ({savedViews.length})
            </span>
            <span className="text-[11px] text-slate-400">Persisted in local browser storage</span>
          </div>

          {/* Save Current Query Form */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Name this view (e.g. Core API 5xx Watch)..."
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-xl border border-slate-800 bg-[#0B0F17] text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={handleSaveCurrentView}
              disabled={!newViewName.trim() || !query.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs disabled:opacity-50 transition-colors"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              <span>Save View</span>
            </button>
          </div>

          {/* List of Saved Views */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {savedViews.map((view) => (
              <div
                key={view.id}
                className="flex items-center justify-between p-2 rounded-xl border border-slate-800 bg-[#0B0F17]/80 hover:border-slate-700 transition-colors"
              >
                <div
                  onClick={() => {
                    onQueryChange(view.query);
                    onApplyQuery(view.query);
                    setIsSavedViewsOpen(false);
                  }}
                  className="flex-1 cursor-pointer"
                >
                  <span className="font-bold text-white text-xs">{view.name}</span>
                  <code className="text-[11px] text-emerald-400 block truncate">
                    {view.query}
                  </code>
                </div>

                <button
                  type="button"
                  onClick={() => handleDeleteView(view.id)}
                  className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors ml-2"
                  title="Delete saved view"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
