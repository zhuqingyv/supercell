import { memo, useMemo } from "react";
import { Table, Typography } from "antd";
import type { ColumnInfo } from "../types";

const { Text } = Typography;

interface DataPreviewProps {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

export const DataPreview = memo(function DataPreview({ columns, rows, totalRows }: DataPreviewProps) {
  const tableColumns = useMemo(
    () =>
      columns.map((col) => ({
        title: col.name,
        dataIndex: col.name,
        key: col.name,
        width: 150,
        ellipsis: true,
        render: (val: unknown) => String(val ?? ""),
      })),
    [columns]
  );

  const dataSource = useMemo(
    () => rows.map((row, idx) => ({ ...row, _key: idx })),
    [rows]
  );

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary">
          预览前 {rows.length.toLocaleString()} 行
          {totalRows > rows.length && `（共 ${totalRows.toLocaleString()} 行）`}
        </Text>
      </div>
      <Table
        columns={tableColumns}
        dataSource={dataSource}
        rowKey="_key"
        size="small"
        bordered
        scroll={{ x: columns.length * 150, y: 500 }}
        virtual
        pagination={false}
      />
    </div>
  );
});
