'use client';

import React, { useState } from 'react';
import { NotificationChannel, OnCallShift } from '../../types/alert';
import {
  Bell,
  CheckCircle2,
  AlertOctagon,
  Users,
  Send,
  Radio,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface NotificationChannelsProps {
  channels: NotificationChannel[];
  onCall: OnCallShift;
  onSendTestNotification: (channelId: string) => Promise<boolean>;
}

export const NotificationChannels: React.FC<NotificationChannelsProps> = ({
  channels,
  onCall,
  onSendTestNotification,
}) => {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean } | null>(null);

  const handleTest = async (channelId: string) => {
    setTestingId(channelId);
    setTestResult(null);
    const success = await onSendTestNotification(channelId);
    setTestingId(null);
    setTestResult({ id: channelId, success });
    setTimeout(() => setTestResult(null), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 font-mono text-xs">
      {/* 1. Notification Dispatch Channels & Synthetic Canary Probes */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E]/80 p-5 backdrop-blur-xl shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-white">Notification Canaries &amp; Webhooks</h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Automated Canary Probes</span>
          </div>

          <div className="mt-3 space-y-2.5">
            {channels.map((chan) => {
              const isHealthy = chan.status === 'healthy';
              const isTesting = testingId === chan.id;
              const hasTested = testResult?.id === chan.id;

              return (
                <div
                  key={chan.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-[#0B0F17]/80 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isHealthy
                          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                          : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                      }`}
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">{chan.name}</span>
                      <span className="text-[10px] text-slate-500 truncate max-w-xs">
                        {chan.endpointOrKey}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTest(chan.id)}
                      disabled={isTesting}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors disabled:opacity-50"
                    >
                      <Send className="h-3 w-3 text-indigo-400" />
                      <span>{isTesting ? 'Pinging...' : hasTested ? (testResult?.success ? '200 OK' : 'Failed') : 'Test Canary'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
          <span>Continuous webhook synthetic probes run every 60 seconds</span>
          <span className="text-emerald-400 font-medium">SLAs 100% reachable</span>
        </div>
      </div>

      {/* 2. On-Call Rotation Schedule & Roster */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#131B2E]/80 p-5 backdrop-blur-xl shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">Active On-Call Rotation</h3>
            </div>
            <span className="text-[11px] text-indigo-400 font-bold">{onCall.rotationName}</span>
          </div>

          <div className="mt-4 space-y-3">
            <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-400 block">
                  Primary On-Call Responder
                </span>
                <span className="text-sm font-semibold text-white">{onCall.primary}</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-600/40 text-indigo-200 border border-indigo-400/40">
                Paging Active
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-800 bg-[#0B0F17]/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Secondary Escalation Responder
                </span>
                <span className="text-sm font-semibold text-slate-300">{onCall.secondary}</span>
              </div>
              <span className="text-slate-500 text-[10px]">Auto-escalates at 5m</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
          <span>Shift handoff: {new Date(onCall.untilIso).toLocaleDateString()} at 09:00 UTC</span>
          <span className="text-indigo-400 font-medium">PagerDuty Synced</span>
        </div>
      </div>
    </div>
  );
};
