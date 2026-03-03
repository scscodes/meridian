# Prose Pipeline — Implementation Spec

Pre-computed research for building the `<context> → analyze → synthesize prose` primitive.
This file eliminates the need to re-read source files when implementing.

---

## 1. Existing LLM Patterns in Meridian

### Model Selection (`src/infrastructure/model-selector.ts`)

```typescript
selectModel(domain?: "hygiene" | "git" | "chat"): Promise<vscode.LanguageModelChat | null>
```

- Reads `meridian.model.<domain>` → falls back to `meridian.model.default` ("gpt-4o") → falls back to any available model
- Uses `vscode.lm.selectChatModels({ family })` then `selectChatModels({})` as fallback
- Returns `null` if no model available — callers must handle this

### Streaming Pattern (already used in `main.ts` ~line 386 for hygiene review)

```typescript
const model = await selectModel("hygiene");
if (!model) { /* show error */ return; }

const messages = [
  vscode.LanguageModelChatMessage.User(`<system prompt>\n\n<data>`)
];

const cts = new vscode.CancellationTokenSource();
context.subscriptions.push(cts);
const response = await model.sendRequest(messages, {}, cts.token);

// Stream to OutputChannel
for await (const fragment of response.text) {
  outputChannel.append(fragment);
}
```

### Chat Participant Streaming (`src/ui/chat-participant.ts`)

Uses `response.stream` (not `response.text`) with type discrimination:

```typescript
const response = await request.model.sendRequest(messages, {}, token);
let result = "";
for await (const part of response.stream) {
  if (part instanceof vscode.LanguageModelTextPart) {
    result += part.value;
  }
}
```

Chat participant uses `stream.markdown()` to render, while the hygiene review uses `outputChannel.append()`.

### Key Differences Between the Two Patterns

| Aspect | OutputChannel (hygiene review) | Chat stream |
|--------|-------------------------------|-------------|
| Model source | `selectModel(domain)` | `request.model` (provided by VS Code) |
| Cancellation | Manual `CancellationTokenSource` | `token` from chat handler args |
| Output | `outputChannel.append(fragment)` | `stream.markdown(text)` |
| Streaming | `response.text` (string async iterable) | `response.stream` (typed parts) |

---

## 2. Available Structured Data (Pipeline Inputs)

### Git Status (`GitProvider.status()`)

```typescript
interface GitStatus {
  branch: string;
  isDirty: boolean;
  staged: number;
  unstaged: number;
  untracked: number;
}
```

### SmartCommit Change Groups (`ChangeGrouper` output)

```typescript
interface FileChange {
  path: string;
  status: "A" | "M" | "D" | "R";
  domain: string;       // extracted from path (e.g., "git", "infrastructure")
  fileType: string;      // extension (e.g., ".ts", ".md")
  additions: number;
  deletions: number;
}

interface ChangeGroup {
  id: string;
  files: FileChange[];
  suggestedMessage: SuggestedMessage;  // { type, scope, description, full }
  similarity: number;   // 0-1 confidence
}
```

This is the richest structured data we have — already semantically grouped with suggested conventional commit messages. Direct input for PR descriptions.

### Inbound/Conflict Analysis (`InboundAnalyzer` output)

```typescript
interface ConflictFile {
  path: string;
  localStatus: "M" | "D" | "A";
  remoteStatus: "M" | "D" | "A";
  severity: "high" | "medium" | "low";
  localChanges: number;
  remoteChanges: number;
}

interface InboundChanges {
  remote: string;        // "origin"
  branch: string;        // "main"
  totalInbound: number;
  totalLocal: number;
  conflicts: ConflictFile[];
  summary: ChangesSummary;  // { description, conflicts: {high, medium, low}, recommendations: string[] }
  diffLink: string;
}
```

### Git Analytics Report (for session briefing)

```typescript
interface GitAnalyticsReport {
  period: "3mo" | "6mo" | "12mo";
  summary: {
    totalCommits: number;
    totalAuthors: number;
    totalFilesModified: number;
    totalLinesAdded: number;
    totalLinesDeleted: number;
    commitFrequency: number;    // per week
    averageCommitSize: number;  // lines per commit
    churnRate: number;
  };
  commits: CommitMetric[];      // hash, author, date, message, files[]
  files: FileMetric[];          // path, commitCount, volatility, risk
  authors: AuthorMetric[];      // name, commits, insertions, deletions
  trends: TrendData;            // commit slope + volatility slope
  churnFiles: FileMetric[];     // top 10 by volatility
  topAuthors: AuthorMetric[];   // top 5 by commits
}
```

### Diff Output (`GitProvider.getDiff()`)

```typescript
getDiff(paths?: string[]): Promise<Result<string>>  // raw unified diff
getAllChanges(): Promise<Result<GitFileChange[]>>     // { path, status, additions, deletions }
getChanges(): Promise<Result<GitStageChange[]>>      // staged only: { path, status }
```

### Recent Commits (`GitProvider.log()`)

```typescript
log(maxCount?: number): Promise<Result<RecentCommit[]>>
// RecentCommit: { hash, message, author, date, filesChanged }
```

---

## 3. Prose Pipeline Primitive — Design

### Interface

```typescript
// src/infrastructure/prose-generator.ts

interface ProseRequest {
  domain: ModelDomain;                    // model selection
  systemPrompt: string;                  // template with role + output format
  data: Record<string, unknown>;         // structured analysis output
  formatData?: (data: Record<string, unknown>) => string;  // optional custom serializer
}

interface ProseResult {
  kind: "ok" | "err";
  text?: string;       // full generated text
  error?: string;      // model unavailable, cancelled, etc.
}
```

### Implementation Sketch

```typescript
async function generateProse(
  request: ProseRequest,
  cancellation?: vscode.CancellationToken
): Promise<ProseResult> {
  const model = await selectModel(request.domain);
  if (!model) return { kind: "err", error: "No language model available" };

  const dataStr = request.formatData
    ? request.formatData(request.data)
    : JSON.stringify(request.data, null, 2);

  const messages = [
    vscode.LanguageModelChatMessage.User(
      `${request.systemPrompt}\n\n---\n\n${dataStr}`
    ),
  ];

  const cts = cancellation ? undefined : new vscode.CancellationTokenSource();
  const token = cancellation ?? cts!.token;

  const response = await model.sendRequest(messages, {}, token);
  let text = "";
  for await (const fragment of response.text) {
    text += fragment;
  }

  return { kind: "ok", text };
}
```

### Streaming Variant

For OutputChannel / chat stream destinations where incremental display matters:

```typescript
async function streamProse(
  request: ProseRequest,
  sink: (fragment: string) => void,
  cancellation?: vscode.CancellationToken
): Promise<ProseResult>
```

Same setup, but calls `sink(fragment)` on each chunk. Callers wire to `outputChannel.append`, `stream.markdown`, or a webview postMessage.

---

## 4. Feature → Pipeline Mapping

### PR Description Generator

```
Input:   ChangeGroup[] + git log since branch point + diff stats
Prompt:  "Generate a PR description with Summary, Changes, and Test Plan sections"
Output:  Markdown → clipboard + option to open `gh pr create`
Domain:  "git"
```

Data assembly:
1. `gitProvider.log()` — commits since branch diverged from base
2. `ChangeGrouper` output from SmartCommit (or re-run grouper on current diff)
3. `gitProvider.getDiff()` — raw diff for context
4. `gitProvider.getAllChanges()` — file-level stats

### PR / Diff Review

```
Input:   getDiff() output + getAllChanges() stats
Prompt:  "Review this diff. For each file: what changed, potential issues, suggestions"
Output:  Markdown → OutputChannel (streamed)
Domain:  "git"
```

### Session Briefing

```
Input:   GitStatus + log(5) + churnFiles from analytics + hygiene.scan summary
Prompt:  "Summarize workspace state: where I left off, what needs attention"
Output:  Markdown → OutputChannel or dedicated webview
Domain:  "git"
```

### Conflict Resolution

```
Input:   InboundChanges + getDiff() for each ConflictFile.path
Prompt:  "For each conflict: explain both sides, recommend resolution strategy"
Output:  Markdown → webview with per-file sections
Domain:  "git"
```

---

## 5. Output Destination Tradeoffs

| Destination | Best For | Limitation |
|-------------|----------|------------|
| OutputChannel | Streaming prose, logs, reviews | No interactivity, no formatting beyond monospace |
| Clipboard + toast | PR descriptions (paste into GitHub) | Non-visual, user must paste elsewhere |
| Webview panel | Rich formatted output, interactive | Heavy to build, overkill for simple text |
| Chat stream | Conversational flow via @meridian | Only available inside Copilot Chat |
| Virtual document | Read-only editor tab with syntax highlighting | Good for markdown preview |

**Recommendation:** Start with OutputChannel (streaming, already proven in hygiene review). Add clipboard for PR descriptions. Webview only for conflict resolution where side-by-side is essential.

---

## 6. Implementation Order

1. **`src/infrastructure/prose-generator.ts`** — the primitive (`generateProse` + `streamProse`)
2. **`git.generatePR`** — handler + command registration (highest value, simplest data assembly)
3. **`git.reviewDiff`** — handler + command registration (same primitive, different prompt)
4. **`meridian.sessionBriefing`** — handler + command registration (aggregates multiple data sources)
5. **`git.resolveConflicts`** — handler + webview (most complex output surface)

Each feature is: new handler function + prompt template + command registration in COMMAND_MAP + package.json entry. The primitive stays the same.
