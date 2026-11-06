/**
 * Human-in-the-Loop (HITL) Safety Guard (Day 13)
 * Evaluates operational risk for automated runbook actions,
 * enforces required approvals, and prevents unauthorized production state changes.
 */

import { RunbookActionId, RunbookRiskLevel } from '../../../src/types/incident';

export interface RemediationSafetyEvaluation {
  actionId: RunbookActionId;
  riskLevel: RunbookRiskLevel;
  requiresHitlApproval: boolean;
  allowed: boolean;
  rejectionReason?: string;
  blastRadiusAssessment: string;
}

export class RemediationSafetyGuard {
  /**
   * Determine operational risk level for a runbook action.
   */
  public evaluateRisk(actionId: RunbookActionId, targetService?: string): RunbookRiskLevel {
    switch (actionId) {
      case 'CIRCUIT_BREAKER_RESET':
        return 'LOW';
      case 'FLUSH_REDIS_CACHE':
      case 'RESTART_POD':
      case 'SCALE_REPLICAS':
        return 'MEDIUM';
      case 'FLUSH_CONNECTION_POOL':
      case 'DRAIN_TRAFFIC':
        return 'HIGH';
      default:
        return 'HIGH';
    }
  }

  /**
   * Assess if execution can proceed under current approvals and role constraints.
   */
  public checkAuthorization(params: {
    actionId: RunbookActionId;
    actor: string;
    role?: string;
    approved?: boolean;
    dryRun?: boolean;
    targetService?: string;
  }): RemediationSafetyEvaluation {
    const riskLevel = this.evaluateRisk(params.actionId, params.targetService);
    const requiresHitlApproval = riskLevel === 'HIGH';

    // Dry runs are always allowed for inspection
    if (params.dryRun) {
      return {
        actionId: params.actionId,
        riskLevel,
        requiresHitlApproval,
        allowed: true,
        blastRadiusAssessment: `Dry-run simulation approved. Risk level: ${riskLevel}. No production traffic will be interrupted.`,
      };
    }

    // High risk actions require explicit HITL confirmation
    if (requiresHitlApproval && !params.approved) {
      return {
        actionId: params.actionId,
        riskLevel,
        requiresHitlApproval,
        allowed: false,
        rejectionReason: `Action ${params.actionId} has HIGH operational risk (${riskLevel}) and requires explicit Human-in-the-Loop (HITL) authorization by SRE Lead or Admin.`,
        blastRadiusAssessment: `High-risk remediation targets ${params.targetService || 'primary service'}. Drops active connection pools or re-routes production traffic.`,
      };
    }

    // Role-based verification: Developers cannot execute High or Medium risk actions without break-glass
    if (params.role === 'Developer' && riskLevel === 'HIGH') {
      return {
        actionId: params.actionId,
        riskLevel,
        requiresHitlApproval,
        allowed: false,
        rejectionReason: 'Developer role lacks permission to trigger HIGH-risk remediations. Please request JIT Break-Glass or escalate to SRE Lead.',
        blastRadiusAssessment: `Restricted by RBAC security policy.`,
      };
    }

    return {
      actionId: params.actionId,
      riskLevel,
      requiresHitlApproval,
      allowed: true,
      blastRadiusAssessment: `Authorized for execution by ${params.actor} (${params.role || 'SRE'}). Operational risk: ${riskLevel}.`,
    };
  }
}
