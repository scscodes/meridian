import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TtlCache } from "../src/infrastructure/cache";

describe("TtlCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns undefined for missing key", () => {
    const cache = new TtlCache<string, number>(1000);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("stores and retrieves a value within TTL", () => {
    const cache = new TtlCache<string, number>(1000);
    cache.set("a", 42);
    expect(cache.get("a")).toBe(42);
  });

  it("evicts expired entries on get", () => {
    const cache = new TtlCache<string, number>(1000);
    cache.set("a", 42);
    vi.advanceTimersByTime(1001);
    expect(cache.get("a")).toBeUndefined();
  });

  it("returns value when exactly at TTL boundary", () => {
    const cache = new TtlCache<string, number>(1000);
    cache.set("a", 42);
    vi.advanceTimersByTime(1000);
    expect(cache.get("a")).toBe(42);
  });

  it("has() returns true for live entries, false for expired", () => {
    const cache = new TtlCache<string, number>(500);
    cache.set("x", 1);
    expect(cache.has("x")).toBe(true);
    vi.advanceTimersByTime(501);
    expect(cache.has("x")).toBe(false);
  });

  it("delete() removes an entry", () => {
    const cache = new TtlCache<string, number>(1000);
    cache.set("a", 1);
    expect(cache.delete("a")).toBe(true);
    expect(cache.get("a")).toBeUndefined();
  });

  it("clear() removes all entries", () => {
    const cache = new TtlCache<string, number>(1000);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });

  it("overwrites existing key and resets TTL", () => {
    const cache = new TtlCache<string, number>(1000);
    cache.set("a", 1);
    vi.advanceTimersByTime(800);
    cache.set("a", 2);
    vi.advanceTimersByTime(800);
    // 800ms since last set — still within TTL
    expect(cache.get("a")).toBe(2);
  });

  it("tracks size correctly", () => {
    const cache = new TtlCache<string, string>(1000);
    expect(cache.size).toBe(0);
    cache.set("a", "x");
    cache.set("b", "y");
    expect(cache.size).toBe(2);
    cache.delete("a");
    expect(cache.size).toBe(1);
  });

  it("works with non-string keys", () => {
    const cache = new TtlCache<number, string>(1000);
    cache.set(1, "one");
    cache.set(2, "two");
    expect(cache.get(1)).toBe("one");
    expect(cache.get(2)).toBe("two");
  });
});
