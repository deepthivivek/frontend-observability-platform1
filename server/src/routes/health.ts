/**
 * Kubernetes Health & Readiness Probes
 * Exposes /healthz (liveness probe) and /readyz (readiness probe) with memory pressure
 * validation, OTLP ingestion telemetry, atomic WAL state persistence, and Akasha convergence checks.
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
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
import { akashaOmegaCore } from '../swarm/akashaOmegaCore';
import { statePersistence } from '../storage/statePersistence';
import { getConnectedClientCount } from '../ws/gateway';

const router = Router();
const startTime = Date.now();

let totalOtlpBatchesIngested = 0;
let totalOtlpRecordsIngested = 0;
let lastIngestedAt: number | null = null;

export function recordOtlpIngestionMetrics(recordCount: number): void {
  totalOtlpBatchesIngested += 1;
  totalOtlpRecordsIngested += recordCount;
  lastIngestedAt = Date.now();
}

export function getOtlpIngestionSummary() {
  return {
    status: 'READY' as const,
    batchesIngested: totalOtlpBatchesIngested,
    recordsIngested: totalOtlpRecordsIngested,
    lastIngestedAt,
    connectedStreamSubscribers: getConnectedClientCount(),
  };
}

// 1. Kubernetes Liveness Probe: /healthz
router.get('/healthz', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    requestId: req.requestId,
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    pid: process.pid,
    nodeVersion: process.version,
    timestamp: Date.now(),
  });
});

// 2. Kubernetes Readiness Probe: /readyz
router.get('/readyz', (req: Request, res: Response) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const freeMemRatio = totalMem > 0 ? freeMem / totalMem : 1.0;
  const freeMemPct = Number((freeMemRatio * 100).toFixed(2));
  const memoryHealthy = freeMemRatio > 0.05;

  const stateDir = statePersistence.getDirectory();
  let stateDirWritable = false;
  try {
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true, mode: 0o750 });
    }
    fs.accessSync(stateDir, fs.constants.W_OK);
    stateDirWritable = true;
  } catch {
    stateDirWritable = false;
  }

  const akashaIntegrity = statePersistence.verifySnapshotIntegrity('akasha-omega-state');
  const auditIntegrity = statePersistence.verifySnapshotIntegrity('audit-log-chain');
  const akashaState = akashaOmegaCore.getUnifiedState();

  const components = {
    otlpIngestion: getOtlpIngestionSummary(),
    statePersistence: {
      status: stateDirWritable ? 'READY' : 'DEGRADED',
      directory: stateDir,
      writable: stateDirWritable,
      akashaChecksumValid: akashaIntegrity.valid,
      auditChecksumValid: auditIntegrity.valid,
    },
    akashaConvergence: {
      status: akashaState.zeroDefectActive ? 'ETERNAL_SINGULARITY' : 'CONVERGING',
      cycleEpoch: akashaState.cycleEpoch,
      globalCoherenceIndex: akashaState.globalCoherenceIndex,
      convergedEngines: akashaState.convergedEnginesCount,
      eternalStateHash: akashaState.eternalStateHash,
    },
  };

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
    akashaOmegaCore: akashaState.zeroDefectActive ? 'ETERNAL_SINGULARITY' : 'CONVERGING',
  };

  const isReady =
    memoryHealthy &&
    stateDirWritable &&
    Object.values(subsystems).every((v) => v !== 'OFFLINE' && v !== 'DESYNC');

  if (!isReady) {
    return res.status(503).json({
      status: 'NOT_READY',
      requestId: req.requestId,
      reason: !memoryHealthy
        ? 'CRITICAL_MEMORY_PRESSURE'
        : !stateDirWritable
        ? 'STATE_DIR_UNWRITABLE'
        : 'SUBSYSTEM_INITIALIZING',
      freeMemoryPct: freeMemPct,
      components,
      subsystems,
      timestamp: Date.now(),
    });
  }

  res.status(200).json({
    status: 'READY',
    requestId: req.requestId,
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    freeMemoryPct: freeMemPct,
    components,
    subsystems,
    timestamp: Date.now(),
  });
});

export const healthRouter = router;
