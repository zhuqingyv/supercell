const BASE = "/api/datalens";

export interface ImportResponse {
  ok: boolean;
  tableName: string;
  rowCount: number;
  schema: {
    tableName: string;
    columns: Array<{
      name: string;
      type: string;
      sampleValues: string[];
    }>;
    rowCount: number;
    sampleRows: Record<string, unknown>[];
  };
  registeredTables: string[];
  error?: string;
}

/** Upload a CSV file and import it into DuckDB */
export async function uploadAndImport(file: File, tableName?: string): Promise<ImportResponse> {
  const form = new FormData();
  form.append("file", file);
  if (tableName) form.append("tableName", tableName);

  const res = await fetch(`${BASE}/upload`, { method: "POST", body: form });
  const data: ImportResponse = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? `Import failed (HTTP ${res.status})`);
  }
  return data;
}

/** List all imported tables */
export async function listTables(): Promise<string[]> {
  const res = await fetch(`${BASE}/tables`);
  const data = await res.json();
  return data.tables ?? [];
}

/** Drop a table */
export async function dropTable(tableName: string): Promise<void> {
  await fetch(`${BASE}/tables/${encodeURIComponent(tableName)}`, { method: "DELETE" });
}
