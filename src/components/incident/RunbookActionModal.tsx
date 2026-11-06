'use client';

import React, { useState } from 'react';
import {
  X,
  Shield,
  ShieldAlert,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Lock,
  Copy,
  Check,
} from 'lucide-react';
import { RunbookDefinition, RunbookExecutionResult } from '../../types/incident';

interface RunbookActionModalProps {
  runbook: RunbookDefinition | null;
  incidentId: string;
  isOpen: boolean;
  onClose: () => void;
  canExecuteRunbooks?: boolean;
  currentUser?: { name: string; role: string };
  onSuccess?: (result: RunbookExecutionResult) => void;
}

export const RunbookActionModal: React.FC<RunbookActionModalProps> = ({
  runbook,
  incidentId,
  isOpen,
  onClose,
  canExecuteRunbooks = true,
  currentUser = { name: 'Alex Rivera', role: 'SRE Staff' },
  onSuccess,
}) => {
  const [isDryRun, setIsDryRun] = useState(false);
  const [hitlConfirmed, setHitlConfirmed] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<RunbookExecutionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedAudit, setCopiedAudit] = useState(false);

  if (!isOpen || !runbook) return null;

  const isHighRisk = runbook.riskLevel === 'HIGH';
  const requiresApproval = isHighRisk && !isDryRun;

  const handleExecute = async (dryRunMode = false) => {
    setIsExecuting(true);
    setErrorMessage(null);
    setExecutionResult(null);

    try {
      const res = await fetch('/api/v1/incidents/remediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId: runbook.actionId,
          targetService: runbook.targetService,
          actor: currentUser.name,
          role: currentUser.role,
          approved: hitlConfirmed || !isHighRisk,
          dryRun: dryRunMode,
          parameters: runbook.parameters || {},
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.message || data.error || 'Runbook execution was blocked or failed.');
        setExecutionResult(data);
      } else {
        setExecutionResult(data);
        if (onSuccess) onSuccess(data);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error while triggering runbook');
    } finally {
      setIsExecuting(false);
    }
  };

  const copyAuditProof = () => {
    if (!executionResult) return;
    const text = `Block ID: ${executionResult.auditEventId}\nHMAC Signature: ${executionResult.auditSignature}\nTimestamp: ${new Date(executionResult.timestamp).toISOString()}`;
    navigator.clipboard.writeText(text);
    setCopiedAudit(true);
    setTimeout(() => setCopiedAudit(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-[#0B0F17]/90 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`p-2.5 rounded-xl border ${
                runbook.riskLevel === 'HIGH'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  : runbook.riskLevel === 'MEDIUM'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
            >
              {runbook.riskLevel === 'HIGH' ? (
                <ShieldAlert className="w-5 h-5 text-rose-400" />
              ) : (
                <Shield className="w-5 h-5 text-indigo-400" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm text-white">{runbook.title}</h3>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    runbook.riskLevel === 'HIGH'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                      : runbook.riskLevel === 'MEDIUM'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {runbook.riskLevel} RISK
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Action: <span className="text-cyan-300">{runbook.actionId}</span> &bull; Target:{' '}
                <span className="text-indigo-300">{runbook.targetService}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Action Description */}
          <div className="bg-[#0B0F17]/60 border border-slate-800/90 rounded-xl p-4 text-xs text-slate-300">
            <p className="leading-relaxed">{runbook.description}</p>
            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Incident Link: <strong className="text-white">{incidentId}</strong></span>
              <span>Operator: <strong className="text-white">{currentUser.name}</strong> ({currentUser.role})</span>
            </div>
          </div>

          {/* HITL Safety Guard Banner */}
          {isHighRisk && (
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 text-xs">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h4 className="font-bold text-rose-300 uppercase tracking-wide">
                    Human-in-the-Loop (HITL) Policy Enforcement
                  </h4>
                  <p className="text-rose-200/80 leading-relaxed">
                    This action directly alters production state on <strong>{runbook.targetService}</strong> and drops
                    in-flight queries or re-routes live network traffic. Explicit SRE Lead authorization is required by
                    security policy before execution.
                  </p>
                  <label className="flex items-center space-x-2 mt-2 pt-2 border-t border-rose-500/20 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hitlConfirmed}
                      onChange={(e) => setHitlConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded border-rose-400/60 bg-rose-900/60 text-rose-500 focus:ring-rose-500"
                    />
                    <span className="text-xs font-semibold text-rose-300">
                      I confirm and authorize live production execution for this high-risk remediation.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* RBAC Permission Warning */}
          {!canExecuteRunbooks && (
            <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 flex items-center space-x-2 text-xs text-amber-300">
              <Lock className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                Your current role (<strong>{currentUser.role}</strong>) does not have permission to trigger live
                runbooks. You can only run non-mutating dry-run simulations.
              </span>
            </div>
          )}

          {/* Execution Output Stream */}
          {executionResult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center space-x-1.5 text-slate-400">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Execution Output Stream</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    executionResult.status === 'SUCCESS'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {executionResult.status} ({executionResult.durationMs}ms)
                </span>
              </div>

              {/* Terminal View */}
              <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3 font-mono text-[11px] space-y-1 overflow-x-auto max-h-48 text-slate-300 shadow-inner">
                {executionResult.stdout.map((line, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <span className="text-slate-600 select-none">&gt;</span>
                    <span className="text-emerald-400">{line}</span>
                  </div>
                ))}
                {executionResult.stderr.map((line, idx) => (
                  <div key={`err-${idx}`} className="flex items-start space-x-2 text-rose-400">
                    <span className="text-rose-600 select-none">!</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>

              {/* Merkle Cryptographic Receipt Badge */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
                <div className="space-y-0.5 truncate mr-2">
                  <div className="flex items-center space-x-1.5 text-indigo-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-bold">Cryptographic Audit Receipt</span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Block: <span className="text-white">{executionResult.auditEventId}</span> &bull; HMAC:{' '}
                    <span className="text-cyan-300">{executionResult.auditSignature.substring(0, 16)}...</span>
                  </div>
                </div>

                <button
                  onClick={copyAuditProof}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition shrink-0"
                >
                  {copiedAudit ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Proof</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* General Error Banner */}
          {errorMessage && !executionResult && (
            <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-300 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t border-slate-800 bg-[#0B0F17]/90 flex items-center justify-between">
          <button
            onClick={() => handleExecute(true)}
            disabled={isExecuting}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 font-mono transition disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
            <span>Simulate Dry Run</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>

            <button
              onClick={() => handleExecute(false)}
              disabled={isExecuting || (!canExecuteRunbooks && !isDryRun) || (requiresApproval && !hitlConfirmed)}
              className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${
                isHighRisk
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
              }`}
            >
              {isExecuting ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Authorize & Execute</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
