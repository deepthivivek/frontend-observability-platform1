'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Filter,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  Activity,
  GitCommit,
  Layers,
  Database,
  RotateCw,
  Play,
  Pause,
  Sliders,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  X,
} from 'lucide-react';
import {
  LogQueryResult,
  LogRegionCluster,
  ScrubbedLogEntry,
  CausalAnalysisResult,
  ZKLogProof,
} from '../../types/logEngine';

interface AdvancedLogViewProps {
  canViewLogs?: boolean;
  canManageLogs?: boolean;
  onInspectTrace?: (traceId: string) => void;
}

export const AdvancedLogView: React.FC<AdvancedLogViewProps> = ({
  canViewLogs = true,
  canManageLogs = true,
  onInspectTrace,
}) => {
  const [queryInput, setQueryInput] = useState<string>('{app="checkout", level="error"} |= "timeout"');
  const [queryResult, setQueryResult] = useState<LogQueryResult | null>(null);
  const [clusters, setClusters] = useState<LogRegionCluster[]>([]);
  const [zkProof, setZkProof] = useState<ZKLogProof | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveTailing, setIsLiveTailing] = useState(false);
  const [selectedLog, setSelectedLog] = useState<ScrubbedLogEntry | null>(null);
  const [activeTab, setActiveTab] = useState<'grid' | 'causal' | 'clusters' | 'zkp'>('grid');

  const executeLogQuery = useCallback(async (qStr: string) => {
    setIsLoading(true);
    try {
      const [queryRes, clusterRes, zkRes] = await Promise.all([
        fetch('/api/v1/logs/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: qStr }),
        }),
        fetch('/api/v1/logs/regions'),
        fetch('/api/v1/logs/zk-proofs?region=us-east'),
      ]);

      if (queryRes.ok) {
        const d = await queryRes.json();
        setQueryResult(d);
      }
      if (clusterRes.ok) {
        const d = await clusterRes.json();
        setClusters(d.clusters || []);
      }
      if (zkRes.ok) {
        const d = await zkRes.json();
        setZkProof(d);
      }
    } catch (err) {
      console.error('Failed to execute LogQL query:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (mounted) {
        await executeLogQuery(queryInput);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [executeLogQuery]);

  // Live Tailing periodic simulator
  useEffect(() => {
    if (!isLiveTailing) return;
    const interval = setInterval(() => {
      executeLogQuery(queryInput);
    }, 4000);
    return () => clearInterval(interval);
  }, [isLiveTailing, queryInput, executeLogQuery]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLogQuery(queryInput);
  };

  const presets = [
    { label: 'Checkout Error Logs', query: '{app="checkout", level="error"}' },
    { label: 'DB Pool Timeout Filter', query: '{app="checkout"} |= "timeout"' },
    { label: 'Semantic Vector Search', query: '{app="checkout"} ~* "connection pool failure"' },
    { label: 'Rate Aggregation', query: 'rate({app="checkout"}[5m])' },
  ];

  if (!canViewLogs) {
    return (
      <div className="bg-[#121318] border border-rose-500/40 rounded-2xl p-8 text-center space-y-4 shadow-[0_0_25px_rgba(244,63,94,0.18)] font-sans">
        <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto" />
        <h3 className="text-base font-bold text-white tracking-tight">Advanced Log Explorer Access Restricted</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Your current RBAC role does not have <code className="text-cyan-300 font-mono">canViewLogs</code> permission. Request JIT Break-Glass escalation to view multi-region log streams.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Header Banner */}
      <div className="bg-[#121318] border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4 transition-all hover:border-white/20">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-lg font-bold text-white tracking-tight">Multi-Region LogQL &amp; Causal AI Explorer</h2>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold tracking-wide">
                PII SCRUBBED &amp; VECTOR INDEXED
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-region log routing, LogQL AST parsing, semantic vector similarity search (~*), causal Bayesian root-cause analysis &amp; zk-SNARK integrity proofs.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 font-mono text-xs">
          <button
            onClick={() => setIsLiveTailing(!isLiveTailing)}
            className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-mono transition border ${
              isLiveTailing
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}
          >
            {isLiveTailing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isLiveTailing ? 'Pause Live Tail' : 'Start Live Tail'}</span>
          </button>

          <button
            onClick={() => executeLogQuery(queryInput)}
            disabled={isLoading}
            className="flex items-center space-x-1.5 bg-[#09090b] hover:bg-slate-800/80 border border-white/10 hover:border-white/20 text-slate-300 px-3.5 py-2 rounded-xl transition disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Execute Query</span>
          </button>
        </div>
      </div>

      {/* 2. LogQL Query Input Bar with Syntax Hints & Presets */}
      <div className="bg-[#121318] border border-white/10 rounded-2xl p-4 shadow-xl space-y-3 font-mono text-xs">
        <form onSubmit={handleFormSubmit} className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder='LogQL query: {app="checkout"} |= "timeout" or {app="api"} ~* "connection error"'
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-[#09090b] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all font-mono text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-sans font-semibold text-xs transition shadow-lg shadow-indigo-600/20 shrink-0"
          >
            Run LogQL
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
          <span className="text-slate-500 font-sans">Quick Presets:</span>
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                setQueryInput(p.query);
                executeLogQuery(p.query);
              }}
              className="px-2.5 py-1 rounded-lg bg-[#09090b] hover:bg-slate-800 text-slate-300 border border-white/10 transition hover:border-white/20 font-mono"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Navigation Sub-Tabs */}
      <div className="flex items-center space-x-2 border-b border-white/10 pb-3 font-mono text-xs">
        <button
          onClick={() => setActiveTab('grid')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'grid'
              ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 font-semibold shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span>Log Data Grid ({queryResult?.totalMatched || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('causal')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'causal'
              ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 font-semibold shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <GitCommit className="w-3.5 h-3.5 text-rose-400" />
          <span>Causal Bayesian Root-Cause AI</span>
        </button>

        <button
          onClick={() => setActiveTab('clusters')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'clusters'
              ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 font-semibold shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>Multi-Region Partition Clusters</span>
        </button>

        <button
          onClick={() => setActiveTab('zkp')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'zkp'
              ? 'bg-indigo-600/25 text-indigo-300 border border-indigo-500/40 font-semibold shadow-[0_0_15px_rgba(99,102,241,0.2)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Lock className="w-3.5 h-3.5 text-indigo-400" />
          <span>zk-SNARK Retrievability Proofs</span>
        </button>
      </div>

      {/* 4. Tab Panels with Motion Transitions */}
      <AnimatePresence mode="wait">
        {/* TAB 1: Log Data Grid */}
        {activeTab === 'grid' && queryResult && (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="bg-[#121318] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3 font-mono text-xs">
              <div className="flex items-center space-x-3">
                <span className="text-white font-bold">Query Execution: {queryResult.queryExecutionMs}ms</span>
                {queryResult.ast.isSemanticVectorSearch && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                    VECTOR COSINE SIMILARITY MATCH
                  </span>
                )}
              </div>
              <span className="text-slate-400">
                Matched {queryResult.logs.length} of {queryResult.totalMatched} records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#09090b] text-slate-400 uppercase tracking-wider text-[10px] border-b border-white/10">
                  <tr>
                    <th className="py-3 px-4">Severity</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Region</th>
                    <th className="py-3 px-4">Labels</th>
                    <th className="py-3 px-4">Scrubbed Log Line</th>
                    <th className="py-3 px-4">PII Tokens</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {queryResult.logs.map((log) => {
                    const sevBadge =
                      log.severity === 'FATAL' || log.severity === 'ERROR'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : log.severity === 'WARN'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

                    return (
                      <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sevBadge}`}>
                            {log.severity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4 text-cyan-300 uppercase font-bold">{log.region}</td>
                        <td className="py-3 px-4 text-slate-400 max-w-[140px] truncate">
                          {JSON.stringify(log.streamLabels)}
                        </td>
                        <td className="py-3 px-4 text-slate-100 font-mono text-[11px] max-w-md truncate">
                          {log.scrubbedLogLine}
                        </td>
                        <td className="py-3 px-4">
                          {log.piiTokensMasked.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {log.piiTokensMasked.map((t) => (
                                <span key={t} className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[9px]">
                                  {t}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-600">Clean</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setSelectedLog(log)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-[11px] font-bold transition"
                            >
                              Inspect JSON
                            </button>
                            {log.traceId && onInspectTrace && (
                              <button
                                onClick={() => onInspectTrace(log.traceId)}
                                className="px-2 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition flex items-center gap-1"
                              >
                                Trace <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* TAB 2: Causal Bayesian Root-Cause Analysis */}
        {activeTab === 'causal' && queryResult?.causalAnalysis && (
          <motion.div
            key="causal"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="bg-[#121318] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-bold text-white text-sm font-sans">Causal Bayesian Root-Cause Analysis</h3>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">
                  Probabilistic dependency graph linking log anomaly bursts to distributed trace spans.
                </p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                ROOT CAUSE PROBABILITY: {queryResult.causalAnalysis.rootCauseProbability}%
              </span>
            </div>

            <div className="bg-[#09090b] border border-rose-500/40 p-4 rounded-xl space-y-2">
              <div className="flex justify-between text-rose-300 font-bold text-xs font-sans">
                <span>Primary Root Cause Origin: {queryResult.causalAnalysis.primaryRootCauseService}</span>
                <span>Confidence: {queryResult.causalAnalysis.confidenceScore}%</span>
              </div>
              <p className="text-xs text-slate-300 font-sans">{queryResult.causalAnalysis.recommendedRemediation}</p>
            </div>

            <div className="space-y-3">
              <span className="text-slate-400 font-bold block text-[11px] uppercase tracking-wider">Probabilistic Causal Cascade Chain</span>
              <div className="space-y-2">
                {queryResult.causalAnalysis.causalChain.map((node, idx) => (
                  <div key={node.id} className="bg-[#09090b] border border-white/10 p-3.5 rounded-xl flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[10px]">
                        NODE #{idx + 1}
                      </span>
                      <div>
                        <span className="text-white font-bold text-xs">{node.service}</span>
                        <p className="text-[10px] text-slate-400">{node.anomalyType}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <span className="text-cyan-300 font-bold">{node.probabilityScore}% Prob</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-white/10 text-[10px]">
                        {node.causalDirection}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 3: Multi-Region Partition Clusters */}
        {activeTab === 'clusters' && (
          <motion.div
            key="clusters"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs"
          >
            {clusters.map((c) => (
              <div key={c.regionId} className="bg-[#121318] border border-white/10 rounded-2xl p-5 shadow-xl space-y-3 transition hover:border-white/20">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="font-bold text-white text-xs uppercase">{c.regionId}</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                    {c.partitionStatus}
                  </span>
                </div>

                <div className="space-y-2 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Active Shard Nodes:</span>
                    <span className="text-white font-bold">{c.activeNodes} Nodes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Ingestion Throughput:</span>
                    <span className="text-cyan-300 font-bold">{c.ingestionRateGbs} GB/s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Replication Lag:</span>
                    <span className="text-emerald-400 font-bold">{c.replicationLagMs}ms</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-white/10">
                    <span className="text-slate-500 font-sans">Total Log Entries:</span>
                    <span className="text-indigo-300 font-bold">{c.totalStoredLogs.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* TAB 4: zk-SNARK Retrievability Proofs */}
        {activeTab === 'zkp' && zkProof && (
          <motion.div
            key="zkp"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="bg-[#121318] border border-white/10 rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-white text-sm font-sans">zk-SNARK Provable Data Possession &amp; Integrity Ledger</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                ZK-RETRIEVABILITY VERIFIED
              </span>
            </div>

            <div className="space-y-3 text-slate-300">
              <div className="flex justify-between bg-[#09090b] p-3 rounded-xl border border-white/10">
                <span className="text-slate-500 font-sans">Proof Unique Identifier:</span>
                <span className="text-indigo-300 font-bold">{zkProof.proofId}</span>
              </div>
              <div className="flex justify-between bg-[#09090b] p-3 rounded-xl border border-white/10">
                <span className="text-slate-500 font-sans">Merkle Root Hash:</span>
                <span className="text-slate-400 font-mono text-[10px] truncate max-w-md">{zkProof.merkleRootHash}</span>
              </div>
              <div className="flex justify-between bg-[#09090b] p-3 rounded-xl border border-white/10">
                <span className="text-slate-500 font-sans">zk-SNARK Circuit Proof:</span>
                <span className="text-cyan-300 font-mono text-[10px] truncate max-w-md">{zkProof.zkProofSnarkHash}</span>
              </div>
              <div className="flex justify-between bg-[#09090b] p-3 rounded-xl border border-white/10">
                <span className="text-slate-500 font-sans">Proven Storage Shard:</span>
                <span className="text-emerald-400 font-bold">{zkProof.shardId} ({zkProof.region.toUpperCase()})</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* JSON Inspector Drawer Modal with Framer Motion */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 bg-[#09090b]/80 backdrop-blur-md flex items-center justify-center p-4 font-mono text-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="bg-[#121318] border border-white/15 rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-bold text-white text-sm font-sans">Log Entry Raw JSON Inspector</h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  aria-label="×"
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <pre className="bg-[#09090b] p-4 rounded-xl text-slate-200 overflow-x-auto max-h-96 text-[11px] leading-relaxed border border-white/10 font-mono">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
