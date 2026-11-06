'use client';

import React, { memo } from 'react';
import { Activity } from 'lucide-react';

interface LiveThroughputMeterProps {
  throughput: number;
  isIngesting: boolean;
  totalLogs: number;
}

/**
 * Micro-rendered component isolated to prevent re-rendering the outer layout tree.
 * Styled with Neon Emerald/Teal glow for active throughput monitoring.
 */
export const LiveThroughputMeter: React.FC<LiveThroughputMeterProps> = memo(
  ({ throughput, isIngesting, totalLogs }) => {
    const isLive = isIngesting || throughput > 0;

    return (
      <div
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-800/80 bg-[#131B2E]/90 font-mono text-xs shadow-inner backdrop-blur-md"
        role="status"
        aria-label={`Current Telemetry Throughput: ${throughput} logs per second`}
      >
        <div className="relative flex items-center justify-center">
          <span
            className={`h-2 w-2 rounded-full ${
              isLive
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                : 'bg-slate-600'
            }`}
          />
          {isLive && (
            <span className="absolute h-3.5 w-3.5 rounded-full bg-emerald-500/40 animate-ping" />
          )}
        </div>

        <div className="flex items-center gap-1.5 text-slate-300">
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-semibold text-white">
            {throughput > 0 ? `${throughput.toLocaleString()}` : isIngesting ? 'Syncing...' : 'Live'}
          </span>
          <span className="text-slate-500 text-[10px]">logs/sec</span>
        </div>

        <span className="text-slate-700">|</span>

        <span className="text-slate-400 text-[11px]" title="Total in-memory indexed records">
          {totalLogs.toLocaleString()} <span className="text-slate-500">total</span>
        </span>
      </div>
    );
  }
);

LiveThroughputMeter.displayName = 'LiveThroughputMeter';
