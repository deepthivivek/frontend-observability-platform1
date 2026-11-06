import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GlobalLatencyView } from '../components/synthetic/GlobalLatencyView';

const mockProbes = [
  {
    id: 'probe-checkout-flow',
    name: 'Global E-Commerce Checkout API Journey',
    type: 'MULTI_STEP_JOURNEY',
    targetUrl: 'https://api.neonchasm.io/v1/checkout',
    regions: ['US-East', 'US-West', 'EU-Central', 'AP-South', 'AP-East'],
    intervalSeconds: 60,
    enabled: true,
    sslMonitorEnabled: true,
    dnsIntegrityEnabled: true,
    overallStatus: 'HEALTHY',
    uptimePercentage: 99.94,
    journeySteps: [
      {
        id: 'step-1',
        name: 'Authenticate SRE Session',
        method: 'POST',
        url: '/auth/login',
        extractTokens: { bearerToken: '$.token' },
        assertions: [{ type: 'statusCode', expectedValue: 200 }],
      },
      {
        id: 'step-2',
        name: 'Execute Reserve Inventory',
        method: 'POST',
        url: '/v1/checkout/reserve',
        assertions: [{ type: 'statusCode', expectedValue: 200 }],
      },
    ],
  },
];

const mockProbeResults = [
  {
    region: 'US-East',
    timestamp: Date.now(),
    statusCode: 200,
    success: true,
    timings: { dnsLookupMs: 12, tcpConnectMs: 18, tlsHandshakeMs: 25, ttfbMs: 45, downloadMs: 15, totalDurationMs: 115 },
    resolvedIp: '198.51.100.14',
  },
  {
    region: 'EU-Central',
    timestamp: Date.now(),
    statusCode: 200,
    success: true,
    timings: { dnsLookupMs: 14, tcpConnectMs: 32, tlsHandshakeMs: 48, ttfbMs: 62, downloadMs: 18, totalDurationMs: 174 },
    resolvedIp: '198.51.100.88',
  },
];

const mockJourneyReport = {
  overallSuccess: true,
  totalDurationMs: 285,
  extractedVariables: { bearerToken: 'eyJhbGciOiJIUzI1NiJ9.mockToken.xyz' },
  stepResults: [
    {
      stepId: 'step-1',
      stepName: 'Authenticate SRE Session',
      success: true,
      durationMs: 45,
      statusCode: 200,
      extractedValues: { bearerToken: 'eyJhbGciOiJIUzI1NiJ9.mockToken.xyz' },
      assertionResults: [{ assertion: { type: 'statusCode', expectedValue: 200 }, passed: true, actualValue: 200 }],
    },
    {
      stepId: 'step-2',
      stepName: 'Execute Reserve Inventory',
      success: true,
      durationMs: 95,
      statusCode: 200,
      extractedValues: { bearerToken: 'eyJhbGciOiJIUzI1NiJ9.mockToken.xyz' },
      assertionResults: [{ assertion: { type: 'statusCode', expectedValue: 200 }, passed: true, actualValue: 200 }],
    },
  ],
};

const mockSSL = {
  domain: 'api.neonchasm.io',
  issuer: 'DigiCert Global TLS RSA SHA256 CA',
  validFrom: '2026-01-01T00:00:00.000Z',
  validTo: '2026-12-31T23:59:59.000Z',
  daysRemaining: 240,
  cipherSuite: 'TLS_AES_256_GCM_SHA384 (ECDHE-RSA)',
  keyStrengthBits: 2048,
  signatureAlgorithm: 'sha256WithRSAEncryption',
  isExpired: false,
  warningAlertTriggered: false,
};

const mockDNS = {
  domain: 'api.neonchasm.io',
  expectedSubnets: ['198.51.100.0/24'],
  regionalResolutions: [
    { region: 'US-East', ip: '198.51.100.14', isAnycastMatched: true, dnsLatencyMs: 5 },
    { region: 'EU-Central', ip: '198.51.100.88', isAnycastMatched: true, dnsLatencyMs: 12 },
  ],
  hasPoisoningOrHijack: false,
};

describe('Global Latency Map & Synthetic Studio UI (Day 15 Frontend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/v1/synthetic/probes')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ total: mockProbes.length, probes: mockProbes }) });
      }
      if (url.includes('/api/v1/synthetic/probe/run')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ targetUrl: 'https://api.neonchasm.io/health', executedAt: Date.now(), results: mockProbeResults, alerts: [] }) });
      }
      if (url.includes('/api/v1/synthetic/journey/run')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockJourneyReport) });
      }
      if (url.includes('/api/v1/synthetic/ssl/inspect')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSSL) });
      }
      if (url.includes('/api/v1/synthetic/dns/inspect')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockDNS) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    }) as unknown as typeof fetch;
  });

  it('renders Global Latency Map, regional matrix, SSL inspector, and executes synthetic journey', async () => {
    render(<GlobalLatencyView />);

    await waitFor(() => {
      expect(screen.getByText('Global Synthetic & Latency Map')).toBeInTheDocument();
    });

    expect(screen.getByText('99.98% GLOBAL SLO UPTIME')).toBeInTheDocument();

    // Switch to SSL/TLS & DNS Parity tab
    const sslDnsTab = screen.getByRole('button', { name: /SSL\/TLS Expiry & DNS Parity/i });
    fireEvent.click(sslDnsTab);

    await waitFor(() => {
      expect(screen.getByText('SSL/TLS Certificate Inspection')).toBeInTheDocument();
      expect(screen.getByText('Global DNS & BGP Parity')).toBeInTheDocument();
    });

    // Switch to Multi-Step Scripted Journeys tab
    const journeyTab = screen.getByRole('button', { name: /Multi-Step Scripted Journeys/i });
    fireEvent.click(journeyTab);

    await waitFor(() => {
      expect(screen.getByText('Global E-Commerce Checkout API Journey')).toBeInTheDocument();
      expect(screen.getByText('STEP 1')).toBeInTheDocument();
      expect(screen.getByText('STEP 2')).toBeInTheDocument();
    });
  });
});
