import { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Select, Row, Col, Card } from 'antd';
import apiClient from '../../../api/client';
import { usePaperEditorStore } from '../../../store/paperEditor';
import { useReferenceValues, toSelectOptions } from '../../../hooks/useReferenceValues';

const DIFF_LABELS: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' };
const DIFF_COLORS: Record<string, string> = { EASY: '#52c41a', MEDIUM: '#faad14', HARD: '#ff4d4f' };

export default function BasicInfoStep() {
  const { paper, updateMeta } = usePaperEditorStore();
  const [form] = Form.useForm();
  const [subjectOptions, setSubjectOptions] = useState<{ value: string; label: string }[]>([]);
  const { 'grade-levels': grades } = useReferenceValues();
  const [gradeMode, setGradeMode] = useState<'single' | 'multiple'>(() =>
    paper?.grade_level?.scope === 'comprehensive' ? 'multiple' : 'single'
  );
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [selectedSyllabus, setSelectedSyllabus] = useState<string>('');
  const [knowledgeNodes, setKnowledgeNodes] = useState<any[]>([]);

  useEffect(() => {
    apiClient.get('/subjects/all').then((resp) => {
      const data = resp.data || [];
      const subjects = Array.isArray(data)
        ? data.filter((s: any) => s.is_active !== false).map((s: any) => ({ value: s.name || s, label: s.name || s }))
        : [];
      setSubjectOptions(subjects);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    apiClient.get('/question-admin/syllabi').then((resp) => {
      setSyllabi(resp.data || []);
    }).catch(() => {});
  }, []);

  // Sync store -> form when paper loads
  useEffect(() => {
    if (paper) {
      const scope = paper.grade_level?.scope || 'grade_comprehensive';
      setGradeMode(scope === 'comprehensive' ? 'multiple' : 'single');
      form.setFieldsValue({
        title: paper.title,
        subject: paper.subject,
        total_score: paper.total_score || undefined,
        grade_scope: scope,
        grade_level: paper.grade_level?.grades || [],
        subtitle: paper.subtitle,
        description: paper.description,
        instructions: paper.instructions,
        duration_minutes: paper.duration_minutes,
        diff_easy: paper.difficulty_ratio?.EASY ?? 20,
        diff_medium: paper.difficulty_ratio?.MEDIUM ?? 50,
        diff_hard: paper.difficulty_ratio?.HARD ?? 30,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper?.id]);

  const loadKnowledgeTree = async (sid: string) => {
    if (!sid) { setKnowledgeNodes([]); return; }
    try {
      const resp = await apiClient.get(`/knowledge-tree/syllabi/${sid}/tree`);
      const points: any[] = [];
      const walk = (nodes: any[]) => {
        for (const n of nodes) {
          if (n.node_type === 'POINT') points.push(n);
          if (n.children) walk(n.children);
        }
      };
      walk(resp.data.tree || resp.data || []);
      setKnowledgeNodes(points);
    } catch { /* ignore */ }
  };

  const handleValuesChange = (_changedValues: any, allValues: any) => {
    const scope = allValues.grade_scope || 'grade_comprehensive';
    updateMeta({
      title: allValues.title || '',
      subject: allValues.subject || '',
      total_score: allValues.total_score || 0,
      grade_level: { scope, grades: allValues.grade_level || [] },
      subtitle: allValues.subtitle || '',
      description: allValues.description || '',
      instructions: allValues.instructions || '',
      duration_minutes: allValues.duration_minutes || null,
      difficulty_ratio: {
        EASY: allValues.diff_easy ?? 20,
        MEDIUM: allValues.diff_medium ?? 50,
        HARD: allValues.diff_hard ?? 30,
      },
    });
  };

  const diffTotal = () => {
    const e = form.getFieldValue('diff_easy') ?? 20;
    const m = form.getFieldValue('diff_medium') ?? 50;
    const h = form.getFieldValue('diff_hard') ?? 30;
    return (e || 0) + (m || 0) + (h || 0);
  };

  return (
    <Card title="基本信息" style={{ maxWidth: 720, margin: '0 auto' }}>
      <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="title" label="试卷标题" rules={[{ required: true, message: '请输入试卷标题' }]}>
              <Input placeholder="如：八年级数学期中测试" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="subject" label="学科" rules={[{ required: true, message: '请选择学科' }]}>
              <Select placeholder="选择学科" options={subjectOptions} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="total_score" label="试卷总分">
              <InputNumber style={{ width: '100%' }} min={1} max={999} placeholder="如：100" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="grade_scope" label="适用范围" initialValue="grade_comprehensive">
              <Select
                onChange={(val) => {
                  setGradeMode(val === 'comprehensive' ? 'multiple' : 'single');
                  // 切换模式时清空已选年级
                  form.setFieldValue('grade_level', []);
                }}
                options={[
                  { value: 'grade_comprehensive', label: '年级综合' },
                  { value: 'comprehensive', label: '跨年级综合' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="grade_level" label="年级" rules={[{ required: true, message: '请选择年级' }]}>
              <Select
                mode={gradeMode === 'multiple' ? 'multiple' : undefined}
                placeholder="选择年级"
                options={toSelectOptions(grades)}
              />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item name="duration_minutes" label="考试时长(分钟)">
              <Input placeholder="如：60" suffix="分钟" />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item label="试卷难度">
              <Row gutter={4}>
                {['EASY', 'MEDIUM', 'HARD'].map((d) => (
                  <Col span={8} key={d}>
                    <Form.Item name={`diff_${d.toLowerCase()}`} noStyle initialValue={d === 'EASY' ? 20 : d === 'MEDIUM' ? 50 : 30}>
                      <InputNumber
                        size="small"
                        style={{ width: '100%' }}
                        min={0} max={100}
                        addonAfter={<span style={{ fontSize: 10, color: DIFF_COLORS[d] }}>{DIFF_LABELS[d]}</span>}
                      />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
              <div style={{ fontSize: 11, color: diffTotal() === 100 ? '#52c41a' : '#ff4d4f', marginTop: 2 }}>
                {diffTotal() === 100 ? '✓ 合计 100%' : `⚠ 合计 ${diffTotal()}%（需为100%）`}
              </div>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Form.Item label="知识点范围">
              <Select
                placeholder="选择考纲（可选）"
                value={selectedSyllabus || undefined}
                onChange={(v) => { setSelectedSyllabus(v || ''); loadKnowledgeTree(v); }}
                options={syllabi.map((s: any) => ({ value: s.id, label: s.title }))}
                allowClear
                style={{ marginBottom: 8, maxWidth: 400 }}
              />
              <Select
                mode="multiple"
                placeholder="选择知识点（可多选，可搜索）"
                value={paper?.knowledge_node_ids || []}
                onChange={(v: string[]) => updateMeta({ knowledge_node_ids: v })}
                options={knowledgeNodes.map((n: any) => ({ value: n.key, label: n.title }))}
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="subtitle" label="副标题">
              <Input placeholder="如：满分100分，考试时间60分钟" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="description" label="试卷描述">
              <Input placeholder="简要描述试卷内容和范围" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="instructions" label="注意事项">
          <Input.TextArea rows={3} placeholder="考生注意事项，如：请使用2B铅笔填涂答题卡" />
        </Form.Item>
      </Form>
    </Card>
  );
}
