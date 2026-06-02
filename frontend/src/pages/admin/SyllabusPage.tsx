import { useState, useRef } from 'react';
import { Button, message, Typography, Modal, Form, Input, Select, Upload } from 'antd';
import { BookOutlined, PlusOutlined, ImportOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toSelectOptions } from '../../hooks/useReferenceValues';
import KnowledgeTreePage from './KnowledgeTreePage';
import * as XLSX from 'xlsx';

const { Title } = Typography;

export default function SyllabusPage() {
  const refData = useReferenceValues();
  const gradeOptions = toSelectOptions(refData['grade-levels']);
  const provinceOptions = toSelectOptions(refData['provinces']);
  const subjectOptions = toSelectOptions(refData['subjects']);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');
  const createFormRef = useRef<any>(null);

  const handleCreateSyllabus = async (values: any) => {
    try {
      await apiClient.post('/question-admin/syllabi', null, { params: values });
      message.success('考纲创建成功');
      setCreateOpen(false);
      // Refresh knowledge tree page
      window.location.reload();
    } catch { message.error('创建失败'); }
  };

  const handleDownloadTemplate = () => {
    const header = ['title', 'grade_level', 'province', 'subject'];
    const example = [
      '示例考纲标题',
      gradeOptions.length > 0 ? gradeOptions[0].value : '',
      provinceOptions.length > 0 ? provinceOptions[0].value : '',
      subjectOptions.length > 0 ? subjectOptions[0].value : '',
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, example]);
    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '考纲导入模板');
    XLSX.writeFile(wb, 'syllabus_import_template.xlsx');
  };

  const handleUploadExcel = (file: any) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target!.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) { message.warning('模板为空或格式不正确'); return; }
        const headers = rows[0] as any[];
        const dataRows = rows.slice(1).filter((r: any) => r[0] || r[1] || r[2] || r[3]);
        const result = dataRows.map((r: any) => {
          const obj: Record<string, any> = {};
          headers.forEach((h: any, i: number) => { if (h && r[i] !== undefined && r[i] !== '') obj[h] = String(r[i]); });
          return obj;
        });
        setImportJson(JSON.stringify(result, null, 2));
        message.success('已加载 ' + result.length + ' 条考纲');
      } catch { message.error('Excel 解析失败'); }
    };
    reader.readAsBinaryString(file);
    return false;
  };

  const handleImportSyllabi = async () => {
    let items;
    try { items = JSON.parse(importJson); } catch { message.error('JSON 格式无效'); return; }
    if (!Array.isArray(items)) { message.error('请输入 JSON 数组'); return; }
    let ok = 0;
    for (const item of items) {
      try {
        await apiClient.post('/question-admin/syllabi', null, { params: item });
        ok++;
      } catch { /* skip */ }
    }
    message.success('成功导入 ' + ok + ' / ' + items.length + ' 条考纲');
    setImportOpen(false);
    setImportJson('');
    window.location.reload();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <BookOutlined style={{ marginRight: 8 }} />考纲与知识树
        </Title>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="small" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建考纲</Button>
          <Button size="small" icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>导入考纲</Button>
        </div>
      </div>

      <KnowledgeTreePage />

      {/* 新建考纲 Modal */}
      <Modal title="新建考纲" open={createOpen} onCancel={() => setCreateOpen(false)} footer={null} destroyOnClose>
        <Form ref={createFormRef} onFinish={handleCreateSyllabus} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="如: 八年级数学(上海)" />
          </Form.Item>
          <Form.Item name="grade_level" label="年级">
            <Select placeholder="选择年级" options={gradeOptions} />
          </Form.Item>
          <Form.Item name="province" label="省份">
            <Select placeholder="选择省份" options={provinceOptions} />
          </Form.Item>
          <Form.Item name="subject" label="学科">
            <Select placeholder="选择学科" options={subjectOptions} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>创建考纲</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* 导入考纲 Modal */}
      <Modal title="导入考纲" open={importOpen} onCancel={() => { setImportOpen(false); setImportJson(''); }} onOk={handleImportSyllabi} okText="批量导入" destroyOnClose width={650}>
        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <Button size="small" icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>下载模板</Button>
          <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={handleUploadExcel}>
            <Button size="small" icon={<UploadOutlined />}>打开模板</Button>
          </Upload>
          <span style={{ fontSize: 12, color: '#999', marginLeft: 'auto' }}>下载模板 → 填写 → 打开上传 → 导入</span>
        </div>
        <Input.TextArea rows={10} value={importJson} onChange={(e) => setImportJson(e.target.value)} placeholder={'下载模板填写后用"打开模板"上传，或直接粘贴 JSON 数组'} style={{ fontFamily: 'monospace', fontSize: 12 }} />
      </Modal>
    </div>
  );
}
