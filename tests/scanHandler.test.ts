import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import { createScanHandler } from "../src/domains/hygiene/scan-handler";
import {
  MockWorkspaceProvider,
  MockLogger,
  MockDeadCodeAnalyzer,
  createMockContext,
  assertSuccess,
  assertFailure,
} from "./fixtures";
import type { CommandContext, DeadCodeScan } from "../src/types";

vi.mock("fs", () => ({
  readFileSync: vi.fn(() => {
    throw new Error("ENOENT");
  }),
}));

describe("hygiene.scan (createScanHandler)", () => {
  let workspace: MockWorkspaceProvider;
  let logger: MockLogger;
  let deadCode: MockDeadCodeAnalyzer;
  let ctx: CommandContext;

  function buildHandler() {
    return createScanHandler(workspace, logger, deadCode);
  }

  beforeEach(() => {
    workspace = new MockWorkspaceProvider();
    logger = new MockLogger();
    deadCode = new MockDeadCodeAnalyzer();
    ctx = createMockContext();
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });
  });

  // -----------------------------------------------------------------------
  // 1. Empty workspace — all arrays empty
  // -----------------------------------------------------------------------
  it("returns empty arrays for an empty workspace", async () => {
    workspace.setFiles({});
    const handler = buildHandler();
    const result = await handler(ctx, {});
    const scan = assertSuccess(result);

    expect(scan.deadFiles).toEqual([]);
    expect(scan.largeFiles).toEqual([]);
    expect(scan.logFiles).toEqual([]);
    expect(scan.markdownFiles).toEqual([]);
    expect(scan.deadCode.items).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 2. Dead file detection (.tmp, .bak)
  // -----------------------------------------------------------------------
  it("detects dead files matching temp/backup patterns", async () => {
    workspace.setFiles({
      "src/data.tmp": "temp content",
      "src/backup.bak": "backup content",
      "src/main.ts": "real code",
    });
    const handler = buildHandler();
    const result = await handler(ctx, {});
    const scan = assertSuccess(result);

    expect(scan.deadFiles).toContain("src/data.tmp");
    expect(scan.deadFiles).toContain("src/backup.bak");
    expect(scan.deadFiles).not.toContain("src/main.ts");
  });

  // -----------------------------------------------------------------------
  // 3. Log file detection
  // -----------------------------------------------------------------------
  it("detects log files matching log patterns", async () => {
    workspace.setFiles({
      "logs/app.log": "log line 1\nlog line 2",
      "src/index.ts": "code",
    });
    const handler = buildHandler();
    const result = await handler(ctx, {});
    const scan = assertSuccess(result);

    expect(scan.logFiles).toContain("logs/app.log");
    expect(scan.logFiles).not.toContain("src/index.ts");
  });

  // -----------------------------------------------------------------------
  // 4. Large file detection (> 10 MB)
  // -----------------------------------------------------------------------
  it("flags files larger than MAX_FILE_SIZE_BYTES", async () => {
    const bigContent = "x".repeat(11 * 1024 * 1024); // ~11 MB
    workspace.setFiles({
      "assets/huge.bin": bigContent,
    });
    const handler = buildHandler();
    const result = await handler(ctx, {});
    const scan = assertSuccess(result);

    expect(scan.largeFiles).toHaveLength(1);
    expect(scan.largeFiles[0].path).toBe("assets/huge.bin");
    expect(scan.largeFiles[0].sizeBytes).toBeGreaterThan(10 * 1024 * 1024);
  });

  // -----------------------------------------------------------------------
  // 5. Markdown collection with lineCount
  // -----------------------------------------------------------------------
  it("collects markdown files with correct lineCount", async () => {
    const mdContent = "# Title\n\nParagraph one.\n\nParagraph two.\n";
    workspace.setFiles({
      "docs/README.md": mdContent,
      "docs/GUIDE.md": "line1\nline2\n",
    });
    const handler = buildHandler();
    const result = await handler(ctx, {});
    const scan = assertSuccess(result);

    expect(scan.markdownFiles).toHaveLength(2);
    const readme = scan.markdownFiles.find((f) => f.path === "docs/README.md");
    expect(readme).toBeDefined();
    expect(readme!.lineCount).toBe(mdContent.split("\n").length);
  });

  // -----------------------------------------------------------------------
  // 6. Dead code integration — analyzer returns items
  // -----------------------------------------------------------------------
  it("includes dead code results from the analyzer", async () => {
    const mockScan: DeadCodeScan = {
      items: [
        {
          filePath: "/home/user/project/src/unused.ts",
          line: 5,
          character: 1,
          message: "'foo' is declared but its value is never read.",
          code: 6133,
          category: "unusedLocal",
        },
      ],
      tsconfigPath: "/home/user/project/tsconfig.json",
      durationMs: 120,
      fileCount: 10,
    };
    deadCode.setResult(mockScan);
    workspace.setFiles({});

    const handler = buildHandler();
    const result = await handler(ctx, {});
    const scan = assertSuccess(result);

    expect(scan.deadCode.items).toHaveLength(1);
    expect(scan.deadCode.items[0].code).toBe(6133);
    expect(scan.deadCode.tsconfigPath).toBe("/home/user/project/tsconfig.json");
  });

  // -----------------------------------------------------------------------
  // 7. Dead code analyzer throws — swallowed gracefully
  // -----------------------------------------------------------------------
  it("swallows dead code analyzer exceptions and returns empty items", async () => {
    const throwingAnalyzer = new MockDeadCodeAnalyzer();
    // Override analyze to throw
    throwingAnalyzer.analyze = () => {
      throw new Error("tsconfig not found");
    };

    workspace.setFiles({});
    const handler = createScanHandler(workspace, logger, throwingAnalyzer);
    const result = await handler(ctx, {});
    const scan = assertSuccess(result);

    expect(scan.deadCode.items).toEqual([]);
    expect(scan.deadCode.durationMs).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 8. .gitignore exclusion
  // -----------------------------------------------------------------------
  it("excludes files matching .gitignore patterns", async () => {
    vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
      if (String(filePath).endsWith(".gitignore")) {
        return "*.log\n";
      }
      throw new Error("ENOENT");
    });

    workspace.setFiles({
      "src/server.log": "log data",
      "src/app.ts": "code",
    });

    const handler = buildHandler();
    const result = await handler(ctx, {});
    const scan = assertSuccess(result);

    // .log files matched by gitignore pattern should be excluded from logFiles
    expect(scan.logFiles).not.toContain("src/server.log");
  });

  // -----------------------------------------------------------------------
  // 9. .meridianignore exclusion
  // -----------------------------------------------------------------------
  it("excludes files matching .meridianignore patterns", async () => {
    vi.mocked(fs.readFileSync).mockImplementation((filePath: any) => {
      if (String(filePath).endsWith(".meridianignore")) {
        return "*.tmp\n";
      }
      throw new Error("ENOENT");
    });

    workspace.setFiles({
      "src/cache.tmp": "cached stuff",
      "src/real.ts": "real code",
    });

    const handler = buildHandler();
    const result = await handler(ctx, {});
    const scan = assertSuccess(result);

    // .tmp matched by meridianignore should be excluded
    expect(scan.deadFiles).not.toContain("src/cache.tmp");
  });

  // -----------------------------------------------------------------------
  // 10. HYGIENE_SCAN_ERROR on unexpected exception
  // -----------------------------------------------------------------------
  it("returns HYGIENE_SCAN_ERROR when workspace provider throws", async () => {
    // Make findFiles throw to trigger the outer catch
    const broken = new MockWorkspaceProvider();
    broken.findFiles = () => {
      throw new Error("disk exploded");
    };

    const handler = createScanHandler(broken, logger, deadCode);
    const result = await handler(ctx, {});
    const err = assertFailure(result);

    expect(err.code).toBe("HYGIENE_SCAN_ERROR");
    expect(err.message).toBe("Workspace scan failed");
  });

  // -----------------------------------------------------------------------
  // 11. File under threshold is NOT flagged as large
  // -----------------------------------------------------------------------
  it("does not flag files under MAX_FILE_SIZE_BYTES as large", async () => {
    const smallContent = "x".repeat(1024); // 1 KB
    workspace.setFiles({
      "src/small.ts": smallContent,
    });
    const handler = buildHandler();
    const result = await handler(ctx, {});
    const scan = assertSuccess(result);

    expect(scan.largeFiles).toEqual([]);
  });
});
