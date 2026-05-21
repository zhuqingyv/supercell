export interface ColumnInfo {
  name: string;
  type: string; // DuckDB types: VARCHAR, INTEGER, DOUBLE, DATE, TIMESTAMP, BOOLEAN
  sampleValues: string[];
}

export interface SchemaInfo {
  tableName: string;
  columns: ColumnInfo[];
  rowCount: number;
  sampleRows: Record<string, unknown>[];
}

export type ImportStatus = "idle" | "uploading" | "done" | "error";

export interface CsvImportState {
  status: ImportStatus;
  fileName: string;
  fileSize: number;
  tableName: string;
  rowCount: number;
  schema: SchemaInfo | null;
  error: string | null;
  rawFile: File | null;
}
