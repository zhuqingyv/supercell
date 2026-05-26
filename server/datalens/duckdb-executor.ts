import { Database } from "duckdb-async";
import type { SQLExecutor } from "./query-pipeline.js";
import type { TableSchema, ColumnSchema } from "./text-to-sql.js";

// DuckDB returns BigInt for integer columns — make JSON.stringify safe globally
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

// ── DuckDB In-Memory Instance ────────────────────────────────────────────────

let db: Database | null = null;

async function getDB(): Promise<Database> {
  if (!db) {
    db = await Database.create(":memory:");
  }
  return db;
}

export async function closeDB(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

// ── SQL Safety ──────────────────────────────────────────────────────────────

const BLOCKED_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE",
  "EXEC", "GRANT", "REVOKE", "COPY", "ATTACH", "DETACH",
  "PRAGMA", "INSTALL", "LOAD",
];

function isSafeSQL(sql: string): string | null {
  // Remove SQL comments (-- and /* */) before checking
  const cleaned = sql
    .replace(/--[^]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  const trimmed = cleaned.trim().toUpperCase();
  if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
    return "Only SELECT queries are allowed";
  }
  for (const keyword of BLOCKED_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(trimmed)) {
      return `SQL contains blocked keyword: ${keyword}`;
    }
  }
  return null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Recursively convert BigInt values to Number (DuckDB returns BigInt for COUNT/SUM etc.) */
function sanitizeValue(val: unknown): unknown {
  if (typeof val === "bigint") return Number(val);
  if (val instanceof Date) return val.toISOString();
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (val !== null && typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = sanitizeValue(v);
    }
    return out;
  }
  return val;
}

function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(row)) {
    out[key] = sanitizeValue(val);
  }
  return out;
}

function sanitizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(sanitizeRow);
}

// ── SQLExecutor Implementation ──────────────────────────────────────────────

export const duckdbExecutor: SQLExecutor = {
  async execute(sql: string): Promise<Record<string, unknown>[]> {
    const error = isSafeSQL(sql);
    if (error) throw new Error(error);

    const conn = await getDB();
    const rows = await conn.all(sql);
    // Ensure no BigInt survives — JSON round-trip with replacer
    return JSON.parse(JSON.stringify(rows, (_k, v) => typeof v === "bigint" ? Number(v) : v));
  },
};

// ── CSV Import ──────────────────────────────────────────────────────────────

export interface ImportResult {
  tableName: string;
  rowCount: number;
  schema: TableSchema;
}

function sanitizeTableName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase()
    || "imported_data";
}

export async function importCsvFile(
  filePath: string,
  tableName?: string,
): Promise<ImportResult> {
  const tname = tableName
    ? sanitizeTableName(tableName)
    : sanitizeTableName(
        filePath.split("/").pop()?.replace(/\.(csv|tsv|txt)$/i, "") ?? "data"
      );

  const conn = await getDB();

  // Drop existing table
  await conn.exec(`DROP TABLE IF EXISTS "${tname}"`);

  // Create table from CSV with auto-detection
  await conn.exec(
    `CREATE TABLE "${tname}" AS SELECT * FROM read_csv_auto('${filePath.replace(/'/g, "''")}', auto_detect=true)`
  );

  // Get row count
  const countResult = await conn.all(`SELECT COUNT(*) AS cnt FROM "${tname}"`);
  const rowCount = Number(countResult[0]?.cnt ?? 0);

  // Get column info
  const descResult = sanitizeRows(await conn.all(`DESCRIBE "${tname}"`) as Record<string, unknown>[]);
  const columns: ColumnSchema[] = descResult.map((row: any) => ({
    name: String(row.column_name),
    type: String(row.column_type),
  }));

  // Get sample rows (first 3)
  const sampleRows = sanitizeRows(await conn.all(`SELECT * FROM "${tname}" LIMIT 3`) as Record<string, unknown>[]);

  const schema: TableSchema = {
    tableName: tname,
    columns,
    rowCount,
    sampleRows,
  };

  const result = { tableName: tname, rowCount, schema };
  // Ensure no BigInt survives — JSON round-trip with replacer
  const clean = JSON.parse(JSON.stringify(result, (_k, v) => typeof v === "bigint" ? Number(v) : v)) as ImportResult;
  return clean;
}

export async function listTables(): Promise<string[]> {
  const conn = await getDB();
  const rows = await conn.all(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' AND table_type = 'BASE TABLE'"
  );
  return rows.map((r: any) => r.table_name as string);
}

export async function dropTable(tableName: string): Promise<void> {
  const tname = sanitizeTableName(tableName);
  const conn = await getDB();
  await conn.exec(`DROP TABLE IF EXISTS "${tname}"`);
}
