import { memo, useCallback } from "react";
import { Card, Spin, Alert, Tabs, Typography, Button, Space } from "antd";
import { DeleteOutlined, ReloadOutlined } from "@ant-design/icons";
import { csvImportStore } from "./store";
import { FileDropZone } from "./components/FileDropZone";
import { SchemaPreview } from "./components/SchemaPreview";
import { DataPreview } from "./components/DataPreview";

const { Title, Text } = Typography;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const CsvImportPage = memo(function CsvImportPage() {
  const { state: status } = csvImportStore.useSelector((s) => s.status);
  const { state: fileName } = csvImportStore.useSelector((s) => s.fileName);
  const { state: fileSize } = csvImportStore.useSelector((s) => s.fileSize);
  const { state: schema } = csvImportStore.useSelector((s) => s.schema);
  const { state: rowCount } = csvImportStore.useSelector((s) => s.rowCount);
  const { state: error } = csvImportStore.useSelector((s) => s.error);
  const { importFile, reimport, reset } = csvImportStore.useActions();

  const handleFileSelect = useCallback(
    (file: File) => {
      importFile(file);
    },
    [importFile]
  );

  const columns = schema?.columns ?? [];
  const sampleRows = schema?.sampleRows ?? [];
  const tableName = schema?.tableName ?? "";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          DataLens — 数据导入
        </Title>
        {status !== "idle" && (
          <Button icon={<DeleteOutlined />} onClick={reset} danger size="small">
            清除
          </Button>
        )}
      </div>

      {/* File Selection */}
      {status === "idle" && (
        <FileDropZone onFileSelect={handleFileSelect} />
      )}

      {/* Uploading / Importing */}
      {status === "uploading" && (
        <Card>
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Spin size="large" />
            <Title level={5} style={{ marginTop: 16 }}>
              正在上传并导入 {fileName}...
            </Title>
            <Text type="secondary">{formatFileSize(fileSize)}</Text>
          </div>
        </Card>
      )}

      {/* Error */}
      {status === "error" && error && (
        <Alert
          type="error"
          message="导入失败"
          description={error}
          showIcon
          closable
          onClose={reset}
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={reset}>
              重试
            </Button>
          }
        />
      )}

      {/* Results */}
      {status === "done" && schema && (
        <>
          <Space style={{ marginBottom: 16 }} size="middle">
            <Text strong>{fileName}</Text>
            <Text type="secondary">{formatFileSize(fileSize)}</Text>
            <Text type="secondary">→ 表 <Text code>{tableName}</Text></Text>
            <Text type="secondary">{rowCount.toLocaleString()} 行</Text>
            <Button icon={<ReloadOutlined />} size="small" onClick={reimport}>
              重新导入
            </Button>
          </Space>

          <Tabs
            defaultActiveKey="schema"
            items={[
              {
                key: "schema",
                label: `Schema (${columns.length} 字段)`,
                children: (
                  <SchemaPreview
                    columns={columns}
                    totalRows={rowCount}
                    tableName={tableName}
                  />
                ),
              },
              {
                key: "preview",
                label: `数据预览 (${sampleRows.length} 行)`,
                children: (
                  <DataPreview
                    columns={columns}
                    rows={sampleRows}
                    totalRows={rowCount}
                  />
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  );
});
