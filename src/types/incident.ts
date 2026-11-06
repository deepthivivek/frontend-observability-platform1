export type IncidentSeverity = 'P1-CRITICAL' | 'P2-HIGH' | 'P3-MEDIUM' | 'P4-LOW';
export type IncidentStatus = 'INVESTIGATING' | 'IDENTIFIED' | 'MITIGATING' | 'RESOLVED';

export type RunbookActionId =
  | 'FLUSH_REDIS_CACHE'
  | 'RESTART_POD'
  | 'CIRCUIT_BREAKER_RESET'
  | 'FLUSH_CONNECTION_POOL'
  | 'SCALE_REPLICAS'
  | 'DRAIN_TRAFFIC';

export type RunbookRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RunbookDefinition {
  actionId: RunbookActionId;
  title: string;
  description: string;
  riskLevel: RunbookRiskLevel;
  requiresHitlApproval: boolean;
  targetService: string;
  parameters?: Record<string, string | number | boolean>;
}

export interface RunbookExecutionResult {
  executionId: string;
  actionId: RunbookActionId;
  status: 'SUCCESS' | 'FAILED' | 'REJECTED_HITL_REQUIRED';
  targetService: string;
  durationMs: number;
  stdout: string[];
  stderr: string[];
  dryRun: boolean;
  auditEventId: string;
  auditSignature: string;
  executedBy: string;
  timestamp: number;
  riskLevel: RunbookRiskLevel;
  message?: string;
}

export interface IncidentBlastRadius {
  affectedUserSessions: number;
  frustrationScore: number;
  revenueImpactEstimated: number; // in USD
  directServices: string[];
  downstreamServices: string[];
  sloBurnRate: number; // e.g. 14.2x
}

export interface IncidentTimelineEvent {
  timestamp: number;
  type: 'DETECTION' | 'ESCALATION' | 'INVESTIGATION' | 'MITIGATION' | 'RESOLUTION';
  message: string;
  actor: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startedAt: number;
  resolvedAt?: number;
  leadSre: string;
  primaryService: string;
  affectedServices: string[];
  errorRatePeak: number; // percentage
  p99LatencyMs: number;
  blastRadius: IncidentBlastRadius;
  rootCause?: string;
  timeline: IncidentTimelineEvent[];
  correlatedTraceIds: string[];
  topErrors: Array<{
    message: string;
    stack?: string;
    count: number;
    service: string;
  }>;
  suggestedRunbooks: RunbookDefinition[];
}

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  structuredInsight?: {
    rootCause?: string;
    affectedMicroservices?: string[];
    recommendedRunbooks?: RunbookDefinition[];
    correlatedLogs?: Array<{ timestamp: number; level: string; message: string; service: string }>;
    blastRadiusSummary?: string;
    zScoreImpact?: number;
  };
}

export interface PostMortemReport {
  incidentId: string;
  title: string;
  generatedAt: number;
  author: string;
  markdown: string;
  sections: {
    executiveSummary: string;
    timeline: string[];
    impact: string;
    rootCause: string;
    triggerRemediations: string[];
    actionItems: Array<{
      priority: 'P0' | 'P1' | 'P2';
      task: string;
      owner: string;
      status: 'TODO' | 'IN_PROGRESS' | 'DONE';
    }>;
    lessonsLearned: {
      whatWentWell: string[];
      whatWentPoorly: string[];
      whereWeGotLucky: string[];
    };
  };
}
