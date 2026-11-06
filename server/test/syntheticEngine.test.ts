import { describe, it, expect, beforeEach } from 'vitest';
import { EdgeProber } from '../src/synthetic/edgeProber';
import { ScriptRunner } from '../src/synthetic/scriptRunner';
import { SSLMonitor } from '../src/synthetic/sslMonitor';
import { DNSInspector } from '../src/synthetic/dnsInspector';
import { DegradationDetector } from '../src/synthetic/degradationDetector';
import { SyntheticScheduler } from '../src/synthetic/scheduler';
import { ProbeRegion, JourneyStep, SyntheticProbeConfig } from '../../src/types/synthetic';

describe('Global Edge Synthetic Prober & Monitoring Engine (Day 15 Backend)', () => {
  describe('EdgeProber Engine', () => {
    const prober = new EdgeProber();

    it('executes global multi-region probe across all 5 edge regions', async () => {
      const results = await prober.probeAllRegions('https://api.neonchasm.io/health');

      expect(results.length).toBe(5);
      const regions: ProbeRegion[] = ['US-East', 'US-West', 'EU-Central', 'AP-South', 'AP-East'];
      regions.forEach((r) => {
        const found = results.find((res) => res.region === r);
        expect(found).toBeDefined();
        expect(found?.timings.totalDurationMs).toBeGreaterThan(0);
        expect(found?.timings.dnsLookupMs).toBeGreaterThan(0);
        expect(found?.timings.tcpConnectMs).toBeGreaterThan(0);
        expect(found?.timings.tlsHandshakeMs).toBeGreaterThan(0);
        expect(found?.timings.ttfbMs).toBeGreaterThan(0);
        expect(found?.statusCode).toBe(200);
      });
    });

    it('executes single-region probe with realistic timing breakdown', async () => {
      const res = await prober.probeEndpoint('https://api.neonchasm.io/v1/telemetry', 'US-East');

      expect(res.region).toBe('US-East');
      expect(res.success).toBe(true);
      expect(res.timings.totalDurationMs).toBe(
        res.timings.dnsLookupMs + res.timings.tcpConnectMs + res.timings.tlsHandshakeMs + res.timings.ttfbMs + res.timings.downloadMs
      );
    });
  });

  describe('ScriptRunner Engine (Multi-Step API Journeys)', () => {
    const runner = new ScriptRunner();

    it('executes multi-step journey with bearer token extraction and assertion validation', async () => {
      const steps: JourneyStep[] = [
        {
          id: 'step-1',
          name: 'Authenticate API Client',
          method: 'POST',
          url: '/auth/login',
          extractTokens: { bearerToken: '$.token' },
          assertions: [
            { type: 'statusCode', expectedValue: 200 },
          ],
        },
        {
          id: 'step-2',
          name: 'Query Telemetry API with Extracted Token',
          method: 'POST',
          url: '/v1/checkout/reserve',
          assertions: [
            { type: 'statusCode', expectedValue: 200 },
          ],
        },
      ];

      const report = await runner.executeJourney(steps, 'https://api.neonchasm.io');

      expect(report.overallSuccess).toBe(true);
      expect(report.stepResults.length).toBe(2);
      expect(report.stepResults[0].success).toBe(true);
      expect(report.stepResults[1].success).toBe(true);
      expect(report.extractedVariables.bearerToken).toBeDefined();
    });
  });

  describe('SSL/TLS Expiry & Cipher Monitor', () => {
    const sslMon = new SSLMonitor();

    it('inspects SSL certificate and raises warning when expiration is under 30 days', () => {
      const certInfo = sslMon.inspectCertificate('api.neonchasm.io', 25);

      expect(certInfo.domain).toBe('api.neonchasm.io');
      expect(certInfo.daysRemaining).toBe(25);
      expect(certInfo.cipherSuite).toContain('TLS_AES_256_GCM');
      expect(certInfo.issuer).toContain('DigiCert');
      expect(certInfo.warningAlertTriggered).toBe(true);
    });
  });

  describe('Global DNS Integrity & BGP Inspector', () => {
    const dnsMon = new DNSInspector();

    it('inspects Anycast DNS resolvers and verifies no BGP hijack / cache poisoning', () => {
      const dnsReport = dnsMon.inspectDNSIntegrity('api.neonchasm.io');

      expect(dnsReport.domain).toBe('api.neonchasm.io');
      expect(dnsReport.regionalResolutions.length).toBeGreaterThan(0);
      expect(dnsReport.hasPoisoningOrHijack).toBe(false);
    });
  });

  describe('Regional Degradation & Alert Detector', () => {
    const detector = new DegradationDetector();
    const prober = new EdgeProber();

    it('detects latency spikes (+50%) and 5xx error bursts', async () => {
      const normalResult = await prober.probeEndpoint('https://api.neonchasm.io/health', 'US-East');
      const failedResult = await prober.probeEndpoint('https://api.neonchasm.io/health', 'EU-Central', true);

      const alerts = detector.evaluateProbeResults([normalResult, failedResult]);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some((a) => a.region === 'EU-Central' && a.metric === 'HTTP_5XX_BURST')).toBe(true);
    });
  });

  describe('SyntheticScheduler & Probe Configuration Registry', () => {
    let scheduler: SyntheticScheduler;

    beforeEach(() => {
      scheduler = new SyntheticScheduler();
    });

    it('registers probe configurations and retrieves active probes', () => {
      const probes = scheduler.getProbes();
      expect(probes.length).toBeGreaterThan(0);
      expect(probes.some((p) => p.id === 'probe-checkout-flow')).toBe(true);
    });

    it('creates new probe configuration', () => {
      const newConfig: SyntheticProbeConfig = {
        id: 'probe-staging-canary',
        name: 'Staging API Canary Probe',
        type: 'SINGLE_ENDPOINT',
        targetUrl: 'https://staging.neonchasm.io/health',
        regions: ['US-East', 'EU-Central'],
        intervalSeconds: 300,
        enabled: true,
      };

      const created = scheduler.saveProbe(newConfig);
      expect(created.id).toBe('probe-staging-canary');
      expect(created.name).toBe('Staging API Canary Probe');
      expect(scheduler.getProbes().some((p) => p.id === 'probe-staging-canary')).toBe(true);
    });
  });
});
