import { callLLM, extractJSON } from "../utils/llm.js";
import {
  createRun,
  finishRun,
  insertFindings,
  insertIterations,
} from "../db/index.js";
import type { FindingRow, IterationRow } from "../db/index.js";

export type Severity = "high" | "medium" | "low";
export type Effort = "small" | "medium" | "large";
export type Impact = "high" | "medium" | "low";

export interface Finding {
  severity: Severity;
  category: string;
  description: string;
  file?: string;
  line?: number;
  suggestion?: string;
  priority: number; // 1 (urgent) – 5 (nice-to-have)
}

export interface Iteration {
  action: string;
  rationale?: string;
  effort: Effort;
  impact: Impact;
}

export interface AgentResult {
  agentName: string;
  score: number;       // 0–10
  summary: string;
  findings: Finding[];
  iterations: Iteration[];
  runId: number;
  durationMs: number;
}

export interface TeamHandoff {
  from: string;
  score: number;
  summary: string;
  topFindings: Finding[];
  topIterations: Iteration[];
}

export interface AgentRunContext {
  mode: "single" | "team" | "parallel";
  handoff?: TeamHandoff[];
}

/**
 * Shared JSON schema pasted into every agent prompt so the LLM knows exactly
 * what format to return.
 */
export const RESPONSE_SCHEMA = `
Return ONLY valid JSON (no markdown prose outside the JSON block) matching this schema:
\`\`\`json
{
  "score": <integer 0-10>,
  "summary": "<one-paragraph overall assessment>",
  "findings": [
    {
      "severity": "high|medium|low",
      "category": "<category label>",
      "description": "<clear description of the problem>",
      "file": "<relative file path or null>",
      "line": <line number or null>,
      "suggestion": "<concrete suggestion>",
      "priority": <1-5>
    }
  ],
  "iterations": [
    {
      "action": "<imperative sentence describing what to do>",
      "rationale": "<why this improves the product>",
      "effort": "small|medium|large",
      "impact": "high|medium|low"
    }
  ]
}
\`\`\`
`;

export abstract class BaseAgent {
  abstract readonly name: string;
  abstract readonly description: string;

  /** Subclasses build the system prompt defining their focus area. */
  protected abstract buildSystemPrompt(): string;

  /** Subclasses gather relevant source files/context and build the user message. */
  protected abstract buildUserMessage(context: AgentRunContext): Promise<string>;
  /** Subclasses can override model routing per role. */
  protected getModel(): string | undefined {
    return undefined;
  }

  async run(context: AgentRunContext = { mode: "single" }): Promise<AgentResult> {
    const runId = createRun(this.name);
    const t0 = Date.now();

    try {
      const [systemPrompt, userMessage] = await Promise.all([
        Promise.resolve(this.buildSystemPrompt()),
        this.buildUserMessage(context),
      ]);

      const raw = await callLLM({
        systemPrompt,
        userMessage,
        model: this.getModel(),
        temperature: 0.3,
        maxTokens: 6000,
      });

      const parsed = extractJSON<{
        score: number;
        summary: string;
        findings: Finding[];
        iterations: Iteration[];
      }>(raw);

      const findings = (parsed.findings ?? []).slice(0, 20);
      const iterations = (parsed.iterations ?? []).slice(0, 10);

      // Persist
      if (findings.length > 0) {
        const rows: FindingRow[] = findings.map((f) => ({
          run_id: runId,
          agent_name: this.name,
          ...f,
        }));
        insertFindings(rows);
      }
      if (iterations.length > 0) {
        const rows: IterationRow[] = iterations.map((i) => ({
          run_id: runId,
          agent_name: this.name,
          ...i,
        }));
        insertIterations(rows);
      }

      finishRun(runId, { score: parsed.score, summary: parsed.summary });

      return {
        agentName: this.name,
        score: parsed.score,
        summary: parsed.summary,
        findings,
        iterations,
        runId,
        durationMs: Date.now() - t0,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      finishRun(runId, { error: msg });
      throw err;
    }
  }
}
