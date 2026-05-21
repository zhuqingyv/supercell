/**
 * End-to-end pipeline test — tests the full chain:
 * CSV Import → Schema Registration → NL Query → SQL Execution → Chart Config
 *
 * This test runs against the real DuckDB executor (no mocks).
 * It does NOT require an LLM — it tests everything except the LLM call
 * by directly invoking the pipeline components.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import { importCsvFile, listTables, dropTable } from "../duckdb-executor.js";
import { generateChartConfig } from "../chart-gen.js";
import type { ChartRecommendation } from "../text-to-sql.js";
import { getPresetQuestions } from "../preset-questions.js";
import { duckdbExecutor } from "../duckdb-executor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "benchmark-orders.csv");

describe("E2E Pipeline (DuckDB + Chart + Presets)", () => {
  let tableName: string;

  beforeAll(async () => {
    const result = await importCsvFile(CSV_PATH, "benchmark_orders");
    tableName = result.tableName;
  });

  afterAll(async () => {
    try {
      await dropTable(tableName);
    } catch {
      // ignore cleanup errors
    }
  });

  // ── CSV Import ──────────────────────────────────────────────────────────

  it("imports CSV and returns correct schema", async () => {
    const result = await importCsvFile(CSV_PATH, "test_import");
    expect(result.rowCount).toBe(30);
    expect(result.schema.columns.length).toBe(13);
    expect(result.schema.columns.map((c) => c.name)).toContain("order_id");
    expect(result.schema.columns.map((c) => c.name)).toContain("order_amount");
    await dropTable("test_import");
  });

  it("lists imported tables", async () => {
    const tables = await listTables();
    expect(tables).toContain(tableName);
  });

  // ── SQL Execution via DuckDB Executor ───────────────────────────────────

  it("executes basic SELECT", async () => {
    const rows = await duckdbExecutor.execute(`SELECT COUNT(*) AS cnt FROM ${tableName}`);
    expect(rows.length).toBe(1);
    expect(Number(rows[0].cnt)).toBe(30);
  });

  it("executes GROUP BY aggregation", async () => {
    const rows = await duckdbExecutor.execute(
      `SELECT category, COUNT(*) AS cnt FROM ${tableName} GROUP BY category ORDER BY cnt DESC`,
    );
    expect(rows.length).toBeGreaterThan(0);
    // Should have categories like 数码配件, 手机周边, 充电设备
    const categories = rows.map((r) => r.category);
    expect(categories).toContain("数码配件");
  });

  it("executes SUM aggregation", async () => {
    const rows = await duckdbExecutor.execute(
      `SELECT SUM(order_amount) AS total FROM ${tableName} WHERE payment_status = '已支付'`,
    );
    expect(rows.length).toBe(1);
    expect(Number(rows[0].total)).toBeGreaterThan(0);
  });

  it("rejects DROP TABLE (SQL safety)", async () => {
    await expect(
      duckdbExecutor.execute(`DROP TABLE ${tableName}`),
    ).rejects.toThrow();
  });

  // ── Chart Generation with Real Query Results ───────────────────────────

  it("generates bar chart from category aggregation", async () => {
    const rows = await duckdbExecutor.execute(
      `SELECT category, SUM(order_amount) AS revenue FROM ${tableName} GROUP BY category ORDER BY revenue DESC`,
    );
    const recommendation: ChartRecommendation = {
      chartType: "bar",
      xField: "category",
      yField: "revenue",
      reason: "ranking by revenue",
    };
    const config = generateChartConfig(recommendation, rows, "Category revenue");
    expect(config).not.toBeNull();
    expect(config!.series[0]).toHaveProperty("type", "bar");
    expect((config!.xAxis as any).data.length).toBeGreaterThan(0);
  });

  it("generates pie chart from channel distribution", async () => {
    const rows = await duckdbExecutor.execute(
      `SELECT channel, COUNT(*) AS cnt FROM ${tableName} GROUP BY channel`,
    );
    const recommendation: ChartRecommendation = {
      chartType: "pie",
      xField: "channel",
      yField: "cnt",
      reason: "distribution",
    };
    const config = generateChartConfig(recommendation, rows, "Channel distribution");
    expect(config).not.toBeNull();
    const pieData = (config!.series[0] as any).data;
    expect(pieData.length).toBeGreaterThan(0);
    expect(pieData[0]).toHaveProperty("name");
    expect(pieData[0]).toHaveProperty("value");
  });

  // ── Preset Questions Detection ─────────────────────────────────────────

  it("detects e-commerce data from imported schema", async () => {
    const result = await importCsvFile(CSV_PATH, "preset_test");
    const presets = getPresetQuestions(result.schema.columns);
    expect(presets.isEcommerce).toBe(true);
    expect(presets.questions.length).toBeGreaterThanOrEqual(15);
    await dropTable("preset_test");
  });
});
