import { describe, it, expect, vi } from "vitest";
import {
  createSmartCommitHandler,
} from "../src/domains/git/handlers";
import {
  MockGitProvider,
  MockLogger,
  createMockContext,
  assertSuccess,
  assertFailure,
  createTestChanges,
} from "./fixtures";
import {
  ChangeGrouper,
  CommitMessageSuggester,
  BatchCommitter,
} from "../src/domains/git/service";
import { SmartCommitParams, ApprovalUI, ApprovalItem, ChangeGroup } from "../src/domains/git/types";

describe("git.smartCommit handler", () => {
  const ctx = createMockContext();

  it("rejects invalid parameter shapes", async () => {
    const git = new MockGitProvider();
    const logger = new MockLogger();
    const handler = createSmartCommitHandler(
      git as any,
      logger,
      new ChangeGrouper(),
      new CommitMessageSuggester(),
      new BatchCommitter(git as any, logger),
    );

    const resultAutoApprove = await handler(ctx, {
      autoApprove: "yes" as any,
    } as SmartCommitParams);
    const errAutoApprove = assertFailure(resultAutoApprove);
    expect(errAutoApprove.code).toBe("INVALID_PARAMS");
    expect(errAutoApprove.context).toBe("git.smartCommit");

    const resultBranch = await handler(ctx, {
      autoApprove: true,
      branch: { name: "main" } as any,
    } as SmartCommitParams);
    const errBranch = assertFailure(resultBranch);
    expect(errBranch.code).toBe("INVALID_PARAMS");
  });

  it("fails with NO_CHANGES when there are no file changes", async () => {
    const git = new MockGitProvider();
    const logger = new MockLogger();
    const handler = createSmartCommitHandler(
      git as any,
      logger,
      new ChangeGrouper(),
      new CommitMessageSuggester(),
      new BatchCommitter(git as any, logger),
    );

    // Default MockGitProvider has no changes
    const result = await handler(ctx, { autoApprove: true });
    const err = assertFailure(result);

    expect(err.code).toBe("NO_CHANGES");
    expect(err.context).toBe("git.smartCommit");
  });

  it("bubbles GitProvider getAllChanges error as GET_CHANGES_FAILED", async () => {
    const git = new MockGitProvider();
    const logger = new MockLogger();
    const handler = createSmartCommitHandler(
      git as any,
      logger,
      new ChangeGrouper(),
      new CommitMessageSuggester(),
      new BatchCommitter(git as any, logger),
    );

    vi.spyOn(git, "getAllChanges").mockResolvedValueOnce({
      kind: "err",
      error: {
        code: "GIT_STATUS_ERROR",
        message: "unable to read changes",
        context: "MockGitProvider.getAllChanges",
      },
    });

    const result = await handler(ctx, {});
    const err = assertFailure(result);

    expect(err.code).toBe("GET_CHANGES_FAILED");
    expect(err.context).toBe("git.smartCommit");
  });

  it("executes grouping, suggestion and batch commit on happy path", async () => {
    const git = new MockGitProvider();
    const logger = new MockLogger();

    // Provide a small realistic change set
    const fileChanges = createTestChanges(3, "api", "M");
    git.setAllChanges(
      fileChanges.map((c) => ({
        path: c.path,
        status: c.status,
        additions: c.additions,
        deletions: c.deletions,
      })) as any
    );

    const grouper = new ChangeGrouper();
    const suggester = new CommitMessageSuggester();
    const committer = new BatchCommitter(git as any, logger);

    const handler = createSmartCommitHandler(
      git as any,
      logger,
      grouper,
      suggester,
      committer,
    );

    const result = await handler(ctx, { autoApprove: true });
    const batchResult = assertSuccess(result);

    expect(batchResult.totalFiles).toBe(3);
    expect(batchResult.totalGroups).toBeGreaterThanOrEqual(1);
    expect(batchResult.commits.length).toBeGreaterThanOrEqual(1);
    expect(typeof batchResult.duration).toBe("number");
  });

  it("forwards BatchCommitter errors unchanged", async () => {
    const git = new MockGitProvider();
    const logger = new MockLogger();

    const grouper = {
      group: vi.fn().mockReturnValue([
        {
          id: "g1",
          files: [
            {
              path: "src/file.ts",
              status: "M",
              domain: "core",
              fileType: ".ts",
              additions: 10,
              deletions: 0,
            },
          ],
          suggestedMessage: {
            type: "fix",
            scope: "core",
            description: "desc",
            full: "fix(core): desc",
          },
          similarity: 1,
        },
      ]),
    } as unknown as ChangeGrouper;

    const suggester = {
      suggest: vi.fn().mockImplementation((group) => group.suggestedMessage),
    } as unknown as CommitMessageSuggester;

    const committer = {
      executeBatch: vi.fn().mockResolvedValue({
        kind: "err",
        error: {
          code: "BATCH_COMMIT_ERROR",
          message: "rollback failed",
          context: "BatchCommitter.executeBatch",
        },
      }),
    } as unknown as BatchCommitter;

    // Provide at least one change so handler goes past NO_CHANGES
    git.setAllChanges([
      {
        path: "src/file.ts",
        status: "M",
        additions: 1,
        deletions: 0,
      } as any,
    ]);

    const handler = createSmartCommitHandler(
      git as any,
      logger,
      grouper,
      suggester,
      committer,
    );

    const result = await handler(ctx, { autoApprove: true });
    const err = assertFailure(result);

    expect(err.code).toBe("BATCH_COMMIT_ERROR");
    expect(err.context).toBe("BatchCommitter.executeBatch");
  });
});

// ============================================================================
// Approval UI Tests
// ============================================================================

describe("git.smartCommit approval UI", () => {
  const ctx = createMockContext();

  /** Set up a handler with N changes and an optional approvalUI mock. */
  function setup(approvalUI?: ApprovalUI) {
    const git = new MockGitProvider();
    const logger = new MockLogger();
    const fileChanges = createTestChanges(3, "api", "M");
    git.setAllChanges(
      fileChanges.map((c) => ({
        path: c.path,
        status: c.status,
        additions: c.additions,
        deletions: c.deletions,
      })) as any
    );
    const grouper = new ChangeGrouper();
    const suggester = new CommitMessageSuggester();
    const committer = new BatchCommitter(git as any, logger);

    const handler = createSmartCommitHandler(
      git as any,
      logger,
      grouper,
      suggester,
      committer,
      approvalUI,
    );
    return { handler, git, logger };
  }

  it("does not invoke approvalUI when autoApprove is true", async () => {
    const mockUI = vi.fn<ApprovalUI>();
    const { handler } = setup(mockUI);

    const result = await handler(ctx, { autoApprove: true });
    assertSuccess(result);

    expect(mockUI).not.toHaveBeenCalled();
  });

  it("invokes approvalUI with grouped changes when not autoApprove", async () => {
    const mockUI = vi.fn<ApprovalUI>().mockImplementation(async (groups) =>
      groups.map((g) => ({ group: g, approvedMessage: g.suggestedMessage.full }))
    );
    const { handler } = setup(mockUI);

    const result = await handler(ctx, {});
    assertSuccess(result);

    expect(mockUI).toHaveBeenCalledOnce();
    const passedGroups = mockUI.mock.calls[0][0];
    expect(passedGroups.length).toBeGreaterThanOrEqual(1);
    expect(passedGroups[0].suggestedMessage.full).toBeTruthy();
  });

  it("returns COMMIT_CANCELLED when approvalUI returns null", async () => {
    const mockUI = vi.fn<ApprovalUI>().mockResolvedValue(null);
    const { handler } = setup(mockUI);

    const result = await handler(ctx, {});
    const err = assertFailure(result);

    expect(err.code).toBe("COMMIT_CANCELLED");
    expect(err.context).toBe("git.smartCommit");
  });

  it("returns NO_GROUPS_APPROVED when approvalUI returns empty array", async () => {
    const mockUI = vi.fn<ApprovalUI>().mockResolvedValue([]);
    const { handler } = setup(mockUI);

    const result = await handler(ctx, {});
    const err = assertFailure(result);

    expect(err.code).toBe("NO_GROUPS_APPROVED");
  });

  it("only commits approved groups when approvalUI returns a subset", async () => {
    // Approve only the first group returned by the UI
    const mockUI = vi.fn<ApprovalUI>().mockImplementation(async (groups) => {
      const first = groups[0];
      return [{ group: first, approvedMessage: first.suggestedMessage.full }];
    });
    const { handler } = setup(mockUI);

    const result = await handler(ctx, {});
    const batchResult = assertSuccess(result);

    // Only 1 group committed regardless of how many groups were generated
    expect(batchResult.commits.length).toBe(1);
  });

  it("uses the edited approvedMessage as the git commit message", async () => {
    const editedMessage = "custom: user-edited message";
    const mockUI = vi.fn<ApprovalUI>().mockImplementation(async (groups) =>
      groups.map((g) => ({ group: g, approvedMessage: editedMessage }))
    );
    const { handler, git } = setup(mockUI);
    const commitSpy = vi.spyOn(git, "commit");

    const result = await handler(ctx, {});
    assertSuccess(result);

    // Every commit call should use the edited message
    for (const call of commitSpy.mock.calls) {
      expect(call[0]).toBe(editedMessage);
    }
  });

  it("auto-approves all groups when no approvalUI is injected", async () => {
    // No approvalUI passed → should behave like autoApprove
    const { handler } = setup(undefined);

    const result = await handler(ctx, {}); // autoApprove not set either
    const batchResult = assertSuccess(result);

    expect(batchResult.commits.length).toBeGreaterThanOrEqual(1);
    expect(batchResult.totalFiles).toBe(3);
  });
});

