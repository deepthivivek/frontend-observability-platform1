/**
 * Edge Synthetic Prober Engine (Day 15)
 * Simulates global prober agents executing HTTP GET, POST, and WebSocket handshake
 * latency checks across US-East, US-West, EU-Central, AP-South, and AP-East.
 */

import { ProbeRegion, SyntheticProbeResult, ProbeTimingBreakdown } from '../../../src/types/synthetic';

export class EdgeProber {
  private static REGION_IP_MAP: Record<ProbeRegion, string> = {
    'US-East': '198.51.100.14',
    'US-West': '198.51.100.42',
    'EU-Central': '198.51.100.88',
    'AP-South': '198.51.100.104',
    'AP-East': '198.51.100.122',
  };

  /**
   * Execute synthetic probe check from a designated global region.
   */
  public async probeEndpoint(
    url: string,
    region: ProbeRegion,
    forceFailure = false
  ): Promise<SyntheticProbeResult> {
    const timestamp = Date.now();
    const resolvedIp = EdgeProber.REGION_IP_MAP[region] || '198.51.100.1';

    // Regional baseline latency variance
    let baseLatency = 20;
    if (region === 'EU-Central') baseLatency = 45;
    if (region === 'AP-South') baseLatency = 85;
    if (region === 'AP-East') baseLatency = 95;

    const dnsLookupMs = Math.round(4 + Math.random() * 6);
    const tcpConnectMs = Math.round(8 + Math.random() * 10);
    const tlsHandshakeMs = Math.round(12 + Math.random() * 15);
    const ttfbMs = forceFailure ? 1200 : Math.round(baseLatency + Math.random() * 25);
    const downloadMs = Math.round(5 + Math.random() * 8);

    const timings: ProbeTimingBreakdown = {
      dnsLookupMs,
      tcpConnectMs,
      tlsHandshakeMs,
      ttfbMs,
      downloadMs,
      totalDurationMs: dnsLookupMs + tcpConnectMs + tlsHandshakeMs + ttfbMs + downloadMs,
    };

    if (forceFailure) {
      return {
        region,
        timestamp,
        statusCode: 504,
        success: false,
        timings,
        resolvedIp,
        errorMessage: `Gateway Timeout: ${region} edge prober exceeded 1000ms TTFB threshold`,
      };
    }

    return {
      region,
      timestamp,
      statusCode: 200,
      success: true,
      timings,
      resolvedIp,
    };
  }

  /**
   * Execute multi-region synthetic probes in parallel.
   */
  public async probeAllRegions(
    url: string,
    regions: ProbeRegion[] = ['US-East', 'US-West', 'EU-Central', 'AP-South', 'AP-East']
  ): Promise<SyntheticProbeResult[]> {
    return Promise.all(regions.map((region) => this.probeEndpoint(url, region)));
  }
}

export const globalEdgeProber = new EdgeProber();
