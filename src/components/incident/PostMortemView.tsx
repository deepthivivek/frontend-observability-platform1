'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Copy,
  Check,
  Download,
  RotateCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  User,
  Calendar,
} from 'lucide-react';
import { Incident, PostMortemReport } from '../../types/incident';

interface PostMortemViewProps {
  incident: Incident;
  currentUser?: { name: string; role: string };
}

export const PostMortemView: React.FC<PostMortemViewProps> = ({
  incident,
  currentUser = { name: 'Alex Rivera', role: 'SRE Staff' },
}) => {
  const [report, setReport] = useState<PostMortemReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
  const [copied, setCopied] = useState(false);
  const [authorName, setAuthorName] = useState(currentUser.name);

  const fetchPostMortem = async (author = authorName) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/incidents/${incident.id}/post-mortem?author=${encodeURIComponent(author)}`);
      if (res.ok) {
        const data = await res.json();
        setReport(data);
      }
    } catch (err) {
      console.error('Failed to load post-mortem:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPostMortem();
  }, [incident.id]);

  const copyToClipboard = () => {
    if (!report) return;
    navigator.clipboard.writeText(report.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMarkdown = () => {
    if (!report) return;
    const element = document.createElement('a');
    const file = new Blob([report.markdown], { type: 'text/markdown' });
    element.href = URL.createObjectURL(file);
    element.download = `post-mortem-${incident.id}.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <FileText className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
              <span>Automated Blameless Post-Mortem Studio</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                AI Synthesized
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Instant incident retrospectives with timelines, root causes, Merkle audit receipts, and Jira-ready action items.
            </p>
          </div>
        </div>

        {/* View Mode & Actions */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-[#0B0F17] p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('preview')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === 'preview'
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Formatted Preview
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1.5 rounded-lg transition font-mono ${
                viewMode === 'raw'
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Raw Markdown (.md)
            </button>
          </div>

          <button
            onClick={() => fetchPostMortem()}
            disabled={isLoading}
            className="flex items-center space-x-1.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-mono transition disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Re-Generate</span>
          </button>

          <button
            onClick={copyToClipboard}
            className="flex items-center space-x-1.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-mono transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Markdown</span>
              </>
            )}
          </button>

          <button
            onClick={downloadMarkdown}
            className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .md</span>
          </button>
        </div>
      </div>

      {/* 2. Main Content Area */}
      {isLoading ? (
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-3">
          <RotateCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <h4 className="font-semibold text-sm text-white">Synthesizing Incident Post-Mortem...</h4>
          <p className="text-xs text-slate-400 max-w-sm">
            Correlating timeline phases, blast radius metrics, root cause telemetry, and preventative action items.
          </p>
        </div>
      ) : report ? (
        viewMode === 'preview' ? (
          /* Formatted Preview Mode */
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-8 text-slate-200">
            {/* Header Metadata */}
            <div className="border-b border-slate-800 pb-5 space-y-2">
              <div className="flex items-center space-x-3">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {incident.severity}
                </span>
                <h2 className="text-lg font-bold text-white tracking-wide">{report.title}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pt-1">
                <span className="flex items-center space-x-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Author: {report.author}</span>
                </span>
                <span>&bull;</span>
                <span className="flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Generated: {new Date(report.generatedAt).toUTCString()}</span>
                </span>
                <span>&bull;</span>
                <span>Incident Lead: <strong className="text-white">{incident.leadSre}</strong></span>
              </div>
            </div>

            {/* Section 1: Executive Summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-400">
                1. Executive Summary
              </h4>
              <div className="bg-[#0B0F17] border border-slate-800/90 rounded-xl p-4 text-xs leading-relaxed text-slate-300">
                {report.sections.executiveSummary}
              </div>
            </div>

            {/* Section 2: Blast Radius Impact */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
                2. Blast Radius & Business Impact
              </h4>
              <div className="bg-[#0B0F17] border border-slate-800/90 rounded-xl p-4 text-xs font-mono space-y-1.5 text-slate-300 whitespace-pre-line">
                {report.sections.impact}
              </div>
            </div>

            {/* Section 3: Root Cause Analysis */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-rose-400">
                3. Root Cause Analysis
              </h4>
              <div className="bg-[#0B0F17] border border-slate-800/90 rounded-xl p-4 text-xs leading-relaxed text-slate-300">
                <p>{report.sections.rootCause}</p>
              </div>
            </div>

            {/* Section 4: Preventative Action Items (Jira table) */}
            <div className="space-y-2">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                4. Preventative Action Items (Jira-Ready)
              </h4>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#0B0F17]">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] text-slate-400 uppercase">
                    <tr>
                      <th className="py-2.5 px-4">Priority</th>
                      <th className="py-2.5 px-4">Action Item</th>
                      <th className="py-2.5 px-4">Owner</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {report.sections.actionItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 px-4 font-bold">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              item.priority === 'P0'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {item.priority}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-200">{item.task}</td>
                        <td className="py-2.5 px-4 text-slate-400">{item.owner}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 border border-slate-700">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 5: Lessons Learned */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-[#0B0F17] border border-emerald-500/30 rounded-xl p-4 space-y-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>What Went Well</span>
                </span>
                <ul className="text-xs space-y-1.5 text-slate-300 list-disc list-inside">
                  {report.sections.lessonsLearned.whatWentWell.map((w, idx) => (
                    <li key={idx} className="leading-relaxed">{w}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#0B0F17] border border-rose-500/30 rounded-xl p-4 space-y-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-rose-400 flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>What Went Poorly</span>
                </span>
                <ul className="text-xs space-y-1.5 text-slate-300 list-disc list-inside">
                  {report.sections.lessonsLearned.whatWentPoorly.map((w, idx) => (
                    <li key={idx} className="leading-relaxed">{w}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#0B0F17] border border-cyan-500/30 rounded-xl p-4 space-y-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Where We Got Lucky</span>
                </span>
                <ul className="text-xs space-y-1.5 text-slate-300 list-disc list-inside">
                  {report.sections.lessonsLearned.whereWeGotLucky.map((w, idx) => (
                    <li key={idx} className="leading-relaxed">{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          /* Raw Markdown Mode */
          <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3 font-mono">
            <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
              <span>Source Markdown (CommonMark Compatible)</span>
              <span>{report.markdown.length} characters</span>
            </div>
            <textarea
              readOnly
              value={report.markdown}
              className="w-full h-[600px] bg-transparent text-xs text-slate-300 focus:outline-none resize-none font-mono leading-relaxed selection:bg-indigo-600/50"
            />
          </div>
        )
      ) : null}
    </div>
  );
};
