export type ProbeRegion = 'US-East' | 'US-West' | 'EU-Central' | 'AP-South' | 'AP-East';

export interface ProbeTimingBreakdown {
  dnsLookupMs: number;
  tcpConnectMs: number;
  tlsHandshakeMs: number;
  ttfbMs: number;
  downloadMs: number;
  totalDurationMs: number;
}

export interface SyntheticProbeResult {
  region: ProbeRegion;
  timestamp: number;
  statusCode: number;
  success: boolean;
  timings: ProbeTimingBreakdown;
  resolvedIp: string;
  errorMessage?: string;
}

export interface JourneyStepAssertion {
  type: 'statusCode' | 'jsonBody' | 'header';
  key?: string; // e.g. "$.status" or "content-type"
  expectedValue: string | number;
}

export interface JourneyStep {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  extractTokens?: Record<string, string>; // e.g. { bearerToken: "$.token" }
  assertions: JourneyStepAssertion[];
}

export interface JourneyStepResult {
  stepId: string;
  stepName: string;
  success: boolean;
  durationMs: number;
  statusCode: number;
  extractedValues?: Record<string, string>;
  assertionResults: Array<{
    assertion: JourneyStepAssertion;
    passed: boolean;
    actualValue?: unknown;
  }>;
  errorMessage?: string;
}

export interface SSLCertificateInfo {
  domain: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  cipherSuite: string;
  keyStrengthBits: number;
  signatureAlgorithm: string;
  isExpired: boolean;
  warningAlertTriggered: boolean;
}

export interface DNSIntegrityReport {
  domain: string;
  expectedSubnets: string[];
  regionalResolutions: Array<{
    region: ProbeRegion;
    ip: string;
    isAnycastMatched: boolean;
    dnsLatencyMs: number;
  }>;
  hasPoisoningOrHijack: boolean;
  alertDetails?: string;
}

export interface SyntheticProbeConfig {
  id: string;
  name: string;
  type: 'SINGLE_ENDPOINT' | 'MULTI_STEP_JOURNEY';
  targetUrl: string;
  regions: ProbeRegion[];
  intervalSeconds: number; // 30, 60, 300
  enabled: boolean;
  sslMonitorEnabled: boolean;
  dnsIntegrityEnabled: boolean;
  expectedIpSubnets?: string[];
  journeySteps?: JourneyStep[];
  lastRunAt?: number;
  overallStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  uptimePercentage: number;
}
