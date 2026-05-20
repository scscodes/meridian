import { describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { migrateLegacyIgnoreFile } from "../src/infrastructure/dotdir-migration";
import { Logger } from "../src/types";

function makeWorkspace(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "meridian-dotdir-mig-"));
}

function makeLogger(): {
  logger: Logger;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
} {
  const info = vi.fn();
  const warn = vi.fn();
  const logger: Logger = {
    debug: vi.fn(),
    info,
    warn,
    error: vi.fn(),
  };
  return { logger, info, warn };
}

describe("migrateLegacyIgnoreFile", () => {
  it("no-op when no legacy file exists; does not create .meridian/", () => {
    const root = makeWorkspace();
    const { logger, info, warn } = makeLogger();

    migrateLegacyIgnoreFile(root, logger);

    expect(fs.existsSync(path.join(root, ".meridian"))).toBe(false);
    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("relocates legacy .meridianignore into .meridian/ on first run", () => {
    const root = makeWorkspace();
    const legacy = path.join(root, ".meridianignore");
    fs.writeFileSync(legacy, "build/\n*.log\n");
    const { logger, info, warn } = makeLogger();

    migrateLegacyIgnoreFile(root, logger);

    const target = path.join(root, ".meridian", ".meridianignore");
    expect(fs.existsSync(legacy)).toBe(false);
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target, "utf-8")).toBe("build/\n*.log\n");
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toContain("Relocated .meridianignore");
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns and leaves both files untouched when target already exists", () => {
    const root = makeWorkspace();
    const legacy = path.join(root, ".meridianignore");
    const target = path.join(root, ".meridian", ".meridianignore");
    fs.writeFileSync(legacy, "legacy content\n");
    fs.mkdirSync(path.join(root, ".meridian"), { recursive: true });
    fs.writeFileSync(target, "new content\n");
    const { logger, info, warn } = makeLogger();

    migrateLegacyIgnoreFile(root, logger);

    expect(fs.readFileSync(legacy, "utf-8")).toBe("legacy content\n");
    expect(fs.readFileSync(target, "utf-8")).toBe("new content\n");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("leaving legacy untouched");
    expect(info).not.toHaveBeenCalled();
  });

  it("logs warn with DOTDIR_MIGRATION_FAILED code when rename throws a non-EXDEV error", () => {
    const root = makeWorkspace();
    const legacy = path.join(root, ".meridianignore");
    fs.writeFileSync(legacy, "patterns\n");
    const { logger, info, warn } = makeLogger();

    const renameSpy = vi
      .spyOn(fs, "renameSync")
      .mockImplementationOnce(() => {
        throw new Error("EACCES: simulated permission error");
      });

    try {
      migrateLegacyIgnoreFile(root, logger);
    } finally {
      renameSpy.mockRestore();
    }

    expect(fs.existsSync(legacy)).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("Relocation of .meridianignore failed");
    const errPayload = warn.mock.calls[0][2];
    expect(errPayload?.code).toBe("DOTDIR_MIGRATION_FAILED");
    expect(errPayload?.message).toContain("EACCES");
    expect(info).not.toHaveBeenCalled();
  });

  it("falls back to copy+unlink when renameSync throws EXDEV (cross-device)", () => {
    const root = makeWorkspace();
    const legacy = path.join(root, ".meridianignore");
    fs.writeFileSync(legacy, "cross-device patterns\n");
    const { logger, info, warn } = makeLogger();

    const renameSpy = vi
      .spyOn(fs, "renameSync")
      .mockImplementationOnce(() => {
        throw new Error("EXDEV: cross-device link not permitted");
      });

    try {
      migrateLegacyIgnoreFile(root, logger);
    } finally {
      renameSpy.mockRestore();
    }

    const target = path.join(root, ".meridian", ".meridianignore");
    expect(fs.existsSync(legacy)).toBe(false);
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.readFileSync(target, "utf-8")).toBe("cross-device patterns\n");
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toContain("Relocated .meridianignore");
    expect(warn).not.toHaveBeenCalled();
  });

  it("no-op when workspaceRoot is undefined (no folder open)", () => {
    const { logger, info, warn } = makeLogger();

    migrateLegacyIgnoreFile(undefined, logger);

    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
