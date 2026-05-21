import path from "path";
import { fileURLToPath } from "url";

import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../.agent-iterations.db");

let _db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

export function closeDB(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_name  TEXT    NOT NULL,
      started_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT,
      status      TEXT    NOT NULL DEFAULT 'running',  -- running | done | error
      score       INTEGER,                             -- 0-10 overall quality score
      summary     TEXT,
      error       TEXT
    );

    CREATE TABLE IF NOT EXISTS findings (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id      INTEGER NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
      agent_name  TEXT    NOT NULL,
      severity    TEXT    NOT NULL DEFAULT 'medium',   -- high | medium | low
      category    TEXT    NOT NULL,
      description TEXT    NOT NULL,
      file        TEXT,
      line        INTEGER,
      suggestion  TEXT,
      priority    INTEGER NOT NULL DEFAULT 3,          -- 1 (highest) – 5 (lowest)
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS iterations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id      INTEGER NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
      agent_name  TEXT    NOT NULL,
      action      TEXT    NOT NULL,
      rationale   TEXT,
      effort      TEXT    NOT NULL DEFAULT 'medium',   -- small | medium | large
      impact      TEXT    NOT NULL DEFAULT 'medium',   -- high | medium | low
      status      TEXT    NOT NULL DEFAULT 'pending',  -- pending | done | skipped
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_findings_agent   ON findings(agent_name, priority);
    CREATE INDEX IF NOT EXISTS idx_findings_run     ON findings(run_id);
    CREATE INDEX IF NOT EXISTS idx_iterations_agent ON iterations(agent_name, status);
    CREATE INDEX IF NOT EXISTS idx_runs_agent       ON agent_runs(agent_name, started_at DESC);
  `);
}

// ── RUNS ────────────────────────────────────────────────────────────────────

export function createRun(agentName: string): number {
  const db = getDB();
  const info = db
    .prepare("INSERT INTO agent_runs (agent_name) VALUES (?)")
    .run(agentName);
  return info.lastInsertRowid as number;
}

export function finishRun(
  runId: number,
  opts: { score?: number; summary?: string; error?: string }
) {
  const db = getDB();
  const status = opts.error ? "error" : "done";
  db.prepare(
    `UPDATE agent_runs
     SET finished_at = datetime('now'), status = ?, score = ?, summary = ?, error = ?
     WHERE id = ?`
  ).run(status, opts.score ?? null, opts.summary ?? null, opts.error ?? null, runId);
}

export interface AgentRunRow {
  id: number;
  agent_name: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "done" | "error";
  score: number | null;
  summary: string | null;
  error: string | null;
}

export function getLatestRun(
  agentName: string
): AgentRunRow | undefined {
  return getDB()
    .prepare(
      "SELECT * FROM agent_runs WHERE agent_name = ? ORDER BY started_at DESC LIMIT 1"
    )
    .get(agentName) as AgentRunRow | undefined;
}

export function getAllLatestRuns(): AgentRunRow[] {
  return getDB()
    .prepare(
      `SELECT * FROM agent_runs
       WHERE id IN (
         SELECT MAX(id) FROM agent_runs GROUP BY agent_name
       )
       ORDER BY agent_name`
    )
    .all() as AgentRunRow[];
}

// ── FINDINGS ────────────────────────────────────────────────────────────────

export interface FindingRow {
  run_id: number;
  agent_name: string;
  severity: "high" | "medium" | "low";
  category: string;
  description: string;
  file?: string;
  line?: number;
  suggestion?: string;
  priority: number;
}

export function insertFindings(findings: FindingRow[]) {
  const db = getDB();
  const stmt = db.prepare(
    `INSERT INTO findings
      (run_id, agent_name, severity, category, description, file, line, suggestion, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const bulk = db.transaction((rows: FindingRow[]) => {
    for (const r of rows) {
      stmt.run(
        r.run_id,
        r.agent_name,
        r.severity,
        r.category,
        r.description,
        r.file ?? null,
        r.line ?? null,
        r.suggestion ?? null,
        r.priority
      );
    }
  });
  bulk(findings);
}

export interface FindingQueryRow extends FindingRow {
  id: number;
  created_at: string;
}

export function getFindings(agentName?: string): FindingQueryRow[] {
  const db = getDB();
  if (agentName) {
    return db
      .prepare(
        `SELECT f.* FROM findings f
         JOIN agent_runs r ON f.run_id = r.id
         WHERE f.agent_name = ? AND r.id = (
           SELECT MAX(id) FROM agent_runs WHERE agent_name = ?
         )
         ORDER BY f.priority, CASE f.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`
      )
      .all(agentName, agentName) as FindingQueryRow[];
  }
  return db
    .prepare(
      `SELECT f.* FROM findings f
       JOIN agent_runs r ON f.run_id = r.id
       WHERE r.id IN (SELECT MAX(id) FROM agent_runs GROUP BY agent_name)
       ORDER BY f.priority, CASE f.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`
    )
    .all() as FindingQueryRow[];
}

// ── ITERATIONS ───────────────────────────────────────────────────────────────

export interface IterationRow {
  run_id: number;
  agent_name: string;
  action: string;
  rationale?: string;
  effort: "small" | "medium" | "large";
  impact: "high" | "medium" | "low";
}

export function insertIterations(iterations: IterationRow[]) {
  const db = getDB();
  const stmt = db.prepare(
    `INSERT INTO iterations (run_id, agent_name, action, rationale, effort, impact)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const bulk = db.transaction((rows: IterationRow[]) => {
    for (const r of rows) {
      stmt.run(r.run_id, r.agent_name, r.action, r.rationale ?? null, r.effort, r.impact);
    }
  });
  bulk(iterations);
}

export interface IterationQueryRow extends IterationRow {
  id: number;
  status: "pending" | "done" | "skipped";
  created_at: string;
}

export function getPendingIterations(agentName?: string): IterationQueryRow[] {
  const db = getDB();
  if (agentName) {
    return db
      .prepare(
        `SELECT i.* FROM iterations i
         WHERE i.agent_name = ? AND i.status = 'pending'
           AND i.run_id = (SELECT MAX(id) FROM agent_runs WHERE agent_name = ?)
         ORDER BY CASE i.impact WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                  CASE i.effort WHEN 'small' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`
      )
      .all(agentName, agentName) as IterationQueryRow[];
  }
  return db
    .prepare(
      `SELECT i.* FROM iterations i
       WHERE i.status = 'pending'
         AND i.run_id IN (SELECT MAX(id) FROM agent_runs GROUP BY agent_name)
       ORDER BY CASE i.impact WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                CASE i.effort WHEN 'small' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END`
    )
    .all() as IterationQueryRow[];
}

export function updateIterationStatus(
  id: number,
  status: "done" | "skipped"
): boolean {
  const result = getDB()
    .prepare("UPDATE iterations SET status = ? WHERE id = ?")
    .run(status, id);
  return result.changes > 0;
}

// ── HISTORY ──────────────────────────────────────────────────────────────────

export function getRunHistory(
  agentName?: string,
  limit = 20
): AgentRunRow[] {
  const db = getDB();
  if (agentName) {
    return db
      .prepare(
        "SELECT * FROM agent_runs WHERE agent_name = ? ORDER BY started_at DESC LIMIT ?"
      )
      .all(agentName, limit) as AgentRunRow[];
  }
  return db
    .prepare("SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT ?")
    .all(limit) as AgentRunRow[];
}
