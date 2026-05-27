import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, InputNumber, message, Steps, Button, Space, Row, Col, Card, Tag } from 'antd';
import apiClient from '../../api/client';
import PaperTemplatePreview from './PaperTemplatePreview';
import { useReferenceValues, toLabelMap, toSelectOptions } from '../../hooks/useReferenceValues';

interface PaperEditModalProps {
  open: boolean;
  paper: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaperEditModal(props: PaperEditModalProps) {
  const { 'question-types': qtypes, 'difficulty-levels': difficultyLevels, 'paper-statuses': paperStatuses, 'grade-levels': grades } = useReferenceValues();
  const open = props.open;
  const paper = props.paper;
  const onClose = props.onClose;
  const onSuccess = props.onSuccess;
  const form = Form.useForm()[0];
  const loadingState = useState(false);
  const loading = loadingState[0];
  const gradeScopeState = useState('grade_comprehensive');
  const gradeScope = gradeScopeState[0];
  const setGradeScope = gradeScopeState[1];
  const setLoading = loadingState[1];
  const subjectOptionsState = useState<any[]>([]);
  const subjectOptions = subjectOptionsState[0];
  const setSubjectOptions = subjectOptionsState[1];
  useEffect(function () {
    apiClient.get('/subjects/all').then(function (res) {
      setSubjectOptions((res.data || []).filter(function (s: any) { return s.is_active; }).map(function (s: any) { return { value: s.name, label: s.name }; }));
    }).catch(function () {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const stepState = useState(0);
  const step = stepState[0];
  const setStep = stepState[1];
  const isEdit = !!paper;

  const distState = useState<Record<string, number>>({ SINGLE_CHOICE: 5, MULTIPLE_CHOICE: 2, FILL_BLANK: 3, SUBJECTIVE: 1 });
  const dist = distState[0];
  const setDist = distState[1];
  const ratioState = useState<Record<string, number>>({ EASY: 40, MEDIUM: 40, HARD: 20 });
  const diffRatio = ratioState[0];
  const setDiffRatio = ratioState[1];
  const availQuestionsState = useState<any[]>([]);
  const availQuestions = availQuestionsState[0];
  const setAvailQuestions = availQuestionsState[1];
  const selectedIdsState = useState<any[]>([]);
  const selectedIds = selectedIdsState[0];
  const setSelectedIds = selectedIdsState[1];
  const previewQuestionsState = useState<any[]>([]);
  const diffFilterMapState = useState<Record<string, any>>({}); const diffFilterMap = diffFilterMapState[0]; const setDiffFilterMap = diffFilterMapState[1];
  const previewQuestions = previewQuestionsState[0];
  const setPreviewQuestions = previewQuestionsState[1];
  const selectModeState = useState('manual');
  const setSelectMode = selectModeState[1];
  let stepContent;
  // 保存表单值，切换 step 后 Form 卸载时不会丢失
  const savedFormValuesState = useState<Record<string, any>>({});
  const savedFormValues = savedFormValuesState[0];
  const setSavedFormValues = savedFormValuesState[1];

  useEffect(function () {
    if (open) {
      setStep(0);
      if (paper) form.setFieldsValue(paper);
      else form.resetFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, paper]);

  let totalQuestions = 0;
  Object.keys(dist).forEach(function (k: string) { totalQuestions = totalQuestions + dist[k]; });

  async function handleSubmit() {
    if (step === 0) {
      await form.validateFields();
      const fv = form.getFieldsValue();
      setSavedFormValues(fv);
      setStep(1);
      return;
    }
    const values = savedFormValues;
    setLoading(true);
    try {
      const payload = {
        title: values.title,
        subtitle: values.subtitle || '',
        subject: values.subject,
        grade_level: { scope: values.grade_scope || 'grade_comprehensive', grades: values.grade_level || [], chapter: values.chapter || undefined, knowledge_points: values.knowledge_points_input ? values.knowledge_points_input.split(',').map(function(s: any) { return s.trim(); }) : undefined },
        total_score: values.total_score,
        duration_minutes: values.duration_minutes,
        status: values.status,
        notes: values.notes || '',
        description: values.description || '',
        question_count: totalQuestions,
        distribution: dist,
        difficulty_ratio: diffRatio,
      };
      if (isEdit) {
        await apiClient.put('/exam-papers/' + paper.id, payload);
        message.success('更新成功');
      } else {
        // Auto-select: batch query all questions by subject, then filter in-memory
        const picked: any[] = [];
        let pool: any[] = [];
        try {
          const allResp = await apiClient.get('/questions', { params: { subject: payload.subject, limit: 200 } });
          pool = Array.isArray(allResp.data) ? allResp.data : (allResp.data.items || []);
          if (pool.length === 0) { message.warning('题库中没有' + (payload.subject || '') + '学科的试题，请先录入试题'); setLoading(false); return; }

          const keys = Object.keys(dist);
          for (let ki = 0; ki < keys.length; ki++) {
            const qtype = keys[ki];
            const count = dist[qtype];
            if (count <= 0) continue;
            const easyCount = Math.round(count * diffRatio.EASY / 100);
            const mediumCount = Math.round(count * diffRatio.MEDIUM / 100);
            const hardCount = count - easyCount - mediumCount;
            const typePool = pool.filter(function (q: any) { return q.question_type === qtype; });
            if (typePool.length < count) { message.warning(toLabelMap(qtypes)[qtype] + '题库中仅有' + typePool.length + '道，需要' + count + '道，请调整分布'); }
            const diffs = [{ diff: 'EASY', cnt: easyCount }, { diff: 'MEDIUM', cnt: mediumCount }, { diff: 'HARD', cnt: hardCount }];
            for (let di = 0; di < diffs.length; di++) {
              const d = diffs[di];
              if (d.cnt <= 0) continue;
              const matched = typePool.filter(function (q: any) { return q.difficulty === d.diff && picked.indexOf(q) < 0; });
              for (let qi = 0; qi < matched.length && qi < d.cnt; qi++) {
                picked.push(matched[qi]);
              }
              if (matched.length < d.cnt) {
                message.warning(toLabelMap(qtypes)[qtype] + toLabelMap(difficultyLevels)[d.diff] + '题库不足：需要' + d.cnt + '道，仅有' + matched.length + '道');
              }
            }
          }
        } catch { message.error('自动选题查询失败'); setLoading(false); return; }
        if (picked.length === 0) { message.error('未找到匹配的试题，请调整选题条件或先录入试题'); setLoading(false); return; }
        message.success('自动选题完成：共' + picked.length + '道，请在下方确认或调整');
        setSelectedIds(picked.map(function (q) { return q.id; }));
        setAvailQuestions(pool);
        setSelectMode('auto');
        setStep(2);
      }
    } catch (e: unknown) {
      const err = e as any;
      let detail = '操作失败';
      if (err && err.response && err.response.data) {
        detail = err.response.data.detail || JSON.stringify(err.response.data);
      }
      message.error(detail);
    } finally {
      setLoading(false);
    }
  }

  function goManualSelect() {
    const values = savedFormValues;
    setSelectedIds([]);
    setSelectMode('manual');
    setStep(2);
    apiClient.get('/questions', { params: { subject: values.subject, limit: 100 } }).then(function (resp) {
      const data = resp.data;
      setAvailQuestions(Array.isArray(data) ? data : (data.items || []));
    }).catch(function () { message.error('加载试题失败'); });
  }

  async function handleManualCreate() {
    const questions = previewQuestions;
    if (questions.length === 0) { message.warning('请至少选择一道试题'); return; }
    const values = savedFormValues;
    setLoading(true);
    try {
      const payload = { title: values.title, subject: values.subject, grade_level: { scope: values.grade_scope || 'grade_comprehensive', grades: values.grade_level || [], chapter: values.chapter || undefined, knowledge_points: values.knowledge_points_input ? values.knowledge_points_input.split(',').map(function(s: any) { return s.trim(); }) : undefined },
        total_score: values.total_score, duration_minutes: values.duration_minutes,
        status: values.status, subtitle: values.subtitle || "", description: values.description, instructions: values.notes || "" };
      const resp = await apiClient.post('/exam-papers', payload);
      const pid = resp.data.id;
      if (!pid) { message.error('试卷创建失败'); setLoading(false); return; }
      const scorePerQ = Math.round((values.total_score || 100) / Math.max(questions.length, 1));
      for (let si = 0; si < questions.length; si++) {
        try {
          await apiClient.post('/exam-papers/' + pid + '/questions', {
            question_id: questions[si].id, position: si + 1, score: questions[si].score || scorePerQ
          });
        } catch { /* skip individual question errors */ }
      }
      message.success('试卷创建成功，已添加 ' + questions.length + ' 道试题');
      onSuccess();
    } catch (e: unknown) {
      const err = e as any;
      let detail = '操作失败';
      if (err && err.response && err.response.data) { detail = err.response.data.detail || JSON.stringify(err.response.data); }
      message.error(detail);
    } finally { setLoading(false); }
  }

  const statsRow = (
    <Row gutter={24}>
      <Col span={6}>
        <div style={{ textAlign: 'center' }}>
          <b>总题数</b>
          <div style={{ fontSize: 24 }}>{totalQuestions}</div>
        </div>
      </Col>
      <Col span={6}>
        <div style={{ textAlign: 'center' }}>
          <b>总分</b>
          <div style={{ fontSize: 24 }}>{savedFormValues.total_score || 100}</div>
        </div>
      </Col>
      <Col span={6}>
        <div style={{ textAlign: 'center' }}>
          <b>每题均分</b>
          <div style={{ fontSize: 24 }}>{Math.round((savedFormValues.total_score || 100) / Math.max(totalQuestions, 1))}</div>
        </div>
      </Col>
      <Col span={6}>
        <div style={{ textAlign: 'center' }}>
          <b>时长</b>
          <div style={{ fontSize: 24 }}>{(savedFormValues.duration_minutes || 60) + '分钟'}</div>
        </div>
      </Col>
    </Row>
  );

  const typeCards = Object.keys(toLabelMap(qtypes)).map(function (key: string) {
    return (
      <Col span={6} key={key}>
        <Card style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{toLabelMap(qtypes)[key]}</div>
          <InputNumber min={0} max={50} value={dist[key]} onChange={function (v) { const nd: Record<string, number> = {}; Object.keys(dist).forEach(function (k: string) { nd[k] = k === key ? (v || 0) as number : dist[k]; }); setDist(nd); }} style={{ width: 80 }} />
          <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>道</div>
        </Card>
      </Col>
    );
  });

  const diffSliders = ['EASY', 'MEDIUM', 'HARD'].map(function (diff: string) {
    const label = diff === 'EASY' ? '简单' : diff === 'MEDIUM' ? '中等' : '困难';
    return (
      <Col span={8} key={diff}>
        <div style={{ textAlign: 'center', marginBottom: 4 }}>{label}</div>
        <InputNumber
          value={diffRatio[diff]} min={0} max={100} style={{ width: '100%' }}
          onChange={function (v) { const numV = v as number; if (v !== null && numV >= 0 && numV <= 100) { const nr: Record<string, number> = {}; Object.keys(diffRatio).forEach(function (k: string) { nr[k] = k === diff ? numV : diffRatio[k]; }); setDiffRatio(nr); } }}
        />
        <div style={{ textAlign: 'center', color: '#999' }}>{diffRatio[diff] + '%'}</div>
      </Col>
    );
  });

  const diffSummary = ['EASY', 'MEDIUM', 'HARD'].map(function (diff: string) {
    const cnt = Math.round(totalQuestions * diffRatio[diff] / 100);
    const label = diff === 'EASY' ? '简单' : diff === 'MEDIUM' ? '中等' : '困难';
    return <Col span={8} key={'s' + diff} style={{ textAlign: 'center', color: '#999', fontSize: 13 }}>{'约 ' + cnt + ' 道' + label + '题'}</Col>;
  });

  function goToPreview(questions: any[]) {
    setPreviewQuestions(questions);
    setStep(3);
  }

  function handleCancel() {
    if (step === 0) onClose();
    else if (step === 3) setStep(step === 3 && previewQuestions.length > 0 ? 2 : 1);
    else setStep(Math.max(0, step - 1));
  }

  let footerButtons;
  if (step === 0) {
    footerButtons = (
      <Space>
        <Button onClick={onClose}>取消</Button>
        <Button type="primary" onClick={function () { handleSubmit(); }}>下一步：选题方式</Button>
      </Space>
    );
    stepContent = (
      <Form form={form} layout="vertical">
        {/* 基本信息 */}
        <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 12, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>基本信息</div>
        <Row gutter={16}>
          <Col span={16}>
            <Form.Item name="title" label="试卷名称" rules={[{ required: true, message: '请输入试卷名称' }]}>
              <Input placeholder="如：八年级数学期中测试" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="status" label="状态" initialValue="DRAFT">
              <Select options={toSelectOptions(paperStatuses)} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="subject" label="学科" rules={[{ required: true, message: '请选择学科' }]}>
              <Select placeholder="选择学科" options={subjectOptions} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="total_score" label="总分" initialValue={100}>
              <InputNumber min={1} max={300} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="duration_minutes" label="时长(分钟)" initialValue={60}>
              <InputNumber min={1} max={300} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        {/* 年级范围 */}
        <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginTop: 8, marginBottom: 12, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>年级范围</div>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="grade_scope" label="适用范围" initialValue="grade">
              <Select options={[
                { value: 'comprehensive', label: '综合 (跨年级)' },
                { value: 'grade_comprehensive', label: '年级综合' },
                { value: 'chapter', label: '章节' },
                { value: 'knowledge_point', label: '知识点' },
              ]} onChange={function(v: any) { setGradeScope(v); }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="grade_level" label="年级"
              rules={[{ required: true, message: '请选择年级' }]}>
              <Select
                mode={gradeScope === 'comprehensive' ? 'multiple' : undefined}
                placeholder="选择年级"
                options={toSelectOptions(grades)} />
            </Form.Item>
          </Col>
          {(gradeScope === 'chapter' || gradeScope === 'knowledge_point') ? (
            <Col span={8}>
              <Form.Item name="chapter" label="章节名称"
                rules={[{ required: true, message: '请输入章节名称' }]}>
                <Input placeholder="如：二次函数" />
              </Form.Item>
            </Col>
          ) : null}
        </Row>
        {gradeScope === 'knowledge_point' ? (
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="knowledge_points_input" label="知识点"
                rules={[{ required: true, message: '请输入知识点' }]}>
                <Input placeholder="如：顶点式, 判别式, 图像平移" />
              </Form.Item>
              <div style={{ color: '#888', fontSize: 11, marginTop: -16 }}>
                多个知识点用逗号分隔
              </div>
            </Col>
          </Row>
        ) : null}

        {/* 描述 */}
        <div style={{ fontSize: 13, fontWeight: 600, color: '#888', marginTop: 8, marginBottom: 12, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 }}>描述信息</div>
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
        <Form.Item name="notes" label="注意事项">
          <Input.TextArea rows={2} placeholder="考生注意事项，如：请使用2B铅笔填涂答题卡" />
        </Form.Item>
      </Form>
    );
  } else if (step === 1) {
    footerButtons = (
      <Space>
        <Button onClick={function () { setStep(0); }}>上一步</Button>
        <Button type="primary" onClick={function () { handleSubmit(); }} loading={loading}>自动选题组卷</Button>
        <Button onClick={goManualSelect}>手动选题组卷</Button>
      </Space>
    );
    stepContent = (
      <div>
        {statsRow}
        <div style={{ marginTop: 24, marginBottom: 12, fontWeight: 'bold', fontSize: 14 }}>题型分布</div>
        <Row gutter={16}>{typeCards}</Row>
        <div style={{ marginTop: 24, marginBottom: 12, fontWeight: 'bold', fontSize: 14 }}>难度比例</div>
        <Row gutter={16}>{diffSliders}</Row>
        <Row style={{ marginTop: 8 }}>{diffSummary}</Row>
      </div>
    );
  } else if (step === 2) {
    footerButtons = (
      <Space>
        <Button onClick={function () { setStep(1); }}>上一步</Button>
        <Button type="primary" onClick={function () {
          const selected = availQuestions.filter(function (q: any) { return selectedIds.indexOf(q.id) >= 0; });
          if (selected.length === 0) { message.warning('请至少选择一道试题'); return; }
          goToPreview(selected);
        }}>预览确认</Button>
      </Space>
    );
    const typeOrder = ['FILL_BLANK', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SUBJECTIVE'];
    const selectedQs = availQuestions.filter(function (q: any) { return selectedIds.indexOf(q.id) >= 0; });
    const totalScore = savedFormValues.total_score || 100;
    let totalRequired = 0;
    Object.keys(dist).forEach(function (k: string) { totalRequired += dist[k] || 0; });

    // LEFT: status panel
    const leftCards = typeOrder.map(function (t) {
      const req = dist[t] || 0;
      if (req <= 0) return null;
      const sel = selectedQs.filter(function (q: any) { return q.question_type === t; }).length;
      return (
        <div key={t} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
          <span>{toLabelMap(qtypes)[t]}</span>
          <span style={{ color: sel >= req ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>{sel + '/' + req}</span>
        </div>
      );
    }).filter(Boolean);

    const leftPanel = (
      <div style={{ width: '28%', paddingRight: 12, borderRight: '1px solid #f0f0f0' }}>
        <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 12 }}>选题状态</div>
        <div style={{ marginBottom: 8, fontSize: 13 }}>{'已选: ' + selectedQs.length + '/' + totalRequired + ' 道'}</div>
        <div style={{ marginBottom: 8, fontSize: 13 }}>{'得分: ' + selectedQs.reduce(function (s: number, q: any) { return s+(q.score||0); }, 0) + '/' + totalScore}</div>
        <hr />
        {leftCards}
      </div>
    );

    // RIGHT: question browser by type (split into selected top / unselected bottom)
    const rightPanels = typeOrder.map(function (qtype) {
      const required = dist[qtype] || 0;
      if (required <= 0) return null;
      const typeQs = availQuestions.filter(function (q: any) { return q.question_type === qtype; });
      // Split into selected and unselected
      const selectedOfType = typeQs.filter(function (q: any) { return selectedIds.indexOf(q.id) >= 0; });
      const unselectedOfType = typeQs.filter(function (q: any) { return selectedIds.indexOf(q.id) < 0; });
      // Apply diff filter only to unselected
      const typeDiffFilter = diffFilterMap[qtype] || '';
      const filteredUnselected = typeDiffFilter ? unselectedOfType.filter(function (q: any) { return q.difficulty === typeDiffFilter; }) : unselectedOfType;
      const selCount = selectedOfType.length;

      // Helper: render a question row
      function renderQRow(q: any, isSelected: boolean) {
        const diffColor = q.difficulty === 'EASY' ? 'green' : q.difficulty === 'MEDIUM' ? 'orange' : 'red';
        const diffLabel = q.difficulty === 'EASY' ? '简' : q.difficulty === 'MEDIUM' ? '中' : '难';
        return (
          <div key={q.id} onClick={function () {
            if (isSelected) {
              // Remove from selection
              setSelectedIds(selectedIds.filter(function (id) { return id !== q.id; }));
            } else {
              // Add to selection (check limits)
              const currentSelected = selectedIds.filter(function (id) { return id !== q.id; });
              const typeSel = currentSelected.filter(function (id) {
                const fq = availQuestions.filter(function (x: any) { return x.id === id; })[0];
                return fq && fq.question_type === qtype;
              }).length;
              if (typeSel >= required) {
                message.warning(toLabelMap(qtypes)[qtype] + '已达到' + required + '道上限');
                return;
              }
              setSelectedIds(selectedIds.concat([q.id]));
            }
          }} style={{ padding: '4px 8px', cursor: 'pointer', background: isSelected ? '#e6f7ff' : '#fff', borderBottom: '1px solid #f0f0f0', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ flex: 1 }}>
              {(q.title || '').substring(0, 60) + (isSelected ? '' : '')}
              {isSelected ? null : <Tag color={diffColor} style={{ marginLeft: 4, fontSize: 10 }}>{diffLabel}</Tag>}
            </span>
            {isSelected ? <span style={{ color: '#ff4d4f', fontSize: 11, cursor: 'pointer' }}>移除</span> : null}
            {isSelected ? null : <Tag color="blue" style={{ marginLeft: 4, fontSize: 10, cursor: 'pointer' }}>添加</Tag>}
          </div>
        );
      }

      // TOP section: selected questions
      const topSection = (
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 12, color: '#1890ff', fontWeight: 'bold', marginBottom: 4 }}>
            {'已选 ' + selCount + '/' + required + ' 道（点击移除）'}
          </div>
          {selectedOfType.length > 0
            ? <div style={{ maxHeight: 100, overflow: 'auto' }}>
                {selectedOfType.map(function (q) { return renderQRow(q, true); })}
              </div>
            : <div style={{ padding: 8, textAlign: 'center', color: '#ccc', fontSize: 12 }}>暂无已选题，从下方选择添加</div>
          }
        </div>
      );

      // BOTTOM section: filter + unselected questions
      const bottomSection = (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: '#666', fontWeight: 'bold' }}>可选题目（点击添加）</div>
            <Select placeholder="难度筛选" allowClear value={(diffFilterMap[qtype] || '') || undefined}
              onChange={function (v: any) { const nd: Record<string, any> = {}; Object.keys(diffFilterMap).forEach(function (k: string) { nd[k] = diffFilterMap[k]; }); nd[qtype] = v || ''; setDiffFilterMap(nd); }}
              size="small" style={{ width: 100 }}
              options={toSelectOptions(difficultyLevels)} />
          </div>
          {filteredUnselected.length > 0
            ? <div style={{ maxHeight: 140, overflow: 'auto' }}>
                {filteredUnselected.map(function (q) { return renderQRow(q, false); })}
              </div>
            : <div style={{ padding: 8, textAlign: 'center', color: '#ccc', fontSize: 12 }}>无匹配题目</div>
          }
        </div>
      );

      return (
        <Card key={qtype} size="small" style={{ marginBottom: 8 }}
          title={<span style={{ fontSize: 13 }}>{toLabelMap(qtypes)[qtype]}</span>}
        >
          {topSection}
          <hr style={{ margin: '8px 0' }} />
          {bottomSection}
        </Card>
      );
    }).filter(function (p) { return p !== null; });

    const rightPanel = (
      <div style={{ width: '72%', paddingLeft: 12, maxHeight: '55vh', overflow: 'auto' }}>
        {rightPanels}
      </div>
    );

    stepContent = (
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {leftPanel}
        {rightPanel}
      </div>
    );
  } else {
    footerButtons = (
      <Space>
        <Button onClick={function () { setStep(2); }}>上一步</Button>
        <Button type="primary" loading={loading} onClick={handleManualCreate}>确认生成试卷</Button>
      </Space>
    );
    stepContent = (
      <div>
        <div style={{ marginBottom: 12, color: '#666' }}>{'预览试卷结构，共 ' + previewQuestions.length + ' 道试题，可点击替换按钮更换试题'}</div>
        <PaperTemplatePreview
          title={savedFormValues.title || '试卷预览'}
          subtitle={savedFormValues.subtitle || ''}
          notes={savedFormValues.notes || ''}
          questions={previewQuestions}
          readonly={false}
          onReplace={function (q: any) {
            const newIds = previewQuestions.filter(function (x: any) { return x.id !== q.id; }).map(function (x: any) { return x.id; });
            setSelectedIds(newIds);
            setPreviewQuestions(previewQuestions.filter(function (x: any) { return x.id !== q.id; }));
            setStep(2);
            message.info('请选择替换试题');
          }}
        />
      </div>
    );
  }

  return (
    <Modal
      title={isEdit ? '编辑试卷' : '新建试卷'}
      open={open} onCancel={handleCancel} width={900} footer={footerButtons}
    >
      <Steps current={step} style={{ marginBottom: 24 }} items={[{ title: '基本信息' }, { title: '选题方式' }, { title: '选择试题' }, { title: '预览确认' }]} />
      {stepContent}
    </Modal>
  );
}
