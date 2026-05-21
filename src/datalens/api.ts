const BASE = "/api/datalens";

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data as T;
}

// ── Types (mirror server types) ──────────────────────────────────────────────

export interface TableSchema {
  tableName: string;
  columns: { name: string; type: string; nullable?: boolean; sampleValues?: string[] }[];
  rowCount: number;
  createStatement?: string;
  sampleRows?: Record<string, unknown>[];
}

export interface PresetQuestion {
  id: string;
  question: string;
  category: string;
  chartType: string;
  outputHint: string;
}

export interface PipelineResult {
  ok: boolean;
  question: string;
  sql: string;
  explanation: string;
  rows: Record<string, unknown>[];
  chartConfig: Record<string, unknown> | null;
  correctionAttempts: number;
  error?: string;
}

export interface LLMConfigInfo {
  provider: string;
  model: string;
}

// ── API Functions ────────────────────────────────────────────────────────────

export function getLLMConfig(): Promise<LLMConfigInfo> {
  return request("/config");
}

export function updateLLMConfig(config: {
  provider?: string;
  apiKey?: string;
  baseURL?: string;
  model?: string;
}): Promise<{ ok: boolean; provider: string; model: string }> {
  return request("/config", { method: "POST", body: JSON.stringify(config) });
}

export function getSchemas(): Promise<{ tables: TableSchema[] }> {
  return request("/schema");
}

export function registerSchema(schema: TableSchema): Promise<{ ok: boolean; tables: string[] }> {
  return request("/schema", { method: "POST", body: JSON.stringify(schema) });
}

export function queryNL(question: string): Promise<PipelineResult> {
  return request("/query", { method: "POST", body: JSON.stringify({ question }) });
}

export function rerunSQL(sql: string, chartRecommendation?: unknown): Promise<PipelineResult> {
  return request("/rerun", { method: "POST", body: JSON.stringify({ sql, chartRecommendation }) });
}

export function pingLLM(): Promise<{ ok: boolean; provider: string; model: string }> {
  return request("/ping");
}

export function importCSV(filePath: string, tableName?: string): Promise<{
  ok: boolean;
  tableName: string;
  rowCount: number;
  schema: TableSchema;
  registeredTables: string[];
}> {
  return request("/import", { method: "POST", body: JSON.stringify({ filePath, tableName }) });
}

export function getPresets(): Promise<{
  ok: boolean;
  isEcommerce: boolean;
  questions: PresetQuestion[];
}> {
  return request("/presets");
}
