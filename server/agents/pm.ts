import { BaseAgent, RESPONSE_SCHEMA, type AgentRunContext } from "./base.js";
import {
  readSourceFiles,
  formatFilesForPrompt,
  readPackageJson,
} from "../utils/codeReader.js";

const PM_FILES = [
  "src/App.tsx",
  "src/store/index.ts",
  "src/service/modules/role.ts",
  "src/service/types.ts",
  "src/uikit/ChatSidebar/index.tsx",
  "src/uikit/UserInput/index.tsx",
  "src/uikit/Message/index.tsx",
  "server/routes/agents.ts",
];

export class PMAgent extends BaseAgent {
  readonly name = "pm";
  readonly description =
    "Codex 产品经理 — RICE 评分、用户故事与功能差距分析";

  protected buildSystemPrompt(): string {
    return `You are a Codex-style product manager: rigorous, data-driven, and ruthlessly prioritized.
You specialize in AI-native products and developer tools.

Your mandate — "Codex PM" — is to produce a structured product optimization plan covering:

  1. **User journey gaps**
     Map the critical paths: first-time user, power user, mobile user.
     Identify where the current UX breaks or leaves users confused.
     Think in terms of Jobs-To-Be-Done (JTBD).

  2. **RICE-scored feature proposals**
     For each proposed feature, score: Reach (1-10), Impact (1-3), Confidence (%), Effort (person-weeks).
     RICE = (Reach × Impact × Confidence) / Effort. Rank by RICE score descending.

  3. **Competitive gap analysis**
     Compare against ChatGPT web, Claude.ai, and Perplexity.
     What table-stakes features are missing that users will immediately feel the absence of?
     What is Supercell's moat (local LLM privacy + social graph) and how can it be deepened?

  4. **User stories** (for the top 5 highest-RICE items)
     Format: "As a [user type], I want to [action] so that [outcome]."
     Include 3 acceptance criteria per story.

  5. **Quick wins vs strategic bets**
     Separate items into: Quick wins (< 1 day effort, high visibility) vs Strategic bets (> 1 week, game-changing).

  6. **Metrics & success criteria**
     For each major proposal, define 1–2 measurable success metrics
     (e.g., "time to first message < 30s", "chat retention rate +20%").

  7. **Risks & assumptions**
     Call out the biggest unknowns or product bets that could invalidate priorities.

Think like a PM at a 10-person startup: be opinionated, ship the right things first.

${RESPONSE_SCHEMA}`;
  }

  protected async buildUserMessage(context: AgentRunContext): Promise<string> {
    const [files, pkg] = await Promise.all([
      readSourceFiles(PM_FILES),
      readPackageJson(),
    ]);
    const codeBlock = formatFilesForPrompt(files);
    const handoffBlock =
      context.handoff && context.handoff.length > 0
        ? `\n## Upstream Handoff\n${JSON.stringify(context.handoff, null, 2)}\n`
        : "";

    const deps = pkg.dependencies as Record<string, string> | undefined;
    const unusedSignals = [
      "@gitbeaker/rest",
      "@slack/bolt",
      "fluent-ffmpeg",
      "simple-git",
    ]
      .filter((d) => deps && d in deps)
      .join(", ");

    return `Produce a RICE-prioritized product optimization plan for "Supercell" (codename: gagent).

## Product Context
- **Core value**: Privacy-first AI chat that runs against a LOCAL LLM server (LM Studio / Ollama).
- **Differentiator**: Built-in "social graph / role analysis" module — tracks relationship dynamics, intent, mood in conversations.
- **Current state**: Single-user local app, React + Vite SPA, no backend auth, multi-chat with localStorage persistence.
- **Audience hints**: Package deps include ${unusedSignals || "Slack, GitLab, ffmpeg"} — suggesting automation / team collaboration ambitions.
- **Autonomous iteration loop**: Backend has 3 AI analysis agents (pm, developer, tester) that self-analyze the codebase.

## What works today
- Streaming LLM chat with multi-conversation sidebar
- localStorage persistence across sessions
- Model switcher (pulls list from local LLM endpoint)
- Code block rendering with copy button
- Mobile-responsive layout with sidebar toggle

## Known gaps (for your analysis)
- No chat search or history export
- No user preferences / settings UI
- Social graph module memory is lost on page reload
- No syntax highlighting in code blocks
- No auth on backend agent endpoints
- No retry / error recovery in the chat flow
- Unused dependencies hint at un-shipped features

## Package metadata
\`\`\`json
${JSON.stringify({ name: pkg.name, scripts: pkg.scripts, dependencies: pkg.dependencies }, null, 2)}
\`\`\`

## Source Files
${codeBlock}
${handoffBlock}

Deliver a prioritized plan. Lead with the RICE-scored feature table, then expand on each top item with user stories and acceptance criteria.`;
  }
}
