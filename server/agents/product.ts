import { BaseAgent, RESPONSE_SCHEMA, type AgentRunContext } from "./base.js";
import {
  readSourceFiles,
  formatFilesForPrompt,
  readPackageJson,
} from "../utils/codeReader.js";

const PRODUCT_FILES = [
  "src/App.tsx",
  "src/store/index.ts",
  "src/service/modules/role.ts",
  "src/uikit/ChatSidebar/index.tsx",
  "src/uikit/UserInput/index.tsx",
  "src/uikit/Message/index.tsx",
];

export class ProductAgent extends BaseAgent {
  readonly name = "product";
  readonly description = "产品形态 — 产品定位、功能集完整性与差异化竞争力";

  protected buildSystemPrompt(): string {
    return `You are a product strategist evaluating an AI chat application from a product perspective.

Your mandate — "产品形态 (Product Form)" — covers:
  1. **Product positioning**: What is the clearest value proposition? Who is the target user? Is the current feature set aligned?
  2. **Feature set completeness**: Compared to leading AI chat products (ChatGPT, Claude.ai, Perplexity), what table-stakes features are missing?
  3. **Differentiation**: What unique capabilities (like the social graph / role analysis module) create genuine differentiation? How can they be surfaced better?
  4. **User journey**: From first visit to power user — are there clear on-boarding, engagement, and retention hooks?
  5. **Monetization readiness**: If this were to become a product, what foundation is in place? What is missing?
  6. **Product coherence**: Do all features hang together in a coherent vision, or is it a collection of experiments?
  7. **Next bets**: What are the 3–5 highest-leverage product investments for the next iteration?

Think like a product leader making a roadmap decision: be opinionated and prioritize ruthlessly.

${RESPONSE_SCHEMA}`;
  }

  protected async buildUserMessage(context: AgentRunContext): Promise<string> {
    const [files, pkg] = await Promise.all([
      readSourceFiles(PRODUCT_FILES),
      readPackageJson(),
    ]);
    const codeBlock = formatFilesForPrompt(files);
    const handoffBlock =
      context.handoff && context.handoff.length > 0
        ? `\n## Upstream Handoff\n${JSON.stringify(context.handoff, null, 2)}\n`
        : "";

    return `Evaluate the product form of this AI chat application named "Supercell" (internal codename: gagent).

Context:
- Targets a local LLM server (LM Studio / Ollama) — privacy-first, offline-capable.
- Has a unique "social graph / role analysis" module that tracks relationship dynamics in conversation.
- Currently a single-user local app, React + Vite frontend only.
- Backend dependencies (Express, SQLite, Slack bot, GitLab) suggest broader automation ambitions.

## package.json name & scripts
\`\`\`json
${JSON.stringify({ name: pkg.name, description: pkg.description, scripts: pkg.scripts }, null, 2)}
\`\`\`

## Source Files
${codeBlock}
${handoffBlock}

Give a candid product assessment. Identify the most compelling product narrative and the highest-leverage next moves.`;
  }
}
