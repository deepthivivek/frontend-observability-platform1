interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  lastAccessed: number;
}

export class AdaptiveQueryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxEntries: number;
  private defaultTtlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(maxEntries = 200, defaultTtlMs = 15000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  get<T>(key: string): { value: T; cached: true } | { value: null; cached: false } {
    const entry = this.cache.get(key);
    const now = Date.now();

    if (!entry) {
      this.misses++;
      return { value: null, cached: false };
    }

    if (now > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return { value: null, cached: false };
    }

    entry.lastAccessed = now;
    this.hits++;
    return { value: entry.value as T, cached: true };
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttlMs || this.defaultTtlMs);

    // Evict oldest if full
    if (this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      expiresAt,
      lastAccessed: now,
    });
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total) * 100 : 0,
    };
  }
}

export const metricsQueryCache = new AdaptiveQueryCache();
