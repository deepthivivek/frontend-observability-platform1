import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ComplianceView } from '../components/compliance/ComplianceView';

const mockAuditData = {
  totalControls: 6,
  passedControls: 6,
  complianceScore: 100,
  controls: [
    {
      id: 'soc2-cc6-1',
      standard: 'SOC2',
      category: 'Access Control',
      title: 'Logical Access Security & RBAC',
      description: 'Multi-role permission matrix enforcement',
      status: 'PASSED',
      lastAssessedAt: Date.now(),
      evidenceRef: 'RBACManager.tsx',
    },
  ],
};

const mockWebhooks = [
  {
    id: 'wh-splunk-core',
    name: 'Splunk Enterprise Security Receiver',
    destinationUrl: 'https://siem.internal.corp/services/collector/raw',
    secretToken: 'splunk-secret-token-991',
    eventTypeFilter: ['SECURITY_ALERT'],
    enabled: true,
    successCount: 1420,
    failureCount: 0,
  },
];

const mockDLQ = {
  total: 1,
  items: [
    {
      id: 'dlq-101',
      webhookId: 'wh-splunk-core',
      destinationUrl: 'https://siem.internal.corp/collect',
      payload: { alert: 'test' },
      errorCode: 'HTTP_503',
      errorMessage: 'Service Unavailable',
      attemptCount: 3,
      failedAt: Date.now(),
      status: 'PENDING_REDRIVE',
    },
  ],
};

const mockExportPkg = {
  exportId: 'export-test-99',
  generatedAt: Date.now(),
  signedBy: 'Compliance Officer',
  merkleRootHash: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
  totalControls: 6,
  passedControls: 6,
  complianceScore: 100,
  controls: mockAuditData.controls,
  auditLogsCount: 420,
  cryptographicSignature: '99887766554433221100abcdef0123456789abcdef0123456789abcdef012345',
};

describe('Compliance Studio Suite (Day 14 Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/compliance/audit')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockAuditData) });
      }
      if (url.includes('/api/v1/compliance/siem/webhooks')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockWebhooks) });
      }
      if (url.includes('/api/v1/compliance/siem/dlq/redrive')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ redrivedCount: 1, totalAttempted: 1 }) });
      }
      if (url.includes('/api/v1/compliance/siem/dlq')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDLQ) });
      }
      if (url.includes('/api/v1/compliance/export')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockExportPkg) });
      }
      if (url.includes('/api/v1/compliance/siem/dispatch')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ dispatched: true }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;
  });

  it('renders control matrix, SIEM webhooks, DLQ items, and signed evidence package', async () => {
    render(<ComplianceView canViewCompliance={true} canConfigureSIEM={true} />);

    await waitFor(() => {
      expect(screen.getByText('SOC2 & GDPR Compliance Studio')).toBeInTheDocument();
    });

    expect(screen.getByText('Logical Access Security & RBAC')).toBeInTheDocument();
    expect(screen.getByText('SCORE: 100% COMPLIANT')).toBeInTheDocument();

    // Switch to SIEM Webhook tab
    const siemTab = screen.getByRole('button', { name: /SIEM Webhook Dispatcher/i });
    fireEvent.click(siemTab);

    await waitFor(() => {
      expect(screen.getByText('Splunk Enterprise Security Receiver')).toBeInTheDocument();
    });

    // Test webhook button click
    const testBtn = screen.getByRole('button', { name: /Test Webhook/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(screen.getByText(/Webhook dispatched successfully/i)).toBeInTheDocument();
    });

    // Switch to DLQ Tab
    const dlqTab = screen.getByRole('button', { name: /Dead-Letter Queue/i });
    fireEvent.click(dlqTab);

    await waitFor(() => {
      expect(screen.getByText('dlq-101')).toBeInTheDocument();
      expect(screen.getByText('HTTP_503')).toBeInTheDocument();
    });

    // Click Re-Drive
    const redriveBtn = screen.getByRole('button', { name: /Re-Drive Pending Events/i });
    fireEvent.click(redriveBtn);

    await waitFor(() => {
      expect(screen.getByText(/Successfully redrived 1 \/ 1 events/i)).toBeInTheDocument();
    });

    // Switch to Evidence Tab
    const evidenceTab = screen.getByRole('button', { name: /Signed Evidence & Merkle Package/i });
    fireEvent.click(evidenceTab);

    await waitFor(() => {
      expect(screen.getByText('Cryptographically Signed Compliance Package')).toBeInTheDocument();
      expect(screen.getByText('abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789')).toBeInTheDocument();
    });
  });
});
