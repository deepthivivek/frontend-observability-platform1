/**
 * Autonomous FinOps Feedback Agent (Day 16)
 * Asynchronous background control loop that dynamically adjusts telemetry sampling fidelity
 * and sheds low-priority log volume to maintain strict monthly budget caps.
 */

import { FinOpsAgentState, FinOpsActionLog } from '../../../src/types/governance';

export class AutonomousFinOpsAgent {
  private state: FinOpsAgentState = {
    enabled: true,
    monthlyBudgetUsd: 5000.0,
    currentMonthSpendUsd: 3420.5,
    projectedMonthEndSpendUsd: 4850.0,
    burnRateRps: 2450,
    activeFidelityMode: 'ADAPTIVE_DOWNSAMPLE',
    actionLogs: [
      {
        id: 'fin-001',
        timestamp: Date.now() - 3600000 * 4,
        action: 'DOWNSAMPLE_HTTP_200_SPANS',
        reason: 'Burn rate surge detected (2,800 RPS vs $5k budget cap). Reduced 200 OK sample rate to 10%.',
        savingsImpact: '-$650/mo',
      },
      {
        id: 'fin-002',
        timestamp: Date.now() - 3600000 * 2,
        action: 'QUARANTINE_EXPLOSIVE_CARDINALITY_LABEL',
        reason: 'Quarantined "user_guid" dynamic label on metric "http_requests_total" to prevent $1,400 bill shock.',
        savingsImpact: '-$1,425/mo',
      },
    ],
  };

  public getState(): FinOpsAgentState {
    return { ...this.state };
  }

  public toggleAgent(enabled: boolean): FinOpsAgentState {
    this.state.enabled = enabled;
    return { ...this.state };
  }

  public updateBudget(monthlyBudgetUsd: number): FinOpsAgentState {
    this.state.monthlyBudgetUsd = monthlyBudgetUsd;
    this.evaluateControlLoop();
    return { ...this.state };
  }

  public evaluateControlLoop(): FinOpsActionLog | undefined {
    if (!this.state.enabled) return undefined;

    // If projected spend exceeds budget, step down fidelity
    if (this.state.projectedMonthEndSpendUsd > this.state.monthlyBudgetUsd) {
      this.state.activeFidelityMode = 'MAX_CONSERVATION';
      const log: FinOpsActionLog = {
        id: `fin-${Date.now()}`,
        timestamp: Date.now(),
        action: 'INVOKE_MAX_CONSERVATION_MODE',
        reason: `Projected spend ($${this.state.projectedMonthEndSpendUsd}) breached budget cap ($${this.state.monthlyBudgetUsd}). Activated Max Conservation mode.`,
        savingsImpact: '-$1,200/mo',
      };
      this.state.actionLogs.unshift(log);
      this.state.projectedMonthEndSpendUsd = Math.round(this.state.monthlyBudgetUsd * 0.95);
      return log;
    }

    return undefined;
  }
}

export const globalFinOpsAgent = new AutonomousFinOpsAgent();
