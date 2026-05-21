import { describe, it, expect } from "vitest";
import { buildSchemaBlock, buildSystemPrompt, buildCorrectionPrompt, parseQueryResult } from "../text-to-sql.js";
import { generateChartConfig } from "../chart-gen.js";
import { getPresetQuestions } from "../preset-questions.js";
import type { TableSchema, ChartRecommendation } from "../text-to-sql.js";

// ── Benchmark Schema: E-commerce Orders ──────────────────────────────────────

const ECOMMERCE_SCHEMA: TableSchema = {
  tableName: "orders",
  rowCount: 5000,
  createStatement:
    "CREATE TABLE orders (order_id INTEGER, order_date DATE, product_name VARCHAR, sku VARCHAR, category VARCHAR, quantity INTEGER, unit_price DOUBLE, order_amount DOUBLE, payment_status VARCHAR, return_status VARCHAR, customer_id VARCHAR, customer_type VARCHAR, channel VARCHAR)",
  columns: [
    { name: "order_id", type: "INTEGER", nullable: false, sampleValues: ["1001", "1002", "1003"] },
    { name: "order_date", type: "DATE", nullable: false, sampleValues: ["2024-01-15", "2024-01-16", "2024-01-17"] },
    { name: "product_name", type: "VARCHAR", nullable: false, sampleValues: ["无线蓝牙耳机", "手机壳", "充电宝"] },
    { name: "sku", type: "VARCHAR", nullable: false, sampleValues: ["SKU-001", "SKU-002", "SKU-003"] },
    { name: "category", type: "VARCHAR", nullable: false, sampleValues: ["数码配件", "手机周边", "充电设备"] },
    { name: "quantity", type: "INTEGER", nullable: false, sampleValues: ["1", "2", "3"] },
    { name: "unit_price", type: "DOUBLE", nullable: false, sampleValues: ["99.00", "29.90", "89.00"] },
    { name: "order_amount", type: "DOUBLE", nullable: false, sampleValues: ["99.00", "59.80", "267.00"] },
    { name: "payment_status", type: "VARCHAR", nullable: false, sampleValues: ["已支付", "待支付", "已退款"] },
    { name: "return_status", type: "VARCHAR", nullable: true, sampleValues: ["无退货", "已退货", "退货中"] },
    { name: "customer_id", type: "VARCHAR", nullable: false, sampleValues: ["C001", "C002", "C003"] },
    { name: "customer_type", type: "VARCHAR", nullable: false, sampleValues: ["新客", "老客", "新客"] },
    { name: "channel", type: "VARCHAR", nullable: false, sampleValues: ["直通车", "自然搜索", "抖音"] },
  ],
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Text-to-SQL Prompt Engineering", () => {
  it("buildSchemaBlock includes createStatement and sampleValues", () => {
    const block = buildSchemaBlock(ECOMMERCE_SCHEMA);
    expect(block).toContain("CREATE TABLE orders");
    expect(block).toContain("order_id: 1001, 1002, 1003");
    expect(block).toContain("product_name: 无线蓝牙耳机, 手机壳, 充电宝");
    expect(block).toContain("5000 rows");
  });

  it("buildSystemPrompt includes all necessary sections", () => {
    const prompt = buildSystemPrompt([ECOMMERCE_SCHEMA]);
    expect(prompt).toContain("DuckDB");
    expect(prompt).toContain("Database Schema");
    expect(prompt).toContain("Rules");
    expect(prompt).toContain("Output Format");
    expect(prompt).toContain("Few-shot Examples");
    expect(prompt).toContain("chartRecommendation");
  });

  it("buildCorrectionPrompt includes error context", () => {
    const prompt = buildCorrectionPrompt(
      "销售额TOP10商品",
      "SELECT product FROM orders LIMIT 10",
      'column "product" not found, did you mean "product_name"?',
      [ECOMMERCE_SCHEMA],
    );
    expect(prompt).toContain("Failed SQL");
    expect(prompt).toContain("product");
    expect(prompt).toContain("not found");
    expect(prompt).toContain("CREATE TABLE orders");
  });

  it("parseQueryResult handles valid JSON", () => {
    const raw = JSON.stringify({
      sql: "SELECT product_name, SUM(order_amount) AS revenue FROM orders GROUP BY product_name ORDER BY revenue DESC LIMIT 10",
      explanation: "Top 10 products by revenue",
      chartRecommendation: {
        chartType: "bar",
        xField: "product_name",
        yField: "revenue",
        reason: "Bar chart for ranking",
      },
    });
    const result = parseQueryResult(raw);
    expect(result.sql).toContain("SELECT");
    expect(result.chartRecommendation.chartType).toBe("bar");
    expect(result.chartRecommendation.xField).toBe("product_name");
  });

  it("parseQueryResult handles markdown-fenced JSON", () => {
    const raw = '```json\n{"sql": "SELECT COUNT(*) FROM orders", "explanation": "count", "chartRecommendation": {"chartType": "none", "reason": "scalar"}}\n```';
    const result = parseQueryResult(raw);
    expect(result.sql).toBe("SELECT COUNT(*) FROM orders");
    expect(result.chartRecommendation.chartType).toBe("none");
  });

  it("parseQueryResult rejects missing sql field", () => {
    expect(() => parseQueryResult('{"explanation": "oops"}')).toThrow("missing 'sql' field");
  });

  it("parseQueryResult rejects invalid JSON", () => {
    expect(() => parseQueryResult("not json at all")).toThrow("Failed to parse");
  });
});

describe("Chart Generation", () => {
  const barRecommendation: ChartRecommendation = {
    chartType: "bar",
    xField: "product_name",
    yField: "revenue",
    reason: "ranking",
  };

  const sampleRows = [
    { product_name: "无线耳机", revenue: 15000 },
    { product_name: "手机壳", revenue: 8000 },
    { product_name: "充电宝", revenue: 12000 },
  ];

  it("generates bar chart config", () => {
    const config = generateChartConfig(barRecommendation, sampleRows, "Top products");
    expect(config).not.toBeNull();
    expect(config!.series[0]).toHaveProperty("type", "bar");
    expect((config!.xAxis as any).data).toEqual(["无线耳机", "手机壳", "充电宝"]);
  });

  it("generates line chart config", () => {
    const lineRec: ChartRecommendation = {
      chartType: "line",
      xField: "month",
      yField: "total_sales",
      reason: "trend",
    };
    const rows = [
      { month: "2024-01", total_sales: 50000 },
      { month: "2024-02", total_sales: 60000 },
      { month: "2024-03", total_sales: 55000 },
    ];
    const config = generateChartConfig(lineRec, rows, "Sales trend");
    expect(config).not.toBeNull();
    expect(config!.series[0]).toHaveProperty("type", "line");
  });

  it("generates pie chart config", () => {
    const pieRec: ChartRecommendation = {
      chartType: "pie",
      xField: "category",
      yField: "count",
      reason: "distribution",
    };
    const rows = [
      { category: "数码", count: 200 },
      { category: "服装", count: 350 },
      { category: "食品", count: 150 },
    ];
    const config = generateChartConfig(pieRec, rows, "Category distribution");
    expect(config).not.toBeNull();
    const pieData = (config!.series[0] as any).data;
    expect(pieData).toHaveLength(3);
    expect(pieData[0].name).toBe("数码");
  });

  it("returns null for chartType none", () => {
    const config = generateChartConfig(
      { chartType: "none", reason: "scalar" },
      [{ count: 5000 }],
      "total rows",
    );
    expect(config).toBeNull();
  });

  it("returns null for empty rows", () => {
    const config = generateChartConfig(barRecommendation, [], "empty");
    expect(config).toBeNull();
  });
});

describe("Preset Questions", () => {
  it("detects e-commerce data and returns 15+ questions", () => {
    const result = getPresetQuestions(ECOMMERCE_SCHEMA.columns);
    expect(result.isEcommerce).toBe(true);
    expect(result.questions.length).toBeGreaterThanOrEqual(15);
  });

  it("each question has required fields", () => {
    const { questions } = getPresetQuestions(ECOMMERCE_SCHEMA.columns);
    for (const q of questions) {
      expect(q.id).toBeTruthy();
      expect(q.question).toBeTruthy();
      expect(q.category).toBeTruthy();
      expect(["line", "bar", "pie", "scatter", "table"]).toContain(q.chartType);
      expect(q.outputHint).toBeTruthy();
    }
  });

  it("returns generic questions for non-ecommerce data", () => {
    const genericCols = [
      { name: "id", type: "INTEGER" },
      { name: "name", type: "VARCHAR" },
      { name: "value", type: "DOUBLE" },
    ];
    const result = getPresetQuestions(genericCols);
    expect(result.isEcommerce).toBe(false);
    expect(result.questions.length).toBeGreaterThan(0);
  });

  it("covers all PRD-required categories for e-commerce", () => {
    const { questions } = getPresetQuestions(ECOMMERCE_SCHEMA.columns);
    const categories = new Set(questions.map((q) => q.category));
    expect(categories.has("销售概览")).toBe(true);
    expect(categories.has("商品分析")).toBe(true);
    expect(categories.has("时间维度")).toBe(true);
    expect(categories.has("客户分析")).toBe(true);
    expect(categories.has("渠道分析")).toBe(true);
  });
});
