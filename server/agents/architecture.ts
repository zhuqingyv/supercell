import { BaseAgent, RESPONSE_SCHEMA, type AgentRunContext } from "./base.js";
import {
  readSourceFiles,
  formatFilesForPrompt,
  readPackageJson,
} from "../utils/codeReader.js";

const ARCH_FILES = [
  "src/main.tsx",
  "src/App.tsx",
  "src/store/index.ts",
  "src/createStore/index.ts",
  "src/service/index.ts",
  "src/service/types.ts",
  "src/service/modules/role.ts",
  "vite.config.ts",
  "tsconfig.app.json",
];

export class ArchitectureAgent extends BaseAgent {
  readonly name = "architecture";
  readonly description = "技术架构 — 状态管理、数据流、服务层设计与可扩展性";

  protected buildSystemPrompt(): string {
    return `You are a staff-level software architect reviewing the technical architecture of an AI chat application.

Your mandate — "技术架构 (Technical Architecture)" — covers:
  1. **State management design**: Is Zustand used correctly? Are atoms/slices appropriately granular? Is derived state computed vs. stored?
  2. **Data flow clarity**: Is data flow unidirectional and predictable? Are there hidden side effects?
  3. **Service layer**: Is the LLM client abstraction clean? Are API concerns properly separated?
  4. **Scalability**: Will the current design hold up as the app grows (more agents, more chat types, multi-user)?
  5. **Bundle & performance**: Are there obvious bundle size issues? Unnecessary re-renders? Missing lazy loading?
  6. **Coupling & cohesion**: Are modules tightly coupled? Does App.tsx do too much?
  7. **Testability**: Is the code structured in a way that makes unit/integration testing feasible?
  8. **Dependency choices**: Are the chosen libraries well-suited? Any unnecessary heavy dependencies?

Reason at the system level, not the line level.

${RESPONSE_SCHEMA}`;
  }

  protected async buildUserMessage(context: AgentRunContext): Promise<string> {
    const [files, pkg] = await Promise.all([
      readSourceFiles(ARCH_FILES),
      readPackageJson(),
    ]);
    const codeBlock = formatFilesForPrompt(files);
    const deps = {
      dependencies: pkg.dependencies,
      devDependencies: pkg.devDependencies,
      scripts: pkg.scripts,
    };

    return `Analyze the technical architecture of this AI chat application.
Review mode: ${context.mode}

## package.json (deps & scripts)
\`\`\`json
${JSON.stringify(deps, null, 2)}
\`\`\`

## Source Files
${codeBlock}

Identify architectural weaknesses, scalability bottlenecks, and specific refactoring opportunities that would increase long-term maintainability.`;
  }
}
