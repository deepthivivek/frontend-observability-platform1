/**
 * Governance, FinOps, eBPF, ZKP, Chaos & FHE API Router (Day 16)
 * Exposes endpoints for cardinality inspection, sampling policies, cost simulations,
 * eBPF socket status, autonomous FinOps agent state, ZKP attestation proofs,
 * chaos experiment execution, and Fully Homomorphic Encryption status.
 */

import { Router, Request, Response } from 'express';
import { globalCardinalityEngine } from '../governance/cardinalityEngine';
import { globalSamplingPolicyManager } from '../governance/samplingPolicy';
import { globalRemediationEngine } from '../governance/remediationEngine';
import { globalEBPFThrottler } from '../governance/ebpfThrottler';
import { globalFinOpsAgent } from '../governance/autonomousFinOpsAgent';
import { globalZKPAttestation } from '../governance/zkpFinOpsAttestation';
import { globalChaosEngine } from '../chaos/chaosEngine';
import { globalFHEGateway } from '../gateway/homomorphicEncryption';
import { appendAuditLog } from '../index';

export const governanceRouter = Router();

// 1. Cardinality Report
governanceRouter.get('/cardinality', (req: Request, res: Response) => {
  res.json({
    metrics: globalCardinalityEngine.getCardinalityReport(),
  });
});

// 2. Quarantine High-Cardinality Metric
governanceRouter.post('/cardinality/quarantine', (req: Request, res: Response) => {
  const { metricId, quarantined } = req.body || {};
  if (!metricId) {
    return res.status(400).json({ error: 'metricId is required.' });
  }
  const updated = globalCardinalityEngine.quarantineMetric(metricId, quarantined !== false);
  appendAuditLog('FINOPS_ADMIN', 'QUARANTINE_CARDINALITY_METRIC', metricId);
  res.json({ metric: updated });
});

// 3. Sampling Policies
governanceRouter.get('/sampling/policies', (req: Request, res: Response) => {
  res.json({
    policies: globalSamplingPolicyManager.getRules(),
  });
});

// 4. Simulate Remediation / Sampling Savings
governanceRouter.post('/simulate', (req: Request, res: Response) => {
  const { policyId, proposedSampleRate } = req.body || {};
  if (!policyId || proposedSampleRate === undefined) {
    return res.status(400).json({ error: 'policyId and proposedSampleRate are required.' });
  }
  const simulation = globalRemediationEngine.simulateSamplingChange(policyId, Number(proposedSampleRate));
  res.json(simulation);
});

// 5. eBPF Socket Throttler Status
governanceRouter.get('/ebpf/status', (req: Request, res: Response) => {
  res.json(globalEBPFThrottler.getStatus());
});

// 6. Autonomous FinOps Agent State & Controls
governanceRouter.get('/finops/agent', (req: Request, res: Response) => {
  res.json(globalFinOpsAgent.getState());
});

governanceRouter.post('/finops/agent/toggle', (req: Request, res: Response) => {
  const { enabled } = req.body || {};
  const state = globalFinOpsAgent.toggleAgent(Boolean(enabled));
  appendAuditLog('FINOPS_ADMIN', 'TOGGLE_AUTONOMOUS_FINOPS_AGENT', String(enabled));
  res.json(state);
});

// 7. ZKP FinOps Attestation Proofs
governanceRouter.get('/finops/zkp-proofs', (req: Request, res: Response) => {
  res.json({
    receipts: globalZKPAttestation.getReceipts(),
  });
});

// 8. Chaos Engineering Experiments
governanceRouter.get('/chaos/experiments', (req: Request, res: Response) => {
  res.json({
    experiments: globalChaosEngine.getExperiments(),
  });
});

governanceRouter.post('/chaos/run', (req: Request, res: Response) => {
  const { experimentId } = req.body || {};
  if (!experimentId) {
    return res.status(400).json({ error: 'experimentId is required.' });
  }
  const result = globalChaosEngine.runExperiment(experimentId);
  appendAuditLog('CHAOS_ADMIN', 'EXECUTE_CHAOS_FAULT_INJECTION', experimentId);
  res.json({ experiment: result });
});

// 9. Homomorphic Encryption Gateway Status
governanceRouter.get('/fhe/status', (req: Request, res: Response) => {
  res.json(globalFHEGateway.getStatus());
});

// 10. Homomorphic Ciphertext Aggregation Test
governanceRouter.post('/fhe/aggregate', (req: Request, res: Response) => {
  const { values } = req.body || {};
  const numList: number[] = Array.isArray(values) ? values.map(Number) : [120, 240, 180];
  
  const encryptedPayloads = numList.map((v) => globalFHEGateway.encryptScalar(v));
  const ciphertexts = encryptedPayloads.map((p) => p.encryptedCiphertext);

  const aggResult = globalFHEGateway.computeHomomorphicAverage(ciphertexts);

  res.json({
    inputValuesCount: numList.length,
    encryptedAverageCiphertext: aggResult.encryptedAverageCiphertext,
    opsPerformed: aggResult.totalOpsCount,
    zeroPlaintextLeakage: aggResult.zeroPlaintextLeakage,
    fheScheme: globalFHEGateway.getStatus().activeLatticeScheme,
  });
});
