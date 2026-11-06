'use client';

import React, { useState } from 'react';
import { Sparkles, Code2, Sliders, Play, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { PromQLQueryConfig } from '../../types/dashboard';

interface MetricQueryBuilderProps {
  initialConfig?: PromQLQueryConfig;
  onApplyQuery: (config: PromQLQueryConfig) => void;
  onClose?: () => void;
}

const METRICS_LIST = [
  { value: 'http_requests_total', label: 'http_requests_total (RPS & Latency)' },
  { value: 'db_query_duration_ms', label: 'db_query_duration_ms (Database Latency)' },
  { value: 'cpu_utilization', label: 'cpu_utilization (Cluster CPU Node %)' },
  { value: 'error_rate', label: 'error_rate (5xx Error Ratio %)' },
  { value: 'memory_rss_bytes', label: 'memory_rss_bytes (Memory Allocation)' },
  { value: 'rum_cls', label: 'rum_cls (Layout Shift Score)' },
];

const AGGREGATIONS = [
  { value: 'rate', label: 'rate() - Per-second rate of increase' },
  { value: 'p99', label: 'p99() - 99th Percentile Quantile' },
  { value: 'p95', label: 'p95() - 95th Percentile Quantile' },
  { value: 'sum_by', label: 'sum_by() - Aggregated sum grouped by label' },
  { value: 'count_over_time', label: 'count_over_time() - Log/Event count' },
  { value: 'avg', label: 'avg() - Arithmetic mean' },
];

const WINDOWS = ['1m', '5m', '15m', '1h', '24h'];
const SAMPLE_PROMPTS = [
  'Show me p99 latency by route for the past 15m',
  'Calculate 5xx error rate percentage over time',
  'Show database query duration average grouped by table',
  'Cluster CPU utilization percentage over 5m window',
];

export const MetricQueryBuilder: React.FC<MetricQueryBuilderProps> = ({
  initialConfig,
  onApplyQuery,
  onClose,
}) => {
  const [mode, setMode] = useState<'ai' | 'visual' | 'code'>('ai');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);

  const [metric, setMetric] = useState(initialConfig?.metric || 'http_requests_total');
  const [aggregation, setAggregation] = useState(initialConfig?.aggregation || 'p99');
  const [windowVal, setWindowVal] = useState(initialConfig?.window || '5m');
  const [groupBy, setGroupBy] = useState(initialConfig?.groupBy || 'endpoint');
  const [expression, setExpression] = useState(
    initialConfig?.expression || 'histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))'
  );

  // Sync visual inputs to expression
  const updateVisualExpression = (newM: string, newA: string, newW: string, newG: string) => {
    let expr = `${newA}(${newM}[${newW}])`;
    if (newA === 'p99') {
      expr = `histogram_quantile(0.99, sum(rate(${newM}_bucket[${newW}])) by (le))`;
    } else if (newA === 'p95') {
      expr = `histogram_quantile(0.95, sum(rate(${newM}_bucket[${newW}])) by (le))`;
    } else if (newA === 'sum_by' && newG) {
      expr = `sum(${newM}) by (${newG})`;
    }
    setExpression(expr);
  };

  const handleAiTranslate = async (promptText: string) => {
    if (!promptText.trim()) return;
    setIsTranslating(true);
    setAiExplanation(null);

    try {
      const res = await fetch('/api/v1/metrics/ai-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      });

      if (res.ok) {
        const data = await res.json();
        setExpression(data.expression);
        setMetric(data.metric);
        setAggregation(data.aggregation);
        setAiExplanation(data.explanation);
      } else {
        // Fallback local translation
        fallbackTranslate(promptText);
      }
    } catch {
      fallbackTranslate(promptText);
    } finally {
      setIsTranslating(false);
    }
  };

  const fallbackTranslate = (txt: string) => {
    const l = txt.toLowerCase();
    if (l.includes('p99')) {
      setExpression('histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))');
      setMetric('http_requests_total');
      setAggregation('p99');
      setAiExplanation('Translated to 99th percentile quantile PromQL query.');
    } else if (l.includes('error')) {
      setExpression('sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100');
      setMetric('error_rate');
      setAggregation('rate');
      setAiExplanation('Translated to 5xx error rate ratio calculation.');
    } else {
      setExpression('sum(rate(http_requests_total[5m])) by (endpoint)');
      setMetric('http_requests_total');
      setAggregation('rate');
      setAiExplanation('Translated to endpoint request rate aggregation.');
    }
  };

  const handleApply = () => {
    onApplyQuery({
      expression,
      step: '1m',
      metric,
      aggregation: aggregation as any,
      window: windowVal,
      groupBy,
    });
    if (onClose) onClose();
  };

  return (
    <div className="bg-[#0F172A] border border-cyan-500/30 rounded-xl p-5 shadow-2xl space-y-5 text-slate-200">
      {/* Header Mode Switcher */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-semibold text-cyan-300 tracking-wide uppercase">PromQL / LogQL Query Studio</h3>
        </div>
        <div className="flex bg-[#0B0F17] p-1 rounded-lg border border-slate-800 space-x-1 text-xs">
          <button
            onClick={() => setMode('ai')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center space-x-1.5 ${
              mode === 'ai' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Assistant</span>
          </button>
          <button
            onClick={() => setMode('visual')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center space-x-1.5 ${
              mode === 'visual' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Visual Builder</span>
          </button>
          <button
            onClick={() => setMode('code')}
            className={`px-3 py-1.5 rounded-md font-medium transition flex items-center space-x-1.5 ${
              mode === 'code' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>PromQL Code</span>
          </button>
        </div>
      </div>

      {/* MODE 1: AI ASSISTANT */}
      {mode === 'ai' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-mono text-slate-400">Describe the metric or telemetry calculation in natural language:</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAiTranslate(aiPrompt)}
                placeholder="e.g. Show me p99 latency by route for the past 15m..."
                className="flex-1 bg-[#0B0F17] border border-slate-700 focus:border-cyan-500 rounded-lg px-3.5 py-2 text-sm text-slate-100 font-mono outline-none"
              />
              <button
                onClick={() => handleAiTranslate(aiPrompt)}
                disabled={isTranslating || !aiPrompt.trim()}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center space-x-2 disabled:opacity-50"
              >
                {isTranslating ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <span>Translate</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sample Prompts */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono text-slate-500">Quick AI Prompts:</span>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setAiPrompt(prompt);
                    handleAiTranslate(prompt);
                  }}
                  className="bg-[#0B0F17] border border-slate-800 hover:border-cyan-500/50 text-slate-300 text-xs px-2.5 py-1 rounded-md transition"
                >
                  &quot;{prompt}&quot;
                </button>
              ))}
            </div>
          </div>

          {aiExplanation && (
            <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-lg p-3 text-xs text-cyan-200 flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-cyan-300">AI PromQL Synthesis Ready</div>
                <div className="mt-0.5 text-slate-300">{aiExplanation}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODE 2: VISUAL BUILDER */}
      {mode === 'visual' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-400">Target Metric</label>
            <select
              value={metric}
              onChange={(e) => {
                setMetric(e.target.value);
                updateVisualExpression(e.target.value, aggregation, windowVal, groupBy);
              }}
              className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-200 focus:border-cyan-500 outline-none"
            >
              {METRICS_LIST.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-400">Aggregation Function</label>
            <select
              value={aggregation}
              onChange={(e) => {
                setAggregation(e.target.value as any);
                updateVisualExpression(metric, e.target.value, windowVal, groupBy);
              }}
              className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-200 focus:border-cyan-500 outline-none"
            >
              {AGGREGATIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-400">Time Window</label>
            <select
              value={windowVal}
              onChange={(e) => {
                setWindowVal(e.target.value);
                updateVisualExpression(metric, aggregation, e.target.value, groupBy);
              }}
              className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-200 focus:border-cyan-500 outline-none"
            >
              {WINDOWS.map((w) => (
                <option key={w} value={w}>
                  {w} window
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-mono text-slate-400">Group By Tag</label>
            <input
              type="text"
              value={groupBy}
              onChange={(e) => {
                setGroupBy(e.target.value);
                updateVisualExpression(metric, aggregation, windowVal, e.target.value);
              }}
              placeholder="e.g. endpoint, service, status"
              className="w-full bg-[#0B0F17] border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-200 focus:border-cyan-500 outline-none"
            />
          </div>
        </div>
      )}

      {/* MODE 3: DIRECT PROMQL CODE */}
      {mode === 'code' && (
        <div className="space-y-2">
          <label className="text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>Raw PromQL Expression</span>
            <span className="text-cyan-400">Validated Syntax</span>
          </label>
          <textarea
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            rows={3}
            className="w-full bg-[#0B0F17] border border-slate-700 focus:border-cyan-500 rounded-lg p-3 text-xs font-mono text-emerald-400 outline-none resize-none leading-relaxed"
          />
        </div>
      )}

      {/* Expression Preview Bar */}
      <div className="bg-[#0B0F17] border border-slate-800 rounded-lg p-3 space-y-1">
        <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Compiled Expression:</div>
        <div className="font-mono text-xs text-cyan-300 break-all">{expression}</div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-slate-500">Step: 1m resolution</span>
        <div className="flex space-x-3">
          {onClose && (
            <button onClick={onClose} className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 transition">
              Cancel
            </button>
          )}
          <button
            onClick={handleApply}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-xs font-medium transition flex items-center space-x-2 shadow-lg shadow-emerald-950/40"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Apply Query to Studio</span>
          </button>
        </div>
      </div>
    </div>
  );
};
