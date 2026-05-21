mod db;

use db::{ImportCsvOptions, ImportCsvResult, QueryResult, TableListResult, TableSchema};

#[tauri::command]
fn import_csv(
    file_path: String,
    table_name: Option<String>,
    options: Option<ImportCsvOptions>,
) -> ImportCsvResult {
    db::import_csv(&file_path, table_name, options)
}

#[tauri::command]
fn execute_query(sql: String, limit: Option<usize>) -> QueryResult {
    db::execute_query(&sql, limit)
}

#[tauri::command]
fn get_table_schema(table_name: String) -> Result<TableSchema, String> {
    db::get_table_schema(&table_name)
}

#[tauri::command]
fn list_tables() -> TableListResult {
    db::list_tables()
}

#[tauri::command]
fn drop_table(table_name: String) -> Result<serde_json::Value, String> {
    db::drop_table(&table_name)?;
    Ok(serde_json::json!({ "success": true }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            import_csv,
            execute_query,
            get_table_schema,
            list_tables,
            drop_table,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
