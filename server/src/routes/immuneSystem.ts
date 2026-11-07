/**
 * Autonomous Immune & Quantum Integration Router (Day 20)
 * Mounts endpoints at /api/v1/immune/, /api/v1/lattice/, and /api/v1/mesh/
 */

import { Router, Request, Response } from 'express';
import { globalHeuristicMutator } from '../immune/heuristicMutationEngine';
import { globalNeuralSymbolicPolicy } from '../immune/neuralSymbolicPolicy';
import { globalCellularQuarantine } from '../immune/cellularQuarantine';
import { globalLatticeHardener } from '../crypto/latticeMeshHardener';
import { globalQuantumRotation } from '../crypto/quantumKeyRotation';
import { globalZkpThreatAttribution } from '../crypto/zkpThreatAttribution';
import { globalQuantumAnnealer } from '../mesh/quantumAnnealer';

export const immuneSystemRouter = Router();

// 1. Overview
immuneSystemRouter.get('/overview', (req: Request, res: Response) => {
  res.json({
    status: 'active',
    platform: 'The Neon Chasm - Autonomous Immune & Quantum Annealing Engine (Day 20)',
    heuristicMutations: globalHeuristicMutator.getGenerations().length,
    cellularQuarantine: globalCellularQuarantine.getStatus(),
    latticeMesh: globalLatticeHardener.getStatus(),
    quantumEntropy: globalQuantumRotation.getEntropyStream(),
    zkpProofs: globalZkpThreatAttribution.getProofs().length,
    quantumAnnealing: globalQuantumAnnealer.getStatus(),
    timestamp: Date.now(),
  });
});

// 2. Heuristic Mutation
immuneSystemRouter.get('/generations', (req: Request, res: Response) => {
  res.json({ generations: globalHeuristicMutator.getGenerations() });
});

immuneSystemRouter.post('/mutate', (req: Request, res: Response) => {
  const input = req.body || {};
  const rule = globalHeuristicMutator.mutateRule(input);
  res.status(201).json({ success: true, rule });
});

immuneSystemRouter.post('/quarantine', (req: Request, res: Response) => {
  const { ruleId, actor } = req.body || {};
  if (!ruleId) return res.status(400).json({ error: 'ruleId is required.' });
  try {
    const rule = globalHeuristicMutator.quarantineRule(ruleId, actor);
    res.json({ success: true, rule });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 3. Neural-Symbolic Policy
immuneSystemRouter.get('/invariants', (req: Request, res: Response) => {
  res.json({ invariants: globalNeuralSymbolicPolicy.getInvariants() });
});

immuneSystemRouter.post('/verify-symbolic', (req: Request, res: Response) => {
  const { ruleId, pattern, actor } = req.body || {};
  if (!ruleId || !pattern) return res.status(400).json({ error: 'ruleId and pattern are required.' });
  const result = globalNeuralSymbolicPolicy.verifyRuleSymbolic(ruleId, pattern, actor);
  res.json({ verification: result });
});

// 4. Cellular Socket Quarantine
immuneSystemRouter.get('/cellular-status', (req: Request, res: Response) => {
  res.json(globalCellularQuarantine.getStatus());
});

immuneSystemRouter.post('/socket-isolate', (req: Request, res: Response) => {
  const input = req.body || {};
  const stream = globalCellularQuarantine.isolateSocket(input);
  res.status(201).json({ success: true, stream });
});

immuneSystemRouter.post('/socket-release', (req: Request, res: Response) => {
  const { streamId, actor } = req.body || {};
  if (!streamId) return res.status(400).json({ error: 'streamId is required.' });
  try {
    const stream = globalCellularQuarantine.releaseSocket(streamId, actor);
    res.json({ success: true, stream });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 5. Post-Quantum Lattice Mesh
immuneSystemRouter.get('/lattice/status', (req: Request, res: Response) => {
  res.json(globalLatticeHardener.getStatus());
});

immuneSystemRouter.post('/lattice/enforce-pqc', (req: Request, res: Response) => {
  const { nodeId, kemAlgorithm, actor } = req.body || {};
  if (!nodeId) return res.status(400).json({ error: 'nodeId is required.' });
  const node = globalLatticeHardener.enforcePQC(nodeId, kemAlgorithm, actor);
  res.json({ success: true, node });
});

// 6. Quantum Key Rotation
immuneSystemRouter.get('/lattice/entropy-stream', (req: Request, res: Response) => {
  res.json(globalQuantumRotation.getEntropyStream());
});

immuneSystemRouter.post('/lattice/rotate-keys', (req: Request, res: Response) => {
  const { actor } = req.body || {};
  const rotation = globalQuantumRotation.rotateKeys(actor);
  res.status(201).json({ success: true, rotation });
});

// 7. ZKP Threat Attribution
immuneSystemRouter.post('/lattice/generate-threat-proof', (req: Request, res: Response) => {
  const { exploitVector, actor } = req.body || {};
  const proof = globalZkpThreatAttribution.generateProof(exploitVector, actor);
  res.status(201).json({ success: true, proof });
});

immuneSystemRouter.post('/lattice/verify-threat-proof', (req: Request, res: Response) => {
  const { proofId, actor } = req.body || {};
  if (!proofId) return res.status(400).json({ error: 'proofId is required.' });
  const verified = globalZkpThreatAttribution.verifyProof(proofId, actor);
  res.json({ success: true, verified });
});

// 8. Quantum Annealing Traffic Optimizer
immuneSystemRouter.get('/mesh/anneal-status', (req: Request, res: Response) => {
  res.json(globalQuantumAnnealer.getStatus());
});

immuneSystemRouter.post('/mesh/optimize-routes', (req: Request, res: Response) => {
  const { actor } = req.body || {};
  const state = globalQuantumAnnealer.optimizeRoutes(actor);
  res.json({ success: true, state });
});
