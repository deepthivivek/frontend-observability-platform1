import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import { AlertRuleBuilder } from '../components/alerts/AlertRuleBuilder';
import { ActiveIncidentsBanner } from '../components/alerts/ActiveIncidentsBanner';
import { NotificationChannels } from '../components/alerts/NotificationChannels';
import { useAlertEvaluator } from '../hooks/useAlertEvaluator';
import { AlertRule, Incident, NotificationChannel, OnCallShift } from '../types/alert';
import { AggregatedMetrics, ApiRequestLog } from '../types/telemetry';

const mockRule: AlertRule = {
  id: 'rule-test-p99',
  name: 'P99 Latency SLA Violation',
  metric: 'latency',
  operator: '>',
  threshold: 250,
  unit: 'ms',
  windowMinutes: 5,
  environment: 'Production',
  serviceScope: 'api-gateway',
  severity: 'P1-Critical',
  flappingDampingCount: 2,
  autoEscalateMinutes: 5,
  remediationAction: 'Flush Redis Cache',
  enabled: true,
};

const mockIncident: Incident = {
  id: 'inc-test-001',
  ruleId: 'rule-test-p99',
  title: 'P99 Latency SLA Violation',
  severity: 'P1-Critical',
  status: 'firing',
  startedAt: Date.now() - 1000 * 60 * 15,
  currentValue: 340,
  threshold: 250,
  environment: 'Production',
  service: 'api-gateway',
  rootCauseTraceId: '00-test-trace-99182',
  subAlertsCount: 4,
  timeline: [
    {
      timestamp: Date.now() - 1000 * 60 * 15,
      event: 'Threshold violated: observed 340ms (> 250ms)',
      metricValue: 340,
    },
  ],
};

const mockChannels: NotificationChannel[] = [
  {
    id: 'chan-slack',
    name: '#sre-alerts',
    type: 'slack',
    endpointOrKey: 'https://hooks.slack.com/services/test',
    status: 'healthy',
    lastPingTimestamp: Date.now() - 1000 * 60 * 5,
  },
  {
    id: 'chan-pagerduty',
    name: 'PagerDuty SRE Primary',
    type: 'pagerduty',
    endpointOrKey: 'pd-service-01',
    status: 'healthy',
    lastPingTimestamp: Date.now() - 1000 * 60 * 10,
  },
];

const mockOnCall: OnCallShift = {
  primary: 'Elena Vance (Principal SRE)',
  secondary: 'Marcus Chen (Staff DevOps)',
  rotationName: 'Global Follow-the-Sun',
  untilIso: new Date(Date.now() + 86400000 * 2).toISOString(),
};

describe('AlertRuleBuilder Component', () => {
  it('renders modal when isOpen is true and submits a new rule', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <AlertRuleBuilder
        isOpen={true}
        onClose={handleClose}
        onSaveRule={handleSave}
      />
    );

    expect(screen.getByText('Alert Rule Builder & Scoping')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText(/e\.g\. Critical P99 Payment Latency Degradation/i);
    fireEvent.change(nameInput, { target: { value: 'High 5xx Spike' } });

    const thresholdInput = screen.getByDisplayValue('250');
    fireEvent.change(thresholdInput, { target: { value: '400' } });

    const submitBtn = screen.getByText('Save Alert Rule');
    fireEvent.click(submitBtn);

    expect(handleSave).toHaveBeenCalledTimes(1);
    const savedRule = handleSave.mock.calls[0][0];
    expect(savedRule.name).toBe('High 5xx Spike');
    expect(savedRule.threshold).toBe(400);
    expect(savedRule.enabled).toBe(true);
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <AlertRuleBuilder
        isOpen={false}
        onClose={vi.fn()}
        onSaveRule={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('ActiveIncidentsBanner Component', () => {
  it('renders empty state when no incidents are present', () => {
    render(
      <ActiveIncidentsBanner
        incidents={[]}
        onAcknowledge={vi.fn()}
        onResolve={vi.fn()}
        onInspectTrace={vi.fn()}
        onTriggerRemediation={vi.fn()}
      />
    );

    expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
  });

  it('renders firing incident, root cause trace link, and triggers inspect callback', () => {
    const handleInspect = vi.fn();
    render(
      <ActiveIncidentsBanner
        incidents={[mockIncident]}
        onAcknowledge={vi.fn()}
        onResolve={vi.fn()}
        onInspectTrace={handleInspect}
        onTriggerRemediation={vi.fn()}
      />
    );

    expect(screen.getByText('P99 Latency SLA Violation')).toBeInTheDocument();
    expect(screen.getByText(/4 sub-alerts bundled/i)).toBeInTheDocument();

    const inspectBtn = screen.getByText('Inspect Root Cause Trace');
    fireEvent.click(inspectBtn);
    expect(handleInspect).toHaveBeenCalledWith('00-test-trace-99182');
  });

  it('opens triage note modal and submits acknowledgement', () => {
    const handleAck = vi.fn();
    render(
      <ActiveIncidentsBanner
        incidents={[mockIncident]}
        onAcknowledge={handleAck}
        onResolve={vi.fn()}
        onInspectTrace={vi.fn()}
        onTriggerRemediation={vi.fn()}
      />
    );

    const ackBtn = screen.getByText('Acknowledge & Note');
    fireEvent.click(ackBtn);

    const textarea = screen.getByPlaceholderText(/Scaling up database read replica pool/i);
    fireEvent.change(textarea, { target: { value: 'Investigating high queue depth in redis' } });

    const confirmBtn = screen.getByText('Confirm Acknowledgement');
    fireEvent.click(confirmBtn);

    expect(handleAck).toHaveBeenCalledWith('inc-test-001', 'Investigating high queue depth in redis');
  });

  it('triggers self-healing automated remediation', () => {
    const handleRemediation = vi.fn();
    render(
      <ActiveIncidentsBanner
        incidents={[mockIncident]}
        onAcknowledge={vi.fn()}
        onResolve={vi.fn()}
        onInspectTrace={vi.fn()}
        onTriggerRemediation={handleRemediation}
      />
    );

    const runBtn = screen.getByText('Run Remediation');
    fireEvent.click(runBtn);
    expect(handleRemediation).toHaveBeenCalledWith('inc-test-001');
  });

  it('generates AI post-mortem report modal on click', () => {
    render(
      <ActiveIncidentsBanner
        incidents={[mockIncident]}
        onAcknowledge={vi.fn()}
        onResolve={vi.fn()}
        onInspectTrace={vi.fn()}
        onTriggerRemediation={vi.fn()}
      />
    );

    const aiBtn = screen.getByText('AI Post-Mortem');
    fireEvent.click(aiBtn);

    expect(screen.getByText('AI Incident Post-Mortem Report')).toBeInTheDocument();
    expect(screen.getByText(/Incident Post-Mortem Report: P99 Latency SLA Violation/i)).toBeInTheDocument();
  });
});

describe('NotificationChannels & Synthetic Canary Probes', () => {
  it('renders channels and dispatches canary probe test', async () => {
    const handleTest = vi.fn().mockResolvedValue(true);
    render(
      <NotificationChannels
        channels={mockChannels}
        onCall={mockOnCall}
        onSendTestNotification={handleTest}
      />
    );

    expect(screen.getByText('#sre-alerts')).toBeInTheDocument();
    expect(screen.getByText('PagerDuty SRE Primary')).toBeInTheDocument();
    expect(screen.getByText('Elena Vance (Principal SRE)')).toBeInTheDocument();

    const testButtons = screen.getAllByText('Test Canary');
    await act(async () => {
      fireEvent.click(testButtons[0]);
    });

    expect(handleTest).toHaveBeenCalledWith('chan-slack');
  });
});

describe('useAlertEvaluator Hook', () => {
  const metrics: AggregatedMetrics = {
    totalRequests: 5000,
    errorCount: 250,
    successRate: 95.0, // 5% error rate
    avgLatency: 80,
    p50Latency: 60,
    p95Latency: 350,
    p99Latency: 520,
    activeAnomaliesCount: 0,
  };

  const logs: ApiRequestLog[] = [
    {
      id: 'l-error-1',
      timestamp: Date.now() - 5000,
      method: 'POST',
      endpoint: '/api/v1/charge',
      statusCode: 500,
      latencyMs: 420,
      clientIp: '10.0.0.1',
      userAgent: 'curl',
      traceId: 'trace-err-root-99',
      spanId: 'span-001',
      requestHeaders: {},
      responseHeaders: {},
      requestBody: null,
      responseBody: null,
    },
  ];

  it('fires incident after sustained threshold breaches past flapping damping count', () => {
    const rules: AlertRule[] = [
      {
        ...mockRule,
        metric: 'error_rate',
        operator: '>',
        threshold: 3.0, // 5% > 3% => breach
        flappingDampingCount: 2,
      },
    ];

    const { result, rerender } = renderHook(
      ({ m, l, r }) => useAlertEvaluator(m, l, r),
      {
        initialProps: { m: metrics, l: logs, r: rules },
      }
    );

    // First breach iteration: count becomes 1 (< flappingDampingCount 2), not yet firing
    expect(result.current.incidents.length).toBe(0);

    // Second breach iteration: count becomes 2 (>= 2), triggers firing incident
    rerender({ m: { ...metrics, totalRequests: 5100 }, l: logs, r: rules });

    expect(result.current.incidents.length).toBe(1);
    expect(result.current.incidents[0].status).toBe('firing');
    expect(result.current.incidents[0].rootCauseTraceId).toBe('trace-err-root-99');
  });

  it('allows acknowledging and resolving an active incident', () => {
    const rules: AlertRule[] = [
      {
        ...mockRule,
        metric: 'latency',
        operator: '>',
        threshold: 200,
        flappingDampingCount: 1,
      },
    ];

    const { result } = renderHook(() => useAlertEvaluator(metrics, logs, rules));

    expect(result.current.incidents.length).toBe(1);
    const incId = result.current.incidents[0].id;

    act(() => {
      result.current.acknowledgeIncident(incId, 'Scaling up pods in us-east');
    });

    expect(result.current.incidents[0].status).toBe('acknowledged');
    expect(result.current.incidents[0].acknowledgementNotes).toBe('Scaling up pods in us-east');

    act(() => {
      result.current.resolveIncident(incId);
    });

    expect(result.current.incidents[0].status).toBe('resolved');
  });

  it('respects active maintenance silencing window and does not fire', () => {
    const now = Date.now();
    const silencedRule: AlertRule[] = [
      {
        ...mockRule,
        metric: 'latency',
        operator: '>',
        threshold: 100,
        flappingDampingCount: 1,
        silencingWindow: {
          enabled: true,
          startIso: new Date(now - 60000).toISOString(),
          endIso: new Date(now + 60000).toISOString(),
          reason: 'Maintenance in progress',
        },
      },
    ];

    const { result } = renderHook(() => useAlertEvaluator(metrics, logs, silencedRule));
    expect(result.current.incidents.length).toBe(0);
  });
});
