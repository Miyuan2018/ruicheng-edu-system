import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, InputNumber, message, Switch, Button, Space, Tag, Row, Col } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toSelectOptions } from '../../hooks/useReferenceValues';

const { TextArea } = Input;

interface QuestionItem {
  id: string; title: string; question_type: string; difficulty: string;
  subject: string; grade_level: string; score: number;
  correct_answer?: string; explanation?: string; is_active: boolean; is_typical?: boolean;
  source?: string; review_status?: string;
}

interface Props { open: boolean; question: QuestionItem | null; onClose: () => void; onSuccess: () => void; }

export default function QuestionEditModal({ open, question, onClose, onSuccess }: Props) {
  const { 'question-types': qtypes, 'difficulty-levels': diffs, 'grade-levels': grades } = useReferenceValues();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [qtype, setQtype] = useState('SINGLE_CHOICE');
  const [subjects, setSubjects] = useState<{ value: string; label: string }[]>([]);
  const isEdit = !!question;

  useEffect(() => {
    if (open) {
      if (question) {
        // Set qtype FIRST so option fields render before setFieldsValue
        setQtype(question.question_type);
        const fields: any = { ...question };
        // Extract grades and knowledge points from JSONB grade_level
        if (question.grade_level) {
          const gl = typeof question.grade_level === 'string'
            ? JSON.parse(question.grade_level)
            : question.grade_level;
          fields.grade_level = gl?.grades || [];
          fields.knowledge_points_display = gl?.knowledge_points?.join(', ') || gl?.chapter || '';
        }
        // Parse correct_answer JSON to populate option fields
        if (question.correct_answer) {
          try {
            const ca = JSON.parse(question.correct_answer);
            if (ca.options) {
              ca.options.forEach((o: any) => {
                fields[`opt_${o.label}`] = o.text || '';
              });
            }
            if (ca.correct_answer) {
              if (Array.isArray(ca.correct_answer)) {
                fields.correct_multi = ca.correct_answer;
              } else if (typeof ca.correct_answer === 'string') {
                fields.correct_letter = ca.correct_answer;
              }
            }
            if (question.question_type === 'FILL_BLANK' && Array.isArray(ca.correct_answer)) {
              fields.fill_answers = ca.correct_answer.join('|');
            }
            if (question.question_type === 'SUBJECTIVE' && ca.correct_answer?.keywords) {
              fields.keywords = ca.correct_answer.keywords.join(',');
            }
          } catch {}
        }
        // Use setTimeout to let React render the conditional form items
        setTimeout(() => form.setFieldsValue(fields), 0);
      } else {
        form.resetFields();
        setQtype('SINGLE_CHOICE');
      }
    }
  }, [open, question, form]);

  useEffect(() => {
    if (open) {
      apiClient.get('/subjects/all').then((resp: any) => {
        const data = resp.data || [];
        setSubjects(data.map((s: any) => ({ value: s.name || s.code, label: s.name || s.code })));
      }).catch(() => {});
    }
  }, [open]);

  const buildAnswerJson = (values: any): string => {
    const type = values.question_type || qtype;
    if (type === 'SINGLE_CHOICE') {
      const options = ['A','B','C','D'].map(k => ({
        label: k, text: values[`opt_${k}`] || ''
      })).filter(o => o.text);
      return JSON.stringify({ options, correct_answer: values.correct_letter || '' });
    }
    if (type === 'MULTIPLE_CHOICE') {
      const options = ['A','B','C','D'].map(k => ({
        label: k, text: values[`opt_${k}`] || ''
      })).filter(o => o.text);
      return JSON.stringify({ options, correct_answer: values.correct_multi || [] });
    }
    if (type === 'FILL_BLANK') {
      const answers = (values.fill_answers || '').split('|').map((s: string) => s.trim()).filter(Boolean);
      return JSON.stringify({ options: null, correct_answer: answers });
    }
    // SUBJECTIVE
    const keywords = (values.keywords || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    return JSON.stringify({ options: null, correct_answer: { keywords, max_score: values.score || 10 } });
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      const gl: any = { scope: 'grade', grades: values.grade_level || [] };
      if (values.knowledge_points_display) {
        const kps = values.knowledge_points_display.split(',').map((s: string) => s.trim()).filter(Boolean);
        if (kps.length) {
          gl.chapter = kps[0];
          gl.knowledge_points = kps;
        }
      }
      const payload = {
        ...values,
        grade_level: gl,
        correct_answer: buildAnswerJson(values),
        review_status: isEdit ? values.review_status : 'APPROVED',
        source: isEdit ? values.source : 'MANUAL',
      };
      // Clean up temp fields
      delete payload.correct_letter; delete payload.correct_multi;
      delete payload.fill_answers; delete payload.keywords;
      ['A','B','C','D'].forEach(k => delete payload[`opt_${k}`]);

      if (isEdit) {
        await apiClient.put(`/questions/${question!.id}`, payload);
        message.success('更新成功');
      } else {
        await apiClient.post('/questions', payload);
        message.success('创建成功（已自动发布）');
      }
      onSuccess();
    } catch { message.error('操作失败'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title={isEdit ? '编辑试题' : '新建试题（入库即发布）'} open={open}
      onCancel={onClose} onOk={handleSubmit} confirmLoading={loading} width={720} destroyOnClose>
      <Form form={form} layout="vertical" initialValues={{
        question_type: 'SINGLE_CHOICE', difficulty: 'MEDIUM', subject: '数学', score: 5, is_active: true, is_typical: false,
      }}>
        <Form.Item name="title" label="题目内容" rules={[{ required: true }]}>
          <TextArea rows={2} placeholder="输入题干" />
        </Form.Item>
        <Row gutter={12} style={{ marginBottom: 4 }}>
          <Col span={6}>
            <Form.Item name="subject" label="学科" style={{ marginBottom: 0 }}>
              <Select size="small" options={subjects} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="grade_level" label="年级" style={{ marginBottom: 0 }}>
              <Select size="small" mode="multiple" placeholder="可多选" options={toSelectOptions(grades)} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="question_type" label="题型" rules={[{ required: true }]} style={{ marginBottom: 0 }}>
              <Select size="small" onChange={(v) => setQtype(v)} options={toSelectOptions(qtypes)} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="difficulty" label="难度" style={{ marginBottom: 0 }}>
              <Select size="small" options={toSelectOptions(diffs)} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12} style={{ marginBottom: 4 }}>
          <Col span={12}>
            <Form.Item name="knowledge_points_display" label="知识点" style={{ marginBottom: 0 }}>
              <Input size="small" placeholder="多知识点用逗号分割" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="score" label="分值" style={{ marginBottom: 0 }}>
              <InputNumber size="small" min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        {/* Options section — varies by question type */}
        {(qtype === 'SINGLE_CHOICE' || qtype === 'MULTIPLE_CHOICE') && (
          <div style={{ marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 6 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>选项</div>
            {['A','B','C','D'].map(k => (
              <Form.Item key={k} name={`opt_${k}`} label={`${k}、`} style={{ marginBottom: 6 }}>
                <Input size="small" placeholder={`选项${k}的内容`} />
              </Form.Item>
            ))}
            {qtype === 'SINGLE_CHOICE' && (
              <Form.Item name="correct_letter" label="正确答案" rules={[{ required: true, message: '请选择正确答案' }]}>
                <Select size="small" options={['A','B','C','D'].map(k => ({ value: k, label: k }))} style={{ width: 80 }} />
              </Form.Item>
            )}
            {qtype === 'MULTIPLE_CHOICE' && (
              <Form.Item name="correct_multi" label="正确答案（多选）" rules={[{ required: true }]}>
                <Select size="small" mode="multiple" options={['A','B','C','D'].map(k => ({ value: k, label: k }))} style={{ width: 200 }} />
              </Form.Item>
            )}
          </div>
        )}

        {qtype === 'FILL_BLANK' && (
          <Form.Item name="fill_answers" label="正确答案（多个用|分隔）" rules={[{ required: true }]}
            tooltip="多个可接受答案用 | 分隔，如：北京|北平">
            <Input placeholder="北京|北平" />
          </Form.Item>
        )}

        {qtype === 'SUBJECTIVE' && (
          <Form.Item name="keywords" label="评分关键词（逗号分隔）" rules={[{ required: true }]}
            tooltip="用于自动判卷的关键词匹配">
            <Input placeholder="勾股定理, 平方, 5" />
          </Form.Item>
        )}

        <Form.Item name="explanation" label="解析">
          <TextArea rows={2} placeholder="题目解析（可选）" />
        </Form.Item>

        {isEdit && (
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="review_status" label="状态" style={{ marginBottom: 0 }}>
                <Select size="small" options={[
                  { value: 'APPROVED', label: '已发布' }, { value: 'PENDING', label: '待审核' }, { value: 'REJECTED', label: '已驳回' }, { value: 'NEEDS_REVIEW', label: '待复审' },
                ]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_active" label="启用" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Switch size="small" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="is_typical" label="典型题" valuePropName="checked" style={{ marginBottom: 0 }}>
                <Switch size="small" />
              </Form.Item>
            </Col>
          </Row>
        )}
      </Form>
    </Modal>
  );
}
