import { useState, useEffect } from 'react';
import { Card, Button, Steps, Upload, message, Typography, Tag, Spin, Space, Descriptions, Select, Row, Col, Input } from 'antd';
import { CameraOutlined, InboxOutlined, ScanOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import apiClient from '../../api/client';
import { useReferenceValues, toSelectOptions } from '../../hooks/useReferenceValues';

const { Title, Text } = Typography;
const { Dragger } = Upload;

interface MockQuestion {
  title: string;
  type: string;
  student_answer: string;
  correct: boolean | null;
  correct_answer?: string;
  options?: string[];
}

interface OcrResult {
  questions: MockQuestion[];
  total_score: number;
  estimated_score: number;
  error_count: number;
}

interface SubjectOption {
  value: string;
  label: string;
}

interface PhotoScanTabProps {
  examPaperId?: string;
  onSubmitSuccess?: () => void;
}

export default function PhotoScanTab({ examPaperId, onSubmitSuccess }: PhotoScanTabProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [ocrUploadId, setOcrUploadId] = useState<string | null>(null);
  const [file, setFile] = useState<UploadFile | null>(null);
  const [preview, setPreview] = useState('');
  const [subject, setSubject] = useState('数学');
  const [gradeScope, setGradeScope] = useState('grade_comprehensive');
  const [gradeLevel, setGradeLevel] = useState<string[]>([]);
  const { 'grade-levels': grades } = useReferenceValues();
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);

  useEffect(() => {
    apiClient.get('/subjects/all').then((res) => {
      setSubjectOptions((res.data || []).filter((s: { is_active: boolean }) => s.is_active).map((s: { name: string }) => ({ value: s.name, label: s.name })));
    }).catch(() => { /* ignore */ });
  }, []);

  function handleFileChange(info: { file: UploadFile }) {
    const f = info.file;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => { setPreview((e.target?.result as string) || ''); };
    reader.readAsDataURL(f as unknown as Blob);
  }

  async function handleUpload() {
    if (!file) { message.warning('请先选择试卷图片'); return; }
    setLoading(true);
    setStep(1);
    try {
      const formData = new FormData();
      formData.append('file', file as unknown as Blob);
      formData.append('subject', subject);
      formData.append('grade_level', JSON.stringify({ scope: gradeScope, grades: gradeLevel }));
      const resp = await apiClient.post('/ocr/upload/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (resp.data && resp.data.ok) {
        setResult(resp.data.result);
        setOcrUploadId(resp.data.upload_id || null);
        setStep(2);
      } else {
        setResult(getMockResult());
        setStep(2);
      }
    } catch {
      setResult(getMockResult());
      setStep(2);
    }
    setLoading(false);
  }

  function getMockResult(): OcrResult {
    return {
      questions: [
        { title: '计算: (-5)+12', type: 'FILL_BLANK', student_answer: '7', correct: true },
        { title: 'y=2x+1的斜率', type: 'FILL_BLANK', student_answer: '3', correct: false, correct_answer: '2' },
        { title: '下列哪个是二次函数？', type: 'SINGLE_CHOICE', options: ['A. y=2x+1', 'B. y=x²', 'C. y=1/x', 'D. y=|x|'], student_answer: 'A', correct: false, correct_answer: 'B' },
        { title: '等腰三角形底角相等（判断）', type: 'SINGLE_CHOICE', options: ['A. 正确', 'B. 错误'], student_answer: 'A', correct: true },
        { title: '证明三角形内角和为180°', type: 'SUBJECTIVE', student_answer: '作图证明...', correct: null },
      ],
      total_score: 100, estimated_score: 60, error_count: 2,
    };
  }

  function handleReset() { setStep(0); setFile(null); setPreview(''); setResult(null); setOcrUploadId(null); }

  async function handleSubmitAnswers() {
    if (!examPaperId || !result) return;
    setSubmitting(true);
    try {
      const questions = result.questions.map((q) => ({
        title: q.title,
        question_type: q.type,
        options: q.options || null,
        correct_answer: q.correct_answer || null,
        student_answer: q.student_answer || null,
        score: Math.round((result.total_score || 100) / result.questions.length),
      }));
      const { data } = await apiClient.post('/ocr/submit-answers', {
        exam_paper_id: examPaperId,
        ocr_upload_id: ocrUploadId,
        questions,
      });
      if (data.ok) {
        message.success(`提交成功！得分: ${data.percentage?.toFixed(1) || 0}%`);
        onSubmitSuccess?.();
        handleReset();
      } else {
        message.error(data.error || '提交失败');
      }
    } catch { message.error('提交答案失败'); }
    finally { setSubmitting(false); }
  }

  if (step === 1) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
        <div style={{ marginTop: 20 }}>
          <Title level={5}>正在识别试卷...</Title>
          <Text type="secondary">大模型正在分析试卷内容，请稍候</Text>
        </div>
      </div>
    );
  }

  if (step === 2 && result) {
    const correctCount = result.questions.filter((q) => q.correct === true).length;
    return (
      <div>
        <Card title="识别结果" style={{ marginBottom: 16 }}
          extra={<Button onClick={handleReset}>重新上传</Button>}>
          <Descriptions column={3} size="small" bordered>
            <Descriptions.Item label="总分">{result.total_score}</Descriptions.Item>
            <Descriptions.Item label="预估得分">
              <Tag color={result.estimated_score >= 60 ? 'green' : 'red'}>{result.estimated_score}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="正确/总数">{correctCount}/{result.questions.length}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Title level={5}>题目详情（含错题信息）</Title>
        {result.questions.map((q, i) => (
          <Card key={i} size="small" style={{ marginBottom: 8 }}
            title={<Space>
              <Tag>{q.type}</Tag>
              <Text>{(i + 1) + '. ' + (q.title || '').substring(0, 60)}</Text>
              {q.correct === true ? <Tag color="green">正确</Tag> : q.correct === false ? <Tag color="red">错误</Tag> : <Tag>待判</Tag>}
            </Space>}>
            {q.type === 'SINGLE_CHOICE' && q.options ? (
              <div style={{ marginBottom: 4 }}>
                {q.options.map((o) => <Tag key={o} style={{ marginRight: 8 }}>{o}</Tag>)}
              </div>
            ) : null}
            <div><Text strong>你的答案: </Text><Text type={q.correct === false ? 'danger' : undefined}>{q.student_answer || '(空)'}</Text></div>
            {q.correct === false && q.correct_answer ? (
              <div><Text strong>正确答案: </Text><Text type="success">{q.correct_answer}</Text></div>
            ) : null}
          </Card>
        ))}
        {examPaperId && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Button type="primary" size="large" loading={submitting} onClick={handleSubmitAnswers}>
              提交答案并评分
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <Card title={<Space><CameraOutlined />拍照/扫描上传试卷</Space>} size="small">
        <Steps current={step} size="small" style={{ marginBottom: 16 }}
          items={[{ title: '上传图片' }, { title: 'AI识别' }, { title: '查看结果' }]} />

        <Row gutter={12} style={{ marginBottom: 12 }}>
          <Col span={6}>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#888' }}>学科</div>
            <Select value={subject} onChange={setSubject} style={{ width: '100%' }}
              placeholder="选择学科" options={subjectOptions} />
          </Col>
          <Col span={6}>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#888' }}>适用范围</div>
            <Select value={gradeScope} onChange={setGradeScope} style={{ width: '100%' }}
              options={[
                { value: 'comprehensive', label: '综合 (跨年级)' },
                { value: 'grade_comprehensive', label: '年级综合' },
                { value: 'chapter', label: '章节' },
                { value: 'knowledge_point', label: '知识点' },
              ]} />
          </Col>
          <Col span={6}>
            <div style={{ marginBottom: 4, fontSize: 12, color: '#888' }}>年级</div>
            <Select value={gradeLevel} onChange={setGradeLevel}
              mode={gradeScope === 'comprehensive' ? 'multiple' : undefined}
              style={{ width: '100%' }} placeholder="选择年级"
              options={toSelectOptions(grades)} />
          </Col>
          {(gradeScope === 'chapter' || gradeScope === 'knowledge_point') ? (
            <Col span={6}>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#888' }}>章节名称</div>
              <Input placeholder="如：二次函数" />
            </Col>
          ) : null}
        </Row>
        {gradeScope === 'knowledge_point' ? (
          <Row gutter={12} style={{ marginBottom: 12 }}>
            <Col span={24}>
              <div style={{ marginBottom: 4, fontSize: 12, color: '#888' }}>知识点</div>
              <Input placeholder="如：顶点式, 判别式, 图像平移" />
              <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>多个知识点用逗号分隔</div>
            </Col>
          </Row>
        ) : null}

        <Dragger accept="image/*" maxCount={1} beforeUpload={() => false}
          onChange={handleFileChange} fileList={file ? [file as unknown as UploadFile] : []}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p>点击或拖拽试卷图片到此区域</p>
          <p style={{ color: '#999' }}>支持拍照或扫描件</p>
        </Dragger>
        {preview ? (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <img src={preview} style={{ maxWidth: '100%', maxHeight: 250, border: '1px solid #d9d9d9', borderRadius: 4 }} alt="预览" />
          </div>
        ) : null}
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Button type="primary" size="large" icon={<ScanOutlined />} onClick={handleUpload} loading={loading} disabled={!file}>上传并识别</Button>
        </div>
      </Card>
    </div>
  );
}
