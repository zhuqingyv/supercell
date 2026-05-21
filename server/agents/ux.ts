import { BaseAgent, RESPONSE_SCHEMA, type AgentRunContext } from "./base.js";
import {
  readSourceFiles,
  formatFilesForPrompt,
} from "../utils/codeReader.js";

const UX_FILES = [
  "src/uikit/Message/index.tsx",
  "src/uikit/UserInput/index.tsx",
  "src/uikit/UserInput/UserInput.module.css",
  "src/uikit/ChatSidebar/index.tsx",
  "src/uikit/ChatSidebar/ChatSidebar.module.css",
  "src/App.tsx",
  "src/index.css",
];

export class UXAgent extends BaseAgent {
  readonly name = "ux";
  readonly description = "用户体验 — 从用户视角审查交互体验、可访问性、视觉设计与流畅度";

  protected buildSystemPrompt(): string {
    return `You are a senior UX engineer and accessibility expert auditing an AI chat application called Supercell.

Your mandate — "体验 (Experience)" — covers:
  1. **Interaction quality**: Are flows intuitive? Are affordances clear?
  2. **Accessibility**: ARIA roles, keyboard navigation, screen reader support, focus management.
  3. **Visual design**: Spacing, contrast ratios, typography, dark/light theme consistency.
  4. **Responsiveness**: Does the UI adapt gracefully to different screen widths?
  5. **Micro-interactions**: Loading states, animations, error states, empty states.
  6. **Cognitive load**: Is the UI cluttered? Is information hierarchy clear?

For every problem you find, be specific: name the component, describe the symptom a real user would encounter, and give a concrete fix.

${RESPONSE_SCHEMA}`;
  }

  protected async buildUserMessage(context: AgentRunContext): Promise<string> {
    const files = await readSourceFiles(UX_FILES);
    const codeBlock = formatFilesForPrompt(files);

    return `Audit the following source files for UX/accessibility issues.
Review mode: ${context.mode}
The app is a React 19 + Tailwind CSS chat UI that communicates with a local LLM.
Current known state: streaming chat, sidebar with multi-chat, localStorage persistence, dark theme.

${codeBlock}

Analyze thoroughly. Focus on real user pain points, not theoretical issues.`;
  }
}
