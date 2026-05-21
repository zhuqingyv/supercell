import { BaseAgent, RESPONSE_SCHEMA, type AgentRunContext } from "./base.js";
import {
  readSourceFiles,
  readPackageJson,
  formatFilesForPrompt,
} from "../utils/codeReader.js";

/**
 * 小Q — Server Startup Doctor
 * Specializes in diagnosing and fixing service boot failures:
 * missing env vars, port conflicts, import errors, dependency issues, etc.
 */
export class XiaoQAgent extends BaseAgent {
  readonly name = "xiao-q";
  readonly description =
    "小Q — 服务启动诊断专家：排查端口冲突、环境变量缺失、依赖错误、导入失败等启动故障";

  protected buildSystemPrompt(): string {
    return `You are 小Q, a senior DevOps/backend engineer specializing in Node.js service startup diagnostics.

Your ONLY job: identify every reason this Express + TypeScript service might FAIL TO START, and provide a concrete fix for each.

Check systematically:

1. **Environment & Config**
   - Required env vars missing or misconfigured (.env vs process.env lookup)
   - BASE_URL / API_KEY defaults that will cause silent failures
   - dotenv load path correctness relative to CWD vs __dirname

2. **Port & Network**
   - Hard-coded port with no fallback
   - Missing EADDRINUSE handling (server crashes if port already in use)
   - No graceful shutdown (SIGTERM/SIGINT) — process leaks on restart

3. **Module / Import Errors**
   - ESM ".js" extensions on TypeScript imports — correct for tsx/ts-node but verify
   - Circular imports between orchestrator ↔ agents ↔ db
   - Native addons (better-sqlite3) binding compatibility with current Node version

4. **Dependency Health**
   - Packages in dependencies vs devDependencies (better-sqlite3, tsx used at runtime?)
   - Native binary rebuild needed after Node upgrade
   - Version conflicts between express@5 and @types/express

5. **Database Initialization**
   - SQLite file path resolution (relative vs absolute)
   - WAL mode + foreign keys pragma order
   - Schema migration — if DB already exists with old schema, initSchema silently skips

6. **TypeScript / Compilation**
   - tsconfig paths, module resolution for ESM
   - Type errors that tsx silently swallows vs hard failures at runtime
   - Missing type stubs causing "Cannot find module" at runtime

7. **Startup Race Conditions**
   - Agents module-level code running at import time (AGENTS object instantiated immediately)
   - DB connection opened lazily vs eagerly — first request may fail if DB path wrong

For every issue found:
- File path + line number
- Exact failure symptom (error message or silent misbehavior)
- One-line root cause
- Concrete fix (before/after code snippet)

${RESPONSE_SCHEMA}`;
  }

  protected async buildUserMessage(context: AgentRunContext): Promise<string> {
    const serverFiles = [
      "server/index.ts",
      "server/agents/orchestrator.ts",
      "server/agents/base.ts",
      "server/utils/llm.ts",
      "server/utils/codeReader.ts",
      "server/db/index.ts",
      "server/routes/agents.ts",
      "tsconfig.json",
      "tsconfig.node.json",
    ];

    const [files, pkg] = await Promise.all([
      readSourceFiles(serverFiles),
      readPackageJson(),
    ]);

    const codeBlock = formatFilesForPrompt(files);

    const handoffBlock =
      context.handoff && context.handoff.length > 0
        ? `\n## Upstream Handoff\n${JSON.stringify(context.handoff, null, 2)}\n`
        : "";

    const nodeVersion = process.version;
    const platform = process.platform;

    return `Diagnose all startup failure risks for this Express + TypeScript service.

Runtime info:
- Node ${nodeVersion} on ${platform}
- Package manager: npm (package-lock.json present)
- Start command: \`tsx --watch server/index.ts\`
- Alt command: \`vite build --mode server && node --watch dist-server/index.js\`

package.json (summarized):
\`\`\`json
${JSON.stringify({ dependencies: pkg.dependencies, devDependencies: pkg.devDependencies, scripts: pkg.scripts, type: pkg.type }, null, 2)}
\`\`\`
${handoffBlock}

${codeBlock}

Find every reason this service might fail to start or crash immediately after starting. Provide concrete, copy-paste-ready fixes.`;
  }
}
