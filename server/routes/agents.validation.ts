import { normalizeAgentName, type AgentName } from "../agents/orchestrator.js";

export function parseAgentList(values: unknown):
  | { ok: true; names: AgentName[] }
  | { ok: false; error: string } {
  if (!Array.isArray(values)) {
    return { ok: false, error: "agents must be an array" };
  }

  const parsed: AgentName[] = [];
  const seen = new Set<AgentName>();

  for (const value of values) {
    if (typeof value !== "string") {
      return { ok: false, error: "every agent name must be a string" };
    }

    const name = normalizeAgentName(value);
    if (!name) {
      return {
        ok: false,
        error: "agents must be an array of: product, pm, developer, tester, xiao-q",
      };
    }

    if (seen.has(name)) {
      return { ok: false, error: `duplicate agent name is not allowed: ${name}` };
    }

    seen.add(name);
    parsed.push(name);
  }

  return { ok: true, names: parsed };
}

export function parseHistoryLimit(value: unknown, fallback = 20): number {
  const clamp = (n: number) => Math.max(1, Math.min(n, 100));
  const fallbackClamped = clamp(fallback);
  const raw = value ?? fallbackClamped;

  let parsed: number;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || !Number.isInteger(raw)) return fallbackClamped;
    parsed = raw;
  } else if (typeof raw === "string") {
    const normalized = raw.trim();
    if (!/^-?\d+$/.test(normalized)) return fallbackClamped;
    parsed = Number(normalized);
  } else {
    return fallbackClamped;
  }

  return clamp(parsed);
}
