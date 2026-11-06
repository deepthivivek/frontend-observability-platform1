'use client';

import React, { useState } from 'react';
import { ApiRequestLog } from '../../types/telemetry';
import { AITriageDiagnosis } from '../../types/trace';
import { Sparkles, Bot, Check, Copy, AlertOctagon, Terminal } from 'lucide-react';

interface AITriagePanelProps {
  log: ApiRequestLog;
}

export const AITriagePanel: React.FC<AITriagePanelProps> = ({ log }) => {
  const [copied, setCopied] = useState(false);

  // Synthesize diagnosis based on request context
  const is5xx = log.statusCode >= 500;
  const is4xx = log.statusCode >= 400 && log.statusCode < 500;
  const isSlow = log.latencyMs > 250;

  const diagnosis: AITriageDiagnosis = is5xx
    ? {
        hypothesis: 'Downstream Database Connection Pool Exhaustion or Gateway Timeout',
        impactAssessment: `Severe: Request failed with HTTP ${log.statusCode}. Caused by a lock stall or timeout waiting for client connection response.`,
        recommendedFix: 'Increase connection pool limits or implement exponential backoff with circuit breaking on query timeouts.',
        suggestedSnippet: `-- Recommended SQL Index to eliminate table scan on orders query:\nCREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_timestamp\nON orders (user_id, created_at DESC);`,
        snippetType: 'sql',
      }
    : is4xx
    ? {
        hypothesis: 'Invalid Authentication Token / Malformed Request Payload',
        impactAssessment: `Client-side error (${log.statusCode}). Request lacked valid Authorization header format or passed unexpected schema.`,
        recommendedFix: 'Verify token expiration headers and validate client JSON schema prior to payload transmission.',
        suggestedSnippet: `// Suggested Token Validation Middleware Check:\nif (!token || !token.startsWith("Bearer ")) {\n  return res.status(401).json({ error: "Invalid Authorization format" });\n}`,
        snippetType: 'code',
      }
    : isSlow
    ? {
        hypothesis: 'Unindexed Database Query or Heavy Serialization Bottleneck',
        impactAssessment: `Performance degradation: Latency (${log.latencyMs}ms) exceeds the p95 SLA threshold (200ms).`,
        recommendedFix: 'Add composite database indexing or cache high-cardinality lookups in Redis/Edge memory.',
        suggestedSnippet: `// Implement Edge Cache-Control Header:\nresponse.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=300");`,
        snippetType: 'code',
      }
    : {
        hypothesis: 'Healthy Execution Trace',
        impactAssessment: 'Optimal performance: Latency and status codes are within normal cluster operational baselines.',
        recommendedFix: 'No remediation necessary.',
        suggestedSnippet: `// System running within healthy SLA limits`,
        snippetType: 'code',
      };

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(diagnosis.suggestedSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="p-4 rounded-2xl border border-indigo-500/40 bg-[#0B0F17]/90 text-slate-200 font-mono space-y-4 shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-semibold text-white text-sm">AI Root Cause Diagnostics</span>
        </div>
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
          Automated Analysis
        </span>
      </div>

      <div className="space-y-3 text-xs">
        {/* Root Cause Hypothesis */}
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500">Root Cause Hypothesis</span>
          <div className="mt-1 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 font-sans leading-relaxed">
            {diagnosis.hypothesis}
          </div>
        </div>

        {/* Impact Assessment */}
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500">Impact Assessment</span>
          <div className="mt-1 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 font-sans leading-relaxed">
            {diagnosis.impactAssessment}
          </div>
        </div>

        {/* Recommended Fix */}
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-500">Remediation Strategy</span>
          <div className="mt-1 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-200 font-sans leading-relaxed">
            {diagnosis.recommendedFix}
          </div>
        </div>

        {/* Code/SQL Remediation Snippet */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-500">
              Suggested {diagnosis.snippetType.toUpperCase()} Patch
            </span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy Snippet'}
            </button>
          </div>
          <pre className="p-3 rounded-xl bg-[#080C14] border border-slate-800 text-emerald-300 text-xs overflow-x-auto">
            {diagnosis.suggestedSnippet}
          </pre>
        </div>
      </div>
    </div>
  );
};
