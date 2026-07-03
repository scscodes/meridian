/**
 * JSONL tail compaction — keep the newest N lines of a line-delimited file,
 * atomically (write tmp sibling, rename over). Operates on raw lines and
 * never parses JSON, so it is schema-agnostic and safe for version-pinned
 * stores (run log ADR 009, pulse store ADR 019): a malformed or
 * future-versioned line is preserved verbatim, never interpreted.
 *
 * Shared by FileRunLog.compact() and FilePulseStore's append-time cap.
 */

import { promises as fs } from "node:fs";

/**
 * Rewrite `filePath` to its newest `maxLines` lines. Returns the number of
 * lines dropped (0 when under the cap or the file is missing). `maxLines <= 0`
 * is a no-op — retention disabled. Not concurrency-safe on its own: callers
 * that also append (run log, pulse store) must invoke this inside their
 * write queue.
 */
export async function compactJsonlTail(filePath: string, maxLines: number): Promise<number> {
  if (maxLines <= 0) return 0;

  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw err;
  }

  const lines = raw.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length <= maxLines) return 0;

  const kept = lines.slice(-maxLines);
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, kept.join("\n") + "\n", "utf8");
  await fs.rename(tmpPath, filePath);
  return lines.length - kept.length;
}
