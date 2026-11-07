export type LogRegionId = 'us-east' | 'eu-west' | 'ap-south';

export interface LogRegionCluster {
  regionId: LogRegionId;
  name: string;
  activeNodes: number;
  ingestionRateGbs: number;
  replicationLagMs: number;
  partitionStatus: 'HEALTHY' | 'SYNCING' | 'DEGRADED';
  totalStoredLogs: number;
}

export interface ScrubbedLogEntry {
  id: string;
  timestamp: number;
  region: LogRegionId;
  clusterNode: string;
  streamLabels: Record<string, string>;
  rawLogLine: string;
  scrubbedLogLine: string;
  piiTokensMasked: string[];
  traceId: string;
  spanId: string;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  vectorEmbedding?: number[];
}

export interface LogQLSelector {
  label: string;
  operator: '=' | '!=' | '=~' | '!~';
  value: string;
}

export interface LogQLFilter {
  operator: '|=' | '!=' | '~' | '!~' | '~*' | '|~*';
  pattern: string;
}

export interface LogQLQueryAST {
  rawQuery: string;
  selectors: LogQLSelector[];
  filters: LogQLFilter[];
  aggregationFunction?: 'rate' | 'count_over_time';
  aggregationWindow?: string;
  isSemanticVectorSearch?: boolean;
}

export interface CausalNode {
  id: string;
  service: string;
  anomalyType: string;
  probabilityScore: number;
  contributingLogCount: number;
  linkedTraceId: string;
  causalDirection: string;
}

export interface CausalAnalysisResult {
  primaryRootCauseService: string;
  rootCauseProbability: number;
  confidenceScore: number;
  causalChain: CausalNode[];
  recommendedRemediation: string;
}

export interface ZKLogProof {
  proofId: string;
  shardId: string;
  region: LogRegionId;
  timestamp: number;
  merkleRootHash: string;
  zkProofSnarkHash: string;
  retrievabilityStatus: 'VERIFIED' | 'FAILED';
  totalBytesProven: number;
}

export interface LogQueryResult {
  query: string;
  ast: LogQLQueryAST;
  logs: ScrubbedLogEntry[];
  totalMatched: number;
  queryExecutionMs: number;
  derivedMetricTimeSeries?: Array<{ timestamp: number; value: number }>;
  causalAnalysis?: CausalAnalysisResult;
  zkProof?: ZKLogProof;
}
