export type DomEventType =
  | 'click'
  | 'rage_click'
  | 'dead_click'
  | 'input'
  | 'navigation'
  | 'scroll'
  | 'error'
  | 'network_call';

export interface DomEvent {
  id: string;
  timestamp: number; // offset in ms from session start
  type: DomEventType;
  targetSelector: string;
  targetText?: string;
  x?: number;
  y?: number;
  inputValue?: string; // auto-masked with •••••• if sensitive
  scrollDepth?: number;
  networkDetails?: {
    method: string;
    url: string;
    status: number;
    durationMs: number;
    traceId: string;
  };
  errorMessage?: string;
}

export interface MemoryProfileDataPoint {
  timestamp: number; // offset ms
  jsHeapSizeMb: number;
  domNodeCount: number;
  longTaskCount: number;
}

export interface WebVitalsSessionMetrics {
  lcp: number; // Largest Contentful Paint (ms)
  inp: number; // Interaction to Next Paint (ms)
  cls: number; // Cumulative Layout Shift
  fcp: number; // First Contentful Paint (ms)
  ttfb: number; // Time to First Byte (ms)
  slowElement?: string;
  networkLatencyAttribution: number; // ms spent in downstream network
  loafDuration: number; // Long Animation Frame main thread blocking ms
}

export interface RumSession {
  id: string;
  userId: string;
  userEmail: string;
  startTime: number;
  durationMs: number;
  device: 'Desktop' | 'Mobile' | 'Tablet';
  browser: string;
  os: string;
  networkTier: '5G' | '4G' | 'WiFi' | 'Slow 3G';
  country: string;
  frustrationScore: number; // 0 to 100
  rageClicksCount: number;
  deadClicksCount: number;
  errorsCount: number;
  correlatedTraceId: string;
  events: DomEvent[];
  webVitals: WebVitalsSessionMetrics;
  memoryProfile: MemoryProfileDataPoint[];
}

export interface StackFrame {
  file: string;
  line: number;
  column: number;
  functionName: string;
  sourceSnippet?: string[];
  highlightedLine?: number;
}

export interface UncaughtExceptionGroup {
  id: string;
  signature: string;
  message: string;
  count: number;
  usersAffected: number;
  firstSeen: number;
  lastSeen: number;
  minifiedStack: string;
  unminifiedFrames: StackFrame[];
}

export interface SyntheticStep {
  id: string;
  stepNumber: number;
  name: string;
  status: 'passed' | 'failed';
  durationMs: number;
  assertionMessage?: string;
}

export interface RegionalAgentStatus {
  regionId: string;
  name: string;
  latencyMs: number;
  status: 'ok' | 'degraded' | 'failing';
}

export interface SyntheticMonitor {
  id: string;
  name: string;
  targetUrl: string;
  frequencyMinutes: number;
  status: 'passing' | 'failing' | 'degraded';
  lastRunTimestamp: number;
  regions: RegionalAgentStatus[];
  steps: SyntheticStep[];
}
