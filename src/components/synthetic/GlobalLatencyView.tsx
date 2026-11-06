'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Activity,
  ShieldCheck,
  ShieldAlert,
  Play,
  RotateCw,
  Plus,
  X,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  Server,
  Zap,
} from 'lucide-react';
import {
  ProbeRegion,
  SyntheticProbeResult,
  SSLCertificateInfo,
  DNSIntegrityReport,
  SyntheticProbeConfig,
  JourneyStep,
} from '../../types/synthetic';

interface GlobalLatencyViewProps {
  canViewSynthetic?: boolean;
  canManageSynthetic?: boolean;
}

export const GlobalLatencyView: React.FC<GlobalLatencyViewProps> = ({
  canViewSynthetic = true,
  canManageSynthetic = true,
}) => {
  const [activeTab, setActiveTab] = useState<'regions' | 'ssl_dns' | 'journey' | 'waterfall'>('regions');
  const [probes, setProbes] = useState<SyntheticProbeConfig[]>([]);
  const [selectedProbeId, setSelectedProbeId] = useState<string>('probe-checkout-flow');
  const [probeResults, setProbeResults] = useState<SyntheticProbeResult[]>([]);
  const [sslInfo, setSslInfo] = useState<SSLCertificateInfo | null>(null);
  const [dnsReport, setDnsReport] = useState<DNSIntegrityReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Probe Modal Form State
  const [newProbeName, setNewProbeName] = useState('');
  const [newProbeUrl, setNewProbeUrl] = useState('https://api.neonchasm.io/v1/checkout');
  const [newProbeInterval, setNewProbeInterval] = useState(60);

  const fetchProbeData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [probesRes, probeRunRes, sslRes, dnsRes] = await Promise.all([
        fetch('/api/v1/synthetic/probes'),
        fetch('/api/v1/synthetic/probe/run?url=https://api.neonchasm.io/health'),
        fetch('/api/v1/synthetic/ssl/inspect?domain=api.neonchasm.io'),
        fetch('/api/v1/synthetic/dns/inspect?domain=api.neonchasm.io'),
      ]);

      if (probesRes.ok) {
        const pData = await probesRes.json();
        setProbes(pData.probes || []);
      }
      if (probeRunRes.ok) {
        const runData = await probeRunRes.json();
        setProbeResults(runData.results || []);
      }
      if (sslRes.ok) {
        const certData = await sslRes.json();
        setSslInfo(certData);
      }
      if (dnsRes.ok) {
        const dnsData = await dnsRes.json();
        setDnsReport(dnsData);
      }
    } catch (err) {
      console.error('Failed to load synthetic monitoring suite data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (mounted) {
        await fetchProbeData();
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [fetchProbeData]);

  const handleCreateProbe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProbeName || !newProbeUrl) return;

    const newProbe: SyntheticProbeConfig = {
      id: `probe-${Date.now()}`,
      name: newProbeName,
      type: 'SINGLE_ENDPOINT',
      targetUrl: newProbeUrl,
      regions: ['US-East', 'EU-Central', 'AP-East'],
      intervalSeconds: newProbeInterval,
      enabled: true,
      sslMonitorEnabled: true,
      dnsIntegrityEnabled: true,
      overallStatus: 'HEALTHY',
      uptimePercentage: 100.0,
    };

    try {
      const res = await fetch('/api/v1/synthetic/probes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProbe),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setNewProbeName('');
        fetchProbeData();
      }
    } catch (err) {
      console.error('Failed to save probe:', err);
    }
  };

  const activeProbeConfig = probes.find((p) => p.id === selectedProbeId) || probes[0];

  if (!canViewSynthetic) {
    return (
      <div className="p-8 text-center bg-[#0F172A] border border-slate-800 rounded-2xl text-slate-400 space-y-3">
        <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
        <h3 className="font-semibold text-white">Synthetic Monitoring Access Restricted</h3>
        <p className="text-xs max-w-md mx-auto">
          Your current role does not have <code className="text-cyan-300">canViewSynthetic</code> permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-lg font-bold text-white tracking-wide">Global Synthetic & Latency Map</h2>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                99.98% GLOBAL SLO UPTIME
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-region edge probers, scripted API transactions, SSL/TLS expiry alerts, and DNS BGP hijack detection.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchProbeData}
            disabled={isLoading}
            className="flex items-center space-x-1.5 bg-[#0B0F17] hover:bg-slate-800 border border-slate-700 text-slate-300 px-3.5 py-2 rounded-xl text-xs font-mono transition disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Run All Probes</span>
          </button>

          {canManageSynthetic && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Configure Probe</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 font-mono text-xs">
        <button
          onClick={() => setActiveTab('regions')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'regions'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Regional Edge Latency Matrix</span>
        </button>

        <button
          onClick={() => setActiveTab('ssl_dns')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'ssl_dns'
              ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>SSL/TLS Expiry & DNS Parity</span>
        </button>

        <button
          onClick={() => setActiveTab('journey')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'journey'
              ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Multi-Step Scripted Journeys</span>
        </button>

        <button
          onClick={() => setActiveTab('waterfall')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition ${
            activeTab === 'waterfall'
              ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Probe Timing Waterfall</span>
        </button>
      </div>

      {/* 3. Tab Content Panels */}
      {activeTab === 'regions' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {probeResults.map((res) => (
              <div
                key={res.region}
                className="bg-[#0F172A] border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white uppercase font-mono">{res.region}</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${
                      res.success
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    {res.statusCode} OK
                  </span>
                </div>

                <div className="mt-2">
                  <div className="text-2xl font-bold font-mono text-cyan-300">{res.timings.totalDurationMs}ms</div>
                  <span className="text-[10px] font-mono text-slate-500">TTFB: {res.timings.ttfbMs}ms</span>
                </div>

                <div className="pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400 truncate">
                  IP: <span className="text-slate-200">{res.resolvedIp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'ssl_dns' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SSL/TLS Certificate Monitor Card */}
          {sslInfo && (
            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-bold text-white uppercase tracking-wider">SSL/TLS Certificate Inspection</h4>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    sslInfo.warningAlertTriggered
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {sslInfo.daysRemaining} DAYS REMAINING
                </span>
              </div>

              <div className="space-y-2 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Domain:</span>
                  <span className="text-white font-bold">{sslInfo.domain}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Issuer Authority:</span>
                  <span className="text-slate-200">{sslInfo.issuer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cipher Suite:</span>
                  <span className="text-cyan-300 font-bold">{sslInfo.cipherSuite}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Key Strength:</span>
                  <span className="text-slate-200">{sslInfo.keyStrengthBits} bits RSA</span>
                </div>
              </div>
            </div>
          )}

          {/* DNS Integrity & BGP Hijack Inspector Card */}
          {dnsReport && (
            <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <h4 className="font-bold text-white uppercase tracking-wider">Global DNS & BGP Parity</h4>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    dnsReport.hasPoisoningOrHijack
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {dnsReport.hasPoisoningOrHijack ? 'HIJACK DETECTED' : 'ANYCAST MATCHED'}
                </span>
              </div>

              <div className="space-y-2 text-slate-300">
                {dnsReport.regionalResolutions.map((res) => (
                  <div key={res.region} className="flex items-center justify-between bg-[#0B0F17] p-2.5 rounded-lg border border-slate-800">
                    <span className="font-bold text-white uppercase">{res.region}</span>
                    <span className="text-cyan-300">{res.ip}</span>
                    <span className="text-emerald-400 font-bold">{res.dnsLatencyMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'journey' && activeProbeConfig && (
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h4 className="font-bold text-white uppercase tracking-wider">{activeProbeConfig.name}</h4>
            <span className="text-slate-400">{activeProbeConfig.journeySteps?.length || 0} Scripted Steps</span>
          </div>

          <div className="space-y-3">
            {activeProbeConfig.journeySteps?.map((step, idx) => (
              <div key={step.id} className="bg-[#0B0F17] border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[10px]">
                      STEP {idx + 1}
                    </span>
                    <span className="font-bold text-white">{step.name}</span>
                  </div>
                  <span className="text-cyan-300 font-bold">{step.method} {step.url}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'waterfall' && (
        <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 font-mono text-xs">
          <div className="border-b border-slate-800 pb-3 font-bold text-white uppercase tracking-wider">
            Probe Latency Phase Breakdown (US-East Edge Agent)
          </div>

          <div className="space-y-3">
            {[
              { label: 'DNS Lookup', value: '4ms', color: 'bg-cyan-500' },
              { label: 'TCP Handshake', value: '9ms', color: 'bg-indigo-500' },
              { label: 'TLS Handshake', value: '14ms', color: 'bg-purple-500' },
              { label: 'TTFB (Server Processing)', value: '32ms', color: 'bg-emerald-500' },
            ].map((phase) => (
              <div key={phase.label} className="space-y-1">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>{phase.label}</span>
                  <span className="text-white font-bold">{phase.value}</span>
                </div>
                <div className="w-full bg-[#0B0F17] h-2 rounded-full overflow-hidden">
                  <div className={`h-full ${phase.color}`} style={{ width: '40%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configure Probe Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0F172A] border border-slate-800 rounded-2xl p-6 w-full max-w-lg space-y-4 text-white font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm">Configure Synthetic Probe</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProbe} className="space-y-4 font-sans text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 font-mono">Probe Name</label>
                <input
                  type="text"
                  value={newProbeName}
                  onChange={(e) => setNewProbeName(e.target.value)}
                  placeholder="e.g. EU Regional Health Check"
                  required
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-mono">Target URL</label>
                <input
                  type="url"
                  value={newProbeUrl}
                  onChange={(e) => setNewProbeUrl(e.target.value)}
                  required
                  className="w-full bg-[#0B0F17] border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                >
                  Save Probe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
