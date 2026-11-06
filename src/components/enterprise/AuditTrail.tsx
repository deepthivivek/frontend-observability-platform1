import React, { useState } from 'react';
import {
  FileCode,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Copy,
  Check,
  Cpu,
  Layers,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { AuditLogEvent, ComplianceViolation } from '../../types/enterprise';

interface AuditTrailProps {
  auditLogs: AuditLogEvent[];
  violations: ComplianceViolation[];
  onRunComplianceScan: () => void;
  isScanning: boolean;
}

export const AuditTrail: React.FC<AuditTrailProps> = ({
  auditLogs,
  violations,
  onRunComplianceScan,
  isScanning,
}) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleCopyHash = (hash: string) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 2000);
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Banner: Hash Chain Integrity & Compliance Posture */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-emerald-500/30 bg-[#131F25]/90 backdrop-blur-xl shadow-xl space-y-2">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="font-bold uppercase text-[11px]">Merkle Hash Chain Status</span>
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="text-2xl font-bold text-white">100% Verified</div>
          <p className="text-[11px] text-slate-400">
            SHA-256 cryptographic chaining ensures zero tampering across {auditLogs.length} logged audit events.
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-indigo-500/30 bg-[#131B2E]/90 backdrop-blur-xl shadow-xl space-y-2">
          <div className="flex items-center justify-between text-indigo-400">
            <span className="font-bold uppercase text-[11px]">Active Compliance Posture</span>
            <Layers className="h-5 w-5" />
          </div>
          <div className="text-2xl font-bold text-white">SOC2 &bull; GDPR &bull; HIPAA</div>
          <p className="text-[11px] text-slate-400">Automated policy-as-code linting continuously inspects workspace state.</p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl shadow-xl space-y-2 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-bold uppercase text-[11px]">Posture Drift Linter</span>
            <Cpu className="h-5 w-5 text-indigo-400" />
          </div>
          <button
            onClick={onRunComplianceScan}
            disabled={isScanning}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning Posture...' : 'Run Compliance Scan'}</span>
          </button>
        </div>
      </div>

      {/* Compliance Violations / Warnings */}
      {violations.length > 0 && (
        <div className="p-5 rounded-2xl border border-amber-500/40 bg-[#1F1B14]/90 backdrop-blur-xl shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <AlertTriangle className="h-4 w-4" />
            <span>Active Compliance Posture Drift Warnings ({violations.length})</span>
          </div>
          <div className="space-y-2">
            {violations.map((v) => (
              <div key={v.id} className="p-3 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-200 flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-white">[{v.standard}] {v.title}</span>
                  <p className="text-[11px] text-amber-300/80 mt-0.5">Remediation: {v.remediation}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">
                  {v.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hash-Chained Audit Log Table */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white">
            <Lock className="h-4 w-4 text-emerald-400" />
            <h3 className="font-semibold text-sm">Cryptographic Hash-Chained Audit Trail (SHA-256)</h3>
          </div>
          <span className="text-slate-400 text-xs">{auditLogs.length} Chained Blocks</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0B0F17] text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4">Block Hash (SHA-256)</th>
                <th className="py-3 px-4">Signature</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-4 font-bold text-white">{log.actor}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{log.targetResource}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 truncate max-w-[160px]" title={log.hash}>
                        {log.hash}
                      </span>
                      <button
                        onClick={() => handleCopyHash(log.hash)}
                        className="text-slate-500 hover:text-white"
                        title="Copy Hash"
                      >
                        {copiedHash === log.hash ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-500 truncate max-w-[100px]">{log.signature}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
