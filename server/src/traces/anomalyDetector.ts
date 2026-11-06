export interface RouteLatencyStats {
  count: number;
  mean: number;
  m2: number; // For Welford's algorithm to compute variance online
  stdDev: number;
  window: number[];
  maxWindowSize: number;
}

export class RollingZScoreAnomalyDetector {
  private statsByRoute: Map<string, RouteLatencyStats> = new Map();
  private zThreshold: number;
  private defaultWindowSize: number;

  constructor(zThreshold = 3.5, defaultWindowSize = 50) {
    this.zThreshold = zThreshold;
    this.defaultWindowSize = defaultWindowSize;
  }

  public recordAndEvaluate(serviceName: string, endpoint: string, durationMs: number): {
    isAnomaly: boolean;
    zScore: number;
    mean: number;
    stdDev: number;
    threshold: number;
  } {
    const routeKey = `${serviceName}:${endpoint}`;
    let stats = this.statsByRoute.get(routeKey);

    if (!stats) {
      stats = {
        count: 0,
        mean: durationMs,
        m2: 0,
        stdDev: 0,
        window: [],
        maxWindowSize: this.defaultWindowSize,
      };
      this.statsByRoute.set(routeKey, stats);
    }

    // Append to sliding window
    stats.window.push(durationMs);
    if (stats.window.length > stats.maxWindowSize) {
      stats.window.shift();
    }

    // Recompute sample mean and stdDev over sliding window
    const n = stats.window.length;
    const sum = stats.window.reduce((acc, val) => acc + val, 0);
    const mean = sum / n;
    
    let variance = 0;
    if (n > 1) {
      variance = stats.window.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
    }
    const stdDev = Math.sqrt(variance);
    stats.mean = mean;
    stats.stdDev = stdDev;
    stats.count++;

    // If we have at least 5 baseline points and stdDev is non-trivial (> 2ms)
    let zScore = 0;
    let isAnomaly = false;

    if (n >= 4 && stdDev > 2) {
      zScore = parseFloat(((durationMs - mean) / stdDev).toFixed(2));
      if (zScore >= this.zThreshold) {
        isAnomaly = true;
      }
    }

    return {
      isAnomaly,
      zScore,
      mean: parseFloat(mean.toFixed(2)),
      stdDev: parseFloat(stdDev.toFixed(2)),
      threshold: this.zThreshold,
    };
  }

  public getStats(serviceName: string, endpoint: string) {
    return this.statsByRoute.get(`${serviceName}:${endpoint}`);
  }

  public reset(): void {
    this.statsByRoute.clear();
  }
}

export const anomalyDetector = new RollingZScoreAnomalyDetector(3.5, 50);
