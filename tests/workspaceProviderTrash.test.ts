/**
 * Trash-first deleteFile — the injected MoveToTrashFn takes precedence over
 * a permanent unlink, path-guard still runs first, and trash failure falls
 * back to unlink (deletion keeps working on hosts without a trash).
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createWorkspaceProvider } from "../src/infrastructure/workspace-provider";
import { MockLogger } from "./fixtures";

describe("WorkspaceProvider trash-first deleteFile", () => {
  let root: string;
  let logger: MockLogger;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-ws-trash-"));
    logger = new MockLogger();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function makeFile(name: string): string {
    const abs = path.join(root, name);
    fs.writeFileSync(abs, "x");
    return abs;
  }

  it("routes deletion through the trash fn with the guarded absolute path", async () => {
    const abs = makeFile("doomed.txt");
    const moveToTrash = vi.fn(async (p: string) => {
      fs.unlinkSync(p); // the host trash removes the file from its location
    });
    const provider = createWorkspaceProvider(root, logger, moveToTrash);

    const result = await provider.deleteFile("doomed.txt");

    expect(result.kind).toBe("ok");
    expect(moveToTrash).toHaveBeenCalledExactlyOnceWith(abs);
    expect(fs.existsSync(abs)).toBe(false);
  });

  it("never unlinks itself when the trash fn succeeds", async () => {
    const abs = makeFile("kept-by-mock.txt");
    // A trash fn that records but doesn't remove: if the provider also
    // unlinked, the file would be gone — its survival proves trash-only.
    const moveToTrash = vi.fn(async () => {});
    const provider = createWorkspaceProvider(root, logger, moveToTrash);

    const result = await provider.deleteFile("kept-by-mock.txt");

    expect(result.kind).toBe("ok");
    expect(fs.existsSync(abs)).toBe(true);
  });

  it("falls back to permanent unlink (with a warn) when trash is unavailable", async () => {
    const abs = makeFile("no-trash.txt");
    const moveToTrash = vi.fn(async () => {
      throw new Error("trash not supported on this filesystem");
    });
    const provider = createWorkspaceProvider(root, logger, moveToTrash);

    const result = await provider.deleteFile("no-trash.txt");

    expect(result.kind).toBe("ok");
    expect(fs.existsSync(abs)).toBe(false);
    expect(logger.getByLevel("warn")).toHaveLength(1);
  });

  it("path-guard rejects an outside target before the trash fn ever runs", async () => {
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-ws-outside-"));
    const outside = path.join(outsideDir, "secret.txt");
    fs.writeFileSync(outside, "secret");
    const moveToTrash = vi.fn(async () => {});
    const provider = createWorkspaceProvider(root, logger, moveToTrash);

    const result = await provider.deleteFile(outside);

    expect(result.kind).toBe("err");
    expect(moveToTrash).not.toHaveBeenCalled();
    expect(fs.existsSync(outside)).toBe(true);
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  it("still refuses to delete a directory, trash fn or not", async () => {
    fs.mkdirSync(path.join(root, "subdir"));
    const moveToTrash = vi.fn(async () => {});
    const provider = createWorkspaceProvider(root, logger, moveToTrash);

    const result = await provider.deleteFile("subdir");

    expect(result.kind).toBe("err");
    expect(moveToTrash).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(root, "subdir"))).toBe(true);
  });
});
