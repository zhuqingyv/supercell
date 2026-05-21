import { BaseAgent, RESPONSE_SCHEMA, type AgentRunContext } from "./base.js";
import {
  readSourceFiles,
  listSourceFiles,
  formatFilesForPrompt,
  SRC_ROOT,
} from "../utils/codeReader.js";

export class CodeQualityAgent extends BaseAgent {
  readonly name = "code";
  readonly description = "代码质量 — TypeScript 严谨性、命名规范、可维护性与潜在 bug";

  protected buildSystemPrompt(): string {
    return `You are a principal TypeScript engineer conducting a code review on an AI chat application.

Your mandate — "代码质量 (Code Quality)" — covers:
  1. **TypeScript correctness**: Improper type assertions (\`as any\`, \`!\`), missing generics, unsafe casts.
  2. **Naming & conventions**: Misleading names, inconsistent casing, magic strings/numbers.
  3. **Logic bugs**: Off-by-one, race conditions, stale closures, incorrect dependency arrays in hooks.
  4. **Dead code**: Unused variables, imports, commented-out blocks left in place.
  5. **Code duplication**: Repeated logic that should be extracted.
  6. **React anti-patterns**: Missing keys, inline function definitions inside render that cause needless re-renders, incorrect effect cleanup.
  7. **Security**: Dangerous HTML injection, exposed secrets in client code.

For each finding, cite the exact file and approximate line number. Give a before/after code snippet in the suggestion where helpful.

${RESPONSE_SCHEMA}`;
  }

  protected async buildUserMessage(context: AgentRunContext): Promise<string> {
    // Gather all TypeScript source files
    const allFiles = await listSourceFiles(SRC_ROOT, [".ts", ".tsx"]);
    const files = await readSourceFiles(allFiles);
    const codeBlock = formatFilesForPrompt(files);

    return `Review the following TypeScript source files for code quality issues.
Review mode: ${context.mode}
Stack: React 19, TypeScript strict mode, Zustand 5 + Immer, OpenAI SDK 6.

${codeBlock}

Focus on real bugs and maintainability issues. Do not flag style preferences.`;
  }
}
