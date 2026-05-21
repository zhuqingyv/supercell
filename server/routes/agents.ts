import { Router, type Response } from "express";
import {
  runAgent,
  runTeamAgents,
  runAgents,
  scheduleCron,
  stopCron,
  getStatus,
  getCachedResult,
  getAgentInfo,
  normalizeAgentName,
} from "../agents/orchestrator.js";
import { parseAgentList, parseHistoryLimit } from "./agents.validation.js";
import {
  getLatestRun,
  getAllLatestRuns,
  getFindings,
  getPendingIterations,
  updateIterationStatus,
  getRunHistory,
} from "../db/index.js";

const router = Router();

function getBodyObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function sendInvalidAgentName(res: Response): void {
  res.status(400).json({
    ok: false,
    error: "Invalid agent name. Use: product, pm, developer, tester, xiao-q",
  });
}

// ── INFO ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/agents
 * List all agents with name and description.
 */
router.get("/", (_req, res) => {
  res.json({ agents: getAgentInfo() });
});

/**
 * GET /api/agents/status
 * Orchestrator and all agent latest-run status.
 */
router.get("/status", (_req, res) => {
  const orchestrator = getStatus();
  const runs = getAllLatestRuns();
  res.json({ orchestrator, runs });
});

// ── RUN ───────────────────────────────────────────────────────────────────────

/**
 * POST /api/agents/run
 * Body: { agents?: AgentName[] }  — omit to run developer+tester in parallel
 * Runs agents synchronously and returns results.
 */
router.post("/run", async (req, res) => {
  const { agents } = getBodyObject(req.body);
  if (typeof agents !== "undefined") {
    const parsed = parseAgentList(agents);
    if (!parsed.ok) {
      res.status(400).json({
        ok: false,
        error: parsed.error,
      });
      return;
    }
    try {
      const results = parsed.names.length
        ? await runAgents(parsed.names)
        : await runTeamAgents();
      res.json({ ok: true, results });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: msg });
    }
    return;
  }

  try {
    const results = await runTeamAgents();
    res.json({ ok: true, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

/**
 * POST /api/agents/run/team
 * Always runs developer + tester in parallel.
 */
router.post("/run/team", async (_req, res) => {
  try {
    const results = await runTeamAgents();
    res.json({ ok: true, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: msg });
  }
});

/**
 * POST /api/agents/:name/run
 * Run a single agent by name.
 */
router.post("/:name/run", async (req, res) => {
  const name = normalizeAgentName(req.params.name);
  if (!name) {
    sendInvalidAgentName(res);
    return;
  }
  try {
    const result = await runAgent(name);
    res.json({ ok: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes("already running") ? 409 : 500;
    res.status(status).json({ ok: false, error: msg });
  }
});

// ── CRON ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/agents/cron/start
 * Body: { schedule: "0 * * * *" }
 */
router.post("/cron/start", (req, res) => {
  const { schedule } = getBodyObject(req.body);
  if (typeof schedule !== "string" || schedule.trim() === "") {
    res.status(400).json({ ok: false, error: "schedule is required" });
    return;
  }
  try {
    scheduleCron(schedule);
    res.json({ ok: true, schedule });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ ok: false, error: msg });
  }
});

/**
 * POST /api/agents/cron/stop
 */
router.post("/cron/stop", (_req, res) => {
  stopCron();
  res.json({ ok: true });
});

// ── RESULTS ───────────────────────────────────────────────────────────────────

/**
 * GET /api/agents/:name/result
 * In-memory cached result for the last run of an agent (fastest).
 */
router.get("/:name/result", (req, res) => {
  const name = normalizeAgentName(req.params.name);
  if (!name) {
    sendInvalidAgentName(res);
    return;
  }
  const cached = getCachedResult(name);
  if (!cached) {
    const dbRun = getLatestRun(name);
    if (!dbRun) {
      res.status(404).json({ ok: false, error: "No run found" });
      return;
    }
    // Return DB summary without full findings (use /findings for that)
    res.json({ ok: true, run: dbRun });
    return;
  }
  res.json({ ok: true, result: cached });
});

/**
 * GET /api/agents/findings
 * All findings from the latest run of every agent.
 */
router.get("/findings/all", (_req, res) => {
  const findings = getFindings();
  res.json({ ok: true, findings });
});

/**
 * GET /api/agents/:name/findings
 * Findings from the latest run of the given agent.
 */
router.get("/:name/findings", (req, res) => {
  const name = normalizeAgentName(req.params.name);
  if (!name) {
    sendInvalidAgentName(res);
    return;
  }
  const findings = getFindings(name);
  res.json({ ok: true, agent: name, findings });
});

/**
 * GET /api/agents/:name/iterations
 * Pending iteration actions for the given agent.
 */
router.get("/:name/iterations", (req, res) => {
  const name = normalizeAgentName(req.params.name);
  if (!name) {
    sendInvalidAgentName(res);
    return;
  }
  const iterations = getPendingIterations(name);
  res.json({ ok: true, agent: name, iterations });
});

/**
 * PATCH /api/agents/iterations/:id
 * Body: { status: "done" | "skipped" }
 */
router.patch("/iterations/:id", (req, res) => {
  const rawId = req.params.id.trim();
  if (!/^[1-9]\d*$/.test(rawId)) {
    res.status(400).json({ ok: false, error: "id must be a positive integer" });
    return;
  }
  const id = Number(rawId);
  const { status } = getBodyObject(req.body);
  if (!["done", "skipped"].includes(status as string)) {
    res.status(400).json({ ok: false, error: "status must be done or skipped" });
    return;
  }
  const changed = updateIterationStatus(id, status as "done" | "skipped");
  if (!changed) {
    res.status(404).json({ ok: false, error: "Iteration not found" });
    return;
  }
  res.json({ ok: true });
});

/**
 * GET /api/agents/:name/history
 * Run history for the given agent.
 * Query: ?limit=20
 */
router.get("/:name/history", (req, res) => {
  const name = normalizeAgentName(req.params.name);
  if (!name) {
    sendInvalidAgentName(res);
    return;
  }
  const limit = parseHistoryLimit(req.query.limit);
  const history = getRunHistory(name, limit);
  res.json({ ok: true, agent: name, history });
});

export default router;
