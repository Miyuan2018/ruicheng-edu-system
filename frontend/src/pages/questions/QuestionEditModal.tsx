import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, InputNumber, message, Switch, Button, Space, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';

const { TextArea } = Input;

interface QuestionItem {
  id: string; title: string; question_type: string; difficulty: string;
  subject: string; grade_level: string; score: number;
  correct_answer?: string; explanation?: string; is_active: boolean;
  source?: string; review_status?: string;
}

interface Props { open: boolean; question: QuestionItem | null; onClose: () => void; onSuccess: () => void; }

export default function QuestionEditModal({ open, question, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [qtype, setQtype] = useState('SINGLE_CHOICE');
  const isEdit = !!question;

  useEffect(() => {
    if (open) {
      if (question) {
        form.setFieldsValue({ ...question });
        setQtype(question.question_type);
      } else {
        form.resetFields();
        setQtype('SINGLE_CHOICE');
      }
    }
  }, [open, question, form]);

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
      const payload = {
        ...values,
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
        question_type: 'SINGLE_CHOICE', difficulty: 'MEDIUM', subject: '数学', score: 5, is_active: true,
      }}>
        <Form.Item name="title" label="题目内容" rules={[{ required: true }]}>
          <TextArea rows={2} placeholder="输入题干" />
        </Form.Item>
        <Space size="large" wrap>
          <Form.Item name="question_type" label="题型" rules={[{ required: true }]}>
            <Select style={{ width: 110 }} onChange={(v) => setQtype(v)} options={[
              { value: 'SINGLE_CHOICE', label: '单选题' }, { value: 'MULTIPLE_CHOICE', label: '多选题' },
              { value: 'FILL_BLANK', label: '填空题' }, { value: 'SUBJECTIVE', label: '解答题' },
            ]} />
          </Form.Item>
          <Form.Item name="difficulty" label="难度">
            <Select style={{ width: 90 }} options={[
              { value: 'EASY', label: '简单' }, { value: 'MEDIUM', label: '中等' }, { value: 'HARD', label: '困难' },
            ]} />
          </Form.Item>
          <Form.Item name="subject" label="学科">
            <Select style={{ width: 90 }} options={[
              { value: '数学', label: '数学' }, { value: '语文', label: '语文' }, { value: '英语', label: '英语' },
            ]} />
          </Form.Item>
          <Form.Item name="grade_level" label="年级">
            <Select style={{ width: 90 }} options={[
              { value: '七年级', label: '七年级' }, { value: '八年级', label: '八年级' }, { value: '九年级', label: '九年级' },
            ]} />
          </Form.Item>
          <Form.Item name="score" label="分值">
            <InputNumber min={1} max={100} style={{ width: 70 }} />
          </Form.Item>
        </Space>

        {/* Options section — varies by question type */}
        {(qtype === 'SINGLE_CHOICE' || qtype === 'MULTIPLE_CHOICE') && (
          <div style={{ marginTop: 12, padding: 12, background: '#fafafa', borderRadius: 6 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>选项</div>
            {['A','B','C','D'].map(k => (
              <Form.Item key={k} name={`opt_${k}`} label={k} style={{ marginBottom: 6 }}>
                <Input placeholder={`选项${k}的内容`} />
              </Form.Item>
            ))}
            {qtype === 'SINGLE_CHOICE' && (
              <Form.Item name="correct_letter" label="正确答案" rules={[{ required: true, message: '请选择正确答案' }]}>
                <Select options={['A','B','C','D'].map(k => ({ value: k, label: k }))} style={{ width: 80 }} />
              </Form.Item>
            )}
            {qtype === 'MULTIPLE_CHOICE' && (
              <Form.Item name="correct_multi" label="正确答案（多选）" rules={[{ required: true }]}>
                <Select mode="multiple" options={['A','B','C','D'].map(k => ({ value: k, label: k }))} style={{ width: 200 }} />
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
          <Space>
            <Form.Item name="source" label="来源"><Input disabled style={{ width: 120 }} /></Form.Item>
            <Form.Item name="review_status" label="状态">
              <Select style={{ width: 100 }} options={[
                { value: 'APPROVED', label: '已发布' }, { value: 'PENDING', label: '待审核' }, { value: 'REJECTED', label: '已驳回' },
              ]} />
            </Form.Item>
          </Space>
        )}
        <Form.Item name="is_active" label="启用" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
