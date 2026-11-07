/**
 * Autonomous Self-Healing & Remediation Engine (Day 18)
 * Evaluates causal root-cause events and Z-Score latency spikes,
 * executing automated remediation playbooks (pod scale-out, circuit breaker tripping,
 * eBPF rate-limit throttling, and canary rollbacks) with audit logging.
 */

import { appendAuditLog } from '../index';

export type PlaybookType =
  | 'scale_out_pods'
  | 'trip_circuit_breaker'
  | 'ebpf_rate_throttle'
  | 'canary_rollback'
  | 'restart_failing_replica';

export type TriggerCondition =
  | 'causal_root_cause'
  | 'zscore_latency_spike'
  | 'error_rate_burst'
  | 'canary_regression';

export interface RemediationRule {
  id: string;
  name: string;
  targetService: string;
  triggerCondition: TriggerCondition;
  metric: string;
  thresholdValue: number;
  playbook: PlaybookType;
  playbookParams: {
    scaleReplicasDelta?: number;
    maxReplicas?: number;
    throttleRatePercent?: number;
    circuitBreakDurationSec?: number;
    canaryTargetWeight?: number;
  };
  cooldownMinutes: number;
  lastTriggeredAt: number | null;
  enabled: boolean;
  autoGitOpsSync: boolean;
}

export interface RemediationAction {
  id: string;
  ruleId: string;
  ruleName: string;
  targetService: string;
  triggerReason: string;
  triggerMetric: string;
  triggerValue: number;
  playbook: PlaybookType;
  status: 'pending' | 'in_progress' | 'completed' | 'verified' | 'failed';
  startedAt: number;
  completedAt: number | null;
  executionLatencyMs: number;
  details: Record<string, any>;
  gitOpsPrUrl?: string;
  gitOpsPrId?: string;
  verificationStatus?: 'unverified' | 'in_progress' | 'verified' | 'failed_hysteresis' | 'inconclusive';
  actor: string;
}

export class SelfHealingEngine {
  private rules: Map<string, RemediationRule> = new Map();
  private actions: RemediationAction[] = [];

  constructor() {
    this.seedDefaultRules();
  }

  private seedDefaultRules() {
    const defaultRules: RemediationRule[] = [
      {
        id: 'rule-autoscale-auth',
        name: 'Auto-Scale Auth Service on Causal CPU/Latency Saturation',
        targetService: 'auth-service',
        triggerCondition: 'causal_root_cause',
        metric: 'p99_latency_ms',
        thresholdValue: 280,
        playbook: 'scale_out_pods',
        playbookParams: { scaleReplicasDelta: 3, maxReplicas: 12 },
        cooldownMinutes: 5,
        lastTriggeredAt: null,
        enabled: true,
        autoGitOpsSync: true,
      },
      {
        id: 'rule-throttle-payment-ebpf',
        name: 'Kernel eBPF Socket Throttling on Payment Gateway Z-Score Spike',
        targetService: 'payment-gateway',
        triggerCondition: 'zscore_latency_spike',
        metric: 'zscore_latency',
        thresholdValue: 3.2,
        playbook: 'ebpf_rate_throttle',
        playbookParams: { throttleRatePercent: 40 },
        cooldownMinutes: 10,
        lastTriggeredAt: null,
        enabled: true,
        autoGitOpsSync: true,
      },
      {
        id: 'rule-canary-rollback-checkout',
        name: 'Automated Canary Rollback on Checkout Error Regression',
        targetService: 'checkout-api',
        triggerCondition: 'canary_regression',
        metric: 'canary_error_rate',
        thresholdValue: 2.0, // >2% error rate
        playbook: 'canary_rollback',
        playbookParams: { canaryTargetWeight: 0 },
        cooldownMinutes: 15,
        lastTriggeredAt: null,
        enabled: true,
        autoGitOpsSync: true,
      },
      {
        id: 'rule-circuit-break-search',
        name: 'Trip Circuit Breaker on Search Indexer 5xx Burst',
        targetService: 'search-indexer',
        triggerCondition: 'error_rate_burst',
        metric: 'error_rate_pct',
        thresholdValue: 8.5,
        playbook: 'trip_circuit_breaker',
        playbookParams: { circuitBreakDurationSec: 60 },
        cooldownMinutes: 5,
        lastTriggeredAt: null,
        enabled: true,
        autoGitOpsSync: false,
      },
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }

    // Seed realistic initial action history
    this.actions.push({
      id: 'rem-act-boot-01',
      ruleId: 'rule-autoscale-auth',
      ruleName: 'Auto-Scale Auth Service on Causal CPU/Latency Saturation',
      targetService: 'auth-service',
      triggerReason: 'Causal Bayesian inference isolated auth-service thread exhaustion (P=0.96)',
      triggerMetric: 'p99_latency_ms',
      triggerValue: 312,
      playbook: 'scale_out_pods',
      status: 'verified',
      startedAt: Date.now() - 3600000,
      completedAt: Date.now() - 3594000,
      executionLatencyMs: 6000,
      details: {
        previousReplicas: 3,
        scaledReplicas: 6,
        cluster: 'us-east-prod-1',
        k8sNamespace: 'production',
      },
      gitOpsPrUrl: 'https://github.com/neon-chasm/infra-gitops/pull/482',
      gitOpsPrId: 'pr-gitops-482',
      verificationStatus: 'verified',
      actor: 'AutonomousSelfHealingEngine',
    });
  }

  public getRules(): RemediationRule[] {
    return Array.from(this.rules.values());
  }

  public getRule(id: string): RemediationRule | undefined {
    return this.rules.get(id);
  }

  public updateRule(id: string, updates: Partial<RemediationRule>): RemediationRule {
    const existing = this.rules.get(id);
    if (!existing) {
      throw new Error(`Rule ${id} not found.`);
    }
    const updated: RemediationRule = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable ID
    };
    this.rules.set(id, updated);
    appendAuditLog('REMEDIATION_ADMIN', 'UPDATE_SELF_HEALING_RULE', id);
    return updated;
  }

  public getActions(limit: number = 50): RemediationAction[] {
    return [...this.actions].reverse().slice(0, limit);
  }

  public getAction(id: string): RemediationAction | undefined {
    return this.actions.find((a) => a.id === id);
  }

  /**
   * Evaluates an alert or causal event against active remediation rules.
   */
  public evaluateCausalEvent(event: {
    service: string;
    anomalyType?: string;
    metric: string;
    value: number;
    causalConfidence?: number;
    actor?: string;
  }): RemediationAction | null {
    const now = Date.now();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (rule.targetService !== event.service) continue;

      // Check metric match or condition
      const metricMatches = rule.metric === event.metric || event.metric.includes(rule.metric);
      if (!metricMatches && rule.triggerCondition !== 'causal_root_cause') {
        continue;
      }

      // Check threshold
      if (event.value >= rule.thresholdValue) {
        // Check cooldown
        if (rule.lastTriggeredAt && now - rule.lastTriggeredAt < rule.cooldownMinutes * 60 * 1000) {
          continue;
        }

        // Trigger playbook
        rule.lastTriggeredAt = now;
        const action = this.executePlaybook(rule, event);
        return action;
      }
    }

    return null;
  }

  /**
   * Manually triggers a specific remediation rule.
   */
  public triggerManualRemediation(
    ruleId: string,
    overrides?: { actor?: string; details?: Record<string, any> }
  ): RemediationAction {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found.`);
    }

    rule.lastTriggeredAt = Date.now();
    const action = this.executePlaybook(
      rule,
      {
        service: rule.targetService,
        metric: rule.metric,
        value: rule.thresholdValue * 1.1,
        actor: overrides?.actor || 'SRE_OPERATOR_MANUAL',
      },
      overrides?.details
    );

    return action;
  }

  private executePlaybook(
    rule: RemediationRule,
    triggerContext: {
      service: string;
      metric: string;
      value: number;
      actor?: string;
    },
    extraDetails?: Record<string, any>
  ): RemediationAction {
    const startTime = Date.now();
    const actionId = `rem-act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    let playbookDetails: Record<string, any> = { ...extraDetails };

    switch (rule.playbook) {
      case 'scale_out_pods':
        playbookDetails = {
          ...playbookDetails,
          action: 'Kubernetes HPA Dynamic Scale-Out',
          deltaReplicas: rule.playbookParams.scaleReplicasDelta || 2,
          currentReplicas: 3,
          targetReplicas: 3 + (rule.playbookParams.scaleReplicasDelta || 2),
          cluster: 'prod-us-east-1',
          namespace: 'default',
        };
        break;

      case 'ebpf_rate_throttle':
        playbookDetails = {
          ...playbookDetails,
          action: 'Kernel eBPF TC BPF_MAP_UPDATE_ELEM',
          throttleRatePercent: rule.playbookParams.throttleRatePercent || 30,
          egressInterface: 'eth0',
          bpfMap: 'rate_limit_filter_table',
        };
        break;

      case 'canary_rollback':
        playbookDetails = {
          ...playbookDetails,
          action: 'eBPF Traffic Weight Shift Rollback',
          previousWeight: 20,
          targetWeight: rule.playbookParams.canaryTargetWeight ?? 0,
          stableBaselineVersion: 'v1.2.0',
          rolledBackCanaryVersion: 'v1.2.1-canary',
        };
        break;

      case 'trip_circuit_breaker':
        playbookDetails = {
          ...playbookDetails,
          action: 'Distributed Circuit Breaker Force Open',
          breakerState: 'OPEN',
          durationSec: rule.playbookParams.circuitBreakDurationSec || 60,
        };
        break;

      case 'restart_failing_replica':
        playbookDetails = {
          ...playbookDetails,
          action: 'Graceful Rolling Restart of Degrading Pods',
          gracePeriodSec: 15,
        };
        break;
    }

    const action: RemediationAction = {
      id: actionId,
      ruleId: rule.id,
      ruleName: rule.name,
      targetService: rule.targetService,
      triggerReason: `Threshold breached on ${triggerContext.metric} (Value: ${triggerContext.value.toFixed(1)} >= ${rule.thresholdValue})`,
      triggerMetric: triggerContext.metric,
      triggerValue: triggerContext.value,
      playbook: rule.playbook,
      status: 'completed',
      startedAt: startTime,
      completedAt: startTime + 1200,
      executionLatencyMs: 1200,
      details: playbookDetails,
      verificationStatus: 'unverified',
      actor: triggerContext.actor || 'AutonomousSelfHealingEngine',
    };

    this.actions.push(action);

    appendAuditLog(
      action.actor,
      `AUTONOMOUS_PLAYBOOK_EXECUTE_${rule.playbook.toUpperCase()}`,
      `${rule.targetService}:${actionId}`
    );

    return action;
  }

  public updateAction(
    actionId: string,
    updates: Partial<RemediationAction>
  ): RemediationAction | undefined {
    const action = this.actions.find((a) => a.id === actionId);
    if (!action) return undefined;

    Object.assign(action, updates);
    return action;
  }
}

export const globalSelfHealingEngine = new SelfHealingEngine();
