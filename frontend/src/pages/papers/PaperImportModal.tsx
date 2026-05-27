import { useState, useEffect } from 'react';
import { Modal, Button, Steps, Upload, Form, Input, Select, InputNumber, Card, Tag, Space, message, Typography, Row, Col, Spin, Alert } from 'antd';
import { CameraOutlined, InboxOutlined, EditOutlined, CheckOutlined, ScanOutlined, EyeOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toLabelMap, toSelectOptions } from '../../hooks/useReferenceValues';

const Text = Typography.Text;
const Dragger = Upload.Dragger;

interface PaperImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaperImportModal(props: PaperImportModalProps) {
  const { 'question-types': qtypes, 'difficulty-levels': diffs, 'grade-levels': grades } = useReferenceValues();
  const open = props.open;
  const onClose = props.onClose;
  const onSuccess = props.onSuccess;
  const form = Form.useForm()[0];

  const stepState = useState(0); const step = stepState[0]; const setStep = stepState[1];
  const loadingState = useState(false); const loading = loadingState[0]; const setLoading = loadingState[1];
  const questionsState = useState<any[]>([]); const questions = questionsState[0]; const setQuestions = questionsState[1];
  const fileState = useState<any>(null); const file = fileState[0]; const setFile = fileState[1];
  const previewState = useState(''); const preview = previewState[0]; const setPreview = previewState[1];
  const savingState = useState(false); const saving = savingState[0]; const setSaving = savingState[1];
  const resultMsgState = useState(''); const resultMsg = resultMsgState[0]; const setResultMsg = resultMsgState[1];
  const gradeScopeState = useState('grade_comprehensive'); const gradeScope = gradeScopeState[0]; const setGradeScope = gradeScopeState[1];
  const subjectOptionsState = useState<any[]>([]); const subjectOptions = subjectOptionsState[0]; const setSubjectOptions = subjectOptionsState[1];
  useEffect(function () {
    apiClient.get('/subjects/all').then(function (res) {
      setSubjectOptions((res.data || []).filter(function (s: any) { return s.is_active; }).map(function (s: any) { return { value: s.name, label: s.name }; }));
    }).catch(function () {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleCancel() {
    if (step === 0) { onClose(); return; }
    setStep(step - 1);
  }

  function handleFileChange(info: any) {
    const f = info.file;
    if (f.status === 'removed') { setFile(null); setPreview(''); return; }
    // Preview
    const reader = new FileReader();
    reader.onload = function (e: ProgressEvent<FileReader>) { setPreview(e.target!.result as string); };
    reader.readAsDataURL(f);
    setFile(f);
  }

  // Step 1 → 2: Recognize
  async function handleRecognize() {
    if (!file) { message.warning('请先选择试卷图片'); return; }
    setLoading(true);
    setStep(1);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const vals = form.getFieldsValue();
      formData.append('subject', vals.subject || '数学');
      formData.append('grade_level', JSON.stringify({ scope: vals.grade_scope || 'grade_comprehensive', grades: vals.grade_level || [], chapter: vals.chapter || undefined, knowledge_points: vals.knowledge_points_input ? vals.knowledge_points_input.split(',').map(function(s: any) { return s.trim(); }) : undefined }));

      const resp = await apiClient.post('/question-admin/import-paper', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (resp.data && resp.data.ok) {
        setQuestions(resp.data.questions || []);
        setResultMsg('识别完成，共 ' + (resp.data.count || 0) + ' 道试题，使用模型: ' + (resp.data.model || ''));
        setStep(2);
      } else {
        setResultMsg(resp.data.error || '识别失败');
      }
    } catch (e: unknown) {
      let detail = '网络请求失败';
      const err = e as any;
      if (err && err.response && err.response.data) detail = err.response.data.detail || JSON.stringify(err.response.data);
      setResultMsg(detail);
    } finally { setLoading(false); }
  }

  // Step 2 → 3: Edit
  function handleEdit() { setStep(3); }

  // Step 3 → 2: Back from edit
  function handleBackToPreview() { setStep(2); }

  // Edit a single question
  function updateQuestion(index: number, field: string, value: any) {
    const newQs = questions.slice();
    newQs[index] = Object.assign({}, newQs[index], {});
    newQs[index][field] = value;
    setQuestions(newQs);
  }

  function updateOption(qIndex: number, oIndex: number, field: string, value: any) {
    const newQs = questions.slice();
    const opts = (newQs[qIndex].options || []).slice();
    opts[oIndex] = Object.assign({}, opts[oIndex], {});
    opts[oIndex][field] = value;
    newQs[qIndex] = Object.assign({}, newQs[qIndex], { options: opts });
    setQuestions(newQs);
  }

  function addOption(qIndex: number) {
    const newQs = questions.slice();
    const opts = (newQs[qIndex].options || []).slice();
    const label = String.fromCharCode(65 + opts.length); // A, B, C...
    opts.push({ label: label, text: '' });
    newQs[qIndex] = Object.assign({}, newQs[qIndex], { options: opts });
    setQuestions(newQs);
  }

  // Step 3: Confirm save
  async function handleSave() {
    setSaving(true);
    try {
      const resp = await apiClient.post('/question-admin/import-confirm', questions);
      if (resp.data && resp.data.ok) {
        message.success(resp.data.message || '入库成功');
        onSuccess();
      } else {
        message.error(resp.data.error || '保存失败');
      }
    } catch (e: unknown) {
      let detail = '保存失败';
      const err = e as any;
      if (err && err.response && err.response.data) detail = err.response.data.detail || JSON.stringify(err.response.data);
      message.error(detail);
    } finally { setSaving(false); }
  }

  // ── Step content ──

  let stepContent;
  let footerButtons;

  if (step === 0) {
    // Step 0: Upload + basic info
    stepContent = (
      <div>
        <Row gutter={12} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Form.Item name="subject" label="学科" initialValue="数学" rules={[{ required: true }]}>
              <Select placeholder="选择学科" options={subjectOptions} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="grade_scope" label="适用范围" initialValue="grade_comprehensive">
              <Select options={[
                { value: 'comprehensive', label: '综合 (跨年级)' },
                { value: 'grade_comprehensive', label: '年级综合' },
                { value: 'chapter', label: '章节' },
                { value: 'knowledge_point', label: '知识点' },
              ]} onChange={function(v: any) { setGradeScope(v); }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="grade_level" label="年级" rules={[{ required: true, message: '请选择年级' }]}>
              <Select mode={gradeScope === 'comprehensive' ? 'multiple' : undefined}
                placeholder="选择年级" options={toSelectOptions(grades)} />
            </Form.Item>
          </Col>
          {(gradeScope === 'chapter' || gradeScope === 'knowledge_point') ? (
            <Col span={6}>
              <Form.Item name="chapter" label="章节名称" rules={[{ required: true }]}>
                <Input placeholder="如：二次函数" />
              </Form.Item>
            </Col>
          ) : null}
        </Row>
        {gradeScope === 'knowledge_point' ? (
          <Row gutter={12} style={{ marginBottom: 12 }}>
            <Col span={24}>
              <Form.Item name="knowledge_points_input" label="知识点" rules={[{ required: true }]}>
                <Input placeholder="如：顶点式, 判别式, 图像平移" />
              </Form.Item>
              <div style={{ color: '#888', fontSize: 11, marginTop: -16 }}>多个知识点用逗号分隔</div>
            </Col>
          </Row>
        ) : null}
        <Dragger
          accept="image/*"
          maxCount={1}
          beforeUpload={function () { return false; }}
          onChange={handleFileChange}
          fileList={file ? [file] : []}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">点击或拖拽试卷图片到此区域</p>
          <p className="ant-upload-hint">支持拍照或扫描件，图片需清晰可见</p>
        </Dragger>
        {preview ? (
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <img src={preview} style={{ maxWidth: '100%', maxHeight: 200, border: '1px solid #d9d9d9', borderRadius: 4 }} />
          </div>
        ) : null}
      </div>
    );
    footerButtons = (
      <Space>
        <Button onClick={onClose}>取消</Button>
        <Button type="primary" icon={<ScanOutlined />} onClick={handleRecognize} loading={loading} disabled={!file}>开始识别</Button>
      </Space>
    );
  } else if (step === 1) {
    // Step 1: Recognizing (loading)
    stepContent = (
      <div style={{ textAlign: 'center', padding: 40 }}>
        {loading
          ? (
            <div>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">正在调用大模型识别试卷内容...</Text>
                <div style={{ marginTop: 8 }}><Text style={{ fontSize: 12, color: '#999' }}>这可能需要30秒到1分钟</Text></div>
              </div>
            </div>
          )
          : (
            <div>
              {resultMsg && !resultMsg.startsWith('识别完成')
                ? <Alert type="error" message={resultMsg} style={{ marginBottom: 16 }} />
                : <Alert type="success" message={resultMsg} />
              }
            </div>
          )
        }
      </div>
    );
    footerButtons = (
      <Space>
        <Button onClick={function () { setStep(0); }}>上一步，重新选择图片</Button>
        {!loading && questions.length > 0
          ? <Button type="primary" icon={<EyeOutlined />} onClick={handleEdit}>查看识别结果（{questions.length}题）</Button>
          : null
        }
      </Space>
    );
  } else if (step === 2) {
    // Step 2: Preview results
    stepContent = (
      <div>
        <Alert type="info" message={'预览识别结果，点击"编辑纠错"进入编辑模式'} style={{ marginBottom: 16 }} />
        {questions.map(function (q: any, i: number) {
          return (
            <Card key={i} size="small" style={{ marginBottom: 8 }}
              title={
                <Space>
                  <Tag color="blue">{i + 1}</Tag>
                  <Tag color="purple">{toLabelMap(qtypes)[q.question_type] || q.question_type}</Tag>
                  <Tag color={q.difficulty === 'EASY' ? 'green' : q.difficulty === 'MEDIUM' ? 'orange' : 'red'}>{toLabelMap(diffs)[q.difficulty] || q.difficulty}</Tag>
                  <Text style={{ fontSize: 11 }}>{q.score}分</Text>
                </Space>
              }
            >
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{q.title || '(无标题)'}</div>
              {q.options && q.options.length > 0
                ? (
                  <div style={{ marginLeft: 16, fontSize: 13 }}>
                    {q.options.map(function (o: any) { return <div key={o.label}>{o.label}. {o.text || ''}</div>; })}
                  </div>
                )
                : null}
              <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>答案: {JSON.stringify(q.correct_answer)}</div>
            </Card>
          );
        })}
      </div>
    );
    footerButtons = (
      <Space>
        <Button onClick={function () { setStep(0); }}>重新上传</Button>
        <Button type="default" icon={<EditOutlined />} onClick={handleEdit}>编辑纠错</Button>
        <Button type="primary" icon={<CheckOutlined />} onClick={handleSave} loading={saving}>确认入库</Button>
      </Space>
    );
  } else {
    // Step 3: Edit mode
    stepContent = (
      <div>
        <Alert type="warning" message={'编辑模式：点击字段进行修改，修改完成后点"确认入库"保存'} style={{ marginBottom: 16 }} />
        {questions.map(function (q: any, i: number) {
          return (
            <Card key={i} size="small" style={{ marginBottom: 12 }}
              title={
                <Space>
                  <Tag color="blue">{i + 1}</Tag>
                  <Select value={q.question_type} size="small" style={{ width: 100 }}
                    onChange={function (v) { updateQuestion(i, 'question_type', v); }}
                    options={toSelectOptions(qtypes)}
                  />
                  <Select value={q.difficulty} size="small" style={{ width: 80 }}
                    onChange={function (v) { updateQuestion(i, 'difficulty', v); }}
                    options={toSelectOptions(diffs)}
                  />
                  <InputNumber value={q.score} size="small" min={1} max={30} style={{ width: 60 }}
                    onChange={function (v) { updateQuestion(i, 'score', v); }}
                  />
                  <Text style={{ fontSize: 11 }}>分</Text>
                </Space>
              }
            >
              <Input.TextArea value={q.title} rows={2} style={{ marginBottom: 8 }}
                onChange={function (e) { updateQuestion(i, 'title', e.target.value); }}
              />
              {(q.question_type === 'SINGLE_CHOICE' || q.question_type === 'MULTIPLE_CHOICE')
                ? (
                  <div style={{ marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 12 }}>选项：</Text>
                    {(q.options || []).map(function (o: any, oi: number) {
                      return (
                        <Input key={oi} value={o.text} size="small" style={{ width: 'calc(50% - 8px)', marginRight: 8, marginBottom: 4 }}
                          addonBefore={o.label}
                          onChange={function (e) { updateOption(i, oi, 'text', e.target.value); }}
                        />
                      );
                    })}
                    <Button type="dashed" size="small" onClick={function () { addOption(i); }} style={{ marginTop: 4 }}>+ 添加选项</Button>
                  </div>
                )
                : null}
              <Input value={typeof q.correct_answer === 'string' ? q.correct_answer : JSON.stringify(q.correct_answer)}
                addonBefore="答案" style={{ marginBottom: 8 }}
                onChange={function (e) { updateQuestion(i, 'correct_answer', e.target.value); }}
              />
              <Input value={q.explanation || ''} addonBefore="解析" placeholder="选填"
                onChange={function (e) { updateQuestion(i, 'explanation', e.target.value); }}
              />
            </Card>
          );
        })}
      </div>
    );
    footerButtons = (
      <Space>
        <Button onClick={handleBackToPreview}>返回预览</Button>
        <Button type="primary" icon={<CheckOutlined />} onClick={handleSave} loading={saving}>确认入库（{questions.length}题）</Button>
      </Space>
    );
  }

  return (
    <Modal
      title={<Space><CameraOutlined /><span>试卷录入 — 拍照/扫描识别</span></Space>}
      open={open} onCancel={handleCancel} width={800} footer={footerButtons}
    >
      <Form form={form} component={false}>
        <Steps current={step} size="small" style={{ marginBottom: 24 }}
          items={[
            { title: '拍照/扫描', description: '上传试卷图片' },
            { title: 'AI识别', description: '大模型提取试题' },
            { title: '预览确认', description: '查看识别结果' },
            { title: '编辑纠错', description: '修改后入库' },
          ]}
        />
        {stepContent}
      </Form>
    </Modal>
  );
}
