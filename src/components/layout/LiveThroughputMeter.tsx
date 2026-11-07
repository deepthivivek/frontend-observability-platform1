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
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-subtleBorder bg-surface/90 font-mono text-xs shadow-inner backdrop-blur-md"
        role="status"
        aria-label={`Current Telemetry Throughput: ${throughput} logs per second`}
      >
        <div className="relative flex items-center justify-center">
          <span
            className={`h-2 w-2 rounded-full ${
              isLive
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                : 'bg-mutedText'
            }`}
          />
          {isLive && (
            <span className="absolute h-3.5 w-3.5 rounded-full bg-emerald-500/40 animate-ping" />
          )}
        </div>

        <div className="flex items-center gap-1.5 text-customText">
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-semibold text-customText tabular-nums">
            {throughput > 0 ? `${throughput.toLocaleString()}` : isIngesting ? 'Syncing...' : 'Live'}
          </span>
          <span className="text-mutedText text-[10px]">logs/sec</span>
        </div>

        <span className="text-mutedText/40">|</span>

        <span className="text-mutedText text-[11px] tabular-nums" title="Total in-memory indexed records">
          {totalLogs.toLocaleString()} <span className="text-mutedText/80">total</span>
        </span>
      </div>
    );
  }
);

LiveThroughputMeter.displayName = 'LiveThroughputMeter';
