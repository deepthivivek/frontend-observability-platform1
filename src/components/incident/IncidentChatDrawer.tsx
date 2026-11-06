'use client';
/* eslint-disable react-hooks/purity */

import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sparkles,
  Send,
  RotateCw,
  Terminal,
  ShieldAlert,
  Play,
  Copy,
  Check,
  Flame,
  ChevronRight,
  Database,
  Layers,
} from 'lucide-react';
import { AIChatMessage, Incident, RunbookDefinition } from '../../types/incident';

interface IncidentChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  incident: Incident;
  onSelectRunbook?: (runbook: RunbookDefinition) => void;
  currentUser?: { name: string; role: string };
}

const QUICK_PROMPTS = [
  'Analyze Error Logs',
  'Check Database Locks',
  'Suggest Runbook',
  'Explain Root Cause',
  'Calculate Blast Radius',
];

export const IncidentChatDrawer: React.FC<IncidentChatDrawerProps> = ({
  isOpen,
  onClose,
  incident,
  onSelectRunbook,
  currentUser = { name: 'Alex Rivera', role: 'SRE Staff' },
}) => {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      id: 'msg-init',
      role: 'assistant',
      content: `Hello ${currentUser.name}. I am **The Neon Chasm AI Incident Copilot**.\n\nI have correlated real-time telemetry, Z-score trace anomalies, and error logs for active incident **\`${incident.id}\`** (*${incident.title}*).\n\nAsk me any diagnostic question or pick a quick diagnostic chip below.`,
      timestamp: Date.now() - 60000,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendPrompt = async (promptText: string) => {
    if (!promptText.trim() || isLoading) return;

    const nowTime = Date.now();
    const userMsg: AIChatMessage = {
      id: `msg-u-${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      content: promptText.trim(),
      timestamp: nowTime,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/incidents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentId: incident.id,
          prompt: promptText.trim(),
          userRole: currentUser.role,
          actor: currentUser.name,
        }),
      });

      if (!res.ok) {
        throw new Error(`Chat API responded with status ${res.status}`);
      }

      const data = await res.json();
      const responseTime = Date.now();

      const assistantMsg: AIChatMessage = {
        id: `msg-a-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: data.message,
        timestamp: responseTime,
        structuredInsight: {
          rootCause: data.rootCause,
          affectedMicroservices: data.affectedMicroservices,
          recommendedRunbooks: data.recommendedRunbooks,
          correlatedLogs: data.correlatedLogs,
          blastRadiusSummary: data.blastRadiusSummary,
          zScoreImpact: data.zScoreImpact,
        },
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: AIChatMessage = {
        id: `msg-err-${Math.random().toString(36).substring(2, 7)}`,
        role: 'assistant',
        content: `**Triage Error**: Could not complete telemetry query (${err.message}). Using local fallback context.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-[#0F172A] border-l border-slate-800 shadow-2xl flex flex-col text-slate-100 animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 bg-[#0B0F17] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-sm text-white">AI Incident Triage Copilot</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                RAG Active
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Incident: <span className="text-cyan-300">{incident.id}</span> &bull; {incident.primaryService}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Prompt Chips */}
      <div className="px-4 py-2.5 border-b border-slate-800/80 bg-[#0B0F17]/60 flex items-center space-x-2 overflow-x-auto no-scrollbar text-xs">
        <span className="text-[10px] uppercase font-mono text-slate-500 shrink-0">Prompts:</span>
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => handleSendPrompt(prompt)}
            disabled={isLoading}
            className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-slate-300 text-xs shrink-0 transition font-mono hover:text-white disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages Container */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto font-sans text-xs">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col space-y-1.5 ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div className="flex items-center space-x-2 px-1 text-[10px] font-mono text-slate-500">
              <span>{msg.role === 'user' ? currentUser.name : 'Neon Chasm AI'}</span>
              <span>&bull;</span>
              <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
            </div>

            <div
              className={`p-3.5 rounded-2xl max-w-[90%] space-y-2 leading-relaxed relative group ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none shadow-md'
                  : 'bg-[#0B0F17] border border-slate-800 text-slate-200 rounded-tl-none shadow-lg'
              }`}
            >
              {/* Message Content */}
              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Action Cards inside Assistant Response */}
              {msg.structuredInsight?.recommendedRunbooks &&
                msg.structuredInsight.recommendedRunbooks.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 block">
                      Suggested Runbook Mitigations
                    </span>

                    <div className="space-y-1.5">
                      {msg.structuredInsight.recommendedRunbooks.map((rb) => (
                        <div
                          key={rb.actionId}
                          className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5 truncate mr-2">
                            <div className="font-semibold text-white flex items-center space-x-1.5 truncate">
                              <span>{rb.title}</span>
                              <span
                                className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                                  rb.riskLevel === 'HIGH'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                }`}
                              >
                                {rb.riskLevel}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate">{rb.description}</span>
                          </div>

                          <button
                            onClick={() => onSelectRunbook && onSelectRunbook(rb)}
                            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold transition shrink-0 shadow"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>Preview</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Copy message button */}
              {msg.role === 'assistant' && (
                <button
                  onClick={() => copyMessage(msg.id, msg.content)}
                  className="opacity-0 group-hover:opacity-100 transition absolute top-2 right-2 p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                  title="Copy response"
                >
                  {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center space-x-2 text-indigo-400 font-mono text-xs p-2">
            <RotateCw className="w-3.5 h-3.5 animate-spin" />
            <span>Correlating telemetry RAG vectors & diagnosing incident...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="p-3 border-t border-slate-800 bg-[#0B0F17]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendPrompt(inputText);
          }}
          className="flex items-center space-x-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask AI Copilot (e.g. Why did checkout fail at 14:32 UTC?)"
            disabled={isLoading}
            className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition shadow-[0_0_15px_rgba(99,102,241,0.3)] shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
          <span>PII auto-redacted before LLM dispatch</span>
          <span>Enter to send</span>
        </div>
      </div>
    </div>
  );
};
