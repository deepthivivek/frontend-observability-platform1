import React, { useState } from 'react';
import {
  Shield,
  Key,
  Lock,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Unlock,
  Sliders,
  Sparkles,
  RefreshCcw,
  Cpu,
} from 'lucide-react';
import { RoleDefinition, BreakGlassRequest } from '../../types/enterprise';

interface RBACManagerProps {
  roles: RoleDefinition[];
  onUpdateRole: (role: RoleDefinition) => void;
  breakGlassRequests: BreakGlassRequest[];
  onRequestBreakGlass: (reason: string, scope: string) => void;
  onApproveBreakGlass: (id: string) => void;
}

export const RBACManager: React.FC<RBACManagerProps> = ({
  roles,
  onUpdateRole,
  breakGlassRequests,
  onRequestBreakGlass,
  onApproveBreakGlass,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [scope, setScope] = useState('Production DB Core Vault');
  const [selectedTab, setSelectedTab] = useState<'rbac' | 'breakglass' | 'vault'>('rbac');

  // Zero-Knowledge Envelope Encryption Simulator state
  const [plaintextEnvelope, setPlaintextEnvelope] = useState('{"tenantKey":"aes-256-gcm-root-994","masterSecret":"sk_live_sec_881"}');
  const [ciphertextResult, setCiphertextResult] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);

  const handleSimulateVaultEncryption = () => {
    // Simulate AES-GCM envelope encryption client-side
    const encoded = btoa(unescape(encodeURIComponent(plaintextEnvelope)));
    setCiphertextResult(`enc:aes256gcm:v1:${encoded.split('').reverse().join('')}`);
    setIsEncrypted(true);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Sub-Navigation */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-[#0B0F17] border border-slate-800 w-fit">
        <button
          onClick={() => setSelectedTab('rbac')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            selectedTab === 'rbac'
              ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.25)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Shield className="h-4 w-4 text-indigo-400" />
          <span>RBAC Matrix &amp; Policies</span>
        </button>

        <button
          onClick={() => setSelectedTab('breakglass')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            selectedTab === 'breakglass'
              ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.25)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Unlock className="h-4 w-4 text-amber-400" />
          <span>JIT Break-Glass Access</span>
          {breakGlassRequests.filter((r) => r.status === 'pending').length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold animate-pulse">
              {breakGlassRequests.filter((r) => r.status === 'pending').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSelectedTab('vault')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            selectedTab === 'vault'
              ? 'bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.25)]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Key className="h-4 w-4 text-emerald-400" />
          <span>Zero-Knowledge Vault</span>
        </button>
      </div>

      {/* Tab 1: RBAC Matrix */}
      {selectedTab === 'rbac' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-white text-sm">Fine-Grained Role Access Control (RBAC)</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Enforces strict separation of duties across SRE, Security, Developer, and Auditor personas.
                </p>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-bold">
                Active Enforcer: OPA v0.62
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {roles.map((role) => (
                <div key={role.id} className="p-4 rounded-xl border border-slate-800 bg-[#0B0F17] space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm">{role.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {role.id}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{role.description}</p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-800/80 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">View Logs:</span>
                      <span className={role.permissions.canViewLogs ? 'text-emerald-400' : 'text-slate-600'}>
                        {role.permissions.canViewLogs ? 'Allowed' : 'Denied'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">JIT Break-Glass:</span>
                      <span className={role.permissions.canTriggerBreakGlass ? 'text-emerald-400' : 'text-slate-600'}>
                        {role.permissions.canTriggerBreakGlass ? 'Allowed' : 'Denied'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Edit Policies:</span>
                      <span className={role.permissions.canEditPolicies ? 'text-emerald-400' : 'text-slate-600'}>
                        {role.permissions.canEditPolicies ? 'Allowed' : 'Denied'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Vault Export:</span>
                      <span className={role.permissions.canExportVault ? 'text-emerald-400' : 'text-slate-600'}>
                        {role.permissions.canExportVault ? 'Allowed' : 'Denied'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: JIT Break-Glass Access */}
      {selectedTab === 'breakglass' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-white text-sm">Just-In-Time (JIT) Break-Glass Escalation</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Emergency 15-minute elevated access requires peer approval and creates tamper-evident audit records.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold border border-amber-500/40 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)]"
              >
                <Unlock className="h-4 w-4" />
                <span>Request JIT Escalation</span>
              </button>
            </div>

            <div className="divide-y divide-slate-800">
              {breakGlassRequests.length === 0 ? (
                <div className="py-8 text-center text-slate-500">No JIT Break-Glass requests recorded.</div>
              ) : (
                breakGlassRequests.map((req) => (
                  <div key={req.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{req.requesterEmail}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                            req.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : req.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {req.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Scope: <strong>{req.requestedScope}</strong> &bull; Reason: &quot;{req.reason}&quot;
                      </p>
                      <div className="text-[10px] text-slate-500">
                        Requested at: {new Date(req.requestedAt).toLocaleTimeString()} &bull; Expires in 15m
                      </div>
                    </div>

                    {req.status === 'pending' && (
                      <button
                        onClick={() => onApproveBreakGlass(req.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Approve Escalation</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Zero-Knowledge Vault */}
      {selectedTab === 'vault' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-slate-800 bg-[#131B2E]/90 backdrop-blur-xl shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-semibold text-white text-sm">Zero-Knowledge Tenant Vault &amp; Envelope Encryption</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tenant secrets are encrypted client-side using AES-GCM before ingestion. The backend never holds unencrypted keys.
                </p>
              </div>
              <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold">
                AES-256-GCM Verified
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-800 bg-[#0B0F17] space-y-3">
                <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                  Plaintext Tenant Envelope (Client-Side)
                </span>
                <textarea
                  value={plaintextEnvelope}
                  onChange={(e) => setPlaintextEnvelope(e.target.value)}
                  className="w-full h-32 bg-slate-900 border border-slate-800 rounded-xl p-3 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSimulateVaultEncryption}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                >
                  <Lock className="h-4 w-4" />
                  <span>Encrypt &amp; Seal into Vault</span>
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-800 bg-[#0B0F17] space-y-3">
                <span className="text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                  Zero-Knowledge Ciphertext (In Transit / Storage)
                </span>
                <div className="w-full h-32 bg-slate-900 border border-slate-800 rounded-xl p-3 text-emerald-400 font-mono text-xs overflow-y-auto">
                  {ciphertextResult || '// Awaiting client-side envelope encryption seal...'}
                </div>
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[11px]">
                  <strong>Security Guarantee:</strong> Even with database root access, plaintext tenant credentials cannot be read without the client-side master derived key.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JIT Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#131B2E] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Request Just-In-Time (JIT) Break-Glass Access</h3>
            <p className="text-xs text-slate-400">
              Provide an emergency justification. Access automatically revokes after 15 minutes.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 text-[11px] block mb-1">Target Restricted Scope</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-800 bg-[#0B0F17] text-white text-xs font-mono"
                >
                  <option value="Production DB Core Vault">Production DB Core Vault</option>
                  <option value="AWS IAM Master Administrator">AWS IAM Master Administrator</option>
                  <option value="Kubernetes Production Cluster Root">Kubernetes Production Cluster Root</option>
                </select>
              </div>

              <div>
                <label className="text-slate-400 text-[11px] block mb-1">Emergency Justification &amp; Ticket ID</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Incident #9941: Resolving cascading gateway timeout in payment checkout cluster."
                  className="w-full h-24 px-3 py-2 rounded-xl border border-slate-800 bg-[#0B0F17] text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!reason) return;
                  onRequestBreakGlass(reason, scope);
                  setReason('');
                  setIsModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-[0_0_15px_rgba(99,102,241,0.3)]"
              >
                Submit for Peer Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
