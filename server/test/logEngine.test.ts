import { describe, it, expect } from 'vitest';
import { LogIngestionRouter } from '../src/logs/logIngestionRouter';
import { PIIMaskingEngine } from '../src/logs/piiMaskingEngine';
import { LogQLParser } from '../src/logs/logQLParser';
import { VectorLogEngine } from '../src/logs/vectorLogEngine';
import { CausalInferenceEngine } from '../src/logs/causalInferenceEngine';
import { ZKLogProofEngine } from '../src/logs/zkLogProof';
import { LogQueryEngine } from '../src/logs/logQueryEngine';

describe('Multi-Region Log Engine, LogQL AST, Vector, PII, Causal AI & zk-SNARK (Day 17 Backend)', () => {
  describe('Multi-Region Log Router', () => {
    const router = new LogIngestionRouter();

    it('retrieves regional cluster partition status', () => {
      const clusters = router.getClusters();
      expect(clusters.length).toBe(3);
      expect(clusters.some((c) => c.regionId === 'us-east')).toBe(true);
      expect(clusters.some((c) => c.regionId === 'eu-west')).toBe(true);
    });

    it('routes log entry with deterministic hash partitioning across regional nodes', () => {
      const route = router.routeLogEntry('HTTP 504 Gateway Timeout in checkout', { app: 'checkout' }, 'us-east');

      expect(route.targetRegion).toBe('us-east');
      expect(route.targetNode).toContain('us-east-node-');
      expect(route.partitionId).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Real-Time PII Scrubbing Engine', () => {
    const pii = new PIIMaskingEngine();

    it('scrubs bearer tokens, API keys, and email addresses from raw log lines', () => {
      const rawText = 'Auth failed for user test@neonchasm.io with Bearer eyJhbGciOiJIUzI1NiJ9.secret and api_key="ak_live_991823"';
      const result = pii.scrubLogLine(rawText);

      expect(result.hasMaskingOccurred).toBe(true);
      expect(result.scrubbedLogLine).toContain('[REDACTED_EMAIL]');
      expect(result.scrubbedLogLine).toContain('[REDACTED_AUTH_TOKEN]');
      expect(result.scrubbedLogLine).toContain('[REDACTED_API_KEY]');
      expect(result.tokensMasked).toContain('EMAIL_ADDRESS');
      expect(result.tokensMasked).toContain('BEARER_TOKEN');
      expect(result.tokensMasked).toContain('API_KEY');
    });
  });

  describe('LogQL AST Parser & Semantic Vector Engine', () => {
    const parser = new LogQLParser();
    const vector = new VectorLogEngine();

    it('parses stream selectors, pipeline filters, and semantic vector operators', () => {
      const ast = parser.parseQuery('{app="checkout", level="error"} |= "timeout" ~* "connection pool failure"');

      expect(ast.selectors.length).toBe(2);
      expect(ast.selectors[0].label).toBe('app');
      expect(ast.selectors[0].value).toBe('checkout');
      expect(ast.filters.length).toBe(2);
      expect(ast.isSemanticVectorSearch).toBe(true);
    });

    it('generates 16-dim vector embeddings and calculates cosine similarity', () => {
      const vec1 = vector.generateEmbedding('Database connection pool exhausted after 5000ms');
      const vec2 = vector.generateEmbedding('db-proxy connection pool timeout');

      expect(vec1.length).toBe(16);
      expect(vec2.length).toBe(16);

      const similarity = vector.cosineSimilarity(vec1, vec2);
      expect(similarity).toBeGreaterThan(0.5);
    });
  });

  describe('Autonomous Causal Bayesian Inference Engine', () => {
    const causal = new CausalInferenceEngine();

    it('calculates root-cause probability score and builds causal dependency chain', () => {
      const mockLogs = [
        {
          id: 'l1',
          timestamp: Date.now(),
          region: 'us-east' as const,
          clusterNode: 'us-east-node-01',
          streamLabels: { app: 'checkout' },
          rawLogLine: 'db-proxy pool connection timeout',
          scrubbedLogLine: 'db-proxy pool connection timeout',
          piiTokensMasked: [],
          traceId: 'tr-db-leak-991',
          spanId: 'sp-chk-101',
          severity: 'ERROR' as const,
        },
      ];

      const result = causal.analyzeCausalRootCause(mockLogs, 'tr-db-leak-991');

      expect(result.primaryRootCauseService).toBe('db-proxy-pool');
      expect(result.rootCauseProbability).toBeGreaterThan(90.0);
      expect(result.causalChain.length).toBeGreaterThan(0);
    });
  });

  describe('zk-SNARK Log Retrievability Engine', () => {
    const zk = new ZKLogProofEngine();

    it('generates and verifies cryptographic proofs of retrievability across regional shards', () => {
      const proof = zk.generateRetrievabilityProof('shard-us-east-42', 'us-east');

      expect(proof.proofId).toBeDefined();
      expect(proof.merkleRootHash.length).toBe(64);
      expect(proof.zkProofSnarkHash.length).toBe(64);
      expect(zk.verifyProof(proof)).toBe(true);
    });
  });

  describe('Distributed Log Query Execution Engine', () => {
    const queryEngine = new LogQueryEngine();

    it('executes end-to-end query returning scrubbed logs, causal analysis, and zk-SNARK proof', () => {
      const result = queryEngine.executeQuery('{app="checkout"} |= "timeout"');

      expect(result.logs.length).toBeGreaterThan(0);
      expect(result.causalAnalysis).toBeDefined();
      expect(result.zkProof).toBeDefined();
      expect(result.queryExecutionMs).toBeGreaterThanOrEqual(0);
    });
  });
});
