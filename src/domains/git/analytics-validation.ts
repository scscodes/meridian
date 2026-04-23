import { AnalyticsOptions, AnalyticsPeriod } from "./analytics-types";

const ALLOWED_PERIODS: ReadonlySet<AnalyticsPeriod> = new Set(["3mo", "6mo", "12mo"]);
const MAX_AUTHOR_LENGTH = 120;
const MAX_PATH_PATTERN_LENGTH = 240;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001f\u007f]/;
const SHELL_META_PATTERN = /[`$;&|<>]/;

export interface AnalyticsOptionsValidationError {
  code: "INVALID_PERIOD" | "INVALID_AUTHOR" | "INVALID_PATH_PATTERN";
  message: string;
}

export type AnalyticsOptionsValidationResult =
  | { ok: true; value: AnalyticsOptions }
  | { ok: false; error: AnalyticsOptionsValidationError };

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function validateAnalyticsOptions(
  params: Partial<AnalyticsOptions> = {}
): AnalyticsOptionsValidationResult {
  const period = (params.period ?? "3mo") as AnalyticsPeriod;
  if (!ALLOWED_PERIODS.has(period)) {
    return {
      ok: false,
      error: {
        code: "INVALID_PERIOD",
        message: `Invalid period: ${String(params.period)}. Must be 3mo, 6mo, or 12mo`,
      },
    };
  }

  const author = normalizeOptional(params.author);
  if (params.author !== undefined && typeof params.author !== "string") {
    return {
      ok: false,
      error: {
        code: "INVALID_AUTHOR",
        message: "Invalid author filter: must be a string",
      },
    };
  }
  if (author) {
    if (author.length > MAX_AUTHOR_LENGTH) {
      return {
        ok: false,
        error: {
          code: "INVALID_AUTHOR",
          message: `Invalid author filter: exceeds ${MAX_AUTHOR_LENGTH} characters`,
        },
      };
    }
    if (CONTROL_CHAR_PATTERN.test(author) || SHELL_META_PATTERN.test(author)) {
      return {
        ok: false,
        error: {
          code: "INVALID_AUTHOR",
          message: "Invalid author filter: contains unsupported characters",
        },
      };
    }
  }

  const pathPattern = normalizeOptional(params.pathPattern);
  if (params.pathPattern !== undefined && typeof params.pathPattern !== "string") {
    return {
      ok: false,
      error: {
        code: "INVALID_PATH_PATTERN",
        message: "Invalid path pattern: must be a string",
      },
    };
  }
  if (pathPattern) {
    if (pathPattern.length > MAX_PATH_PATTERN_LENGTH) {
      return {
        ok: false,
        error: {
          code: "INVALID_PATH_PATTERN",
          message: `Invalid path pattern: exceeds ${MAX_PATH_PATTERN_LENGTH} characters`,
        },
      };
    }
    if (CONTROL_CHAR_PATTERN.test(pathPattern)) {
      return {
        ok: false,
        error: {
          code: "INVALID_PATH_PATTERN",
          message: "Invalid path pattern: contains control characters",
        },
      };
    }
  }

  return {
    ok: true,
    value: {
      period,
      author,
      pathPattern,
    },
  };
}
