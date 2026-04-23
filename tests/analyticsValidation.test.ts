import { describe, expect, it } from "vitest";
import { validateAnalyticsOptions } from "../src/domains/git/analytics-validation";

describe("validateAnalyticsOptions", () => {
  it("accepts valid options", () => {
    const result = validateAnalyticsOptions({
      period: "6mo",
      author: "alice",
      pathPattern: "src/**",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects unsafe author filter characters", () => {
    const result = validateAnalyticsOptions({ period: "3mo", author: "alice;rm -rf /" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_AUTHOR");
    }
  });

  it("rejects non-string author/path values", () => {
    const authorResult = validateAnalyticsOptions({ period: "3mo", author: 42 as unknown as string });
    const pathResult = validateAnalyticsOptions({ period: "3mo", pathPattern: 12 as unknown as string });
    expect(authorResult.ok).toBe(false);
    expect(pathResult.ok).toBe(false);
  });
});
