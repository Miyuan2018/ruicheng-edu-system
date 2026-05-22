import { useState } from 'react';
import { Modal, Upload, Button, message, Alert, Space } from 'antd';
import { UploadOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import apiClient from '../../api/client';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BatchImportModal({ open, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleImport = async () => {
    if (!file) { message.warning('请选择文件'); return; }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.post('/questions/batch-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('导入成功');
      onSuccess();
    } catch {
      message.error('导入失败，请检查文件格式');
    } finally {
      setLoading(false);
    }
  };

  const uploadProps: UploadProps = {
    beforeUpload: (f) => { setFile(f); return false; },
    maxCount: 1,
    accept: '.xlsx,.xls,.json,.csv',
    onRemove: () => setFile(null),
  };

  const handleDownloadTemplate = () => {
    // Create a simple CSV template
    const csv = 'title,question_type,difficulty,subject,grade_level,score,correct_answer,explanation\n例题,SINGLE_CHOICE,EASY,数学,八年级,5,A,解析内容';
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'question_template.csv'; a.click();
  };

  return (
    <Modal
      title="批量导入试题"
      open={open}
      onCancel={onClose}
      onOk={handleImport}
      confirmLoading={loading}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Alert message="支持 Excel (.xlsx)、CSV、JSON 格式。导入前请确保文件格式正确。" type="info" showIcon />
        <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
          下载导入模板
        </Button>
        <Upload.Dragger {...uploadProps}>
          <p className="ant-upload-drag-icon"><UploadOutlined style={{ fontSize: 36, color: '#667eea' }} /></p>
          <p>点击或拖拽文件到此区域上传</p>
          <p style={{ color: '#999' }}>支持 .xlsx, .csv, .json</p>
        </Upload.Dragger>
      </Space>
    </Modal>
  );
}
