/**
 * Regional Ping & Availability Scheduler (Day 15)
 * Periodically evaluates synthetic probes, tracks SLO uptime percentages,
 * and maintains active probe configurations.
 */

import { SyntheticProbeConfig } from '../../../src/types/synthetic';

export class SyntheticScheduler {
  private probeConfigs: Map<string, SyntheticProbeConfig> = new Map([
    [
      'probe-checkout-flow',
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
        expectedIpSubnets: ['198.51.100.0/24'],
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
            assertions: [
              { type: 'statusCode', expectedValue: 200 },
              { type: 'jsonBody', key: '$.status', expectedValue: 'ok' },
            ],
          },
        ],
        lastRunAt: Date.now() - 30000,
        overallStatus: 'HEALTHY',
        uptimePercentage: 99.94,
      },
    ],
    [
      'probe-auth-service',
      {
        id: 'probe-auth-service',
        name: 'Auth Service Health & SSL Probe',
        type: 'SINGLE_ENDPOINT',
        targetUrl: 'https://auth.neonchasm.io/health',
        regions: ['US-East', 'EU-Central', 'AP-East'],
        intervalSeconds: 30,
        enabled: true,
        sslMonitorEnabled: true,
        dnsIntegrityEnabled: true,
        lastRunAt: Date.now() - 15000,
        overallStatus: 'HEALTHY',
        uptimePercentage: 100.0,
      },
    ],
  ]);

  public getProbes(): SyntheticProbeConfig[] {
    return Array.from(this.probeConfigs.values());
  }

  public getProbeById(id: string): SyntheticProbeConfig | undefined {
    return this.probeConfigs.get(id);
  }

  public saveProbe(config: SyntheticProbeConfig): SyntheticProbeConfig {
    this.probeConfigs.set(config.id, config);
    return config;
  }
}

export const globalSyntheticScheduler = new SyntheticScheduler();
