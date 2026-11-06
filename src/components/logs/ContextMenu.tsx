'use client';

import React from 'react';
import {
  Copy,
  Terminal,
  Filter,
  Eye,
  ExternalLink,
  Ban,
  Check,
} from 'lucide-react';
import { ApiRequestLog } from '../../types/telemetry';

export interface ContextMenuPosition {
  x: number;
  y: number;
  log: ApiRequestLog;
}

interface ContextMenuProps {
  position: ContextMenuPosition | null;
  onClose: () => void;
  onInspect: (log: ApiRequestLog) => void;
  onCopyCurl: (log: ApiRequestLog) => void;
  onFilterEndpoint: (endpoint: string) => void;
  onExcludeStatus: (status: number) => void;
  onCopyTraceId: (traceId: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  position,
  onClose,
  onInspect,
  onCopyCurl,
  onFilterEndpoint,
  onExcludeStatus,
  onCopyTraceId,
}) => {
  if (!position) return null;
  const { x, y, log } = position;

  // Prevent overflowing outside viewport
  const adjustedX = Math.min(x, typeof window !== 'undefined' ? window.innerWidth - 220 : x);
  const adjustedY = Math.min(y, typeof window !== 'undefined' ? window.innerHeight - 260 : y);

  return (
    <div
      role="menu"
      aria-label="Log Row Actions Menu"
      style={{ left: `${adjustedX}px`, top: `${adjustedY}px` }}
      className="fixed z-50 w-56 rounded-xl border border-slate-800 bg-[#131B2E] shadow-[0_10px_35px_rgba(0,0,0,0.8)] backdrop-blur-xl p-1.5 text-xs text-slate-200 font-sans animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-2.5 py-1.5 border-b border-slate-800/80 mb-1">
        <div className="font-semibold text-white truncate max-w-[190px]">
          {log.method} {log.endpoint}
        </div>
        <div className="text-[10px] font-mono text-slate-400">
          Status: {log.statusCode} • {log.latencyMs}ms
        </div>
      </div>

      <button
        role="menuitem"
        onClick={() => {
          onInspect(log);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-left"
      >
        <Eye className="h-3.5 w-3.5 text-indigo-400" />
        <span>Inspect Request Payload</span>
      </button>

      <button
        role="menuitem"
        onClick={() => {
          onCopyCurl(log);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-left"
      >
        <Terminal className="h-3.5 w-3.5 text-emerald-400" />
        <span>Copy as cURL</span>
      </button>

      <button
        role="menuitem"
        onClick={() => {
          onCopyTraceId(log.traceId);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-left"
      >
        <Copy className="h-3.5 w-3.5 text-sky-400" />
        <span>Copy Trace ID</span>
      </button>

      <div className="h-px bg-slate-800/80 my-1" />

      <button
        role="menuitem"
        onClick={() => {
          onFilterEndpoint(log.endpoint);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors text-left"
      >
        <Filter className="h-3.5 w-3.5 text-amber-400" />
        <span>Filter by this Endpoint</span>
      </button>

      <button
        role="menuitem"
        onClick={() => {
          onExcludeStatus(log.statusCode);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-rose-400 hover:text-rose-300 transition-colors text-left"
      >
        <Ban className="h-3.5 w-3.5 text-rose-400" />
        <span>Exclude Status {log.statusCode}</span>
      </button>
    </div>
  );
};
