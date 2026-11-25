import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EndpointTable } from './EndpointTable';
import type { EndpointRow } from '@/src/lib/metrics';

const ENDPOINTS_FIXTURE: EndpointRow[] = [
  {
    id: 'ep-1',
    name: 'Auth Login',
    method: 'POST',
    path: '/api/v1/auth/login',
    status: 'Healthy',
    responseTimeMs: 120,
    uptimePercent: 99.99,
    lastChecked: '2026-11-24T11:00:00Z',
  },
  {
    id: 'ep-2',
    name: 'Checkout Settlement',
    method: 'POST',
    path: '/api/v2/payments/settle',
    status: 'Failed',
    responseTimeMs: 840,
    uptimePercent: 96.4,
    lastChecked: '2026-11-24T11:01:00Z',
  },
  {
    id: 'ep-3',
    name: 'Trace Search',
    method: 'GET',
    path: '/api/v1/traces/query',
    status: 'Warning',
    responseTimeMs: 310,
    uptimePercent: 99.15,
    lastChecked: '2026-11-24T11:02:00Z',
  },
  {
    id: 'ep-4',
    name: 'Health Probe',
    method: 'GET',
    path: '/api/healthz',
    status: 'Healthy',
    responseTimeMs: 25,
    uptimePercent: 100,
    lastChecked: '2026-11-24T11:03:00Z',
  },
];

describe('EndpointTable', () => {
  it('filters by search query and clears via Clear search button', async () => {
    const user = userEvent.setup();
    render(<EndpointTable endpoints={ENDPOINTS_FIXTURE} />);

    const searchInput = screen.getByRole('searchbox', {
      name: /search endpoints/i,
    });

    await user.type(searchInput, 'Checkout');

    expect(screen.getByText('Checkout Settlement')).toBeInTheDocument();
    expect(screen.queryByText('Auth Login')).not.toBeInTheDocument();

    const clearBtn = screen.getByRole('button', { name: /clear search/i });
    await user.click(clearBtn);

    expect(searchInput).toHaveValue('');
    expect(screen.getByText('Auth Login')).toBeInTheDocument();
    expect(screen.getByText('Health Probe')).toBeInTheDocument();
  });

  it('filters by status buttons with aria-pressed state and live counts', async () => {
    const user = userEvent.setup();
    render(<EndpointTable endpoints={ENDPOINTS_FIXTURE} />);

    const failedBtn = screen.getByRole('button', { name: /failed \(1\)/i });
    const healthyBtn = screen.getByRole('button', { name: /healthy \(2\)/i });

    await user.click(failedBtn);
    expect(failedBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Checkout Settlement')).toBeInTheDocument();
    expect(screen.queryByText('Auth Login')).not.toBeInTheDocument();

    await user.click(healthyBtn);
    expect(healthyBtn).toHaveAttribute('aria-pressed', 'true');
    expect(failedBtn).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Auth Login')).toBeInTheDocument();
    expect(screen.getByText('Health Probe')).toBeInTheDocument();
    expect(screen.queryByText('Checkout Settlement')).not.toBeInTheDocument();
  });

  it('cycles Response Time sort order and updates aria-sort on column header', async () => {
    const user = userEvent.setup();
    render(<EndpointTable endpoints={ENDPOINTS_FIXTURE} />);

    const responseTimeHeader = screen.getByRole('columnheader', {
      name: /response time/i,
    });
    const sortButton = within(responseTimeHeader).getByRole('button', {
      name: /response time/i,
    });

    expect(responseTimeHeader).toHaveAttribute('aria-sort', 'none');

    // First click -> ascending
    await user.click(sortButton);
    expect(responseTimeHeader).toHaveAttribute('aria-sort', 'ascending');
    const ascRows = screen.getAllByRole('row').slice(1);
    expect(ascRows[0]).toHaveTextContent('Health Probe');
    expect(ascRows[3]).toHaveTextContent('Checkout Settlement');

    // Second click -> descending
    await user.click(sortButton);
    expect(responseTimeHeader).toHaveAttribute('aria-sort', 'descending');
    const descRows = screen.getAllByRole('row').slice(1);
    expect(descRows[0]).toHaveTextContent('Checkout Settlement');
    expect(descRows[3]).toHaveTextContent('Health Probe');

    // Third click -> none
    await user.click(sortButton);
    expect(responseTimeHeader).toHaveAttribute('aria-sort', 'none');
  });

  it('shows empty filter state and resets filters cleanly', async () => {
    const user = userEvent.setup();
    render(<EndpointTable endpoints={ENDPOINTS_FIXTURE} />);

    const searchInput = screen.getByRole('searchbox', {
      name: /search endpoints/i,
    });
    await user.type(searchInput, 'nonexistent-route-xyz');

    expect(
      screen.getByText(/no endpoints match your filters/i)
    ).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /reset filters/i });
    await user.click(resetBtn);

    expect(searchInput).toHaveValue('');
    expect(screen.getByText('Auth Login')).toBeInTheDocument();
    expect(screen.getByText('Checkout Settlement')).toBeInTheDocument();
  });
});
