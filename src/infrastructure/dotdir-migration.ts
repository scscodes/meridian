/**
 * Dotdir migration — one-shot relocation of legacy workspace dotfiles into
 * the `.meridian/` dotdir on activation. Per ADR 014, the only legacy surface
 * is `.meridianignore` at the workspace root; this module hoists it into
 * `.meridian/.meridianignore` and leaves a `logger.info` trail. Idempotent,
 * non-fatal on failure (activation continues regardless).
 */

import * as fs from "fs";
import * as path from "path";
import { Logger } from "../types";

const IGNORE_FILENAME = ".meridianignore";
const DOTDIR = ".meridian";

export function migrateLegacyIgnoreFile(workspaceRoot: string, logger: Logger): void {
  const legacy = path.join(workspaceRoot, IGNORE_FILENAME);
  const target = path.join(workspaceRoot, DOTDIR, IGNORE_FILENAME);

  if (!fs.existsSync(legacy)) return;

  if (fs.existsSync(target)) {
    logger.warn(
      `Legacy ${IGNORE_FILENAME} present at workspace root alongside ${DOTDIR}/${IGNORE_FILENAME} — leaving legacy untouched; new location wins. Delete the root copy when convenient.`,
      "migrateLegacyIgnoreFile"
    );
    return;
  }

  try {
    fs.mkdirSync(path.join(workspaceRoot, DOTDIR), { recursive: true });
    fs.renameSync(legacy, target);
    logger.info(
      `Relocated ${IGNORE_FILENAME} → ${DOTDIR}/${IGNORE_FILENAME}`,
      "migrateLegacyIgnoreFile"
    );
  } catch (err) {
    logger.warn(
      `Relocation of ${IGNORE_FILENAME} failed; legacy file still at workspace root, patterns will not load from new location until resolved.`,
      "migrateLegacyIgnoreFile",
      {
        code: "DOTDIR_MIGRATION_FAILED",
        message: err instanceof Error ? err.message : String(err),
      }
    );
  }
}
