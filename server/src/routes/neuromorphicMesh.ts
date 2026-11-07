import { Router, Request, Response } from 'express';
import { neuromorphicEngine } from '../ai/neuromorphicPredictor';
import { meshRingController } from '../mesh/autonomousMeshRing';
import { slimeMouldOptimizer } from '../mesh/slimeMouldOptimizer';
import { biophotonicSync } from '../crypto/biophotonicSync';

const router = Router();

// Neuromorphic SNN Endpoints
router.get('/neuromorphic/spikes', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  res.json({ spikes: neuromorphicEngine.getSpikes(limit) });
});

router.post('/neuromorphic/simulate-burst', (req: Request, res: Response) => {
  const { intensity } = req.body || {};
  const result = neuromorphicEngine.simulateBurst(intensity ? parseFloat(intensity) : 1.2);
  res.json(result);
});

router.get('/neuromorphic/membrane-state', (req: Request, res: Response) => {
  res.json(neuromorphicEngine.getMembraneState());
});

// Autonomous Mesh Ring Endpoints
router.get('/mesh-ring/topology', (req: Request, res: Response) => {
  res.json(meshRingController.getTopology());
});

router.post('/mesh-ring/isolate-node', (req: Request, res: Response) => {
  const { nodeId } = req.body || {};
  if (!nodeId) {
    return res.status(400).json({ error: 'nodeId is required.' });
  }
  res.json(meshRingController.isolateNode(nodeId));
});

router.post('/mesh-ring/heal', (req: Request, res: Response) => {
  res.json(meshRingController.healCluster());
});

// Slime-Mould Bio-Routing Endpoints
router.get('/slime-mould/tunnels', (req: Request, res: Response) => {
  res.json({ tunnels: slimeMouldOptimizer.getTunnels() });
});

router.post('/slime-mould/simulate-growth', (req: Request, res: Response) => {
  const { nutrientBoost } = req.body || {};
  res.json(slimeMouldOptimizer.simulateGrowth(nutrientBoost ? parseFloat(nutrientBoost) : 1.25));
});

router.get('/slime-mould/conductivity', (req: Request, res: Response) => {
  res.json(slimeMouldOptimizer.getConductivitySummary());
});

// Biophotonic Quantum-Entangled Sync Endpoints
router.get('/biophotonic/entanglement-status', (req: Request, res: Response) => {
  res.json(biophotonicSync.getEntanglementStatus());
});

router.post('/biophotonic/verify-bell-state', (req: Request, res: Response) => {
  const { pairId } = req.body || {};
  res.json(biophotonicSync.verifyBellState(pairId));
});

router.post('/biophotonic/sync-telemetry', (req: Request, res: Response) => {
  const payload = req.body || {};
  res.json(biophotonicSync.syncTelemetry(payload));
});

// Aggregate /api/v1/neuromorphic-mesh/ status summary
router.get('/neuromorphic-mesh/summary', (req: Request, res: Response) => {
  res.json({
    day: 21,
    title: 'Neuromorphic SNN, Slime-Mould & Biophotonic Entanglement Sync',
    membraneState: neuromorphicEngine.getMembraneState(),
    meshTopology: meshRingController.getTopology(),
    slimeMouldSummary: slimeMouldOptimizer.getConductivitySummary(),
    biophotonicStatus: biophotonicSync.getEntanglementStatus(),
    timestamp: Date.now(),
  });
});

export const neuromorphicMeshRouter = router;
