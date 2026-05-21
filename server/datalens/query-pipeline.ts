import type { LLMProvider } from "./llm-provider.js";
import type { TableSchema, QueryResult } from "./text-to-sql.js";
import type { EChartsOption } from "./chart-gen.js";
import { textToSQL, correctSQL } from "./text-to-sql.js";
import { generateChartConfig } from "./chart-gen.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SQLExecutor {
  /** Execute a SQL query and return rows */
  execute(sql: string): Promise<Record<string, unknown>[]>;
}

export interface PipelineResult {
  /** The natural language question */
  question: string;
  /** Final SQL that was executed successfully */
  sql: string;
  /** Natural language explanation */
  explanation: string;
  /** Query result rows */
  rows: Record<string, unknown>[];
  /** ECharts config (null if no chart recommended) */
  chartConfig: EChartsOption | null;
  /** Number of correction attempts (0 = first try worked) */
  correctionAttempts: number;
  /** Error if pipeline ultimately failed */
  error?: string;
}

const MAX_CORRECTIONS = 2;

// ── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Full query pipeline:
 * 1. Natural language → LLM → SQL + chart recommendation
 * 2. Execute SQL against DuckDB
 * 3. If SQL fails, feed error back to LLM for correction (up to 2 retries)
 * 4. Generate ECharts config from results
 */
export async function runQueryPipeline(
  provider: LLMProvider,
  executor: SQLExecutor,
  question: string,
  schemas: TableSchema[],
): Promise<PipelineResult> {
  // Step 1: Generate initial SQL
  let queryResult: QueryResult;
  try {
    queryResult = await textToSQL(provider, question, schemas);
  } catch (err) {
    return {
      question,
      sql: "",
      explanation: "",
      rows: [],
      chartConfig: null,
      correctionAttempts: 0,
      error: `LLM generation failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  // Step 2 & 3: Execute with auto-correction loop
  let rows: Record<string, unknown>[] = [];
  let correctionAttempts = 0;
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= MAX_CORRECTIONS; attempt++) {
    try {
      rows = await executor.execute(queryResult.sql);
      lastError = undefined;
      break;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      lastError = errorMsg;
      correctionAttempts = attempt + 1;

      if (attempt < MAX_CORRECTIONS) {
        try {
          queryResult = await correctSQL(
            provider,
            question,
            queryResult.sql,
            errorMsg,
            schemas,
          );
        } catch (corrErr) {
          // Correction itself failed — stop retrying
          lastError = `SQL error: ${errorMsg}. Correction also failed: ${corrErr instanceof Error ? corrErr.message : String(corrErr)}`;
          break;
        }
      }
    }
  }

  if (lastError) {
    return {
      question,
      sql: queryResult.sql,
      explanation: queryResult.explanation,
      rows: [],
      chartConfig: null,
      correctionAttempts,
      error: lastError,
    };
  }

  // Step 4: Generate chart config
  const chartConfig = generateChartConfig(
    queryResult.chartRecommendation,
    rows,
    queryResult.explanation,
  );

  return {
    question,
    sql: queryResult.sql,
    explanation: queryResult.explanation,
    rows,
    chartConfig,
    correctionAttempts,
  };
}

/**
 * Re-execute a user-edited SQL (no LLM involved).
 * Optionally regenerate chart from the original recommendation.
 */
export async function rerunSQL(
  executor: SQLExecutor,
  sql: string,
  chartRecommendation?: QueryResult["chartRecommendation"],
): Promise<Pick<PipelineResult, "sql" | "rows" | "chartConfig" | "error">> {
  try {
    const rows = await executor.execute(sql);
    const chartConfig = chartRecommendation
      ? generateChartConfig(chartRecommendation, rows, "")
      : null;
    return { sql, rows, chartConfig };
  } catch (err) {
    return {
      sql,
      rows: [],
      chartConfig: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
