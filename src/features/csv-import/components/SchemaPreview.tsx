import { memo } from "react";
import { Table, Tag, Typography } from "antd";
import type { ColumnInfo } from "../types";

const { Text } = Typography;

interface SchemaPreviewProps {
  columns: ColumnInfo[];
  totalRows: number;
  tableName: string;
}

const TYPE_COLORS: Record<string, string> = {
  VARCHAR: "blue",
  INTEGER: "green",
  BIGINT: "green",
  DOUBLE: "cyan",
  FLOAT: "cyan",
  DATE: "orange",
  TIMESTAMP: "orange",
  BOOLEAN: "purple",
};

const tableColumns = [
  {
    title: "#",
    key: "index",
    width: 50,
    render: (_: unknown, __: unknown, idx: number) => idx + 1,
  },
  {
    title: "字段名",
    dataIndex: "name",
    key: "name",
    width: 200,
    render: (name: string) => <Text strong>{name}</Text>,
  },
  {
    title: "DuckDB 类型",
    dataIndex: "type",
    key: "type",
    width: 130,
    render: (dtype: string) => <Tag color={TYPE_COLORS[dtype] ?? "default"}>{dtype}</Tag>,
  },
  {
    title: "样本值",
    dataIndex: "sampleValues",
    key: "sampleValues",
    render: (values: string[]) => (
      <Text type="secondary" ellipsis style={{ maxWidth: 400 }}>
        {(values ?? []).slice(0, 3).join(" / ")}
      </Text>
    ),
  },
];

export const SchemaPreview = memo(function SchemaPreview({ columns, totalRows, tableName }: SchemaPreviewProps) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary">
          表 <Text code>{tableName}</Text> — {columns.length} 个字段，{totalRows.toLocaleString()} 行
        </Text>
      </div>
      <Table
        columns={tableColumns}
        dataSource={columns}
        rowKey="name"
        size="small"
        pagination={false}
        bordered
        scroll={{ y: 300 }}
      />
    </div>
  );
});
