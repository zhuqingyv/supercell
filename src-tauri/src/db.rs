use duckdb::{Connection, params};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;

// Global DuckDB in-memory connection
static DB: Lazy<Mutex<Connection>> = Lazy::new(|| {
    let conn = Connection::open_in_memory().expect("Failed to open DuckDB in-memory database");
    // Enable auto-detection for CSV imports
    conn.execute_batch("INSTALL icu; LOAD icu;").ok();
    Mutex::new(conn)
});

// Track imported tables metadata
static TABLE_META: Lazy<Mutex<HashMap<String, TableMeta>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TableMeta {
    name: String,
    imported_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub dtype: String,
    pub nullable: bool,
    #[serde(rename = "sampleValues")]
    pub sample_values: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportCsvOptions {
    pub delimiter: Option<String>,
    #[serde(rename = "hasHeader")]
    pub has_header: Option<bool>,
    pub encoding: Option<String>,
    #[serde(rename = "sampleRows")]
    pub sample_rows: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportCsvResult {
    pub success: bool,
    #[serde(rename = "tableName")]
    pub table_name: String,
    #[serde(rename = "rowCount")]
    pub row_count: usize,
    pub columns: Vec<ColumnInfo>,
    pub preview: Vec<HashMap<String, serde_json::Value>>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryResult {
    pub success: bool,
    pub columns: Vec<String>,
    #[serde(rename = "columnTypes")]
    pub column_types: Vec<String>,
    pub rows: Vec<HashMap<String, serde_json::Value>>,
    #[serde(rename = "rowCount")]
    pub row_count: usize,
    #[serde(rename = "totalRowCount")]
    pub total_row_count: usize,
    #[serde(rename = "executionTimeMs")]
    pub execution_time_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableSchema {
    #[serde(rename = "tableName")]
    pub table_name: String,
    #[serde(rename = "rowCount")]
    pub row_count: usize,
    pub columns: Vec<ColumnInfo>,
    #[serde(rename = "createStatement")]
    pub create_statement: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
    #[serde(rename = "rowCount")]
    pub row_count: usize,
    #[serde(rename = "columnCount")]
    pub column_count: usize,
    #[serde(rename = "importedAt")]
    pub imported_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableListResult {
    pub tables: Vec<TableInfo>,
}

/// Sanitize table name to prevent injection
fn sanitize_table_name(name: &str) -> String {
    name.chars()
        .filter(|c| c.is_alphanumeric() || *c == '_')
        .collect::<String>()
        .to_lowercase()
}

/// Derive a table name from file path
fn table_name_from_path(path: &str) -> String {
    let stem = std::path::Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("imported_data");
    sanitize_table_name(stem)
}

/// Check if SQL is a safe SELECT-only query
pub fn is_safe_sql(sql: &str) -> Result<(), String> {
    let trimmed = sql.trim().to_uppercase();

    // Must start with SELECT or WITH (for CTEs)
    if !trimmed.starts_with("SELECT") && !trimmed.starts_with("WITH") {
        return Err("Only SELECT queries are allowed".to_string());
    }

    // Block dangerous keywords
    let blocked = [
        "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER", "TRUNCATE",
        "EXEC", "EXECUTE", "GRANT", "REVOKE", "COPY", "ATTACH", "DETACH",
        "PRAGMA", "INSTALL", "LOAD",
    ];

    // Tokenize: split on whitespace and common delimiters to check keywords
    // This is a simple but effective approach for the security layer
    for keyword in &blocked {
        // Check if the keyword appears as a standalone word (not inside a string literal)
        // Simple heuristic: check uppercase version outside of quoted strings
        let upper = trimmed.as_str();
        if upper.contains(keyword) {
            // More precise check: ensure it's a word boundary
            let pattern = format!(r"\b{}\b", keyword);
            if regex_lite_match(&upper, &pattern) {
                return Err(format!("SQL contains blocked keyword: {}", keyword));
            }
        }
    }

    Ok(())
}

/// Simple word boundary check without regex dependency
fn regex_lite_match(haystack: &str, _pattern: &str) -> bool {
    // Extract the keyword from the pattern (between \b markers)
    let keyword = _pattern.trim_start_matches(r"\b").trim_end_matches(r"\b");
    let hay = haystack.to_uppercase();
    let key = keyword.to_uppercase();

    for (i, _) in hay.match_indices(&key) {
        let before_ok = i == 0 || !hay.as_bytes()[i - 1].is_ascii_alphanumeric();
        let after_pos = i + key.len();
        let after_ok =
            after_pos >= hay.len() || !hay.as_bytes()[after_pos].is_ascii_alphanumeric();
        if before_ok && after_ok {
            return true;
        }
    }
    false
}

/// Convert a DuckDB value to serde_json::Value
fn duckdb_value_to_json(val: duckdb::types::Value) -> serde_json::Value {
    match val {
        duckdb::types::Value::Null => serde_json::Value::Null,
        duckdb::types::Value::Boolean(b) => serde_json::Value::Bool(b),
        duckdb::types::Value::TinyInt(n) => serde_json::json!(n),
        duckdb::types::Value::SmallInt(n) => serde_json::json!(n),
        duckdb::types::Value::Int(n) => serde_json::json!(n),
        duckdb::types::Value::BigInt(n) => serde_json::json!(n),
        duckdb::types::Value::Float(f) => serde_json::json!(f),
        duckdb::types::Value::Double(f) => serde_json::json!(f),
        duckdb::types::Value::Text(s) => serde_json::Value::String(s),
        _ => serde_json::Value::String(format!("{:?}", val)),
    }
}

/// Execute a query and return rows as Vec<HashMap>
fn execute_and_collect(
    conn: &Connection,
    sql: &str,
    limit: usize,
) -> Result<(Vec<String>, Vec<String>, Vec<HashMap<String, serde_json::Value>>, usize), String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let column_count = stmt.column_count();
    let col_names: Vec<String> = (0..column_count)
        .map(|i| stmt.column_name(i).map_or("?".to_string(), |v| v.to_string()))
        .collect();
    let col_types: Vec<String> = (0..column_count)
        .map(|i| format!("{:?}", stmt.column_type(i)))
        .collect();

    let rows_iter = stmt.query_map([], |row| {
        let mut map = HashMap::new();
        for i in 0..column_count {
            let val: duckdb::types::Value = row.get(i)?;
            map.insert(col_names[i].clone(), duckdb_value_to_json(val));
        }
        Ok(map)
    }).map_err(|e| e.to_string())?;

    let mut rows = Vec::new();
    let mut total = 0usize;
    for row_result in rows_iter {
        total += 1;
        if rows.len() < limit {
            rows.push(row_result.map_err(|e| e.to_string())?);
        }
    }

    Ok((col_names, col_types, rows, total))
}

pub fn import_csv(
    file_path: &str,
    table_name: Option<String>,
    options: Option<ImportCsvOptions>,
) -> ImportCsvResult {
    let tname = table_name
        .map(|n| sanitize_table_name(&n))
        .unwrap_or_else(|| table_name_from_path(file_path));

    if tname.is_empty() {
        return ImportCsvResult {
            success: false,
            table_name: String::new(),
            row_count: 0,
            columns: vec![],
            preview: vec![],
            error: Some("Invalid table name".to_string()),
        };
    }

    let conn = DB.lock().unwrap();
    let opts = options.unwrap_or(ImportCsvOptions {
        delimiter: None,
        has_header: None,
        encoding: None,
        sample_rows: None,
    });

    // Build DuckDB CSV read options
    let mut csv_opts = vec![format!("auto_detect=true")];
    if let Some(ref delim) = opts.delimiter {
        csv_opts.push(format!("delim='{}'", delim.replace('\'', "''")));
    }
    if let Some(header) = opts.has_header {
        csv_opts.push(format!("header={}", header));
    }

    // Drop existing table if any, then create from CSV
    let drop_sql = format!("DROP TABLE IF EXISTS \"{}\"", tname);
    if let Err(e) = conn.execute_batch(&drop_sql) {
        return ImportCsvResult {
            success: false,
            table_name: tname,
            row_count: 0,
            columns: vec![],
            preview: vec![],
            error: Some(format!("Failed to drop existing table: {}", e)),
        };
    }

    let create_sql = format!(
        "CREATE TABLE \"{}\" AS SELECT * FROM read_csv_auto('{}', {})",
        tname,
        file_path.replace('\'', "''"),
        csv_opts.join(", ")
    );

    if let Err(e) = conn.execute_batch(&create_sql) {
        return ImportCsvResult {
            success: false,
            table_name: tname,
            row_count: 0,
            columns: vec![],
            preview: vec![],
            error: Some(format!("CSV import failed: {}", e)),
        };
    }

    // Get row count
    let row_count: usize = conn
        .query_row(&format!("SELECT COUNT(*) FROM \"{}\"", tname), [], |row| {
            row.get(0)
        })
        .unwrap_or(0);

    // Get column info
    let columns = get_column_info(&conn, &tname);

    // Get preview rows
    let sample_rows = opts.sample_rows.unwrap_or(1000);
    let preview_sql = format!("SELECT * FROM \"{}\" LIMIT {}", tname, sample_rows);
    let preview = match execute_and_collect(&conn, &preview_sql, sample_rows) {
        Ok((_, _, rows, _)) => rows,
        Err(_) => vec![],
    };

    // Track metadata
    TABLE_META.lock().unwrap().insert(
        tname.clone(),
        TableMeta {
            name: tname.clone(),
            imported_at: chrono::Utc::now().to_rfc3339(),
        },
    );

    ImportCsvResult {
        success: true,
        table_name: tname,
        row_count,
        columns,
        preview,
        error: None,
    }
}

fn get_column_info(conn: &Connection, table_name: &str) -> Vec<ColumnInfo> {
    // Get column names and types from DESCRIBE
    let describe_sql = format!("DESCRIBE \"{}\"", table_name);
    let mut stmt = match conn.prepare(&describe_sql) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let columns: Vec<(String, String, bool)> = stmt
        .query_map([], |row| {
            let name: String = row.get(0)?;
            let dtype: String = row.get(1)?;
            let nullable: String = row.get(2)?;
            Ok((name, dtype, nullable == "YES"))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    // Get sample values for each column
    columns
        .into_iter()
        .map(|(name, dtype, nullable)| {
            let sample_sql = format!(
                "SELECT DISTINCT CAST(\"{}\" AS VARCHAR) FROM \"{}\" WHERE \"{}\" IS NOT NULL LIMIT 3",
                name, table_name, name
            );
            let sample_values: Vec<String> = conn
                .prepare(&sample_sql)
                .ok()
                .map(|mut s| {
                    s.query_map([], |row| row.get::<_, String>(0))
                        .unwrap()
                        .filter_map(|r| r.ok())
                        .collect()
                })
                .unwrap_or_default();

            ColumnInfo {
                name,
                dtype,
                nullable,
                sample_values,
            }
        })
        .collect()
}

pub fn execute_query(sql: &str, limit: Option<usize>) -> QueryResult {
    let start = std::time::Instant::now();

    // Security check
    if let Err(e) = is_safe_sql(sql) {
        return QueryResult {
            success: false,
            columns: vec![],
            column_types: vec![],
            rows: vec![],
            row_count: 0,
            total_row_count: 0,
            execution_time_ms: start.elapsed().as_millis() as u64,
            error: Some(e),
        };
    }

    let max_rows = limit.unwrap_or(10_000);
    let conn = DB.lock().unwrap();

    match execute_and_collect(&conn, sql, max_rows) {
        Ok((col_names, col_types, rows, total)) => QueryResult {
            success: true,
            columns: col_names,
            column_types: col_types,
            row_count: rows.len(),
            total_row_count: total,
            rows,
            execution_time_ms: start.elapsed().as_millis() as u64,
            error: None,
        },
        Err(e) => QueryResult {
            success: false,
            columns: vec![],
            column_types: vec![],
            rows: vec![],
            row_count: 0,
            total_row_count: 0,
            execution_time_ms: start.elapsed().as_millis() as u64,
            error: Some(e),
        },
    }
}

pub fn get_table_schema(table_name: &str) -> Result<TableSchema, String> {
    let tname = sanitize_table_name(table_name);
    let conn = DB.lock().unwrap();

    // Check table exists
    let exists: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM information_schema.tables WHERE table_name = ?",
            params![tname],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !exists {
        return Err(format!("Table '{}' not found", tname));
    }

    let row_count: usize = conn
        .query_row(&format!("SELECT COUNT(*) FROM \"{}\"", tname), [], |row| {
            row.get(0)
        })
        .unwrap_or(0);

    let columns = get_column_info(&conn, &tname);

    // Build CREATE TABLE statement for LLM prompt injection
    let col_defs: Vec<String> = columns
        .iter()
        .map(|c| {
            format!(
                "  \"{}\" {}{}",
                c.name,
                c.dtype,
                if c.nullable { "" } else { " NOT NULL" }
            )
        })
        .collect();
    let create_statement = format!(
        "CREATE TABLE \"{}\" (\n{}\n);",
        tname,
        col_defs.join(",\n")
    );

    Ok(TableSchema {
        table_name: tname,
        row_count,
        columns,
        create_statement,
    })
}

pub fn list_tables() -> TableListResult {
    let conn = DB.lock().unwrap();
    let meta = TABLE_META.lock().unwrap();

    let sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' AND table_type = 'BASE TABLE'";
    let mut stmt = match conn.prepare(sql) {
        Ok(s) => s,
        Err(_) => return TableListResult { tables: vec![] },
    };

    let tables: Vec<TableInfo> = stmt
        .query_map([], |row| {
            let name: String = row.get(0)?;
            Ok(name)
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .map(|name| {
            let row_count: usize = conn
                .query_row(&format!("SELECT COUNT(*) FROM \"{}\"", name), [], |row| {
                    row.get(0)
                })
                .unwrap_or(0);
            let col_count = get_column_info(&conn, &name).len();
            let imported_at = meta
                .get(&name)
                .map(|m| m.imported_at.clone())
                .unwrap_or_default();

            TableInfo {
                name,
                row_count,
                column_count: col_count,
                imported_at,
            }
        })
        .collect();

    TableListResult { tables }
}

pub fn drop_table(table_name: &str) -> Result<(), String> {
    let tname = sanitize_table_name(table_name);
    let conn = DB.lock().unwrap();
    conn.execute_batch(&format!("DROP TABLE IF EXISTS \"{}\"", tname))
        .map_err(|e| e.to_string())?;
    TABLE_META.lock().unwrap().remove(&tname);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_safe_sql_allows_select() {
        assert!(is_safe_sql("SELECT * FROM test").is_ok());
        assert!(is_safe_sql("SELECT count(*) FROM test WHERE x > 1").is_ok());
        assert!(is_safe_sql("WITH cte AS (SELECT 1) SELECT * FROM cte").is_ok());
    }

    #[test]
    fn test_is_safe_sql_blocks_dangerous() {
        assert!(is_safe_sql("DROP TABLE test").is_err());
        assert!(is_safe_sql("DELETE FROM test").is_err());
        assert!(is_safe_sql("INSERT INTO test VALUES (1)").is_err());
        assert!(is_safe_sql("UPDATE test SET x = 1").is_err());
        assert!(is_safe_sql("CREATE TABLE test (id INT)").is_err());
    }

    #[test]
    fn test_sanitize_table_name() {
        assert_eq!(sanitize_table_name("my-data.csv"), "mydatacsv");
        assert_eq!(sanitize_table_name("sales_2024"), "sales_2024");
        assert_eq!(sanitize_table_name("Robert'; DROP TABLE--"), "robertdroptable");
    }
}
