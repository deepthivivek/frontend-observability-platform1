'use client';

import React, { useState } from 'react';
import {
  Network,
  Activity,
  ArrowRight,
  Database,
  Server,
  Layers,
  Globe,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  ExternalLink,
} from 'lucide-react';
import { ServiceTopologyMapData, ServiceTopologyNode, ServiceTopologyEdge } from '../../types/trace';

interface ServiceTopologyMapProps {
  topology: ServiceTopologyMapData;
  onRefresh?: () => void;
  onSelectService?: (serviceName: string) => void;
}

export const ServiceTopologyMap: React.FC<ServiceTopologyMapProps> = ({
  topology,
  onRefresh,
  onSelectService,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const getNodeIcon = (type: ServiceTopologyNode['type']) => {
    switch (type) {
      case 'gateway':
        return <Globe className="w-5 h-5 text-cyan-400" />;
      case 'database':
        return <Database className="w-5 h-5 text-amber-400" />;
      case 'cache':
        return <Layers className="w-5 h-5 text-rose-400" />;
      case 'external':
        return <ExternalLink className="w-5 h-5 text-purple-400" />;
      default:
        return <Server className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getStatusBadge = (status: ServiceTopologyNode['status']) => {
    switch (status) {
      case 'critical':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span>CRITICAL</span>
          </span>
        );
      case 'degraded':
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>DEGRADED</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>HEALTHY</span>
          </span>
        );
    }
  };

  const activeEdges = selectedNodeId
    ? topology.edges.filter((e) => e.source === selectedNodeId || e.target === selectedNodeId)
    : topology.edges;

  return (
    <div className="space-y-6 text-slate-100">
      {/* Topology Header Controls */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <span>Dynamic Service Topology Map</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                {topology.nodes.length} Nodes &bull; {topology.edges.length} Dependencies
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live automated dependency graph tracking cross-service calls, latency, and error degradation.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {selectedNodeId && (
            <button
              onClick={() => setSelectedNodeId(null)}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 transition"
            >
              Reset Filter
            </button>
          )}

          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center space-x-1.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-slate-300 px-3.5 py-1.5 rounded-lg text-xs font-mono transition"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Refresh Map</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Microservice Node Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {topology.nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const statusBorder =
            node.status === 'critical'
              ? 'border-red-500/60 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
              : node.status === 'degraded'
              ? 'border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
              : 'border-slate-800 hover:border-slate-700';

          return (
            <div
              key={node.id}
              onClick={() => {
                setSelectedNodeId(isSelected ? null : node.id);
                if (onSelectService) onSelectService(node.id);
              }}
              className={`bg-[#0F172A] border ${statusBorder} rounded-xl p-4 transition-all cursor-pointer select-none relative group ${
                isSelected ? 'ring-2 ring-cyan-500/60 bg-slate-900/90' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-[#0B0F17] border border-slate-800">
                    {getNodeIcon(node.type)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs text-white group-hover:text-cyan-300 transition">
                      {node.name}
                    </h4>
                    <span className="text-[10px] font-mono text-slate-500 uppercase">{node.type}</span>
                  </div>
                </div>

                {getStatusBadge(node.status)}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block">Throughput</span>
                  <span className="font-bold text-slate-200">{node.requestCount} calls</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Avg Latency</span>
                  <span
                    className={`font-bold ${
                      node.avgLatencyMs > 250 ? 'text-amber-400' : 'text-cyan-300'
                    }`}
                  >
                    {node.avgLatencyMs}ms
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Error Rate</span>
                  <span
                    className={`font-bold ${
                      node.errorRate > 3 ? 'text-red-400' : 'text-emerald-400'
                    }`}
                  >
                    {node.errorRate}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cross-Service Dependency Edge Matrix */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <h4 className="font-semibold text-xs text-slate-300 uppercase tracking-wider flex items-center space-x-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>Cross-Service Edge Call Volumes &amp; Degradation Status</span>
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0B0F17] text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Source Service</th>
                <th className="py-2.5 px-4">Direction</th>
                <th className="py-2.5 px-4">Target Service</th>
                <th className="py-2.5 px-4">Call Volume</th>
                <th className="py-2.5 px-4">Avg Latency</th>
                <th className="py-2.5 px-4">Error Rate</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {activeEdges.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    No active edges for the selected service.
                  </td>
                </tr>
              ) : (
                activeEdges.map((edge) => (
                  <tr
                    key={edge.id}
                    className={`hover:bg-slate-800/40 transition ${
                      edge.isDegraded ? 'bg-red-950/20' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 font-bold text-white">{edge.source}</td>
                    <td className="py-2.5 px-4">
                      <ArrowRight
                        className={`w-4 h-4 ${
                          edge.isDegraded ? 'text-red-400 animate-pulse' : 'text-cyan-400'
                        }`}
                      />
                    </td>
                    <td className="py-2.5 px-4 font-bold text-white">{edge.target}</td>
                    <td className="py-2.5 px-4">{edge.callCount} calls</td>
                    <td className="py-2.5 px-4 font-bold text-cyan-300">{edge.avgLatencyMs}ms</td>
                    <td className="py-2.5 px-4">
                      <span className={edge.errorRate > 3 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                        {edge.errorRate}%
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      {edge.isDegraded ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                          DEGRADED EDGE
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          NORMAL
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
