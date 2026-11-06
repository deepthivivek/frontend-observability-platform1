import { AnomalyRule, DetectedAnomaly } from './telemetry';

export type AlertMetricType = 'latency' | 'error_rate' | 'rps' | 'slo_burn';
export type AlertSeverity = 'P1-Critical' | 'P2-Warning' | 'P3-Info';
export type AlertOperator = '>' | '<' | '=';
export type IncidentStatus = 'firing' | 'acknowledged' | 'resolved';

export interface AlertRule {
  id: string;
  name: string;
  metric: AlertMetricType;
  operator: AlertOperator;
  threshold: number;
  unit: string;
  windowMinutes: number;
  environment: 'Production' | 'Staging' | 'All';
  serviceScope?: string;
  severity: AlertSeverity;
  flappingDampingCount: number; // e.g. require 3 consecutive violations
  autoEscalateMinutes: number; // e.g. 5 mins unacknowledged -> escalate
  remediationAction?: 'Flush Redis Cache' | 'Rollback Release' | 'Scale Out Pods' | 'None';
  silencingWindow?: {
    enabled: boolean;
    startIso: string;
    endIso: string;
    reason: string;
  };
  enabled: boolean;
}

export interface IncidentTimelineEvent {
  timestamp: number;
  event: string;
  author?: string;
  metricValue?: number;
}

export interface Incident {
  id: string;
  ruleId: string;
  title: string;
  severity: AlertSeverity;
  status: IncidentStatus;
  startedAt: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  acknowledgementNotes?: string;
  resolvedAt?: number;
  currentValue: number;
  threshold: number;
  environment: string;
  service: string;
  rootCauseTraceId?: string;
  subAlertsCount: number;
  timeline: IncidentTimelineEvent[];
  remediationTriggered?: string;
  postMortemReport?: string;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'slack' | 'pagerduty' | 'webhook';
  endpointOrKey: string;
  status: 'healthy' | 'unreachable';
  lastPingTimestamp: number;
}

export interface OnCallShift {
  primary: string;
  secondary: string;
  rotationName: string;
  untilIso: string;
}
