import { Router, Request, Response } from 'express';
import { traceCollector } from '../traces/collector';
import { serviceTopologyAggregator } from '../traces/serviceMap';
import { broadcastTraceAnomaly, broadcastTopologyUpdate } from '../ws/gateway';
import { TraceSpan } from '../../../src/types/trace';

export const tracesRouter = Router();

// GET /api/v1/traces/topology - Service Topology Map (MUST be placed before /:traceId)
tracesRouter.get('/topology', (req: Request, res: Response) => {
  const topology = serviceTopologyAggregator.getTopologyData();
  res.json(topology);
});

// GET /api/v1/traces - Query trace summaries with filters
tracesRouter.get('/', (req: Request, res: Response) => {
  const { serviceName, minDurationMs, hasError, onlyAnomalies, searchQuery } = req.query;

  const filters = {
    serviceName: serviceName ? String(serviceName) : undefined,
    minDurationMs: minDurationMs ? Number(minDurationMs) : undefined,
    hasError: hasError !== undefined ? hasError === 'true' : undefined,
    onlyAnomalies: onlyAnomalies !== undefined ? onlyAnomalies === 'true' : undefined,
    searchQuery: searchQuery ? String(searchQuery) : undefined,
  };

  const traces = traceCollector.getTraces(filters);
  res.json({
    count: traces.length,
    traces,
  });
});

// GET /api/v1/traces/:traceId - Get reconstructed transaction tree & root cause
tracesRouter.get('/:traceId', (req: Request, res: Response) => {
  const traceId = Array.isArray(req.params.traceId) ? req.params.traceId[0] : req.params.traceId;
  const tree = traceCollector.getTraceById(traceId);

  if (!tree) {
    return res.status(404).json({ error: `Trace with id ${traceId} not found.` });
  }

  res.json(tree);
});

// POST /api/v1/traces - Ingest hierarchical OpenTelemetry spans
tracesRouter.post('/', (req: Request, res: Response) => {
  const payload = req.body;
  const spansToIngest: TraceSpan[] = Array.isArray(payload) ? payload : [payload];

  if (spansToIngest.length === 0 || !spansToIngest[0].traceId) {
    return res.status(400).json({ error: 'Valid trace span or span array is required.' });
  }

  const result = traceCollector.ingestBatch(spansToIngest);

  // Check for any anomalies to broadcast over WebSockets
  for (const span of spansToIngest) {
    if (span.isAnomaly || (span.zScore && span.zScore >= 3.5)) {
      broadcastTraceAnomaly({
        traceId: span.traceId || 'unknown-trace',
        serviceName: span.serviceName || span.service || 'unknown-service',
        spanName: span.name,
        durationMs: span.durationMs,
        zScore: span.zScore || 3.8,
        rootCauseReason: `Latency outlier Z-Score ${span.zScore}σ detected`,
      });
    }
  }

  // Broadcast updated topology
  const updatedTopology = serviceTopologyAggregator.getTopologyData();
  broadcastTopologyUpdate(updatedTopology);

  res.status(202).json({
    accepted: true,
    ingestedCount: result.ingestedCount,
    anomaliesCount: result.anomaliesCount,
    timestamp: Date.now(),
  });
});
