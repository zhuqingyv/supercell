import type { ChartRecommendation } from "./text-to-sql.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface EChartsOption {
  title?: { text: string };
  tooltip: Record<string, unknown>;
  xAxis?: Record<string, unknown>;
  yAxis?: Record<string, unknown>;
  series: Record<string, unknown>[];
  legend?: Record<string, unknown>;
}

// ── Chart Config Generators ──────────────────────────────────────────────────

/**
 * Generate an ECharts option config from query results + chart recommendation.
 * This is a deterministic generation (no LLM call) — fast and reliable.
 */
export function generateChartConfig(
  recommendation: ChartRecommendation,
  rows: Record<string, unknown>[],
  queryExplanation: string,
): EChartsOption | null {
  if (recommendation.chartType === "none" || rows.length === 0) {
    return null;
  }

  const { chartType, xField, yField } = recommendation;
  if (!xField || !yField) return null;

  const xData = rows.map((r) => formatValue(r[xField]));
  const yData = rows.map((r) => toNumber(r[yField]));

  switch (chartType) {
    case "bar":
      return buildBarChart(xData, yData, xField, yField, queryExplanation);
    case "line":
      return buildLineChart(xData, yData, xField, yField, queryExplanation);
    case "pie":
      return buildPieChart(xData, yData, queryExplanation);
    case "scatter":
      return buildScatterChart(rows, xField, yField, queryExplanation);
    default:
      return null;
  }
}

// ── Chart Builders ───────────────────────────────────────────────────────────

function buildBarChart(
  xData: string[],
  yData: number[],
  xField: string,
  yField: string,
  title: string,
): EChartsOption {
  return {
    title: { text: title },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: xData, name: xField, axisLabel: { rotate: xData.length > 8 ? 30 : 0 } },
    yAxis: { type: "value", name: yField },
    series: [{ type: "bar", data: yData, name: yField }],
  };
}

function buildLineChart(
  xData: string[],
  yData: number[],
  xField: string,
  yField: string,
  title: string,
): EChartsOption {
  return {
    title: { text: title },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: xData, name: xField },
    yAxis: { type: "value", name: yField },
    series: [{ type: "line", data: yData, name: yField, smooth: true }],
  };
}

function buildPieChart(
  labels: string[],
  values: number[],
  title: string,
): EChartsOption {
  const pieData = labels.map((name, i) => ({ name, value: values[i] }));
  return {
    title: { text: title },
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    legend: { orient: "vertical", left: "left" },
    series: [
      {
        type: "pie",
        radius: "60%",
        data: pieData,
        emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.5)" } },
      },
    ],
  };
}

function buildScatterChart(
  rows: Record<string, unknown>[],
  xField: string,
  yField: string,
  title: string,
): EChartsOption {
  const scatterData = rows.map((r) => [toNumber(r[xField]), toNumber(r[yField])]);
  return {
    title: { text: title },
    tooltip: { trigger: "item" },
    xAxis: { type: "value", name: xField },
    yAxis: { type: "value", name: yField },
    series: [{ type: "scatter", data: scatterData, symbolSize: 8 }],
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return String(val);
}

function toNumber(val: unknown): number {
  if (typeof val === "number") return val;
  const n = Number(val);
  return Number.isNaN(n) ? 0 : n;
}
