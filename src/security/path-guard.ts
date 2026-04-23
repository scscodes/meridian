import * as path from "path";
import * as fs from "fs";

export function resolveWorkspacePath(
  workspaceRoot: string,
  candidatePath: string
): string {
  const root = fs.realpathSync(path.resolve(workspaceRoot));
  const candidateResolved = path.isAbsolute(candidatePath)
    ? path.resolve(candidatePath)
    : path.resolve(root, candidatePath);
  const candidate = fs.realpathSync(candidateResolved);

  const relative = path.relative(root, candidate);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Path is outside workspace");
  }

  return candidate;
}
