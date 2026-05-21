import { createStore } from "../../createStore";
import { uploadAndImport, dropTable } from "./utils/api";
import type { CsvImportState } from "./types";

const initState: CsvImportState = {
  status: "idle",
  fileName: "",
  fileSize: 0,
  tableName: "",
  rowCount: 0,
  schema: null,
  error: null,
  rawFile: null,
};

export const csvImportStore = createStore(initState, (api) => ({
  reset() {
    const state = api.getState();
    if (state.tableName) {
      dropTable(state.tableName).catch(() => {});
    }
    api.setState(() => ({ ...initState }));
  },

  setFile(file: File) {
    api.setState((s) => {
      s.rawFile = file as never;
      s.fileName = file.name;
      s.fileSize = file.size;
      s.error = null;
    });
  },

  /** Upload file to server and import into DuckDB */
  async importFile(file?: File) {
    const state = api.getState();
    const f = file ?? (state.rawFile as unknown as File | null);
    if (!f) return;

    api.setState((s) => {
      s.status = "uploading";
      s.error = null;
      s.schema = null;
      s.rawFile = f as never;
      s.fileName = f.name;
      s.fileSize = f.size;
    });

    try {
      const result = await uploadAndImport(f);
      api.setState((s) => {
        s.status = "done";
        s.tableName = result.tableName;
        s.rowCount = result.rowCount;
        s.schema = result.schema;
      });
    } catch (err) {
      api.setState((s) => {
        s.status = "error";
        s.error = err instanceof Error ? err.message : String(err);
      });
    }
  },

  /** Re-import (drop old table, upload again) */
  async reimport() {
    const state = api.getState();
    const file = state.rawFile as unknown as File | null;
    if (!file) return;

    if (state.tableName) {
      await dropTable(state.tableName).catch(() => {});
    }

    api.setState((s) => {
      s.status = "uploading";
      s.error = null;
      s.schema = null;
      s.tableName = "";
    });

    try {
      const result = await uploadAndImport(file);
      api.setState((s) => {
        s.status = "done";
        s.tableName = result.tableName;
        s.rowCount = result.rowCount;
        s.schema = result.schema;
      });
    } catch (err) {
      api.setState((s) => {
        s.status = "error";
        s.error = err instanceof Error ? err.message : String(err);
      });
    }
  },
}));
