/**
 * GitOps PR Reconciliation Controller (Day 18)
 * Automatically constructs and submits declarative GitOps Pull Requests
 * (Kubernetes YAML/Kustomize diffs) when out-of-band eBPF or scaling remediations occur,
 * preventing infrastructure drift against Git repositories.
 */

import { appendAuditLog } from '../index';
import { RemediationAction } from './selfHealingEngine';

export interface GitOpsPR {
  id: string;
  title: string;
  branch: string;
  targetRepo: string;
  targetFile: string;
  commitSha: string;
  diff: string;
  status: 'drafted' | 'submitted' | 'merged' | 'reconciled';
  remediationActionId?: string;
  service: string;
  driftDetected: boolean;
  createdAt: number;
  reconciledAt: number | null;
  prUrl: string;
  author: string;
}

export class GitOpsReconciliationController {
  private prs: Map<string, GitOpsPR> = new Map();

  constructor() {
    this.seedPRs();
  }

  private seedPRs() {
    const defaultPRs: GitOpsPR[] = [
      {
        id: 'pr-gitops-482',
        title: 'fix(gitops): reconcile auth-service scale-out HPA minReplicas (3 -> 6)',
        branch: 'gitops/remediation-auth-service-scale-482',
        targetRepo: 'neon-chasm/infra-fleet-gitops',
        targetFile: 'deploy/base/auth-service/hpa.yaml',
        commitSha: '9f8b1c4d2e0a6789123456789abcdef012345678',
        diff: `--- a/deploy/base/auth-service/hpa.yaml
+++ b/deploy/base/auth-service/hpa.yaml
@@ -10,7 +10,7 @@ spec:
   scaleTargetRef:
     apiVersion: apps/v1
     kind: Deployment
     name: auth-service
-  minReplicas: 3
+  minReplicas: 6
   maxReplicas: 15
   metrics:
   - type: Resource`,
        status: 'merged',
        remediationActionId: 'rem-act-boot-01',
        service: 'auth-service',
        driftDetected: false,
        createdAt: Date.now() - 3600000,
        reconciledAt: Date.now() - 3500000,
        prUrl: 'https://github.com/neon-chasm/infra-gitops/pull/482',
        author: 'GitOpsReconciliationController[bot]',
      },
      {
        id: 'pr-gitops-483',
        title: 'chore(ebpf): persist payment-gateway TC rate limit policy (40% throttle)',
        branch: 'gitops/remediation-payment-ebpf-483',
        targetRepo: 'neon-chasm/infra-fleet-gitops',
        targetFile: 'deploy/cilium/policies/payment-ratelimit.yaml',
        commitSha: '4c3d2e1b0a9876543210fedcba9876543210abcd',
        diff: `--- a/deploy/cilium/policies/payment-ratelimit.yaml
+++ b/deploy/cilium/policies/payment-ratelimit.yaml
@@ -8,6 +8,11 @@ spec:
     matchLabels:
       app: payment-gateway
   ingress:
   - fromEndpoints:
     - matchLabels:
         app: checkout-api
+    rateLimit:
+      requestsPerSecond: 850
+      burst: 120
+      ebpfMapThrottlePercent: 40`,
        status: 'submitted',
        service: 'payment-gateway',
        driftDetected: true,
        createdAt: Date.now() - 1800000,
        reconciledAt: null,
        prUrl: 'https://github.com/neon-chasm/infra-gitops/pull/483',
        author: 'GitOpsReconciliationController[bot]',
      },
    ];

    for (const pr of defaultPRs) {
      this.prs.set(pr.id, pr);
    }
  }

  public getPRs(): GitOpsPR[] {
    return Array.from(this.prs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getPR(id: string): GitOpsPR | undefined {
    return this.prs.get(id);
  }

  /**
   * Constructs declarative K8s/Cilium YAML diff and opens a GitOps PR for a self-healing action.
   */
  public createPRForRemediation(action: RemediationAction): GitOpsPR {
    const prNum = Math.floor(484 + this.prs.size);
    const prId = `pr-gitops-${prNum}`;
    const branch = `gitops/remediation-${action.targetService}-${action.id.slice(-6)}`;
    const commitSha = Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10);

    let targetFile = `deploy/overlays/prod/${action.targetService}.yaml`;
    let diff = '';

    if (action.playbook === 'scale_out_pods') {
      const replicas = action.details?.targetReplicas || 5;
      targetFile = `deploy/base/${action.targetService}/hpa.yaml`;
      diff = `--- a/${targetFile}
+++ b/${targetFile}
@@ -12,5 +12,5 @@ spec:
   scaleTargetRef:
     apiVersion: apps/v1
     kind: Deployment
     name: ${action.targetService}
-  minReplicas: ${action.details?.currentReplicas || 2}
+  minReplicas: ${replicas}
   maxReplicas: 20`;
    } else if (action.playbook === 'ebpf_rate_throttle') {
      targetFile = `deploy/cilium/policies/${action.targetService}-ratelimit.yaml`;
      diff = `--- a/${targetFile}
+++ b/${targetFile}
@@ -10,3 +10,7 @@ spec:
   ingress:
   - fromEndpoints:
     - matchLabels:
         app: ingress-gateway
+    rateLimit:
+      ebpfThrottleRatePercent: ${action.details?.throttleRatePercent || 30}
+      bpfMapPinnedPath: ${action.details?.bpfMap || 'rate_limit_filter_table'}`;
    } else if (action.playbook === 'canary_rollback') {
      targetFile = `deploy/istio/virtualservices/${action.targetService}-routing.yaml`;
      diff = `--- a/${targetFile}
+++ b/${targetFile}
@@ -15,7 +15,7 @@ spec:
       route:
       - destination:
           host: ${action.targetService}
           subset: v1
-        weight: 85
+        weight: 100
       - destination:
           host: ${action.targetService}
           subset: canary
-        weight: 15
+        weight: 0`;
    } else {
      diff = `--- a/${targetFile}
+++ b/${targetFile}
@@ -1,3 +1,5 @@
+# Automated runtime remediation declarative sync
+# Action: ${action.id}
+# Trigger: ${action.triggerReason}`;
    }

    const pr: GitOpsPR = {
      id: prId,
      title: `fix(gitops): reconcile ${action.targetService} ${action.playbook.replace(/_/g, ' ')}`,
      branch,
      targetRepo: 'neon-chasm/infra-fleet-gitops',
      targetFile,
      commitSha,
      diff,
      status: 'submitted',
      remediationActionId: action.id,
      service: action.targetService,
      driftDetected: true,
      createdAt: Date.now(),
      reconciledAt: null,
      prUrl: `https://github.com/neon-chasm/infra-gitops/pull/${prNum}`,
      author: 'GitOpsReconciliationController[bot]',
    };

    this.prs.set(pr.id, pr);

    appendAuditLog(
      'GITOPS_RECONCILER',
      'CREATE_DECLARATIVE_PR',
      `${pr.targetRepo}#${prNum} (${action.targetService})`
    );

    return pr;
  }

  /**
   * Simulates merging the PR and syncing declarative Git state to runtime.
   */
  public reconcilePR(prId: string, actor: string = 'SRE_OPERATOR'): GitOpsPR {
    const pr = this.prs.get(prId);
    if (!pr) {
      throw new Error(`GitOps PR ${prId} not found.`);
    }

    pr.status = 'reconciled';
    pr.driftDetected = false;
    pr.reconciledAt = Date.now();

    appendAuditLog(actor, 'GITOPS_PR_RECONCILED', `${pr.id} (${pr.service})`);
    return pr;
  }

  /**
   * Scans current cluster state vs declarative Git repo to detect drift.
   */
  public checkDrift(): { totalPRs: number; openDriftCount: number; syncedCount: number } {
    let openDriftCount = 0;
    let syncedCount = 0;

    for (const pr of this.prs.values()) {
      if (pr.driftDetected) {
        openDriftCount++;
      } else {
        syncedCount++;
      }
    }

    return {
      totalPRs: this.prs.size,
      openDriftCount,
      syncedCount,
    };
  }
}

export const globalGitOpsReconciler = new GitOpsReconciliationController();
