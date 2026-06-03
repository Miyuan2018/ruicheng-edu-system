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
    if (!sid) { setKnowledgeNodes([]); storeSetKnowledgeNodes([]); return; }
    try {
      const resp = await apiClient.get(`/knowledge-tree/syllabi/${sid}/tree`);
      const tree = resp.data.tree || resp.data || [];
      // 从完整树中提取 POINT 节点用于本地 Select
      const points: any[] = [];
      const walk = (nodes: any[]) => {
        for (const n of nodes) {
          if (n.node_type === 'POINT') points.push(n);
          if (n.children) walk(n.children);
        }
      };
      walk(tree);
      setKnowledgeNodes(points);
      // 存完整树到 store，供其他 Step 的 TreeSelect 使用
      storeSetKnowledgeNodes(tree);
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

        <Divider style={{ margin: '4px 0 12px 0' }} />

        {/* 难度比值 — 智能选题时按此比例分配题数 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#333' }}>
            难度比值 <span style={{ fontWeight: 400, color: '#999', fontSize: 12 }}>— 智能选题时按此比例分配题数</span>
          </div>
          <Row gutter={12}>
            {(['EASY', 'MEDIUM', 'HARD'] as const).map((d) => {
              const colors: Record<string, string> = { EASY: '#52c41a', MEDIUM: '#faad14', HARD: '#ff4d4f' };
              const bgColors: Record<string, string> = { EASY: '#f6ffed', MEDIUM: '#fffbe6', HARD: '#fff2f0' };
              const borderColors: Record<string, string> = { EASY: '#b7eb8f', MEDIUM: '#ffe58f', HARD: '#ffccc7' };
              const labels: Record<string, string> = { EASY: '简单', MEDIUM: '中等', HARD: '困难' };
              const diffRatio = paper?.difficulty_ratio || { EASY: 20, MEDIUM: 50, HARD: 30 };
              return (
                <Col span={8} key={d}>
                  <div style={{
                    background: bgColors[d], border: `2px solid ${borderColors[d]}`,
                    borderRadius: 8, padding: '8px 12px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 12, color: colors[d], marginBottom: 2 }}>{labels[d]}</div>
                    <InputNumber
                      size="small" variant="borderless"
                      style={{ fontSize: 20, fontWeight: 700, color: colors[d], textAlign: 'center', width: '100%' }}
                      value={diffRatio[d]}
                      min={0} max={100}
                      onChange={(v) => {
                        const newRatio = { ...diffRatio, [d]: v || 0 };
                        updateMeta({ difficulty_ratio: newRatio });
                      }}
                      suffix={<span style={{ fontSize: 14, color: colors[d] }}>%</span>}
                    />
                  </div>
                </Col>
              );
            })}
          </Row>
          {(() => {
            const dr = paper?.difficulty_ratio || { EASY: 20, MEDIUM: 50, HARD: 30 };
            const total = (dr.EASY || 0) + (dr.MEDIUM || 0) + (dr.HARD || 0);
            return (
              <div style={{ fontSize: 11, textAlign: 'center', marginTop: 6, color: total === 100 ? '#52c41a' : '#ff4d4f' }}>
                {total === 100 ? '✓ 合计 100%' : `⚠ 合计 ${total}%（需为100%）`}
              </div>
            );
          })()}
        </div>

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
