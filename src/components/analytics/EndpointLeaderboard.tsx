'use client';

import React, { useState, useMemo } from 'react';
import { ApiRequestLog } from '../../types/telemetry';
import { Trophy, ArrowUpDown, ArrowUp, ArrowDown, Filter, Zap } from 'lucide-react';

interface EndpointLeaderboardProps {
  logs: ApiRequestLog[];
  onFilterEndpoint: (endpoint: string) => void;
}

type SortCol = 'volume' | 'avgLatency' | 'p99Latency' | 'errorRate' | 'impact';

export const EndpointLeaderboard: React.FC<EndpointLeaderboardProps> = ({
  logs,
  onFilterEndpoint,
}) => {
  const [sortCol, setSortCol] = useState<SortCol>('impact');
  const [sortAsc, setSortAsc] = useState(false);

  // Group and rank endpoints by telemetry metrics
  const endpointStats = useMemo(() => {
    const map = new Map<
      string,
      { count: number; errorCount: number; latencies: number[] }
    >();

    logs.forEach((l) => {
      let item = map.get(l.endpoint);
      if (!item) {
        item = { count: 0, errorCount: 0, latencies: [] };
        map.set(l.endpoint, item);
      }
      item.count++;
      if (l.statusCode >= 400) item.errorCount++;
      item.latencies.push(l.latencyMs);
    });

    return Array.from(map.entries()).map(([endpoint, data]) => {
      data.latencies.sort((a, b) => a - b);
      const sum = data.latencies.reduce((a, b) => a + b, 0);
      const avgLatency = Math.round(sum / (data.count || 1));
      const p99Idx = Math.floor(data.latencies.length * 0.99);
      const p99Latency = data.latencies[p99Idx] || avgLatency;
      const errorRate = Number(((data.errorCount / (data.count || 1)) * 100).toFixed(1));

      // Impact score: volume * (avgLatency / 100) * (1 + errorRate / 10)
      const impact = Math.round(data.count * (avgLatency / 100) * (1 + errorRate / 10));

      return {
        endpoint,
        volume: data.count,
        avgLatency,
        p99Latency,
        errorRate,
        impact,
      };
    });
  }, [logs]);

  const sortedStats = useMemo(() => {
    return [...endpointStats].sort((a, b) => {
      const modifier = sortAsc ? 1 : -1;
      return (a[sortCol] - b[sortCol]) * modifier;
    });
  }, [endpointStats, sortCol, sortAsc]);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  const getSortIcon = (col: SortCol) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 text-slate-500 opacity-50" />;
    return sortAsc ? <ArrowUp className="h-3 w-3 text-indigo-400" /> : <ArrowDown className="h-3 w-3 text-indigo-400" />;
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E]/80 p-5 backdrop-blur-xl shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Endpoint Performance Leaderboard</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Ranked by System Impact Score</span>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#0B0F17]/90 text-[10px] uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Endpoint</th>
                <th onClick={() => toggleSort('volume')} className="py-2.5 px-3 cursor-pointer select-none">
                  <div className="flex items-center gap-1">Volume {getSortIcon('volume')}</div>
                </th>
                <th onClick={() => toggleSort('avgLatency')} className="py-2.5 px-3 cursor-pointer select-none">
                  <div className="flex items-center gap-1">Avg Latency {getSortIcon('avgLatency')}</div>
                </th>
                <th onClick={() => toggleSort('p99Latency')} className="py-2.5 px-3 cursor-pointer select-none">
                  <div className="flex items-center gap-1">P99 Latency {getSortIcon('p99Latency')}</div>
                </th>
                <th onClick={() => toggleSort('errorRate')} className="py-2.5 px-3 cursor-pointer select-none">
                  <div className="flex items-center gap-1">Error Rate {getSortIcon('errorRate')}</div>
                </th>
                <th onClick={() => toggleSort('impact')} className="py-2.5 px-3 cursor-pointer select-none text-right">
                  <div className="flex items-center justify-end gap-1">Impact Score {getSortIcon('impact')}</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {sortedStats.slice(0, 8).map((row) => {
                const isHighImpact = row.impact > 500;
                const hasErrors = row.errorRate > 3;

                return (
                  <tr key={row.endpoint} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-white max-w-xs truncate">
                      <button
                        onClick={() => onFilterEndpoint(row.endpoint)}
                        title={`Filter log stream by ${row.endpoint}`}
                        className="hover:text-indigo-400 transition-colors text-left truncate flex items-center gap-1.5"
                      >
                        <Filter className="h-3 w-3 text-slate-500 hover:text-indigo-400" />
                        <span className="truncate">{row.endpoint}</span>
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">{row.volume.toLocaleString()}</td>
                    <td className="py-2.5 px-3">{row.avgLatency}ms</td>
                    <td className="py-2.5 px-3 text-amber-300 font-medium">{row.p99Latency}ms</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                          hasErrors
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {row.errorRate}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${
                          isHighImpact
                            ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                            : 'bg-slate-900 text-slate-400'
                        }`}
                      >
                        {row.impact.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono text-slate-400">
        <span>Click any endpoint to isolate in telemetry log stream</span>
        <span className="text-indigo-400 font-medium">Auto-updated from worker index</span>
      </div>
    </div>
  );
};
