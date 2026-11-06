export type CardinalityRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'EXPLOSIVE';

export interface CardinalityMetric {
  id: string;
  metricName: string;
  labelCount: number;
  cardinalityRisk: CardinalityRisk;
  estimatedStorageBloatGb: number;
  estimatedCostMonthlyUsd: number;
  quarantined: boolean;
  offendingLabel: string;
}

export interface SamplingPolicyRule {
  id: string;
  name: string;
  targetMetricOrEndpoint: string;
  sampleRatePercent: number;
  preserveErrors: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
}

export interface SimulationResult {
  policyId: string;
  monthlyCostSavingsUsd: number;
  retainedErrorTraceRatio: number;
  projectedMonthlyGb: number;
  currentMonthlyGb: number;
}

export interface eBPFThrottlerStatus {
  enabled: boolean;
  droppedPacketsCount: number;
  ingestionRateRps: number;
  kernelLatencyMs: number;
  queueSaturationPercent: number;
  activeSocketSheds: number;
}

export interface FinOpsActionLog {
  id: string;
  timestamp: number;
  action: string;
  reason: string;
  savingsImpact: string;
}

export interface FinOpsAgentState {
  enabled: boolean;
  monthlyBudgetUsd: number;
  currentMonthSpendUsd: number;
  projectedMonthEndSpendUsd: number;
  burnRateRps: number;
  activeFidelityMode: 'HIGH_PRECISION' | 'ADAPTIVE_DOWNSAMPLE' | 'MAX_CONSERVATION';
  actionLogs: FinOpsActionLog[];
}

export interface ZKPAttestationReceipt {
  proofId: string;
  timestamp: number;
  merkleRootHash: string;
  zkProofHash: string;
  samplingPolicyVersion: string;
  totalIngestedGbProven: number;
  totalBilledAmountUsd: number;
  verificationBadge: 'VERIFIED_ZERO_KNOWLEDGE' | 'INVALID_PROOF';
}

export type ChaosFaultType = 'LATENCY_INJECTION' | 'PACKET_LOSS' | 'CPU_STARVATION' | 'SERVICE_KILL';

export interface ChaosExperiment {
  id: string;
  name: string;
  faultType: ChaosFaultType;
  targetService: string;
  durationSeconds: number;
  intensityPercent: number;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'HALTED';
  recoveryTimeMttrMs: number;
  resilienceScore: number;
  circuitBreakerTripped: boolean;
}

export interface FHEPipelineStatus {
  enabled: boolean;
  ciphertextOpsPerSec: number;
  encryptedMetricsCount: number;
  plaintextDataExposedRatio: number;
  activeLatticeScheme: string;
  keyBits: number;
}
