import { useEffect, useState } from 'react';
import { Form, Input, InputNumber, Select, Row, Col, Card, Divider, Collapse } from 'antd';
import apiClient from '../../../api/client';
import { usePaperEditorStore } from '../../../store/paperEditor';
import { useReferenceValues, toSelectOptions } from '../../../hooks/useReferenceValues';

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
  const storeSetKnowledgeNodes = usePaperEditorStore(s => s.setKnowledgeNodes);

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
        subtitle: paper.subtitle || '',
        instructions: paper.instructions || '',
        duration_minutes: paper.duration_minutes || undefined,
      });
    }
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
      storeSetKnowledgeNodes(points);
    } catch { /* ignore */ }
  };

  // 只设置 Step1 负责的字段
  const handleValuesChange = (_changedValues: any, allValues: any) => {
    const scope = allValues.grade_scope || 'grade_comprehensive';
    updateMeta({
      title: allValues.title || '',
      subject: allValues.subject || '',
      total_score: allValues.total_score || 0,
      grade_level: {
        scope,
        grades: Array.isArray(allValues.grade_level)
          ? allValues.grade_level
          : allValues.grade_level
            ? [allValues.grade_level]
            : [],
      },
      duration_minutes: allValues.duration_minutes || null,
      subtitle: allValues.subtitle || '',
      instructions: allValues.instructions || '',
    });
  };

  return (
    <Card title="基本信息" style={{ maxWidth: 720, margin: '0 auto' }}>
      <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
        {/* Row 1: 标题 | 学科 | 总分 */}
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
              <InputNumber style={{ width: '100%' }} min={1} max={999} placeholder="100" />
            </Form.Item>
          </Col>
        </Row>

        {/* Row 2: 适用范围 | 年级 | 时长 */}
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="grade_scope" label="适用范围" initialValue="grade_comprehensive">
              <Select
                onChange={(val) => {
                  setGradeMode(val === 'comprehensive' ? 'multiple' : 'single');
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
            <Form.Item name="duration_minutes" label="考试时长">
              <InputNumber style={{ width: '100%' }} min={1} max={300} placeholder="60" suffix="分钟" />
            </Form.Item>
          </Col>
          <Col span={5} />
        </Row>

        <Divider style={{ margin: '4px 0 12px 0' }} />

        {/* 选填区: 副标题 | 注意事项 */}
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="subtitle" label={<span style={{ color: '#999', fontWeight: 400 }}>副标题</span>}>
              <Input placeholder="如：满分100分，考试时间60分钟" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="instructions" label={<span style={{ color: '#999', fontWeight: 400 }}>注意事项</span>}>
              <Input placeholder="考生须知（选填）" />
            </Form.Item>
          </Col>
        </Row>

        {/* 高级设置 */}
        <Collapse
          size="small"
          ghost
          items={[{
            key: 'advanced',
            label: <span style={{ fontSize: 12, color: '#bbb' }}>高级设置</span>,
            children: (
              <div style={{ padding: '8px 0' }}>
                <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
                  知识点范围 <span style={{ fontSize: 11, color: '#999' }}>— 选定后自动选题时优先匹配</span>
                </div>
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
              </div>
            ),
          }]}
        />
      </Form>
    </Card>
  );
}
