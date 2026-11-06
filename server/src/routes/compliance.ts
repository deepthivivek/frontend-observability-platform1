/**
 * Compliance & SIEM Routes (Day 14)
 * Exposes endpoints for SOC2/GDPR control evaluations, evidence exports,
 * SIEM webhook management, dispatching, and DLQ re-drives.
 */

import { Router, Request, Response } from 'express';
import { globalComplianceAuditor } from '../siem/complianceAuditor';
import { globalComplianceExporter } from '../siem/complianceExporter';
import { globalSIEMDispatcher } from '../siem/webhookDispatcher';
import { globalDLQManager } from '../siem/dlqManager';
import { appendAuditLog } from '../index';

export const complianceRouter = Router();

// 1. Get Compliance Audit Assessment
complianceRouter.get('/audit', (req: Request, res: Response) => {
  const assessment = globalComplianceAuditor.evaluateControls();
  appendAuditLog('COMPLIANCE_OFFICER', 'SOC2_GDPR_CONTROL_AUDIT', 'compliance_matrix');
  res.json(assessment);
});

// 2. Get Signed Compliance Export Package
complianceRouter.get('/export', (req: Request, res: Response) => {
  const author = (req.query.author as string) || 'Neon Chasm Compliance Officer';
  const pkg = globalComplianceExporter.generateExportPackage(author);
  appendAuditLog('COMPLIANCE_OFFICER', 'EXPORT_SIGNED_EVIDENCE_PACKAGE', pkg.exportId);
  res.json(pkg);
});

// 3. Get SIEM Webhook Configurations
complianceRouter.get('/siem/webhooks', (req: Request, res: Response) => {
  res.json(globalSIEMDispatcher.getConfigs());
});

// 4. Save SIEM Webhook Configuration
complianceRouter.post('/siem/webhooks', (req: Request, res: Response) => {
  const config = req.body || {};
  if (!config.id || !config.destinationUrl) {
    return res.status(400).json({ error: 'id and destinationUrl are required.' });
  }
  const saved = globalSIEMDispatcher.saveConfig(config);
  appendAuditLog('SECURITY_ADMIN', 'SAVE_SIEM_WEBHOOK_CONFIG', config.id);
  res.json(saved);
});

// 5. Dispatch Test Webhook
complianceRouter.post('/siem/dispatch', async (req: Request, res: Response) => {
  const { eventType, payload, webhookId } = req.body || {};
  const results = await globalSIEMDispatcher.dispatchEvent(
    eventType || 'SECURITY_ALERT',
    payload || { message: 'Manual SIEM test dispatch probe' },
    webhookId
  );
  appendAuditLog('SECURITY_ADMIN', 'DISPATCH_SIEM_WEBHOOK', webhookId || 'all_active');
  res.json({ dispatched: true, results });
});

// 6. Get DLQ Items
complianceRouter.get('/siem/dlq', (req: Request, res: Response) => {
  const status = req.query.status as string;
  const items = globalDLQManager.getItems(status);
  res.json({ total: items.length, items });
});

// 7. Re-drive DLQ Failed Webhooks
complianceRouter.post('/siem/dlq/redrive', async (req: Request, res: Response) => {
  const { dlqId } = req.body || {};
  const items = globalDLQManager.getItems('PENDING_REDRIVE');
  const targetItems = dlqId ? items.filter((i) => i.id === dlqId) : items;

  let redrivedCount = 0;
  const results = [];

  for (const item of targetItems) {
    const dispatchResults = await globalSIEMDispatcher.dispatchEvent('DLQ_REDRIVE_EVENT', item.payload, item.webhookId);
    const success = dispatchResults.some((d) => d.success);
    globalDLQManager.markRedrived(item.id, success);
    if (success) redrivedCount++;
    results.push({ dlqId: item.id, success });
  }

  appendAuditLog('SECURITY_ADMIN', 'REDRIVE_DEAD_LETTER_QUEUE', `${redrivedCount} items redrived`);

  res.json({
    redrivedCount,
    totalAttempted: targetItems.length,
    results,
  });
});
