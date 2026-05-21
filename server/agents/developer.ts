import { BaseAgent, RESPONSE_SCHEMA, type AgentRunContext } from "./base.js";
import {
  readSourceFiles,
  listSourceFiles,
  formatFilesForPrompt,
  SRC_ROOT,
} from "../utils/codeReader.js";

export class DeveloperAgent extends BaseAgent {
  readonly name = "developer";
  readonly description =
    "Claude 开发 — 代码实现、代码风格治理与潜在缺陷修复建议";

  protected getModel(): string {
    return process.env.AGENT_MODEL_DEVELOPER || "claude";
  }

  protected buildSystemPrompt(): string {
    return `You are a senior full-stack engineer acting as the implementation lead for an AI chat application (React 19 + TypeScript + Zustand + OpenAI SDK frontend; Express + SQLite backend).

Your mandate — "Claude Developer" — is to produce CONCRETE, ACTIONABLE implementation improvements. Focus exclusively on things that can be coded right now.

Examine the code for:
  0. **Code style and maintainability**
     - Inconsistent naming, unnecessary complexity, and unclear control flow
     - TypeScript strictness gaps (implicit any, loose unions, nullable handling)
     - Repeated logic that should be extracted into reusable utilities/hooks
  1. **Security vulnerabilities**
     - API key exposure in browser (dangerouslyAllowBrowser)
     - Missing backend proxy for LLM calls
     - Unvalidated inputs at API boundaries
     - XSS risks from un-sanitized content rendering
  2. **Race conditions & async correctness**
     - Mid-stream chat switching (currentChatId can change while streaming)
     - AbortController lifecycle (leaks across remounts)
     - Missing cleanup in useEffect / event listeners
  3. **Performance**
     - Re-render hotspots (missing memo/useCallback where selector causes churn)
     - Unthrottled auto-scroll causing layout thrash
     - Synchronous SQLite blocking the event loop on large reads
     - Token window: no guard against exceeding context length
  4. **Error handling gaps**
     - Silent catch blocks that swallow real errors
     - No exponential-backoff retry on LLM calls
     - Missing error states in components (error boundary covers top level only)
  5. **State coherence**
     - userInputCache on Chat type defined but never used — remove or implement
     - Role module memory lost on reload (singleton not persisted)
     - Model list fetch errors silently ignored
  6. **Backend hardening**
     - No auth/rate-limiting on /api/agents/* endpoints
     - Hard-coded file lists in agents won't pick up new files
     - No request timeout on LLM callLLM() — can hang indefinitely

Collaboration rules:
- If upstream handoff is provided, align implementation priorities to product priorities first.
- Avoid repeating identical findings from upstream unless implementation details materially change.

For every finding include:
- Exact file path and line number
- Root cause in one sentence
- A concrete code diff / before-after snippet in the suggestion

${RESPONSE_SCHEMA}`;
  }

  protected async buildUserMessage(context: AgentRunContext): Promise<string> {
    const allSrcFiles = await listSourceFiles(SRC_ROOT, [".ts", ".tsx"]);
    const serverFiles = [
      "server/agents/base.ts",
      "server/utils/llm.ts",
      "server/routes/agents.ts",
      "server/db/index.ts",
    ];

    const [srcFiles, svrFiles] = await Promise.all([
      readSourceFiles(allSrcFiles),
      readSourceFiles(serverFiles),
    ]);

    const codeBlock = formatFilesForPrompt([...srcFiles, ...svrFiles]);
    const handoffBlock =
      context.handoff && context.handoff.length > 0
        ? `\n## Upstream Handoff\n${JSON.stringify(context.handoff, null, 2)}\n`
        : "";

    return `Perform a deep implementation review of this AI chat application.
Stack: React 19, TypeScript strict, Zustand 5 + Immer, OpenAI SDK 6, Express 5, better-sqlite3.

Key context:
- The app streams LLM responses via OpenAI SDK with \`dangerouslyAllowBrowser: true\`
- Conversations are persisted in localStorage via a custom createLocalStore wrapper
- A "role module" (social graph analysis) generates system prompts and parses JSON from assistant responses
- The backend exposes a 3-role review team (product/developer/tester) orchestrated by Express routes
- There is NO authentication on any /api/agents/* endpoints
${handoffBlock}

${codeBlock}

Identify the highest-impact implementation and style issues. For each, provide a concrete code fix or refactor plan with before/after snippets.`;
  }
}
