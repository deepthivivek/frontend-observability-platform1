export type ComplianceStandard = 'SOC2' | 'GDPR' | 'HIPAA';
export type ControlStatus = 'PASSED' | 'WARNING' | 'FAILED';

export interface ComplianceControl {
  id: string;
  standard: ComplianceStandard;
  category: string;
  title: string;
  description: string;
  status: ControlStatus;
  lastAssessedAt: number;
  evidenceRef: string;
}

export interface SIEMWebhookConfig {
  id: string;
  name: string;
  destinationUrl: string;
  secretToken: string;
  eventTypeFilter: string[];
  enabled: boolean;
  lastDispatchedAt?: number;
  successCount: number;
  failureCount: number;
}

export interface DeadLetterQueueItem {
  id: string;
  webhookId: string;
  destinationUrl: string;
  payload: unknown;
  errorCode: string;
  errorMessage: string;
  attemptCount: number;
  failedAt: number;
  status: 'PENDING_REDRIVE' | 'REDRIVED_SUCCESS' | 'DROPPED';
}

export interface ComplianceExportPackage {
  exportId: string;
  generatedAt: number;
  signedBy: string;
  merkleRootHash: string;
  totalControls: number;
  passedControls: number;
  complianceScore: number; // 0-100%
  controls: ComplianceControl[];
  auditLogsCount: number;
  cryptographicSignature: string;
}
