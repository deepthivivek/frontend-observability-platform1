/**
 * Capstone Ultimate Integration Router (Day 20)
 * Exposes endpoints for Ephemeral Digital Twin sandboxes and Federated Anomaly Sync.
 */

import { Router, Request, Response } from 'express';
import { globalDigitalTwinChaos } from '../chaos/digitalTwinChaos';
import { globalFederatedSync } from '../ai/federatedAnomalySync';
import { appendAuditLog } from '../index';

export const capstoneUltimateRouter = Router();

// 1. Capstone Overview
capstoneUltimateRouter.get('/overview', (req: Request, res: Response) => {
  res.json({
    status: 'active',
    platform: 'The Neon Chasm - Full-Stack Observability Platform (Capstone Ultimate Edition)',
    digitalTwin: globalDigitalTwinChaos.getStatus(),
    federatedSync: globalFederatedSync.getStatus(),
    timestamp: Date.now(),
  });
});

// 2. Digital Twin: Get Sandboxes
capstoneUltimateRouter.get('/digital-twin/status', (req: Request, res: Response) => {
  res.json({
    status: globalDigitalTwinChaos.getStatus(),
    sandboxes: globalDigitalTwinChaos.getSandboxes(),
  });
});

// 3. Digital Twin: Spawn Sandbox
capstoneUltimateRouter.post('/digital-twin/spawn', (req: Request, res: Response) => {
  const input = req.body || {};
  if (!input.targetService) {
    return res.status(400).json({ error: 'targetService is required.' });
  }
  try {
    const sandbox = globalDigitalTwinChaos.spawnSandbox(input);
    res.status(201).json({ success: true, sandbox });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Digital Twin: Simulate Chaos
capstoneUltimateRouter.post('/digital-twin/simulate-chaos', (req: Request, res: Response) => {
  const { sandboxId, actor } = req.body || {};
  if (!sandboxId) {
    return res.status(400).json({ error: 'sandboxId is required.' });
  }
  try {
    const sandbox = globalDigitalTwinChaos.simulateChaos(sandboxId, actor);
    res.json({ success: true, sandbox });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 5. Federated: Get Status
capstoneUltimateRouter.get('/federated/status', (req: Request, res: Response) => {
  res.json(globalFederatedSync.getStatus());
});

// 6. Federated: Get Global Model
capstoneUltimateRouter.get('/federated/global-model', (req: Request, res: Response) => {
  res.json({ globalModel: globalFederatedSync.getGlobalModel(), nodes: globalFederatedSync.getNodes() });
});

// 7. Federated: Submit Gradients
capstoneUltimateRouter.post('/federated/submit-gradients', (req: Request, res: Response) => {
  const input = req.body || {};
  if (!input.nodeId || input.modelLoss === undefined) {
    return res.status(400).json({ error: 'nodeId and modelLoss are required.' });
  }
  try {
    const result = globalFederatedSync.submitGradients(input);
    res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});
