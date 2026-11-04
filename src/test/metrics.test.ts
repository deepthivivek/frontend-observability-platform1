import { describe, it, expect } from 'vitest';
import { calculatePercentile, calculateZScore } from '../utils/metrics';

describe('Metrics Utilities', () => {
  it('calculates percentiles correctly', () => {
    const latencies = [10, 20, 30, 40, 50].sort((a, b) => a - b);
    expect(calculatePercentile(latencies, 50)).toBe(30);
    expect(calculatePercentile(latencies, 95)).toBe(48);
  });

  it('calculates Z-score correctly', () => {
    expect(calculateZScore(10, 5, 2)).toBe(2.5);
  });

  it('handles empty arrays', () => {
    expect(calculatePercentile([], 50)).toBe(0);
  });
});
