import { memo, useCallback } from "react";
import { Upload, Typography } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";

const { Dragger } = Upload;
const { Text } = Typography;

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export const FileDropZone = memo(function FileDropZone({ onFileSelect, disabled }: FileDropZoneProps) {
  const uploadProps: UploadProps = {
    name: "file",
    multiple: false,
    accept: ".csv,.tsv,.txt",
    showUploadList: false,
    disabled,
    beforeUpload(file) {
      onFileSelect(file as unknown as File);
      return false;
    },
  };

  return (
    <Dragger {...uploadProps} style={{ padding: "40px 20px" }}>
      <p className="ant-upload-drag-icon">
        <InboxOutlined style={{ fontSize: 48, color: "#999" }} />
      </p>
      <p className="ant-upload-text" style={{ fontSize: 16 }}>
        点击或拖拽 CSV 文件到此区域
      </p>
      <p className="ant-upload-hint">
        <Text type="secondary">支持 .csv / .tsv / .txt 格式，最大 200MB</Text>
      </p>
    </Dragger>
  );
});
