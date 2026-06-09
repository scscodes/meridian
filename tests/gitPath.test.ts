/**
 * Pins the EXACT behavior of normalizeRenamePath. This regex previously lived
 * inline in analytics-service with no coverage; it is now the single source of
 * truth for both the analytics FileMetric path and the pending-change-risk
 * dirty-set join, so a behavior change here silently breaks the join. These
 * cases pin current behavior verbatim (including its quirks) — they are a
 * regression guard, not a spec to "improve" against.
 */

import { describe, it, expect } from "vitest";
import { normalizeRenamePath } from "../src/domains/git/git-path";

describe("normalizeRenamePath", () => {
  it("passes through a path with no rename notation", () => {
    expect(normalizeRenamePath("src/domains/git/a.ts")).toBe("src/domains/git/a.ts");
    expect(normalizeRenamePath("")).toBe("");
  });

  it("does not treat a brace without ' => ' as a rename", () => {
    expect(normalizeRenamePath("src/a{b}.ts")).toBe("src/a{b}.ts");
  });

  it("simple form → destination (last segment after ' => ')", () => {
    expect(normalizeRenamePath("old.ts => new.ts")).toBe("new.ts");
    expect(normalizeRenamePath("src/old.ts => src/new.ts")).toBe("src/new.ts");
    // Existing behavior: pop() takes the last on a multi-arrow string.
    expect(normalizeRenamePath("a => b => c")).toBe("c");
  });

  it("brace form → destination, preserving prefix and suffix", () => {
    expect(normalizeRenamePath("src/{old.ts => new.ts}")).toBe("src/new.ts");
    expect(normalizeRenamePath("a/{b => c}/d.ts")).toBe("a/c/d.ts");
  });

  it("brace form with added/empty source segment", () => {
    expect(normalizeRenamePath("a/{ => c}/d.ts")).toBe("a/c/d.ts");
  });

  it("applies globally to multiple brace groups (existing /g behavior)", () => {
    expect(normalizeRenamePath("{a => b}/{c => d}.ts")).toBe("b/d.ts");
  });
});
