/**
 * Global Synthetic & Latency API Routes (Day 15)
 * Exposes endpoints for probe listings, multi-region checks, multi-step transaction executions,
 * SSL certificate monitoring, DNS integrity inspection, and probe configuration.
 */

import { Router, Request, Response } from 'express';
import { globalEdgeProber } from '../synthetic/edgeProber';
import { globalScriptRunner } from '../synthetic/scriptRunner';
import { globalSSLMonitor } from '../synthetic/sslMonitor';
import { globalDNSInspector } from '../synthetic/dnsInspector';
import { globalDegradationDetector } from '../synthetic/degradationDetector';
import { globalSyntheticScheduler } from '../synthetic/scheduler';
import { appendAuditLog } from '../index';
import { ProbeRegion } from '../../../src/types/synthetic';

export const syntheticRouter = Router();

// 1. Get All Synthetic Probes
syntheticRouter.get('/probes', (req: Request, res: Response) => {
  res.json({
    total: globalSyntheticScheduler.getProbes().length,
    probes: globalSyntheticScheduler.getProbes(),
  });
});

// 2. Configure / Create New Probe
syntheticRouter.post('/probes', (req: Request, res: Response) => {
  const config = req.body || {};
  if (!config.id || !config.targetUrl) {
    return res.status(400).json({ error: 'id and targetUrl are required.' });
  }
  const saved = globalSyntheticScheduler.saveProbe(config);
  appendAuditLog('SYNTHETIC_ADMIN', 'CONFIGURE_SYNTHETIC_PROBE', config.id);
  res.json(saved);
});

// 3. Execute Multi-Region Probe Check
syntheticRouter.get('/probe/run', async (req: Request, res: Response) => {
  const url = (req.query.url as string) || 'https://api.neonchasm.io/health';
  const regions: ProbeRegion[] = ['US-East', 'US-West', 'EU-Central', 'AP-South', 'AP-East'];

  const results = await globalEdgeProber.probeAllRegions(url, regions);
  const alerts = globalDegradationDetector.evaluateProbeResults(results);

  appendAuditLog('EDGE_PROBER', 'EXECUTE_GLOBAL_PROBE_RUN', url);

  res.json({
    targetUrl: url,
    executedAt: Date.now(),
    results,
    alerts,
  });
});

// 4. Run Multi-Step Scripted Journey
syntheticRouter.post('/journey/run', async (req: Request, res: Response) => {
  const { steps, baseUrl } = req.body || {};
  if (!Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({ error: 'steps array is required.' });
  }

  const result = await globalScriptRunner.executeJourney(steps, baseUrl);
  appendAuditLog('SYNTHETIC_JOURNEY', 'EXECUTE_SCRIPTED_TRANSACTION', `${steps.length}_steps`);

  res.json(result);
});

// 5. Inspect SSL Certificate Health
syntheticRouter.get('/ssl/inspect', (req: Request, res: Response) => {
  const domain = (req.query.domain as string) || 'api.neonchasm.io';
  const certInfo = globalSSLMonitor.inspectCertificate(domain);
  res.json(certInfo);
});

// 6. Inspect DNS Integrity & BGP Parity
syntheticRouter.get('/dns/inspect', (req: Request, res: Response) => {
  const domain = (req.query.domain as string) || 'api.neonchasm.io';
  const dnsReport = globalDNSInspector.inspectDNSIntegrity(domain);
  res.json(dnsReport);
});
