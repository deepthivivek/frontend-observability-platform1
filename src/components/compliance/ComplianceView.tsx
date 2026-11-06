'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Terminal,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Download,
  Send,
  Lock,
  FileText,
  Key,
  Globe,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { ComplianceControl, SIEMWebhookConfig, DeadLetterQueueItem, ComplianceExportPackage } from '../../types/compliance';

interface ComplianceViewProps {
  canViewCompliance?: boolean;
  canConfigureSIEM?: boolean;
}

export const ComplianceView: React.FC<ComplianceViewProps> = ({
  canViewCompliance = true,
  canConfigureSIEM = true,
}) => {
  const [activeTab, setActiveTab] = useState<'controls' | 'siem' | 'dlq' | 'evidence'>('controls');
  const [controls, setControls] = useState<ComplianceControl[]>([]);
  const [complianceScore, setComplianceScore] = useState(100);
  const [webhooks, setWebhooks] = useState<SIEMWebhookConfig[]>([]);
  const [dlqItems, setDlqItems] = useState<DeadLetterQueueItem[]>([]);
  const [exportPkg, setExportPkg] = useState<ComplianceExportPackage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testWebhookStatus, setTestWebhookStatus] = useState<string | null>(null);
  const [redriveStatus, setRedriveStatus] = useState<string | null>(null);
  const [copiedSig, setCopiedSig] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [auditRes, webhookRes, dlqRes, exportRes] = await Promise.all([
        fetch('/api/v1/compliance/audit'),
        fetch('/api/v1/compliance/siem/webhooks'),
        fetch('/api/v1/compliance/siem/dlq'),
        fetch('/api/v1/compliance/export'),
      ]);

      if (auditRes.ok) {
        const data = await auditRes.json();
        setControls(data.controls || []);
        setComplianceScore(data.complianceScore || 100);
      }
      if (webhookRes.ok) {
        const whData = await webhookRes.json();
        setWebhooks(whData || []);
      }
      if (dlqRes.ok) {
        const dlqData = await dlqRes.json();
        setDlqItems(dlqData.items || []);
      }
      if (exportRes.ok) {
        const expData = await exportRes.json();
        setExportPkg(expData);
      }
    } catch (err) {
      console.error('Failed to load compliance suite data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTestWebhook = async (webhookId: string) => {
    setTestWebhookStatus('Dispatching signed test probe...');
    try {
      const res = await fetch('/api/v1/compliance/siem/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookId,
          eventType: 'SECURITY_ALERT',
          payload: { message: 'Compliance Studio manual test webhook ping' },
        }),
      });
      if (res.ok) {
        setTestWebhookStatus('Webhook dispatched successfully with HMAC-SHA256 signature (HTTP 200 OK)');
        fetchData();
      } else {
        setTestWebhookStatus('Webhook dispatch failed or routed to DLQ');
      }
    } catch (err: any) {
      setTestWebhookStatus(`Error: ${err.message}`);
    }
    setTimeout(() => setTestWebhookStatus(null), 4000);
  };

  const handleRedriveDLQ = async () => {
    setRedriveStatus('Re-driving failed DLQ events...');
    try {
      const res = await fetch('/api/v1/compliance/siem/dlq/redrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setRedriveStatus(`Successfully redrived ${data.redrivedCount} / ${data.totalAttempted} events.`);
        fetchData();
      }
    } catch (err: any) {
      setRedriveStatus(`Redrive error: ${err.message}`);
    }
    setTimeout(() => setRedriveStatus(null), 4000);
  };

  const copySignature = () => {
    if (!exportPkg) return;
    navigator.clipboard.writeText(exportPkg.cryptographicSignature);
    setCopiedSig(true);
    setTimeout(() => setCopiedSig(false), 2000);
  };

  if (!canViewCompliance) {
    return (
      <div className="p-8 text-center bg-[#0F172A] border border-slate-800 rounded-2xl text-slate-400 space-y-3">
        <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
        <h3 className="font-semibold text-white">Compliance Access Restricted</h3>
        <p className="text-xs max-w-md mx-auto">
          Your current role does not have <code className="text-cyan-300">canViewCompliance</code> permission. Contact your security administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header & Score Banner */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-lg font-bold text-white tracking-wide">SOC2 & GDPR Compliance Studio</h2>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                SCORE: {complianceScore}% COMPLIANT
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time control assessment, HMAC-SHA256 SIEM webhook dispatcher, DLQ recovery manager, and signed audit evidence.
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center space-x-1.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-slate-300 px-3.5 py-2 rounded-xl text-xs font-mono transition"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Posture</span>
        </button>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 font-mono text-xs">
        <button
          onClick={() => setActiveTab('controls')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'controls'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>SOC2 & GDPR Controls ({controls.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('siem')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'siem'
              ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>SIEM Webhook Dispatcher ({webhooks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('dlq')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'dlq'
              ? 'bg-rose-600/30 text-rose-300 border border-rose-500/40 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Dead-Letter Queue (DLQ) ({dlqItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('evidence')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'evidence'
              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Signed Evidence & Merkle Package</span>
        </button>
      </div>

      {/* 3. Tab Panels */}
      {activeTab === 'controls' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {controls.map((control) => (
              <div
                key={control.id}
                className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-bold">
                      {control.standard} &bull; {control.category}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                        control.status === 'PASSED'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : control.status === 'WARNING'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      }`}
                    >
                      {control.status}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-white">{control.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{control.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-500 flex items-center justify-between">
                  <span>Evidence: <strong className="text-slate-300 truncate max-w-xs">{control.evidenceRef}</strong></span>
                  <span>Assessed: {new Date(control.lastAssessedAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'siem' && (
        <div className="space-y-5">
          {testWebhookStatus && (
            <div className="bg-cyan-950/40 border border-cyan-500/40 rounded-xl p-3 text-xs text-cyan-300 font-mono">
              {testWebhookStatus}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {webhooks.map((wh) => (
              <div key={wh.id} className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-white">{wh.name}</h4>
                    <p className="text-xs text-slate-400 font-mono truncate max-w-xs mt-0.5">{wh.destinationUrl}</p>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border font-bold ${
                      wh.enabled ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {wh.enabled ? 'ACTIVE' : 'DISABLED'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-2 border-t border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Success</span>
                    <span className="font-bold text-emerald-400">{wh.successCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Failures</span>
                    <span className="font-bold text-rose-400">{wh.failureCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">HMAC Secret</span>
                    <span className="font-bold text-cyan-300">••••{wh.secretToken.slice(-4)}</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500">
                    Filters: {wh.eventTypeFilter.join(', ')}
                  </span>
                  <button
                    onClick={() => handleTestWebhook(wh.id)}
                    disabled={!canConfigureSIEM}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition disabled:opacity-40"
                  >
                    <Send className="w-3 h-3" />
                    <span>Test Webhook</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'dlq' && (
        <div className="space-y-4">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-white">Dead-Letter Queue (DLQ) Ledger</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspect undeliverable SIEM webhook dispatches and re-drive failed events once destinations recover.
              </p>
            </div>

            <button
              onClick={handleRedriveDLQ}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-Drive Pending Events</span>
            </button>
          </div>

          {redriveStatus && (
            <div className="bg-indigo-950/40 border border-indigo-500/40 rounded-xl p-3 text-xs text-indigo-300 font-mono">
              {redriveStatus}
            </div>
          )}

          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0B0F17] text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">DLQ ID</th>
                  <th className="py-3 px-4">Webhook ID</th>
                  <th className="py-3 px-4">Error Code</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Failed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {dlqItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No undeliverable webhook dispatches recorded in DLQ.
                    </td>
                  </tr>
                ) : (
                  dlqItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-bold text-white">{item.id}</td>
                      <td className="py-3 px-4 text-cyan-300">{item.webhookId}</td>
                      <td className="py-3 px-4 text-rose-400 font-bold">{item.errorCode}</td>
                      <td className="py-3 px-4">{item.attemptCount}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px]">
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{new Date(item.failedAt).toLocaleTimeString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'evidence' && exportPkg && (
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-sm text-white">Cryptographically Signed Compliance Package</h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">Export ID: {exportPkg.exportId}</p>
            </div>
            <button
              onClick={copySignature}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
            >
              {copiedSig ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSig ? 'Signature Copied' : 'Copy HMAC Signature'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <div className="bg-[#0B0F17] p-4 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Merkle Root Hash</span>
              <span className="font-bold text-cyan-300 truncate block mt-1">{exportPkg.merkleRootHash}</span>
            </div>
            <div className="bg-[#0B0F17] p-4 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Controls Passed</span>
              <span className="font-bold text-emerald-400 block mt-1">
                {exportPkg.passedControls} / {exportPkg.totalControls} ({exportPkg.complianceScore}%)
              </span>
            </div>
            <div className="bg-[#0B0F17] p-4 rounded-xl border border-slate-800">
              <span className="text-slate-500 block text-[10px]">Cryptographic HMAC-SHA256 Signature</span>
              <span className="font-bold text-indigo-300 truncate block mt-1">{exportPkg.cryptographicSignature}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
