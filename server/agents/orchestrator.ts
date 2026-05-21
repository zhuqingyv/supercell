import cron from "node-cron";
import { ProductAgent } from "./product.js";
import { PMAgent } from "./pm.js";
import { DeveloperAgent } from "./developer.js";
import { TesterAgent } from "./tester.js";
import { XiaoQAgent } from "./xiao-q.js";
import type {
  BaseAgent,
  AgentResult,
  AgentRunContext,
} from "./base.js";

export const AGENT_NAMES = ["product", "pm", "developer", "tester", "xiao-q"] as const;
export type AgentName = (typeof AGENT_NAMES)[number];

export function isAgentName(name: string): name is AgentName {
  return AGENT_NAMES.includes(name as AgentName);
}

export function normalizeAgentName(name: string): AgentName | null {
  const normalized = name.trim().toLowerCase();
  if (isAgentName(normalized)) return normalized;

  // Common aliases for ergonomic API usage.
  if (normalized === "dev") return "developer";
  if (normalized === "qa" || normalized === "test") return "tester";
  return null;
}

// Five-role team: product, pm, developer, tester, xiao-q
const AGENTS: Record<AgentName, BaseAgent> = {
  product: new ProductAgent(),
  pm: new PMAgent(),
  developer: new DeveloperAgent(),
  tester: new TesterAgent(),
  "xiao-q": new XiaoQAgent(),
};

export interface OrchestratorStatus {
  cronActive: boolean;
  activeAgents: AgentName[];
  lastRunAt: string | null;
  cronSchedule: string | null;
}

interface RunState {
  running: Set<AgentName>;
  lastRunAt: Date | null;
  cronTask: cron.ScheduledTask | null;
  cronSchedule: string | null;
  /** Latest result per agent */
  cache: Partial<Record<AgentName, AgentResult>>;
}

const state: RunState = {
  running: new Set(),
  lastRunAt: null,
  cronTask: null,
  cronSchedule: null,
  cache: {},
};

/** Run a single agent by name */
export async function runAgent(
  name: AgentName,
  context: AgentRunContext = { mode: "single" }
): Promise<AgentResult> {
  if (state.running.has(name)) {
    throw new Error(`Agent "${name}" is already running`);
  }
  const agent = AGENTS[name];
  if (!agent) throw new Error(`Unknown agent: ${name}`);

  state.running.add(name);
  console.log(`[orchestrator] Starting agent: ${name}`);
  try {
    const result = await agent.run(context);
    state.cache[name] = result;
    console.log(
      `[orchestrator] Agent ${name} done — score: ${result.score}/10, ` +
        `findings: ${result.findings.length}, suggestions: ${result.iterations.length}, ` +
        `duration: ${result.durationMs}ms`
    );
    return result;
  } finally {
    state.running.delete(name);
    state.lastRunAt = new Date();
  }
}

/** Run all team agents concurrently */
export async function runAllAgents(): Promise<AgentResult[]> {
  const names = Object.keys(AGENTS) as AgentName[];
  return runAgents(names);
}

/** Run the default team in parallel: developer + tester */
export async function runTeamAgents(): Promise<AgentResult[]> {
  const names: AgentName[] = ["developer", "tester"];
  return runAgents(names);
}

/** Run a subset of agents concurrently */
export async function runAgents(names: AgentName[]): Promise<AgentResult[]> {
  const uniqueNames = Array.from(new Set(names));
  const settled = await Promise.allSettled(
    uniqueNames.map((n) => runAgent(n, { mode: "parallel" }))
  );
  const results: AgentResult[] = [];
  const errors: unknown[] = [];
  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    } else {
      errors.push(outcome.reason);
      console.error("[orchestrator] Agent error:", outcome.reason);
    }
  }
  if (results.length === 0 && errors.length > 0) {
    const reason = errors
      .map((err) => (err instanceof Error ? err.message : String(err)))
      .join("; ");
    throw new Error(`All selected agents failed: ${reason}`);
  }
  return results;
}

/** Schedule automatic runs via cron expression (e.g. "0 * * * *" = hourly) */
export function scheduleCron(expression: string): void {
  if (!cron.validate(expression)) {
    throw new Error(`Invalid cron expression: ${expression}`);
  }
  if (state.cronTask) {
    state.cronTask.stop();
    state.cronTask.destroy();
  }
  state.cronSchedule = expression;
  state.cronTask = cron.schedule(expression, () => {
    console.log(`[orchestrator] Cron triggered (${expression}): running all agents`);
    runAllAgents().catch((err) =>
      console.error("[orchestrator] Cron run failed:", err)
    );
  });
  console.log(`[orchestrator] Cron scheduled: ${expression}`);
}

/** Stop the cron schedule */
export function stopCron(): void {
  if (state.cronTask) {
    state.cronTask.stop();
    state.cronTask.destroy();
    state.cronTask = null;
    state.cronSchedule = null;
    console.log("[orchestrator] Cron stopped");
  }
}

export function getStatus(): OrchestratorStatus {
  return {
    cronActive: state.cronTask !== null,
    activeAgents: Array.from(state.running),
    lastRunAt: state.lastRunAt?.toISOString() ?? null,
    cronSchedule: state.cronSchedule,
  };
}

export function getCachedResult(name: AgentName): AgentResult | undefined {
  return state.cache[name];
}

export function getAgentInfo(): Array<{
  name: AgentName;
  description: string;
}> {
  return (Object.entries(AGENTS) as [AgentName, BaseAgent][]).map(
    ([name, agent]) => ({ name, description: agent.description })
  );
}
