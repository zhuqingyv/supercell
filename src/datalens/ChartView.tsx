import { useEffect, useRef, useState, useCallback } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart, ScatterChart } from "echarts/charts";
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  ToolboxComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// Register ECharts modules (tree-shakeable)
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  ToolboxComponent,
  CanvasRenderer,
]);

// ── Types ────────────────────────────────────────────────────────────────────

type ChartType = "line" | "bar" | "pie" | "scatter";

interface ChartViewProps {
  /** ECharts option config from chart-gen */
  option: Record<string, unknown> | null;
  /** Chart height in px */
  height?: number;
  /** Allow user to switch chart type */
  onChartTypeChange?: (type: ChartType) => void;
}

const CHART_TYPES: { type: ChartType; label: string }[] = [
  { type: "line", label: "Line" },
  { type: "bar", label: "Bar" },
  { type: "pie", label: "Pie" },
  { type: "scatter", label: "Scatter" },
];

// ── Component ────────────────────────────────────────────────────────────────

export function ChartView({ option, height = 400, onChartTypeChange }: ChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [activeType, setActiveType] = useState<ChartType | null>(null);

  // Detect current chart type from option
  useEffect(() => {
    if (!option) return;
    const series = option.series as Array<{ type?: string }> | undefined;
    const type = series?.[0]?.type as ChartType | undefined;
    if (type) setActiveType(type);
  }, [option]);

  // Init / update chart
  useEffect(() => {
    if (!containerRef.current || !option) return;

    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current);
    }

    // Enhance option with defaults for better interaction
    const enhancedOption = {
      ...option,
      toolbox: {
        show: true,
        right: 10,
        feature: {
          saveAsImage: { title: "Save" },
          dataZoom: { title: { zoom: "Zoom", back: "Reset" } },
          restore: { title: "Reset" },
        },
      },
      // Add dataZoom for bar/line charts
      ...(activeType !== "pie" && {
        dataZoom: [
          { type: "inside", start: 0, end: 100 },
          { type: "slider", start: 0, end: 100, bottom: 0, height: 20 },
        ],
      }),
    };

    chartRef.current.setOption(enhancedOption, true);

    return () => {};
  }, [option, activeType]);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current || !chartRef.current) return;
    const ro = new ResizeObserver(() => chartRef.current?.resize());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [option]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  const handleTypeSwitch = useCallback(
    (type: ChartType) => {
      setActiveType(type);
      onChartTypeChange?.(type);

      if (!chartRef.current || !option) return;

      // Re-derive option with new chart type
      const newOption = switchChartType(option, type);
      chartRef.current.setOption(newOption, true);
    },
    [option, onChartTypeChange],
  );

  if (!option) return null;

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
      {/* Chart type switcher */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "8px 12px",
          background: "#f9fafb",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        {CHART_TYPES.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => handleTypeSwitch(type)}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              border: "1px solid",
              borderColor: activeType === type ? "#4f46e5" : "#d1d5db",
              borderRadius: 4,
              background: activeType === type ? "#4f46e5" : "white",
              color: activeType === type ? "white" : "#374151",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart canvas */}
      <div ref={containerRef} style={{ width: "100%", height }} />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Transform an ECharts option to switch chart type.
 * Handles the structural differences between pie and cartesian charts.
 */
function switchChartType(
  option: Record<string, unknown>,
  newType: ChartType,
): Record<string, unknown> {
  const series = option.series as Array<Record<string, unknown>> | undefined;
  if (!series?.length) return option;

  const oldType = series[0].type as string;
  const result = { ...option };

  if (newType === "pie") {
    // Convert to pie: need {name, value} data format
    const xData = (option.xAxis as any)?.data as string[] | undefined;
    const yData = series[0].data as unknown[];
    if (xData && yData) {
      const pieData = xData.map((name, i) => ({
        name,
        value: typeof yData[i] === "number" ? yData[i] : Number(yData[i]) || 0,
      }));
      result.series = [{ type: "pie", radius: "60%", data: pieData }];
      result.xAxis = undefined;
      result.yAxis = undefined;
      result.tooltip = { trigger: "item", formatter: "{b}: {c} ({d}%)" };
    }
  } else if (oldType === "pie" && newType !== "pie") {
    // Convert from pie back to cartesian
    const pieData = series[0].data as Array<{ name: string; value: number }> | undefined;
    if (pieData) {
      const xData = pieData.map((d) => d.name);
      const yData = pieData.map((d) => d.value);
      result.xAxis = { type: "category", data: xData };
      result.yAxis = { type: "value" };
      result.series = [{ type: newType, data: yData, smooth: newType === "line" }];
      result.tooltip = { trigger: "axis" };
    }
  } else {
    // Cartesian to cartesian — just change series type
    result.series = series.map((s) => ({
      ...s,
      type: newType,
      smooth: newType === "line" ? true : undefined,
      symbolSize: newType === "scatter" ? 8 : undefined,
    }));
  }

  return result;
}
