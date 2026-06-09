/**
 * Shared TTL Cache — generic time-to-live cache used across domains.
 *
 * Replaces inline TTL cache implementations in:
 * - hygiene/analytics-service.ts (report cache)
 * - git/analytics-service.ts (analytics cache)
 * - hygiene/impact-analysis-handler.ts (analysis cache)
 */

export class TtlCache<K, V> {
  private entries = new Map<K, { value: V; cachedAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    this.entries.set(key, { value, cachedAt: Date.now() });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
