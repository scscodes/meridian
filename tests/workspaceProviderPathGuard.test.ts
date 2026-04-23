import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { createWorkspaceProvider } from "../src/infrastructure/workspace-provider";

describe("WorkspaceProvider path boundary enforcement", () => {
  it("allows read/delete inside workspace and blocks outside traversal", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-ws-provider-"));
    const inside = path.join(root, "tmp.txt");
    fs.writeFileSync(inside, "ok");

    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "meridian-ws-outside-"));
    const outside = path.join(outsideDir, "secret.txt");
    fs.writeFileSync(outside, "secret");

    const provider = createWorkspaceProvider(root);

    const readOk = await provider.readFile("tmp.txt");
    expect(readOk.kind).toBe("ok");

    const readBlocked = await provider.readFile("../secret.txt");
    expect(readBlocked.kind).toBe("err");

    const delBlocked = await provider.deleteFile(outside);
    expect(delBlocked.kind).toBe("err");

    const delOk = await provider.deleteFile("tmp.txt");
    expect(delOk.kind).toBe("ok");
  });
});
