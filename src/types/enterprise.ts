export interface Workspace {
  id: string;
  name: string;
  region: 'US-East' | 'EU-Central' | 'AP-South';
  mTLSRequired: boolean;
  encryptionAtRest: boolean;
  idleTimeoutMinutes: number;
  activeEndpoint: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  permissions: {
    canViewLogs: boolean;
    canTriggerBreakGlass: boolean;
    canEditPolicies: boolean;
    canExportVault: boolean;
    canManageWorkspaces: boolean;
    canViewTraces?: boolean;
    canViewIncidents?: boolean;
    canExecuteRunbooks?: boolean;
    canViewCompliance?: boolean;
    canConfigureSIEM?: boolean;
    canViewSynthetic?: boolean;
    canManageSynthetic?: boolean;
    canViewGovernance?: boolean;
    canManageGovernance?: boolean;
  };
}

export interface BreakGlassRequest {
  id: string;
  requesterEmail: string;
  reason: string;
  requestedScope: string;
  status: 'pending' | 'approved' | 'expired';
  requestedAt: number;
  expiresAt: number;
  approver?: string;
}

export interface AuditLogEvent {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  targetResource: string;
  previousHash: string;
  hash: string;
  signature: string;
}

export interface ComplianceViolation {
  id: string;
  standard: 'SOC2' | 'GDPR' | 'HIPAA';
  severity: 'critical' | 'warning';
  title: string;
  remediation: string;
}
