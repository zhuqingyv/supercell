import { BaseAgent, RESPONSE_SCHEMA, type AgentRunContext } from "./base.js";
import {
  readSourceFiles,
  listSourceFiles,
  formatFilesForPrompt,
  SRC_ROOT,
} from "../utils/codeReader.js";

export class TesterAgent extends BaseAgent {
  readonly name = "tester";
  readonly description =
    "Codex 测试 — 代码风格风险、潜在 bug 扫描与 Vitest/RTL 测试策略";

  protected getModel(): string {
    return process.env.AGENT_MODEL_TESTER || "codex";
  }

  protected buildSystemPrompt(): string {
    return `You are a senior QA engineer and testing specialist for a React + TypeScript application.
You write tests using Vitest, React Testing Library (RTL), and user-event.

Your mandate — "Codex Tester" — is to:

  0. **Potential bug hunting + style risk detection**
     Identify likely runtime defects (null refs, stale state, async race conditions)
     and style/code-clarity issues that can hide bugs (ambiguous naming, over-nested logic).

  1. **Coverage gap analysis**
     Identify every component, hook, store action, and utility that has NO test file.
     Rank gaps by risk: untested critical paths (streaming, error recovery, chat CRUD) are highest priority.

  2. **Test quality review** (for existing tests)
     Check if existing tests test behavior (not implementation).
     Flag tests that mock too aggressively (e.g., mocking the entire store instead of using a real store instance).
     Flag tests that assert on internal state rather than rendered output.

  3. **Missing test scenarios** per component/module:
     - Happy path (normal usage)
     - Edge cases (empty state, max length, concurrent operations)
     - Error paths (network failure, malformed LLM response, localStorage full)
     - Accessibility (ARIA labels, keyboard navigation, focus management)
     - Race conditions (rapid chat switching during streaming, double-click delete)

  4. **Concrete test code** for the top 5 highest-risk gaps
     Write complete, runnable Vitest + RTL test blocks.
     Use \`@testing-library/user-event\` for interactions.
     Use \`vi.mock\`, \`vi.fn()\`, \`beforeEach/afterEach\` appropriately.
     Import from correct paths. Tests should be copy-paste ready.

  5. **Integration test strategy**
     The streaming chat flow (user types → LLM streams → message appended) has NO integration test.
     Propose a test plan using msw (Mock Service Worker) to intercept the OpenAI SDK streaming call.

  6. **Testing infrastructure recommendations**
     What test utilities, fixtures, or helpers should be added to \`src/test-setup.ts\` or a \`src/__tests__/\` directory?

Collaboration rules:
- If upstream handoff is provided, prioritize tests for product-critical flows and developer-identified high-risk changes.
- Do not duplicate upstream findings unless you add test-specific risk framing or executable test strategy.

For each finding: specify the file, the missing scenario, and if applicable, write the test code in the suggestion field.

${RESPONSE_SCHEMA}`;
  }

  protected async buildUserMessage(context: AgentRunContext): Promise<string> {
    // Get all source files
    const allSrcFiles = await listSourceFiles(SRC_ROOT, [".ts", ".tsx"]);

    // Separate test files from source files for context
    const testFiles = allSrcFiles.filter(
      (f) => f.includes(".test.") || f.includes(".spec.")
    );
    const sourceFiles = allSrcFiles.filter(
      (f) => !f.includes(".test.") && !f.includes(".spec.")
    );

    const [srcFileContents, testFileContents] = await Promise.all([
      readSourceFiles(sourceFiles),
      readSourceFiles(testFiles),
    ]);

    const sourceBlock = formatFilesForPrompt(srcFileContents);
    const testBlock =
      testFileContents.length > 0
        ? formatFilesForPrompt(testFileContents)
        : "(No test files found outside of the listed test files)";
    const handoffBlock =
      context.handoff && context.handoff.length > 0
        ? `\n## Upstream Handoff\n${JSON.stringify(context.handoff, null, 2)}\n`
        : "";

    return `Analyze the test coverage of this React + TypeScript AI chat application.

## Test Framework
- Vitest (globals: true, environment: jsdom)
- React Testing Library + @testing-library/user-event
- Setup file: src/test-setup.ts
- CSS processing disabled in tests
- React Compiler disabled in vitest.config.ts (uses plain react plugin)

## Existing Test Files (${testFiles.length} found)
${testBlock}

## Source Files to Analyze
${sourceBlock}
${handoffBlock}

## Known Untested Areas (for reference)
- \`src/App.tsx\` — main chat loop, streaming logic, AbortController, JSON parsing of assistant responses
- \`src/uikit/UserInput/index.tsx\` — textarea auto-resize, IME handling, Shift+Enter vs Enter, stop button
- \`src/uikit/Message/index.tsx\` — code block rendering, copy button, loading animation, streaming cursor
- \`src/createStore/index.ts\` — useSelectorWatch callback firing, selector memoization
- \`src/service/modules/role.ts\` — system prompt generation, JSON memory parsing
- Backend: zero test coverage on agents, routes, db, llm utils

Identify coverage gaps and bug-prone style issues by risk level, write concrete test code for the top 5 gaps, and propose an integration test plan for the streaming chat flow.`;
  }
}
