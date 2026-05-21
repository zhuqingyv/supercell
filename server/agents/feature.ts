import { BaseAgent, RESPONSE_SCHEMA, type AgentRunContext } from "./base.js";
import {
  readSourceFiles,
  formatFilesForPrompt,
} from "../utils/codeReader.js";

const FEATURE_FILES = [
  "src/App.tsx",
  "src/store/index.ts",
  "src/service/index.ts",
  "src/service/types.ts",
  "src/service/modules/role.ts",
  "src/uikit/UserInput/index.tsx",
  "src/uikit/Message/index.tsx",
  "src/uikit/ChatSidebar/index.tsx",
];

export class FeatureAgent extends BaseAgent {
  readonly name = "feature";
  readonly description = "功能质量 — 评估已有功能的完整性、可靠性与边界处理";

  protected buildSystemPrompt(): string {
    return `You are a senior product engineer evaluating the feature quality of an AI chat application.

Your mandate — "功能质量 (Feature Quality)" — covers:
  1. **Feature completeness**: Are core chat features fully implemented? (streaming, history, multi-chat, model switching)
  2. **Edge case handling**: Empty input, very long messages, network failure mid-stream, concurrent requests.
  3. **State consistency**: Can the store get into impossible/inconsistent states?
  4. **Error UX**: Are errors surfaced to users clearly with recovery options?
  5. **Missing features with high ROI**: Search, message editing, conversation export, markdown rendering, image support, etc.
  6. **Regression risks**: Fragile assumptions that could break with minor changes.

Be practical: rate by severity to a real user, not by engineering elegance.

${RESPONSE_SCHEMA}`;
  }

  protected async buildUserMessage(context: AgentRunContext): Promise<string> {
    const files = await readSourceFiles(FEATURE_FILES);
    const codeBlock = formatFilesForPrompt(files);

    return `Evaluate the following AI chat application source code for feature quality.
Review mode: ${context.mode}
It's a React 19 + Zustand + OpenAI SDK app targeting a local LLM (LM Studio / Ollama compatible).

Key context:
- Users can create multiple chats, each with isolated history.
- Streaming responses are supported with an AbortController stop button.
- localStorage persistence via Zustand persist middleware.
- Social graph / role analysis module runs on each message.

${codeBlock}

Identify gaps in feature coverage, fragile edge cases, and the highest-ROI missing features.`;
  }
}
