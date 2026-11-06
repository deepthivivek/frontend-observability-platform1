import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IncidentCommandCenter } from '../components/incident/IncidentCommandCenter';
import { IncidentChatDrawer } from '../components/incident/IncidentChatDrawer';
import { RunbookActionModal } from '../components/incident/RunbookActionModal';
import { BlastRadiusVisualizer } from '../components/incident/BlastRadiusVisualizer';
import { PostMortemView } from '../components/incident/PostMortemView';
import { Incident, RunbookDefinition } from '../types/incident';

const mockIncident: Incident = {
  id: 'inc-test-8812',
  title: 'Cascading Connection Pool Exhaustion on inventory-db',
  description: 'Spike in checkout transactions exhausted connection limits on inventory-db',
  severity: 'P1-CRITICAL',
  status: 'IDENTIFIED',
  startedAt: 1700000000000,
  leadSre: 'Alex Rivera (SRE Staff)',
  primaryService: 'inventory-db',
  affectedServices: ['api-gateway', 'checkout-service', 'inventory-db'],
  errorRatePeak: 19.4,
  p99LatencyMs: 1680,
  blastRadius: {
    affectedUserSessions: 12450,
    frustrationScore: 88,
    revenueImpactEstimated: 24500,
    directServices: ['inventory-db'],
    downstreamServices: ['checkout-service', 'api-gateway'],
    sloBurnRate: 18.2,
  },
  rootCause: 'PgBouncer connection pool starved by deadlock table lock in reservations.',
  timeline: [
    {
      timestamp: 1700000000000,
      type: 'DETECTION',
      message: 'Z-score detector flagged 4.6σ latency surge on /checkout',
      actor: 'AnomalyDetectorBot',
    },
    {
      timestamp: 1700000060000,
      type: 'INVESTIGATION',
      message: 'Alex Rivera verified pool exhaustion',
      actor: 'Alex Rivera',
    },
  ],
  correlatedTraceIds: ['tr-cascade-504-01'],
  topErrors: [
    {
      service: 'inventory-db',
      message: 'FATAL: remaining connection slots are reserved for non-replication superuser connections',
      count: 1420,
      stack: 'Error: Connection pool exhausted\n    at Pool.connect (/app/db.js:10:1)',
    },
  ],
  suggestedRunbooks: [
    {
      actionId: 'FLUSH_CONNECTION_POOL',
      title: 'Drain Stale Database Connections',
      description: 'Terminates idle connections on PgBouncer to restore pool slots.',
      riskLevel: 'HIGH',
      requiresHitlApproval: true,
      targetService: 'inventory-db',
    },
    {
      actionId: 'CIRCUIT_BREAKER_RESET',
      title: 'Trip & Reset Gateway Circuit Breaker',
      description: 'Enables fast-fail shedding on upstream api-gateway.',
      riskLevel: 'LOW',
      requiresHitlApproval: false,
      targetService: 'api-gateway',
    },
  ],
};

const mockPostMortem = {
  incidentId: 'inc-test-8812',
  title: 'Post-Mortem: Cascading Connection Pool Exhaustion on inventory-db',
  generatedAt: 1700001000000,
  author: 'Neon Chasm SRE Lead',
  markdown: '# Post-Mortem: Cascading Connection Pool Exhaustion\n\n## 1. Executive Summary\nIncident resolved.',
  sections: {
    executiveSummary: 'Executive summary text of the incident.',
    timeline: ['Timeline event 1'],
    impact: '12,450 sessions impacted.',
    rootCause: 'Connection pool starved.',
    triggerRemediations: ['FLUSH_CONNECTION_POOL'],
    actionItems: [
      { priority: 'P0' as const, task: 'Increase connection pool bounds', owner: 'Alex Rivera', status: 'TODO' as const },
    ],
    lessonsLearned: {
      whatWentWell: ['Fast detection'],
      whatWentPoorly: ['Slow manual escalation'],
      whereWeGotLucky: ['Read replica held up'],
    },
  },
};

describe('AI Incident Command Center & Safety Suite (Day 13 Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/incidents/chat')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              message: 'Analysis: Observed 4.6σ latency surge on inventory-db.',
              rootCause: 'Connection starvation in PgBouncer pool.',
              affectedMicroservices: ['inventory-db', 'checkout-service'],
              recommendedRunbooks: mockIncident.suggestedRunbooks,
              blastRadiusSummary: '12,450 sessions affected',
              zScoreImpact: 4.6,
            }),
        });
      }
      if (url.includes('/post-mortem')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockPostMortem),
        });
      }
      if (url.includes('/remediate')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              executionId: 'exec-test-1',
              actionId: 'FLUSH_CONNECTION_POOL',
              status: 'SUCCESS',
              targetService: 'inventory-db',
              durationMs: 42,
              stdout: ['Connecting to PgBouncer...', 'Gracefully terminated 74 hanging backend queries.'],
              stderr: [],
              dryRun: true,
              auditEventId: 'aud-test-receipt',
              auditSignature: 'hmac-test-sig',
              executedBy: 'Alex Rivera',
              timestamp: Date.now(),
              riskLevel: 'HIGH',
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            total: 1,
            activeCount: 1,
            incidents: [mockIncident],
          }),
      });
    }) as unknown as typeof fetch;
  });

  describe('IncidentCommandCenter Component', () => {
    it('renders active incident details, metrics, and switches between navigation tabs', async () => {
      render(<IncidentCommandCenter canViewIncidents={true} canExecuteRunbooks={true} />);

      await waitFor(() => {
        expect(screen.getByText('AI Incident Command Center')).toBeInTheDocument();
      });

      expect(screen.getByText(/Cascading Connection Pool Exhaustion on inventory-db/i)).toBeInTheDocument();
      expect(screen.getByText('19.4%')).toBeInTheDocument();
      expect(screen.getByText('1680ms')).toBeInTheDocument();

      // Click Blast Radius Visualizer tab
      const blastRadiusTab = screen.getByRole('button', { name: /Blast Radius Visualizer/i });
      fireEvent.click(blastRadiusTab);

      await waitFor(() => {
        expect(screen.getByText('Real User Monitoring Impact')).toBeInTheDocument();
        expect(screen.getByText('Cascading Microservice Blast Radius')).toBeInTheDocument();
      });
    });
  });

  describe('IncidentChatDrawer Component', () => {
    it('renders quick prompt chips and handles prompt interaction', async () => {
      render(
        <IncidentChatDrawer
          isOpen={true}
          onClose={vi.fn()}
          incident={mockIncident}
          currentUser={{ name: 'Alex Rivera', role: 'SRE Staff' }}
        />
      );

      expect(screen.getByText('AI Incident Triage Copilot')).toBeInTheDocument();
      expect(screen.getByText('Analyze Error Logs')).toBeInTheDocument();
      expect(screen.getByText('Check Database Locks')).toBeInTheDocument();

      // Click a prompt chip
      const chip = screen.getByText('Explain Root Cause');
      fireEvent.click(chip);

      await waitFor(() => {
        expect(screen.getByText(/Observed 4.6σ latency surge on inventory-db/i)).toBeInTheDocument();
      });
    });
  });

  describe('RunbookActionModal Component', () => {
    it('enforces HITL authorization for HIGH-risk runbooks and allows dry run execution', async () => {
      const highRiskRunbook: RunbookDefinition = mockIncident.suggestedRunbooks[0];

      render(
        <RunbookActionModal
          isOpen={true}
          onClose={vi.fn()}
          runbook={highRiskRunbook}
          incidentId={mockIncident.id}
          canExecuteRunbooks={true}
          currentUser={{ name: 'Alex Rivera', role: 'SRE Lead' }}
        />
      );

      expect(screen.getByText('Drain Stale Database Connections')).toBeInTheDocument();
      expect(screen.getByText('HIGH RISK')).toBeInTheDocument();
      expect(screen.getByText(/Human-in-the-Loop \(HITL\) Policy Enforcement/i)).toBeInTheDocument();

      // Authorize & Execute button should be disabled without checkbox confirmation
      const executeBtn = screen.getByRole('button', { name: /Authorize & Execute/i });
      expect(executeBtn).toBeDisabled();

      // Click checkbox confirmation
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(executeBtn).not.toBeDisabled();

      // Click Simulate Dry Run
      const dryRunBtn = screen.getByRole('button', { name: /Simulate Dry Run/i });
      fireEvent.click(dryRunBtn);

      await waitFor(() => {
        expect(screen.getByText('Execution Output Stream')).toBeInTheDocument();
        expect(screen.getByText(/Gracefully terminated 74 hanging backend queries/i)).toBeInTheDocument();
        expect(screen.getByText(/Cryptographic Audit Receipt/i)).toBeInTheDocument();
      });
    });
  });

  describe('BlastRadiusVisualizer Component', () => {
    it('renders impact metrics and microservice cascade tree', () => {
      render(<BlastRadiusVisualizer incident={mockIncident} />);

      expect(screen.getByText('12,450')).toBeInTheDocument();
      expect(screen.getByText('88')).toBeInTheDocument();
      expect(screen.getByText('18.2x')).toBeInTheDocument();
      expect(screen.getByText('$24,500')).toBeInTheDocument();
      expect(screen.getByText('Root Failure Zone')).toBeInTheDocument();
      expect(screen.getByText('Downstream Impact Zone')).toBeInTheDocument();
    });
  });

  describe('PostMortemView Component', () => {
    it('renders post-mortem report and toggles between formatted and raw markdown views', async () => {
      render(<PostMortemView incident={mockIncident} />);

      await waitFor(() => {
        expect(screen.getByText('Automated Blameless Post-Mortem Studio')).toBeInTheDocument();
      });

      expect(screen.getByText('1. Executive Summary')).toBeInTheDocument();
      expect(screen.getByText('4. Preventative Action Items (Jira-Ready)')).toBeInTheDocument();

      // Switch to Raw Markdown
      const rawTab = screen.getByRole('button', { name: /Raw Markdown \(\.md\)/i });
      fireEvent.click(rawTab);

      expect(screen.getByText(/Source Markdown \(CommonMark Compatible\)/i)).toBeInTheDocument();
    });
  });
});
