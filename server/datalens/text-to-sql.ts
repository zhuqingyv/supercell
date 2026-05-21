import type { LLMProvider, ChatMessage } from "./llm-provider.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ColumnSchema {
  name: string;
  type: string; // DuckDB type: VARCHAR, INTEGER, DOUBLE, DATE, TIMESTAMP, BOOLEAN, etc.
  nullable?: boolean;
  /** First 3 non-null sample values — helps LLM understand column semantics */
  sampleValues?: string[];
}

export interface TableSchema {
  tableName: string;
  columns: ColumnSchema[];
  rowCount: number;
  /** CREATE TABLE DDL — can be injected directly into prompt */
  createStatement?: string;
  /** First 3 rows of sample data for context (legacy, prefer sampleValues on columns) */
  sampleRows?: Record<string, unknown>[];
}

export interface QueryResult {
  sql: string;
  explanation: string;
  chartRecommendation: ChartRecommendation;
}

export interface ChartRecommendation {
  chartType: "line" | "bar" | "pie" | "scatter" | "none";
  xField?: string;
  yField?: string;
  reason: string;
}

// ── Few-shot Examples ────────────────────────────────────────────────────────

const FEW_SHOT_EXAMPLES = `
Example 1:
User question: "What are the top 5 products by revenue?"
Schema: orders(product_name VARCHAR, quantity INTEGER, unit_price DOUBLE, order_date DATE)
Response:
{
  "sql": "SELECT product_name, SUM(quantity * unit_price) AS revenue FROM orders GROUP BY product_name ORDER BY revenue DESC LIMIT 5",
  "explanation": "Calculates total revenue (quantity x unit price) for each product, returns the top 5.",
  "chartRecommendation": {
    "chartType": "bar",
    "xField": "product_name",
    "yField": "revenue",
    "reason": "Bar chart is ideal for comparing discrete categories ranked by a numeric value."
  }
}

Example 2:
User question: "Show me the monthly sales trend"
Schema: orders(product_name VARCHAR, quantity INTEGER, unit_price DOUBLE, order_date DATE)
Response:
{
  "sql": "SELECT DATE_TRUNC('month', order_date) AS month, SUM(quantity * unit_price) AS total_sales FROM orders WHERE order_date IS NOT NULL GROUP BY month ORDER BY month",
  "explanation": "Aggregates sales by month to show the trend over time.",
  "chartRecommendation": {
    "chartType": "line",
    "xField": "month",
    "yField": "total_sales",
    "reason": "Line chart best shows trends over time."
  }
}

Example 3:
User question: "What is the distribution of order status?"
Schema: orders(order_id INTEGER, status VARCHAR, amount DOUBLE)
Response:
{
  "sql": "SELECT status, COUNT(*) AS count FROM orders GROUP BY status ORDER BY count DESC",
  "explanation": "Counts orders in each status category.",
  "chartRecommendation": {
    "chartType": "pie",
    "xField": "status",
    "yField": "count",
    "reason": "Pie chart is suitable for showing proportional distribution of categories."
  }
}

Example 4:
User question: "How many rows are there?"
Schema: orders(order_id INTEGER, status VARCHAR, amount DOUBLE)
Response:
{
  "sql": "SELECT COUNT(*) AS total_rows FROM orders",
  "explanation": "Counts the total number of rows in the table.",
  "chartRecommendation": {
    "chartType": "none",
    "reason": "Single scalar result does not benefit from a chart."
  }
}
`.trim();

// ── Prompt Builder ───────────────────────────────────────────────────────────

function buildSchemaBlock(schema: TableSchema): string {
  // Prefer createStatement (DDL) if available — most compact and LLM-friendly
  const ddl = schema.createStatement
    ? `\n${schema.createStatement}`
    : "\n" + schema.columns.map((c) => `  ${c.name} ${c.type}${c.nullable === false ? " NOT NULL" : ""}`).join("\n");

  // Column sample values — key for LLM to understand semantics
  const hasSampleValues = schema.columns.some((c) => c.sampleValues?.length);
  const sampleBlock = hasSampleValues
    ? "\n\nSample values:\n" +
      schema.columns
        .filter((c) => c.sampleValues?.length)
        .map((c) => `  ${c.name}: ${c.sampleValues!.join(", ")}`)
        .join("\n")
    : schema.sampleRows?.length
      ? `\nSample data (first ${schema.sampleRows.length} rows):\n${JSON.stringify(schema.sampleRows, null, 2)}`
      : "";

  return `Table: ${schema.tableName} (${schema.rowCount} rows)${ddl}${sampleBlock}`;
}

function buildSystemPrompt(schemas: TableSchema[]): string {
  const schemaBlocks = schemas.map(buildSchemaBlock).join("\n\n");

  return `You are a SQL expert assistant for DuckDB. Your job is to convert natural language questions into SQL queries.

## Database Schema
${schemaBlocks}

## Rules
1. Generate valid DuckDB SQL only. DuckDB is PostgreSQL-compatible with extras like DATE_TRUNC, LIST, STRUCT.
2. Always use the exact table and column names from the schema above. Never invent columns.
3. For aggregation queries, always include GROUP BY.
4. Use appropriate WHERE clauses to filter NULL values when needed.
5. Limit results to 1000 rows max unless the user asks for a specific limit.
6. For date/time operations, use DuckDB functions: DATE_TRUNC, DATE_PART, EXTRACT, etc.
7. Return results in a format suitable for display — use readable column aliases.

## Output Format
You MUST respond with a valid JSON object (no markdown fences, no extra text) with this exact structure:
{
  "sql": "SELECT ...",
  "explanation": "Brief natural language explanation of what this query does",
  "chartRecommendation": {
    "chartType": "line" | "bar" | "pie" | "scatter" | "none",
    "xField": "column name for x-axis (omit if chartType is none)",
    "yField": "column name for y-axis (omit if chartType is none)",
    "reason": "Why this chart type is appropriate"
  }
}

## Few-shot Examples
${FEW_SHOT_EXAMPLES}

Now answer the user's question.`;
}

// ── SQL Error Correction Prompt ──────────────────────────────────────────────

function buildCorrectionPrompt(
  originalQuestion: string,
  failedSQL: string,
  errorMessage: string,
  schemas: TableSchema[],
): string {
  const schemaBlocks = schemas.map(buildSchemaBlock).join("\n\n");
  return `The SQL query you generated failed. Fix it.

## Database Schema
${schemaBlocks}

## Original Question
${originalQuestion}

## Failed SQL
${failedSQL}

## Error Message
${errorMessage}

## Instructions
- Analyze the error and fix the SQL query.
- Common issues: wrong column name, missing GROUP BY, type mismatch, syntax error.
- Return the corrected result in the SAME JSON format:
{
  "sql": "corrected SQL",
  "explanation": "what the corrected query does",
  "chartRecommendation": { "chartType": "...", "xField": "...", "yField": "...", "reason": "..." }
}

Return ONLY the JSON object, no other text.`;
}

// ── Core Functions ───────────────────────────────────────────────────────────

function parseQueryResult(raw: string): QueryResult {
  // Strip markdown fences if present
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenced ? fenced[1].trim() : raw.trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (err) {
    throw new Error(
      `Failed to parse LLM response as JSON: ${err instanceof Error ? err.message : String(err)}\nRaw: ${jsonStr.slice(0, 500)}`,
    );
  }

  if (typeof parsed.sql !== "string" || !parsed.sql.trim()) {
    throw new Error("LLM response missing 'sql' field");
  }

  const chart = (parsed.chartRecommendation as Record<string, unknown>) || {};
  return {
    sql: parsed.sql as string,
    explanation: (parsed.explanation as string) || "",
    chartRecommendation: {
      chartType: (chart.chartType as ChartRecommendation["chartType"]) || "none",
      xField: chart.xField as string | undefined,
      yField: chart.yField as string | undefined,
      reason: (chart.reason as string) || "",
    },
  };
}

/**
 * Convert a natural language question to SQL using the LLM.
 * Returns the generated SQL, explanation, and chart recommendation.
 */
export async function textToSQL(
  provider: LLMProvider,
  question: string,
  schemas: TableSchema[],
): Promise<QueryResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(schemas) },
    { role: "user", content: question },
  ];

  const result = await provider.complete({ messages, temperature: 0.1 });
  return parseQueryResult(result.content);
}

/**
 * Attempt to correct a failed SQL query by feeding the error back to the LLM.
 */
export async function correctSQL(
  provider: LLMProvider,
  originalQuestion: string,
  failedSQL: string,
  errorMessage: string,
  schemas: TableSchema[],
): Promise<QueryResult> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildCorrectionPrompt(originalQuestion, failedSQL, errorMessage, schemas),
    },
    {
      role: "user",
      content: "Please fix the SQL query.",
    },
  ];

  const result = await provider.complete({ messages, temperature: 0.1 });
  return parseQueryResult(result.content);
}

export { buildSchemaBlock, buildSystemPrompt, buildCorrectionPrompt, parseQueryResult };
