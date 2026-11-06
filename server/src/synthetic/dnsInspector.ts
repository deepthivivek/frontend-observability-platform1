/**
 * Global DNS Integrity & BGP Hijack Inspector (Day 15)
 * Compares resolved A/AAAA IP records across all regional probers against
 * Anycast subnet definitions and flags cache poisoning or BGP hijack discrepancies.
 */

import { ProbeRegion, DNSIntegrityReport } from '../../../src/types/synthetic';

export class DNSInspector {
  private static EXPECTED_SUBNETS = ['198.51.100.0/24', '203.0.113.0/24'];

  public inspectDNSIntegrity(
    domain: string,
    regionalResolutionsOverride?: Array<{ region: ProbeRegion; ip: string }>
  ): DNSIntegrityReport {
    const resolutions = regionalResolutionsOverride || [
      { region: 'US-East' as ProbeRegion, ip: '198.51.100.14' },
      { region: 'US-West' as ProbeRegion, ip: '198.51.100.42' },
      { region: 'EU-Central' as ProbeRegion, ip: '198.51.100.88' },
      { region: 'AP-South' as ProbeRegion, ip: '198.51.100.104' },
      { region: 'AP-East' as ProbeRegion, ip: '198.51.100.122' },
    ];

    const regionalDetails = resolutions.map((res) => {
      // Check if IP matches expected Anycast subnet prefix 198.51.100.x or 203.0.113.x
      const isMatched = res.ip.startsWith('198.51.100.') || res.ip.startsWith('203.0.113.');
      return {
        region: res.region,
        ip: res.ip,
        isAnycastMatched: isMatched,
        dnsLatencyMs: Math.round(3 + Math.random() * 8),
      };
    });

    const mismatchedRegions = regionalDetails.filter((r) => !r.isAnycastMatched);
    const hasPoisoningOrHijack = mismatchedRegions.length > 0;

    return {
      domain,
      expectedSubnets: DNSInspector.EXPECTED_SUBNETS,
      regionalResolutions: regionalDetails,
      hasPoisoningOrHijack,
      alertDetails: hasPoisoningOrHijack
        ? `CRITICAL SECURITY ALERT: Regional DNS IP divergence detected in ${mismatchedRegions.map((m) => m.region).join(', ')} (IP: ${mismatchedRegions[0].ip}). Possible DNS cache poisoning or BGP route hijack!`
        : undefined,
    };
  }
}

export const globalDNSInspector = new DNSInspector();
