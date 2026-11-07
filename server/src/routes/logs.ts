/**
 * Multi-Region Logs & LogQL API Router (Day 17)
 * Exposes endpoints for log ingestion, LogQL AST queries, regional cluster status,
 * PII scrubbing, causal Bayesian root-cause analysis, and zk-SNARK retrievability proofs.
 */

import { Router, Request, Response } from 'express';
import { globalLogIngestionRouter } from '../logs/logIngestionRouter';
import { globalPIIMaskingEngine } from '../logs/piiMaskingEngine';
import { globalLogQueryEngine } from '../logs/logQueryEngine';
import { globalCausalInferenceEngine } from '../logs/causalInferenceEngine';
import { globalZKLogProofEngine } from '../logs/zkLogProof';
import { appendAuditLog } from '../index';
import { LogRegionId } from '../../../src/types/logEngine';

export const logsRouter = Router();

// 1. Ingest Log Payload
logsRouter.post('/ingest', (req: Request, res: Response) => {
  const { rawLogLine, streamLabels, region } = req.body || {};
  if (!rawLogLine) {
    return res.status(400).json({ error: 'rawLogLine is required.' });
  }

  // 1. Scrub PII
  const scrubResult = globalPIIMaskingEngine.scrubLogLine(rawLogLine);

  // 2. Route payload
  const routeResult = globalLogIngestionRouter.routeLogEntry(
    scrubResult.scrubbedLogLine,
    streamLabels || {},
    region as LogRegionId
  );

  appendAuditLog('LOG_GATEWAY', 'INGEST_ROUTED_LOG', routeResult.targetNode);

  res.json({
    status: 'INGESTED',
    routed: routeResult,
    scrubbed: scrubResult,
    timestamp: Date.now(),
  });
});

// 2. Execute LogQL AST & Vector Search Query
logsRouter.post('/query', (req: Request, res: Response) => {
  const { query } = req.body || {};
  const queryStr = query || '{app="checkout"} |= "timeout"';

  const result = globalLogQueryEngine.executeQuery(queryStr);
  appendAuditLog('LOGQL_ENGINE', 'LOGQL_AST_QUERY_EXECUTE', queryStr);

  res.json(result);
});

// 3. Get Multi-Region Cluster Status
logsRouter.get('/regions', (req: Request, res: Response) => {
  res.json({
    clusters: globalLogIngestionRouter.getClusters(),
  });
});

// 4. Scrub PII Test Endpoint
logsRouter.post('/pii/scrub', (req: Request, res: Response) => {
  const { text } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: 'text parameter is required.' });
  }
  const result = globalPIIMaskingEngine.scrubLogLine(text);
  res.json(result);
});

// 5. Causal Bayesian Root-Cause Analysis
logsRouter.post('/causal/analyze', (req: Request, res: Response) => {
  const { traceId } = req.body || {};
  const mockQueryResult = globalLogQueryEngine.executeQuery('{app="checkout"}');
  const causalResult = globalCausalInferenceEngine.analyzeCausalRootCause(mockQueryResult.logs, traceId);

  appendAuditLog('CAUSAL_AI', 'ANALYZE_ROOT_CAUSE_BAYESIAN', traceId || 'auto_trace');

  res.json(causalResult);
});

// 6. zk-SNARK Retrievability Proofs
logsRouter.get('/zk-proofs', (req: Request, res: Response) => {
  const region = (req.query.region as LogRegionId) || 'us-east';
  const proof = globalZKLogProofEngine.generateRetrievabilityProof('shard-us-east-42', region);

  res.json(proof);
});
