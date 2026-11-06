import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { parsePromQLExpression, evaluateMetricQuery, translateTextToPromQL } from '../../server/src/metrics/aggregator';
import { AdaptiveQueryCache } from '../../server/src/metrics/cache';
import { evaluateWidgetAlertTriggers } from '../../server/src/metrics/alertTriggers';
import { MetricQueryBuilder } from '../components/analytics/MetricQueryBuilder';
import { CustomDashboardBuilder } from '../components/analytics/CustomDashboardBuilder';

describe('Custom Dashboard Studio & PromQL Aggregator (Day 11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Backend PromQL Metric Aggregator & Cache', () => {
    it('correctly parses complex PromQL expressions', () => {
      const parsed = parsePromQLExpression('histogram_quantile(0.99, rate(http_requests_total[5m])) by (endpoint)');
      expect(parsed.aggregation).toBe('p99');
      expect(parsed.metric).toBe('http_requests_total');
      expect(parsed.window).toBe('5m');
      expect(parsed.groupBy).toBe('endpoint');
    });

    it('evaluates metric queries and checks thresholds', () => {
      const res = evaluateMetricQuery({
        query: 'rate(http_requests_total[5m])',
        metric: 'http_requests_total',
        threshold: { operator: '>', warning: 2000, critical: 5000 },
      });

      expect(res.dataPoints.length).toBeGreaterThan(0);
      expect(res.metric).toBe('http_requests_total');
      expect(res.status).toBe('ok');
    });

    it('translates natural language text into valid PromQL expressions', () => {
      const translation = translateTextToPromQL('Show me p99 latency for API requests');
      expect(translation.expression).toContain('0.99');
      expect(translation.aggregation).toBe('p99');
      expect(translation.explanation).toBeDefined();
    });

    it('manages LRU eviction and hit/miss statistics in AdaptiveQueryCache', () => {
      const cache = new AdaptiveQueryCache(2, 5000);
      cache.set('k1', { val: 1 });
      cache.set('k2', { val: 2 });

      expect(cache.get('k1').cached).toBe(true);
      
      // Overflow max entries
      cache.set('k3', { val: 3 });
      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
    });

    it('evaluates widget alert triggers across multiple dashboard widgets', () => {
      const alerts = evaluateWidgetAlertTriggers([
        {
          id: 'w-1',
          title: 'High Latency',
          query: { expression: 'rate(http_requests[5m])', metric: 'http_requests_total' },
          threshold: { operator: '>', warning: 1, critical: 2 },
        },
      ]);

      expect(alerts.length).toBe(1);
      expect(alerts[0].widgetId).toBe('w-1');
    });
  });

  describe('MetricQueryBuilder Component', () => {
    it('renders query builder with AI Assistant mode active', () => {
      render(<MetricQueryBuilder onApplyQuery={vi.fn()} />);

      expect(screen.getByText('PromQL / LogQL Query Studio')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Show me p99 latency/i)).toBeInTheDocument();
    });

    it('switches between AI, Visual, and Code modes', () => {
      render(<MetricQueryBuilder onApplyQuery={vi.fn()} />);

      const visualBtn = screen.getByRole('button', { name: /Visual Builder/i });
      fireEvent.click(visualBtn);
      expect(screen.getByText('Target Metric')).toBeInTheDocument();

      const codeBtn = screen.getByRole('button', { name: /PromQL Code/i });
      fireEvent.click(codeBtn);
      expect(screen.getByText('Raw PromQL Expression')).toBeInTheDocument();
    });

    it('applies query configuration on click', () => {
      const handleApply = vi.fn();
      render(<MetricQueryBuilder onApplyQuery={handleApply} />);

      const applyBtn = screen.getByRole('button', { name: /Apply Query to Studio/i });
      fireEvent.click(applyBtn);

      expect(handleApply).toHaveBeenCalledTimes(1);
    });
  });

  describe('CustomDashboardBuilder Component', () => {
    it('renders dashboard canvas with default preset widgets', async () => {
      render(<CustomDashboardBuilder workspaceId="ws-test" />);

      expect(screen.getByText('Preset Layout:')).toBeInTheDocument();
      expect(screen.getByText('P99 Latency vs Target (ms)')).toBeInTheDocument();
    });

    it('opens Add Widget modal and adds a new metric widget tile', async () => {
      render(<CustomDashboardBuilder workspaceId="ws-test" />);

      const addBtn = screen.getByRole('button', { name: /Add Widget/i });
      fireEvent.click(addBtn);

      expect(screen.getByText('Add Custom Metric Widget')).toBeInTheDocument();

      const titleInput = screen.getByDisplayValue('New Metric Widget');
      fireEvent.change(titleInput, { target: { value: 'Database CPU Load' } });

      const submitBtn = screen.getByRole('button', { name: 'Add Custom Widget' });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Database CPU Load')).toBeInTheDocument();
      });
    });
  });
});
