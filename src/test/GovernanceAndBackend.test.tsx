import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RBACManager } from '../components/enterprise/RBACManager';
import { AuditTrail } from '../components/enterprise/AuditTrail';
import { WorkspaceSelector } from '../components/enterprise/WorkspaceSelector';
import { RoleDefinition, BreakGlassRequest, AuditLogEvent, ComplianceViolation, Workspace } from '../types/enterprise';

const mockRoles: RoleDefinition[] = [
  {
    id: 'role-admin',
    name: 'Administrator',
    description: 'Full cluster privileges.',
    permissions: { canViewLogs: true, canTriggerBreakGlass: true, canEditPolicies: true, canExportVault: true, canManageWorkspaces: true },
  },
];

const mockBreakGlass: BreakGlassRequest[] = [
  {
    id: 'bg-1',
    requesterEmail: 'test@neonchasm.io',
    reason: 'Emergency database fix',
    requestedScope: 'Production DB Core Vault',
    status: 'pending',
    requestedAt: Date.now(),
    expiresAt: Date.now() + 900000,
  },
];

const mockAuditLogs: AuditLogEvent[] = [
  {
    id: 'aud-1',
    timestamp: Date.now(),
    actor: 'admin@neonchasm.io',
    action: 'POLICY_UPDATE',
    targetResource: 'pol-sovereignty',
    previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    signature: 'sig_valid_123',
  },
];

const mockViolations: ComplianceViolation[] = [
  {
    id: 'vio-1',
    standard: 'SOC2',
    severity: 'warning',
    title: 'mTLS certificate rotation due',
    remediation: 'Renew client certs.',
  },
];

const mockWorkspaces: Workspace[] = [
  {
    id: 'ws-prod',
    name: 'Production US Core',
    region: 'US-East',
    mTLSRequired: true,
    encryptionAtRest: true,
    idleTimeoutMinutes: 10,
    activeEndpoint: 'https://ingest.us.internal/v1',
  },
];

describe('Enterprise Governance & Backend Suite (Day 10)', () => {
  it('renders RBACManager and switches to break-glass tab to view requests', () => {
    render(
      <RBACManager
        roles={mockRoles}
        onUpdateRole={vi.fn()}
        breakGlassRequests={mockBreakGlass}
        onRequestBreakGlass={vi.fn()}
        onApproveBreakGlass={vi.fn()}
      />
    );

    expect(screen.getByText('Administrator')).toBeInTheDocument();

    const breakGlassTab = screen.getByRole('button', { name: /JIT Break-Glass Access/i });
    fireEvent.click(breakGlassTab);

    expect(screen.getByText('test@neonchasm.io')).toBeInTheDocument();
  });

  it('renders AuditTrail with Merkle hash chain and compliance violations', () => {
    render(
      <AuditTrail
        auditLogs={mockAuditLogs}
        violations={mockViolations}
        onRunComplianceScan={vi.fn()}
        isScanning={false}
      />
    );

    expect(screen.getByText('100% Verified')).toBeInTheDocument();
    expect(screen.getByText(/mTLS certificate rotation due/i)).toBeInTheDocument();
  });

  it('renders WorkspaceSelector with active tenant endpoint', () => {
    render(
      <WorkspaceSelector
        workspaces={mockWorkspaces}
        activeWorkspace={mockWorkspaces[0]}
        onSelectWorkspace={vi.fn()}
        onUpdateConfig={vi.fn()}
      />
    );

    expect(screen.getByText('Production US Core')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://ingest.us.internal/v1')).toBeInTheDocument();
  });
});
