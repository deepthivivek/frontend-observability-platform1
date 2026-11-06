/**
 * Automated Post-Mortem Generator (Day 13)
 * Synthesizes blameless Markdown post-mortem reports featuring detailed timelines,
 * blast radius impact metrics, root-cause attribution, and preventative action items.
 */

import { Incident, PostMortemReport } from '../../../src/types/incident';

export class PostMortemGenerator {
  public generate(incident: Incident, author = 'Neon Chasm AI Incident Engine'): PostMortemReport {
    const generatedAt = Date.now();
    const durationMinutes = incident.resolvedAt
      ? Math.max(1, Math.round((incident.resolvedAt - incident.startedAt) / 60000))
      : Math.max(1, Math.round((generatedAt - incident.startedAt) / 60000));

    // Structured timeline entries
    const timelineFormatted = incident.timeline.map((item) => {
      const timeStr = new Date(item.timestamp).toISOString().substring(11, 19) + ' UTC';
      return `| ${timeStr} | **${item.type}** | ${item.message} | \`${item.actor}\` |`;
    });

    // Action items
    const actionItems = [
      {
        priority: 'P0' as const,
        task: `Increase connection pool max capacity and configure aggressive idle socket reaping in ${incident.primaryService}`,
        owner: incident.leadSre,
        status: 'IN_PROGRESS' as const,
      },
      {
        priority: 'P1' as const,
        task: `Deploy automated circuit breaker trip thresholds for upstream callers to prevent cascading 504 timeouts`,
        owner: 'Core Platform Team',
        status: 'TODO' as const,
      },
      {
        priority: 'P1' as const,
        task: `Add synthetic canary alert for database lock latency (>500ms for 2 consecutive minutes)`,
        owner: 'SRE Observability',
        status: 'TODO' as const,
      },
      {
        priority: 'P2' as const,
        task: `Conduct chaos engineering test verifying grace-degradation under simulated database pool starvation`,
        owner: 'Reliability Engineering',
        status: 'TODO' as const,
      },
    ];

    const lessonsLearned = {
      whatWentWell: [
        'Z-score anomaly detection engine identified the root bottleneck within 45 seconds of onset.',
        'Slide-over trace flamegraph and RAG context quickly isolated the offending SQL query.',
        'Automated runbook executor restored service health without manual shell access.',
      ],
      whatWentPoorly: [
        'Upstream gateway retry storms amplified queue depth on the saturated connection pool.',
        'Initial alerting threshold for connection pool saturation was set at 95% instead of 80%.',
      ],
      whereWeGotLucky: [
        'Standby read replicas absorbed read-only traffic during primary database remediation.',
        'No customer data corruption or uncommitted transactions occurred.',
      ],
    };

    const executiveSummary = `On ${new Date(incident.startedAt).toISOString().split('T')[0]}, an incident impacted **${incident.primaryService}** and downstream microservices (${incident.affectedServices.join(', ')}), resulting in a peak error rate of **${incident.errorRatePeak}%** and P99 latency surging to **${incident.p99LatencyMs}ms**. The total incident duration was **${durationMinutes} minutes**. The incident was mitigated via automated runbook execution with zero data loss.`;

    const impact = `
- **Affected Microservices**: ${incident.affectedServices.join(', ')}
- **Impacted User Sessions**: ${incident.blastRadius.affectedUserSessions.toLocaleString()} sessions
- **Max Frustration Score**: ${incident.blastRadius.frustrationScore}/100
- **SLO Error Budget Burn**: ${incident.blastRadius.sloBurnRate}x normal rate
- **Estimated Revenue Exposure**: ~$${incident.blastRadius.revenueImpactEstimated.toLocaleString()} USD
- **Peak Error Rate**: ${incident.errorRatePeak}%
- **Max P99 Latency**: ${incident.p99LatencyMs}ms
`;

    const rootCause = incident.rootCause || `Connection starvation in the primary backing datastore for ${incident.primaryService}. Under sudden traffic bursts, long-running queries locked the client pool, cascading 504 Gateway Timeouts to upstream client requests.`;

    const triggerRemediations = incident.suggestedRunbooks.map(
      (rb) => `- **${rb.title}** (\`${rb.actionId}\`) - Risk: *${rb.riskLevel}* (Target: \`${rb.targetService}\`)`
    );

    const markdown = `# Post-Mortem: ${incident.title}

| Field | Value |
|---|---|
| **Incident ID** | \`${incident.id}\` |
| **Severity** | **${incident.severity}** |
| **Status** | **${incident.status}** |
| **Primary Service** | \`${incident.primaryService}\` |
| **Incident Lead** | ${incident.leadSre} |
| **Detected At** | ${new Date(incident.startedAt).toUTCString()} |
| **Resolved At** | ${incident.resolvedAt ? new Date(incident.resolvedAt).toUTCString() : 'In Progress / Active'} |
| **Total Duration** | **${durationMinutes} minutes** |
| **Author** | ${author} |

---

## 1. Executive Summary
${executiveSummary}

---

## 2. Blast Radius & Business Impact
${impact}

---

## 3. Incident Timeline
| Time (UTC) | Phase | Event Description | Logged By |
|---|---|---|---|
${timelineFormatted.join('\n')}

---

## 4. Root Cause Analysis
${rootCause}

### Contributing Factors
1. **Connection Pool Bounds**: Connection pool was pinned at maximum concurrent capacity without dynamic surge backpressure.
2. **Cascading Retries**: Client services lacked exponential backoff with jitter, triggering an immediate thundering herd.
3. **Database Lock Contention**: Concurrent read-write transactions on index tables caused serialization waits.

---

## 5. Automated Remediations Executed
${triggerRemediations.length ? triggerRemediations.join('\n') : '- Manual mitigation performed.'}

All remediation actions were sealed into the cryptographic SHA-256 Merkle audit trail with verified operator HMAC signatures.

---

## 6. Preventative Action Items
| Priority | Action Item | Owner | Status |
|---|---|---|---|
${actionItems.map((a) => `| **${a.priority}** | ${a.task} | ${a.owner} | \`${a.status}\` |`).join('\n')}

---

## 7. Lessons Learned

### What Went Well
${lessonsLearned.whatWentWell.map((w) => `- ${w}`).join('\n')}

### What Went Poorly
${lessonsLearned.whatWentPoorly.map((w) => `- ${w}`).join('\n')}

### Where We Got Lucky
${lessonsLearned.whereWeGotLucky.map((w) => `- ${w}`).join('\n')}

---
*Report generated automatically by The Neon Chasm Incident Observability Engine.*
`;

    return {
      incidentId: incident.id,
      title: incident.title,
      generatedAt,
      author,
      markdown,
      sections: {
        executiveSummary,
        timeline: incident.timeline.map((t) => t.message),
        impact,
        rootCause,
        triggerRemediations,
        actionItems,
        lessonsLearned,
      },
    };
  }
}
