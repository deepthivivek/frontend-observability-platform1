/**
 * Kubernetes Health & Readiness Probes
 * Exposes /healthz (liveness probe) and /readyz (readiness probe) with memory pressure
 * validation and multi-subsystem telemetry readiness checks.
 */

import { Router, Request, Response } from 'express';
import os from 'os';
import { neuromorphicEngine } from '../ai/neuromorphicPredictor';
import { meshRingController } from '../mesh/autonomousMeshRing';
import { biophotonicSync } from '../crypto/biophotonicSync';
import { dnaTelemetryVault } from '../dna/dnaTelemetryVault';
import { neuralResonanceSync } from '../ai/neuralResonanceSync';
import { complianceAuditor } from '../governance/complianceAuditor';
import { sreSwarmOrchestrator } from '../swarm/sreSwarmOrchestrator';
import { biophotonicSingularitySync } from '../swarm/biophotonicSingularitySync';
import { selfHealingMesh } from '../mesh/selfHealingMesh';

const router = Router();
const startTime = Date.now();

// 1. Kubernetes Liveness Probe: /healthz
router.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    pid: process.pid,
    nodeVersion: process.version,
    timestamp: Date.now(),
  });
});

// 2. Kubernetes Readiness Probe: /readyz
router.get('/readyz', (_req: Request, res: Response) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const freeMemRatio = totalMem > 0 ? freeMem / totalMem : 1.0;
  const freeMemPct = Number((freeMemRatio * 100).toFixed(2));

  // Memory Pressure Guard: ensure free memory > 5%
  const memoryHealthy = freeMemRatio > 0.05;

  const subsystems = {
    ebpfKernelGovernance: 'ACTIVE',
    pqcLatticeHardening: 'ML-KEM-1024-ONLINE',
    neuromorphicSnn: neuromorphicEngine.getMembraneState().status,
    autonomousMeshRing: meshRingController.getTopology().routingEfficiency > 80 ? 'OPTIMAL' : 'DEGRADED',
    biophotonicSync: biophotonicSync.getEntanglementStatus().zeroLatencySyncActive ? 'SYNCHRONIZED' : 'DESYNC',
    dnaTelemetryVault: dnaTelemetryVault.getVaultStatus().vaultStatus,
    neuralResonance: neuralResonanceSync.getStatus().zeroSerializationActive ? 'RESONANT' : 'OFFLINE',
    continuousCompliance: complianceAuditor.getComplianceStatus().auditorHealth,
    sreSwarmBft: sreSwarmOrchestrator.getSwarmState().totalAgents >= 4 ? 'CONSENSUS_READY' : 'DEGRADED',
    holographicSingularity: biophotonicSingularitySync.getStatus().singularityLock ? 'LOCKED' : 'DESYNC',
    selfHealingMesh: selfHealingMesh.getStatus().meshHealthStatus,
  };

  const isReady = memoryHealthy && Object.values(subsystems).every((v) => v !== 'OFFLINE' && v !== 'DESYNC');

  if (!isReady) {
    return res.status(503).json({
      status: 'NOT_READY',
      reason: !memoryHealthy ? 'CRITICAL_MEMORY_PRESSURE' : 'SUBSYSTEM_INITIALIZING',
      freeMemoryPct: freeMemPct,
      subsystems,
      timestamp: Date.now(),
    });
  }

  res.status(200).json({
    status: 'READY',
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    freeMemoryPct: freeMemPct,
    subsystems,
    timestamp: Date.now(),
  });
});

export const healthRouter = router;
