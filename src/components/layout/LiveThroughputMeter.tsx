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
 */
export const LiveThroughputMeter: React.FC<LiveThroughputMeterProps> = memo(
  ({ throughput, isIngesting, totalLogs }) => {
    return (
      <div
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900/90 font-mono text-xs shadow-inner"
        role="status"
        aria-label={`Current Telemetry Throughput: ${throughput} logs per second`}
      >
        <div className="relative flex items-center justify-center">
          <span
            className={`h-2 w-2 rounded-full ${
              isIngesting || throughput > 0 ? 'bg-emerald-500' : 'bg-neutral-600'
            }`}
          />
          {(isIngesting || throughput > 0) && (
            <span className="absolute h-3 w-3 rounded-full bg-emerald-500/50 animate-ping" />
          )}
        </div>

        <div className="flex items-center gap-1.5 text-neutral-300">
          <Activity className="h-3.5 w-3.5 text-emerald-400" />
          <span className="font-semibold text-neutral-100">
            {throughput > 0 ? `${throughput.toLocaleString()}` : isIngesting ? 'Syncing...' : 'Live'}
          </span>
          <span className="text-neutral-500 text-[10px]">logs/sec</span>
        </div>

        <span className="text-neutral-600">|</span>

        <span className="text-neutral-400 text-[11px]" title="Total in-memory indexed records">
          {totalLogs.toLocaleString()} total
        </span>
      </div>
    );
  }
);

LiveThroughputMeter.displayName = 'LiveThroughputMeter';
