export interface TraceSpan {
  id?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  service?: string;
  serviceName?: string;
  name: string;
  startTimeOffsetMs?: number;
  startTimeMs?: number;
  durationMs: number;
  status?: 'ok' | 'warning' | 'error';
  statusCode?: number;
  baselineDurationMs?: number;
  tags?: Record<string, string>;
  attributes?: Record<string, string | number | boolean>;
  isAnomaly?: boolean;
  zScore?: number;
  rootCause?: {
    isRootCause: boolean;
    bottleneckReason?: string;
    remediation?: string;
  };
}

export interface TraceSpanNode extends TraceSpan {
  traceId: string;
  spanId: string;
  serviceName: string;
  startTimeMs: number;
  statusCode: number;
  attributes: Record<string, string | number | boolean>;
  children: TraceSpanNode[];
  depth: number;
  offsetMs: number;
}

export interface TraceSummary {
  traceId: string;
  rootServiceName: string;
  rootEndpoint: string;
  startTimeMs: number;
  totalDurationMs: number;
  spanCount: number;
  statusCode: number;
  hasErrors: boolean;
  hasAnomalies: boolean;
  services: string[];
  rootCauseService?: string;
  rootCauseReason?: string;
}

export interface TraceTree {
  traceId: string;
  rootSpan: TraceSpanNode;
  spansCount: number;
  totalDurationMs: number;
  hasAnomalies: boolean;
  hasErrors: boolean;
  services: string[];
  timestamp: number;
  rootCause?: {
    bottleneckSpanId: string;
    serviceName: string;
    reason: string;
    remediation: string;
  };
}

export interface ServiceTopologyNode {
  id: string;
  name: string;
  type: 'gateway' | 'service' | 'database' | 'cache' | 'external';
  requestCount: number;
  errorRate: number;
  avgLatencyMs: number;
  status: 'healthy' | 'degraded' | 'critical';
}

export interface ServiceTopologyEdge {
  id: string;
  source: string;
  target: string;
  callCount: number;
  avgLatencyMs: number;
  errorRate: number;
  isDegraded: boolean;
}

export interface ServiceTopologyMapData {
  nodes: ServiceTopologyNode[];
  edges: ServiceTopologyEdge[];
  timestamp: number;
}

export interface TraceFilterOptions {
  serviceName?: string;
  minDurationMs?: number;
  hasError?: boolean;
  onlyAnomalies?: boolean;
  searchQuery?: string;
}

export interface AITriageDiagnosis {
  hypothesis: string;
  impactAssessment: string;
  recommendedFix: string;
  suggestedSnippet: string;
  snippetType: 'sql' | 'code';
}

export interface IncidentNote {
  id: string;
  author: string;
  timestamp: number;
  text: string;
}
