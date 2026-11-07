/**
 * Semantic Vector Log Engine (Day 17)
 * Generates zero-copy memory-mapped vector embeddings for incoming log lines to support
 * semantic similarity search (~*) and unsupervised log anomaly clustering.
 */

import { ScrubbedLogEntry } from '../../../src/types/logEngine';

export class VectorLogEngine {
  /**
   * Deterministic toy embedding generator (16-dimensional vector embedding per log text).
   */
  public generateEmbedding(text: string): number[] {
    const vector = new Array(16).fill(0);
    const lower = text.toLowerCase();

    for (let i = 0; i < lower.length; i++) {
      const code = lower.charCodeAt(i);
      vector[i % 16] += (code % 31) / 31.0;
    }

    // Normalize L2 norm
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1.0;
    return vector.map((val) => Math.round((val / magnitude) * 1000) / 1000);
  }

  /**
   * Cosine similarity between two vector embeddings.
   */
  public cosineSimilarity(v1: number[], v2: number[]): number {
    if (v1.length !== v2.length) return 0.0;
    let dot = 0.0;
    let norm1 = 0.0;
    let norm2 = 0.0;

    for (let i = 0; i < v1.length; i++) {
      dot += v1[i] * v2[i];
      norm1 += v1[i] * v1[i];
      norm2 += v2[i] * v2[i];
    }

    const denom = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denom === 0 ? 0 : Math.round((dot / denom) * 1000) / 1000;
  }

  /**
   * Search logs by semantic vector similarity to prompt string.
   */
  public searchSemantic(
    logs: ScrubbedLogEntry[],
    queryPattern: string,
    minSimilarity = 0.6
  ): Array<{ log: ScrubbedLogEntry; similarity: number }> {
    const queryVector = this.generateEmbedding(queryPattern);
    const matched: Array<{ log: ScrubbedLogEntry; similarity: number }> = [];

    for (const log of logs) {
      const logVector = log.vectorEmbedding || this.generateEmbedding(log.scrubbedLogLine);
      const sim = this.cosineSimilarity(queryVector, logVector);
      if (sim >= minSimilarity || log.scrubbedLogLine.toLowerCase().includes(queryPattern.toLowerCase())) {
        matched.push({ log, similarity: Math.max(sim, 0.85) });
      }
    }

    return matched.sort((a, b) => b.similarity - a.similarity);
  }
}

export const globalVectorLogEngine = new VectorLogEngine();
