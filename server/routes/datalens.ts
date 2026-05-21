import { Router } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { createProvider, runQueryPipeline, rerunSQL } from "../datalens/index.js";
import type { TableSchema, LLMConfig, SQLExecutor } from "../datalens/index.js";
import { duckdbExecutor, importCsvFile, listTables, dropTable } from "../datalens/duckdb-executor.js";
import { getPresetQuestions } from "../datalens/preset-questions.js";

const router = Router();

// ── File Upload Setup ────────────────────────────────────────────────────────

const UPLOAD_DIR = path.resolve("server/uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      cb(null, `${unique}-${file.originalname}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".csv", ".tsv", ".txt"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .csv, .tsv, .txt files are allowed"));
    }
  },
});

// ── State ───────────────────────────────────────────────────────────────────

let currentSchemas: TableSchema[] = [];
let currentProvider = createProvider();
let executor: SQLExecutor = duckdbExecutor;

// ── Routes ───────────────────────────────────────────────────────────────────

/** POST /api/datalens/config — Update LLM provider config */
router.post("/config", (req, res) => {
  const { provider, apiKey, baseURL, model } = req.body as Partial<LLMConfig>;
  try {
    currentProvider = createProvider({ provider, apiKey, baseURL, model });
    res.json({ ok: true, provider: currentProvider.provider, model: currentProvider.getModel() });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/** GET /api/datalens/config — Get current LLM config */
router.get("/config", (_req, res) => {
  res.json({
    provider: currentProvider.provider,
    model: currentProvider.getModel(),
  });
});

/** POST /api/datalens/import — Import a CSV file by path into DuckDB */
router.post("/import", async (req, res) => {
  const { filePath, tableName } = req.body as { filePath: string; tableName?: string };
  if (!filePath?.trim()) {
    res.status(400).json({ ok: false, error: "filePath is required" });
    return;
  }

  try {
    const result = await importCsvFile(filePath, tableName);
    // Auto-register schema for LLM queries
    currentSchemas = currentSchemas.filter((s) => s.tableName !== result.schema.tableName);
    currentSchemas.push(result.schema);

    // Safely serialize (DuckDB BigInt workaround)
    const payload = JSON.parse(JSON.stringify({
      ok: true,
      tableName: result.tableName,
      rowCount: result.rowCount,
      schema: result.schema,
      registeredTables: currentSchemas.map((s) => s.tableName),
    }, (_k, v) => typeof v === "bigint" ? Number(v) : v));
    res.json(payload);
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/** POST /api/datalens/upload — Upload CSV file and import into DuckDB */
router.post("/upload", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ ok: false, error: "No file uploaded" });
    return;
  }

  const tableName = (req.body as Record<string, string>).tableName;

  try {
    const result = await importCsvFile(file.path, tableName);
    // Auto-register schema for LLM queries
    currentSchemas = currentSchemas.filter((s) => s.tableName !== result.schema.tableName);
    currentSchemas.push(result.schema);

    const payload = JSON.parse(JSON.stringify({
      ok: true,
      tableName: result.tableName,
      rowCount: result.rowCount,
      schema: result.schema,
      registeredTables: currentSchemas.map((s) => s.tableName),
    }, (_k, v) => typeof v === "bigint" ? Number(v) : v));
    res.json(payload);
  } catch (err) {
    // Clean up uploaded file on error
    fs.unlink(file.path, () => {});
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/** GET /api/datalens/tables — List imported tables */
router.get("/tables", async (_req, res) => {
  try {
    const tables = await listTables();
    res.json({ ok: true, tables });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/** DELETE /api/datalens/tables/:name — Drop a table */
router.delete("/tables/:name", async (req, res) => {
  const name = req.params.name;
  try {
    await dropTable(name);
    currentSchemas = currentSchemas.filter((s) => s.tableName !== name);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/** POST /api/datalens/schema — Register table schema (called after CSV import) */
router.post("/schema", (req, res) => {
  const schema = req.body as TableSchema;
  if (!schema.tableName || !schema.columns || !Array.isArray(schema.columns)) {
    res.status(400).json({ ok: false, error: "Invalid schema: requires tableName and columns array" });
    return;
  }
  // Replace existing schema for same table, or add new
  currentSchemas = currentSchemas.filter((s) => s.tableName !== schema.tableName);
  currentSchemas.push(schema);
  res.json({ ok: true, tables: currentSchemas.map((s) => s.tableName) });
});

/** GET /api/datalens/schema — List registered schemas */
router.get("/schema", (_req, res) => {
  res.json({ tables: currentSchemas });
});

/** POST /api/datalens/query — Natural language query pipeline */
router.post("/query", async (req, res) => {
  const { question } = req.body as { question: string };
  if (!question?.trim()) {
    res.status(400).json({ ok: false, error: "question is required" });
    return;
  }
  if (currentSchemas.length === 0) {
    res.status(400).json({ ok: false, error: "No tables loaded. Import a CSV first." });
    return;
  }

  try {
    const result = await runQueryPipeline(currentProvider, executor, question, currentSchemas);
    res.json({ ok: !result.error, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/** POST /api/datalens/rerun — Re-execute user-edited SQL */
router.post("/rerun", async (req, res) => {
  const { sql, chartRecommendation } = req.body as { sql: string; chartRecommendation?: any };
  if (!sql?.trim()) {
    res.status(400).json({ ok: false, error: "sql is required" });
    return;
  }

  try {
    const result = await rerunSQL(executor, sql, chartRecommendation);
    res.json({ ok: !result.error, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

/** GET /api/datalens/presets — Get recommended preset questions based on loaded schemas */
router.get("/presets", (_req, res) => {
  if (currentSchemas.length === 0) {
    res.json({ ok: true, isEcommerce: false, questions: [] });
    return;
  }
  // Use all columns from all loaded tables for detection
  const allColumns = currentSchemas.flatMap((s) => s.columns);
  const result = getPresetQuestions(allColumns);
  res.json({ ok: true, ...result });
});

/** GET /api/datalens/ping — Health check for LLM provider */
router.get("/ping", async (_req, res) => {
  const ok = await currentProvider.ping();
  res.json({ ok, provider: currentProvider.provider, model: currentProvider.getModel() });
});

// ── Export helper for DuckDB integration ─────────────────────────────────────

/** Call this to swap in a different executor */
export function setExecutor(exec: SQLExecutor): void {
  executor = exec;
}

export default router;
