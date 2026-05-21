import { useState, useRef, useCallback } from "react";
import { queryNL, rerunSQL } from "./api";
import type { PipelineResult } from "./api";
import { ChartView } from "./ChartView";

// ── QueryPanel: Input + SQL Display + Table + Chart ──────────────────────────

export function QueryPanel() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [editedSQL, setEditedSQL] = useState("");
  const [isEditingSQL, setIsEditingSQL] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleQuery = useCallback(async () => {
    const q = question.trim();
    if (!q) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await queryNL(q);
      setResult(r);
      setEditedSQL(r.sql);
      setIsEditingSQL(false);
    } catch (err) {
      setResult({
        ok: false,
        question: q,
        sql: "",
        explanation: "",
        rows: [],
        chartConfig: null,
        correctionAttempts: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [question]);

  const handleRerun = useCallback(async () => {
    if (!editedSQL.trim()) return;
    setLoading(true);
    try {
      const r = await rerunSQL(editedSQL);
      setResult((prev) => (prev ? { ...prev, ...r, ok: !r.error } : null));
      setIsEditingSQL(false);
    } catch (err) {
      setResult((prev) =>
        prev
          ? { ...prev, rows: [], error: err instanceof Error ? err.message : String(err), ok: false }
          : null,
      );
    } finally {
      setLoading(false);
    }
  }, [editedSQL]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleQuery();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 16 }}>
      {/* Query Input */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your data..."
          disabled={loading}
          style={{
            flex: 1,
            padding: "10px 14px",
            fontSize: 15,
            border: "1px solid #d0d0d0",
            borderRadius: 8,
            outline: "none",
          }}
        />
        <button
          onClick={handleQuery}
          disabled={loading || !question.trim()}
          style={{
            padding: "10px 20px",
            fontSize: 15,
            background: loading ? "#999" : "#4f46e5",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Querying..." : "Ask"}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Explanation */}
          {result.explanation && (
            <div style={{ padding: 12, background: "#f0f9ff", borderRadius: 8, fontSize: 14 }}>
              {result.explanation}
              {result.correctionAttempts > 0 && (
                <span style={{ marginLeft: 8, color: "#b45309", fontSize: 12 }}>
                  (auto-corrected {result.correctionAttempts}x)
                </span>
              )}
            </div>
          )}

          {/* SQL Display / Editor */}
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>SQL</span>
              <div style={{ display: "flex", gap: 6 }}>
                {!isEditingSQL ? (
                  <button
                    onClick={() => setIsEditingSQL(true)}
                    style={{ fontSize: 12, background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleRerun}
                      disabled={loading}
                      style={{ fontSize: 12, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
                    >
                      Run
                    </button>
                    <button
                      onClick={() => { setEditedSQL(result.sql); setIsEditingSQL(false); }}
                      style={{ fontSize: 12, background: "none", border: "1px solid #ccc", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            {isEditingSQL ? (
              <textarea
                value={editedSQL}
                onChange={(e) => setEditedSQL(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: 80,
                  fontFamily: "monospace",
                  fontSize: 13,
                  padding: 10,
                  border: "1px solid #4f46e5",
                  borderRadius: 6,
                  background: "#1e1e2e",
                  color: "#cdd6f4",
                  resize: "vertical",
                }}
              />
            ) : (
              <pre style={{
                padding: 10,
                background: "#1e1e2e",
                color: "#cdd6f4",
                borderRadius: 6,
                fontSize: 13,
                overflow: "auto",
                margin: 0,
              }}>
                {result.sql || "(no SQL generated)"}
              </pre>
            )}
          </div>

          {/* Error */}
          {result.error && (
            <div style={{ padding: 12, background: "#fef2f2", color: "#dc2626", borderRadius: 8, fontSize: 14 }}>
              {result.error}
            </div>
          )}

          {/* Results Table */}
          {result.rows.length > 0 && (
            <div style={{ overflow: "auto", maxHeight: 400 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {Object.keys(result.rows[0]).map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: "8px 12px",
                          textAlign: "left",
                          borderBottom: "2px solid #e5e7eb",
                          background: "#f9fafb",
                          fontWeight: 600,
                          position: "sticky",
                          top: 0,
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.slice(0, 200).map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                      {Object.values(row).map((val, j) => (
                        <td key={j} style={{ padding: "6px 12px", borderBottom: "1px solid #f0f0f0" }}>
                          {val === null ? <span style={{ color: "#999" }}>NULL</span> : String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.rows.length > 200 && (
                <div style={{ padding: 8, textAlign: "center", color: "#666", fontSize: 12 }}>
                  Showing 200 of {result.rows.length} rows
                </div>
              )}
            </div>
          )}

          {/* ECharts Visualization */}
          {result.chartConfig && (
            <ChartView option={result.chartConfig} height={400} />
          )}
        </div>
      )}
    </div>
  );
}
