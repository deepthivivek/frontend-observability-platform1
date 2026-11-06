import React from 'react';
import {
  Globe,
  Server,
  Shield,
  CheckCircle2,
  Lock,
  Layers,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { Workspace } from '../../types/enterprise';

interface WorkspaceSelectorProps {
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  onSelectWorkspace: (ws: Workspace) => void;
  onUpdateConfig: (wsId: string, updates: Partial<Workspace>) => void;
}

export const WorkspaceSelector: React.FC<WorkspaceSelectorProps> = ({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  onUpdateConfig,
}) => {
  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Workspace Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">Multi-Tenant Workspace &amp; Sovereignty Governance</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Active Environment: <strong className="text-white">{activeWorkspace.name}</strong> ({activeWorkspace.region})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">Switch Tenant:</span>
          <select
            value={activeWorkspace.id}
            onChange={(e) => {
              const found = workspaces.find((w) => w.id === e.target.value);
              if (found) onSelectWorkspace(found);
            }}
            className="px-3 py-2 rounded-xl border border-slate-800 bg-[#0B0F17] text-white text-xs font-mono font-semibold focus:outline-none focus:border-indigo-500"
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name} ({ws.region})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Workspace Configuration & Security Settings */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white">
            <Server className="h-4 w-4 text-emerald-400" />
            <h3 className="font-semibold text-sm">Tenant Sovereignty &amp; Security Controls</h3>
          </div>
          <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold">
            Isolated Ingestion Router Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-800 bg-[#0B0F17] space-y-3">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Endpoint Ingestion URL</span>
            <input
              type="text"
              readOnly
              value={activeWorkspace.activeEndpoint}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-indigo-300 font-mono text-xs"
            />
            <p className="text-[10px] text-slate-500">All telemetry batches are routed directly to regional edge nodes.</p>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-[#0B0F17] space-y-3">
            <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">Security Enforcement Toggles</span>
            <div className="space-y-2 pt-1">
              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Enforce Mutual TLS (mTLS)</span>
                <input
                  type="checkbox"
                  checked={activeWorkspace.mTLSRequired}
                  onChange={(e) => onUpdateConfig(activeWorkspace.id, { mTLSRequired: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Zero-Knowledge Envelope Encryption at Rest</span>
                <input
                  type="checkbox"
                  checked={activeWorkspace.encryptionAtRest}
                  onChange={(e) => onUpdateConfig(activeWorkspace.id, { encryptionAtRest: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
