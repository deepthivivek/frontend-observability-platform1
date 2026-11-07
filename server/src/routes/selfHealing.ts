/**
 * Express API Self-Healing & Incident Router (Day 18)
 * Endpoints for autonomous remediation playbooks, canary rollback controller,
 * reinforcement learning eBPF loop, GitOps PR reconciliation, closed-loop verification,
 * and automated post-mortem synthesis.
 */

import { Router, Request, Response } from 'express';
import { globalSelfHealingEngine } from '../infra/selfHealingEngine';
import { globalCanaryController } from '../infra/canaryRollbackController';
import { globalRLControlLoop } from '../infra/rlControlLoop';
import { globalGitOpsReconciler } from '../infra/gitopsReconciler';
import { globalRemediationVerifier } from '../infra/remediationVerifier';
import { globalPostMortemSynthesizer } from '../infra/postMortemSynthesizer';
import { appendAuditLog } from '../index';

export const selfHealingRouter = Router();

// 1. Overview & Health Matrix
selfHealingRouter.get('/overview', (req: Request, res: Response) => {
  const rules = globalSelfHealingEngine.getRules();
  const actions = globalSelfHealingEngine.getActions(10);
  const canaries = globalCanaryController.getDeployments();
  const rl = globalRLControlLoop.getStatus();
  const drift = globalGitOpsReconciler.checkDrift();
  const postMortems = globalPostMortemSynthesizer.getPostMortems();

  res.json({
    status: 'active',
    autonomousRemediationActive: true,
    totalRules: rules.length,
    activeRulesCount: rules.filter((r) => r.enabled).length,
    actionsCount: actions.length,
    canaryDeploymentsCount: canaries.length,
    rlConvergenceScore: rl.convergenceScore,
    gitopsDrift: drift,
    totalPostMortems: postMortems.length,
    timestamp: Date.now(),
  });
});

// 2. Trigger Remediation Action (Manual or Causal Event)
selfHealingRouter.post('/trigger', (req: Request, res: Response) => {
  const { ruleId, service, metric, value, causalConfidence, actor } = req.body || {};

  if (ruleId) {
    try {
      const action = globalSelfHealingEngine.triggerManualRemediation(ruleId, { actor });
      // If rule specifies auto GitOps sync, draft PR
      const rule = globalSelfHealingEngine.getRule(ruleId);
      if (rule?.autoGitOpsSync) {
        const pr = globalGitOpsReconciler.createPRForRemediation(action);
        action.gitOpsPrUrl = pr.prUrl;
        action.gitOpsPrId = pr.id;
      }
      return res.status(201).json({ success: true, action });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  }

  if (service && metric && value !== undefined) {
    const action = globalSelfHealingEngine.evaluateCausalEvent({
      service,
      metric,
      value: Number(value),
      causalConfidence: causalConfidence ? Number(causalConfidence) : undefined,
      actor,
    });

    if (action) {
      const rule = globalSelfHealingEngine.getRule(action.ruleId);
      if (rule?.autoGitOpsSync) {
        const pr = globalGitOpsReconciler.createPRForRemediation(action);
        action.gitOpsPrUrl = pr.prUrl;
        action.gitOpsPrId = pr.id;
      }
      return res.status(201).json({ triggered: true, action });
    } else {
      return res.json({
        triggered: false,
        message: 'No active remediation rule matched or threshold not reached / in cooldown.',
      });
    }
  }

  return res.status(400).json({ error: 'Either ruleId or service, metric, and value are required.' });
});

// 3. List Remediation Actions
selfHealingRouter.get('/actions', (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  res.json({ actions: globalSelfHealingEngine.getActions(limit) });
});

// 4. List Remediation Rules
selfHealingRouter.get('/rules', (req: Request, res: Response) => {
  res.json({ rules: globalSelfHealingEngine.getRules() });
});

// 5. Update Remediation Rule
selfHealingRouter.put('/rules/:id', (req: Request, res: Response) => {
  try {
    const updated = globalSelfHealingEngine.updateRule(req.params.id as string, req.body || {});
    res.json({ rule: updated });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 6. Canary Deployments
selfHealingRouter.get('/canary', (req: Request, res: Response) => {
  res.json({ deployments: globalCanaryController.getDeployments() });
});

// 7. Canary Rollback
selfHealingRouter.post('/canary/rollback', (req: Request, res: Response) => {
  const { deploymentId, reason, actor } = req.body || {};
  if (!deploymentId) {
    return res.status(400).json({ error: 'deploymentId is required.' });
  }
  try {
    const dep = globalCanaryController.triggerRollback(
      deploymentId,
      reason || 'Manual SRE Operator Triggered Rollback',
      actor || 'SRE_OPERATOR'
    );
    res.json({ success: true, deployment: dep });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 8. Canary Set Traffic Weight
selfHealingRouter.post('/canary/traffic', (req: Request, res: Response) => {
  const { deploymentId, canaryWeight, actor } = req.body || {};
  if (!deploymentId || canaryWeight === undefined) {
    return res.status(400).json({ error: 'deploymentId and canaryWeight are required.' });
  }
  try {
    const dep = globalCanaryController.setTrafficWeight(deploymentId, Number(canaryWeight), actor);
    res.json({ success: true, deployment: dep });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 9. Canary Promote
selfHealingRouter.post('/canary/promote', (req: Request, res: Response) => {
  const { deploymentId, actor } = req.body || {};
  if (!deploymentId) {
    return res.status(400).json({ error: 'deploymentId is required.' });
  }
  try {
    const dep = globalCanaryController.promoteCanary(deploymentId, actor);
    res.json({ success: true, deployment: dep });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 10. RL eBPF Loop Status
selfHealingRouter.get('/rl/status', (req: Request, res: Response) => {
  res.json({
    ...globalRLControlLoop.getStatus(),
    hyperparameters: globalRLControlLoop.getHyperparameters(),
    actions: globalRLControlLoop.getActions(),
  });
});

// 11. RL Step / Train
selfHealingRouter.post('/rl/step', (req: Request, res: Response) => {
  const feedback = req.body || {};
  const result = globalRLControlLoop.step(feedback);
  res.json({ result });
});

// 12. Update RL Hyperparameters
selfHealingRouter.put('/rl/hyperparameters', (req: Request, res: Response) => {
  const updated = globalRLControlLoop.updateHyperparameters(req.body || {});
  res.json({ hyperparameters: updated });
});

// 13. GitOps PRs & Drift
selfHealingRouter.get('/gitops/prs', (req: Request, res: Response) => {
  res.json({
    prs: globalGitOpsReconciler.getPRs(),
    drift: globalGitOpsReconciler.checkDrift(),
  });
});

// 14. GitOps Reconcile PR
selfHealingRouter.post('/gitops/reconcile', (req: Request, res: Response) => {
  const { prId, actor } = req.body || {};
  if (!prId) {
    return res.status(400).json({ error: 'prId is required.' });
  }
  try {
    const reconciled = globalGitOpsReconciler.reconcilePR(prId, actor);
    res.json({ success: true, pr: reconciled });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 15. Closed-Loop Remediation Verification
selfHealingRouter.post('/verify', (req: Request, res: Response) => {
  const { actionId, targetService, beforeMetrics } = req.body || {};
  if (!actionId || !targetService) {
    return res.status(400).json({ error: 'actionId and targetService are required.' });
  }
  const report = globalRemediationVerifier.runVerification(actionId, targetService, beforeMetrics);
  // Update action verification status
  globalSelfHealingEngine.updateAction(actionId, {
    verificationStatus: report.status,
  });
  res.json({ report });
});

// 16. Verification Reports
selfHealingRouter.get('/verify/reports', (req: Request, res: Response) => {
  res.json({ reports: globalRemediationVerifier.getReports() });
});

// 17. Post-Mortems List
selfHealingRouter.get('/postmortems', (req: Request, res: Response) => {
  res.json({ postMortems: globalPostMortemSynthesizer.getPostMortems() });
});

// 18. Generate Post-Mortem
selfHealingRouter.post('/postmortems/generate', (req: Request, res: Response) => {
  const input = req.body || {};
  if (!input.incidentId || !input.service) {
    return res.status(400).json({ error: 'incidentId and service are required.' });
  }
  const pm = globalPostMortemSynthesizer.generatePostMortem(input);
  res.status(201).json({ postMortem: pm });
});

// 19. Download Post-Mortem Markdown
selfHealingRouter.get('/postmortems/:id/download', (req: Request, res: Response) => {
  const pm = globalPostMortemSynthesizer.getPostMortem(req.params.id as string);
  if (!pm) {
    return res.status(404).json({ error: `Post-Mortem ${req.params.id as string} not found.` });
  }
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${pm.id}.md"`);
  res.send(pm.markdown);
});
