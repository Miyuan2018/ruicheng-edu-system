import React, { useState, useRef, useEffect } from 'react';
import { Modal, Button, Steps, Upload, Form, Input, Select, InputNumber, Card, Tag, Space, message, Typography, Row, Col, Spin, Alert } from 'antd';
import { CameraOutlined, InboxOutlined, EditOutlined, CheckOutlined, RobotOutlined, ScanOutlined, EyeOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';
import { useReferenceValues, toLabelMap, toSelectOptions } from '../../hooks/useReferenceValues';

var Title = Typography.Title;
var Text = Typography.Text;
var Dragger = Upload.Dragger;

export default function PaperImportModal(props) {
  const { 'question-types': qtypes, 'difficulty-levels': diffs, 'grade-levels': grades } = useReferenceValues();
  var open = props.open;
  var onClose = props.onClose;
  var onSuccess = props.onSuccess;
  var form = Form.useForm()[0];

  var stepState = useState(0); var step = stepState[0]; var setStep = stepState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var questionsState = useState([]); var questions = questionsState[0]; var setQuestions = questionsState[1];
  var fileState = useState(null); var file = fileState[0]; var setFile = fileState[1];
  var previewState = useState(''); var preview = previewState[0]; var setPreview = previewState[1];
  var savingState = useState(false); var saving = savingState[0]; var setSaving = savingState[1];
  var resultMsgState = useState(''); var resultMsg = resultMsgState[0]; var setResultMsg = resultMsgState[1];
  var gradeScopeState = useState('grade_comprehensive'); var gradeScope = gradeScopeState[0]; var setGradeScope = gradeScopeState[1];
  var subjectOptionsState = useState([]); var subjectOptions = subjectOptionsState[0]; var setSubjectOptions = subjectOptionsState[1];
  useEffect(function () {
    apiClient.get('/subjects/all').then(function (res) {
      setSubjectOptions((res.data || []).filter(function (s) { return s.is_active; }).map(function (s) { return { value: s.name, label: s.name }; }));
    }).catch(function () {});
  }, []);

  function handleCancel() {
    if (step === 0) { onClose(); return; }
    setStep(step - 1);
  }

  function handleFileChange(info) {
    var f = info.file;
    if (f.status === 'removed') { setFile(null); setPreview(''); return; }
    // Preview
    var reader = new FileReader();
    reader.onload = function (e) { setPreview(e.target.result); };
    reader.readAsDataURL(f);
    setFile(f);
  }

  // Step 1 → 2: Recognize
  async function handleRecognize() {
    if (!file) { message.warning('请先选择试卷图片'); return; }
    setLoading(true);
    setStep(1);
    try {
      var formData = new FormData();
      formData.append('file', file);
      var vals = form.getFieldsValue();
      formData.append('subject', vals.subject || '数学');
      formData.append('grade_level', JSON.stringify({ scope: vals.grade_scope || 'grade_comprehensive', grades: vals.grade_level || [], chapter: vals.chapter || undefined, knowledge_points: vals.knowledge_points_input ? vals.knowledge_points_input.split(',').map(function(s) { return s.trim(); }) : undefined }));

      var resp = await apiClient.post('/question-admin/import-paper', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (resp.data && resp.data.ok) {
        setQuestions(resp.data.questions || []);
        setResultMsg('识别完成，共 ' + (resp.data.count || 0) + ' 道试题，使用模型: ' + (resp.data.model || ''));
        setStep(2);
      } else {
        setResultMsg(resp.data.error || '识别失败');
      }
    } catch (e) {
      var detail = '网络请求失败';
      if (e && e.response && e.response.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      setResultMsg(detail);
    } finally { setLoading(false); }
  }

  // Step 2 → 3: Edit
  function handleEdit() { setStep(3); }

  // Step 3 → 2: Back from edit
  function handleBackToPreview() { setStep(2); }

  // Edit a single question
  function updateQuestion(index, field, value) {
    var newQs = questions.slice();
    newQs[index] = Object.assign({}, newQs[index], {});
    newQs[index][field] = value;
    setQuestions(newQs);
  }

  function updateOption(qIndex, oIndex, field, value) {
    var newQs = questions.slice();
    var opts = (newQs[qIndex].options || []).slice();
    opts[oIndex] = Object.assign({}, opts[oIndex], {});
    opts[oIndex][field] = value;
    newQs[qIndex] = Object.assign({}, newQs[qIndex], { options: opts });
    setQuestions(newQs);
  }

  function addOption(qIndex) {
    var newQs = questions.slice();
    var opts = (newQs[qIndex].options || []).slice();
    var label = String.fromCharCode(65 + opts.length); // A, B, C...
    opts.push({ label: label, text: '' });
    newQs[qIndex] = Object.assign({}, newQs[qIndex], { options: opts });
    setQuestions(newQs);
  }

  // Step 3: Confirm save
  async function handleSave() {
    setSaving(true);
    try {
      var resp = await apiClient.post('/question-admin/import-confirm', questions);
      if (resp.data && resp.data.ok) {
        message.success(resp.data.message || '入库成功');
        onSuccess();
      } else {
        message.error(resp.data.error || '保存失败');
      }
    } catch (e) {
      var detail = '保存失败';
      if (e && e.response && e.response.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    } finally { setSaving(false); }
  }

  // ── Step content ──

  var stepContent;
  var footerButtons;

  if (step === 0) {
    // Step 0: Upload + basic info
    stepContent = React.createElement('div', null,
      React.createElement(Row, { gutter: 12, style: { marginBottom: 16 } },
        React.createElement(Col, { span: 6 },
          React.createElement(Form.Item, { name: 'subject', label: '学科', initialValue: '数学', rules: [{ required: true }] },
            React.createElement(Select, { placeholder: '选择学科', options: subjectOptions })
          )
        ),
        React.createElement(Col, { span: 6 },
          React.createElement(Form.Item, { name: 'grade_scope', label: '适用范围', initialValue: 'grade_comprehensive' },
            React.createElement(Select, { options: [
              { value: 'comprehensive', label: '综合 (跨年级)' },
              { value: 'grade_comprehensive', label: '年级综合' },
              { value: 'chapter', label: '章节' },
              { value: 'knowledge_point', label: '知识点' },
            ], onChange: function(v) { setGradeScope(v); } })
          )
        ),
        React.createElement(Col, { span: 6 },
          React.createElement(Form.Item, { name: 'grade_level', label: '年级', rules: [{ required: true, message: '请选择年级' }] },
            React.createElement(Select, { mode: gradeScope === 'comprehensive' ? 'multiple' : undefined,
              placeholder: '选择年级', options: toSelectOptions(grades) })
          )
        ),
        (gradeScope === 'chapter' || gradeScope === 'knowledge_point') ? React.createElement(Col, { span: 6 },
          React.createElement(Form.Item, { name: 'chapter', label: '章节名称', rules: [{ required: true }] },
            React.createElement(Input, { placeholder: '如：二次函数' })
          )
        ) : null
      ),
      gradeScope === 'knowledge_point' ? React.createElement(Row, { gutter: 12, style: { marginBottom: 12 } },
        React.createElement(Col, { span: 24 },
          React.createElement(Form.Item, { name: 'knowledge_points_input', label: '知识点', rules: [{ required: true }] },
            React.createElement(Input, { placeholder: '如：顶点式, 判别式, 图像平移' })
          ),
          React.createElement('div', { style: { color: '#888', fontSize: 11, marginTop: -16 } }, '多个知识点用逗号分隔')
        )
      ) : null,
      React.createElement(Dragger, {
        accept: 'image/*',
        maxCount: 1,
        beforeUpload: function () { return false; },
        onChange: handleFileChange,
        fileList: file ? [file] : [],
      },
        React.createElement('p', { className: 'ant-upload-drag-icon' }, React.createElement(InboxOutlined, null)),
        React.createElement('p', { className: 'ant-upload-text' }, '点击或拖拽试卷图片到此区域'),
        React.createElement('p', { className: 'ant-upload-hint' }, '支持拍照或扫描件，图片需清晰可见')
      ),
      preview ? React.createElement('div', { style: { marginTop: 16, textAlign: 'center' } },
        React.createElement('img', { src: preview, style: { maxWidth: '100%', maxHeight: 200, border: '1px solid #d9d9d9', borderRadius: 4 } })
      ) : null
    );
    footerButtons = React.createElement(Space, null,
      React.createElement(Button, { onClick: onClose }, '取消'),
      React.createElement(Button, { type: 'primary', icon: React.createElement(ScanOutlined), onClick: handleRecognize, loading: loading, disabled: !file }, '开始识别')
    );
  } else if (step === 1) {
    // Step 1: Recognizing (loading)
    stepContent = React.createElement('div', { style: { textAlign: 'center', padding: 40 } },
      loading
        ? React.createElement('div', null,
            React.createElement(Spin, { size: 'large' }),
            React.createElement('div', { style: { marginTop: 16 } },
              React.createElement(Text, { type: 'secondary' }, '正在调用大模型识别试卷内容...'),
              React.createElement('div', { style: { marginTop: 8 } }, React.createElement(Text, { style: { fontSize: 12, color: '#999' } }, '这可能需要30秒到1分钟'))
            )
          )
        : React.createElement('div', null,
            resultMsg && !resultMsg.startsWith('识别完成')
              ? React.createElement(Alert, { type: 'error', message: resultMsg, style: { marginBottom: 16 } })
              : React.createElement(Alert, { type: 'success', message: resultMsg })
          )
    );
    footerButtons = React.createElement(Space, null,
      React.createElement(Button, { onClick: function () { setStep(0); } }, '上一步，重新选择图片'),
      !loading && questions.length > 0
        ? React.createElement(Button, { type: 'primary', icon: React.createElement(EyeOutlined), onClick: handleEdit }, '查看识别结果（' + questions.length + '题）')
        : null
    );
  } else if (step === 2) {
    // Step 2: Preview results
    stepContent = React.createElement('div', null,
      React.createElement(Alert, { type: 'info', message: '预览识别结果，点击"编辑纠错"进入编辑模式', style: { marginBottom: 16 } }),
      questions.map(function (q, i) {
        return React.createElement(Card, { key: i, size: 'small', style: { marginBottom: 8 },
          title: React.createElement(Space, null,
            React.createElement(Tag, { color: 'blue' }, i + 1),
            React.createElement(Tag, { color: 'purple' }, toLabelMap(qtypes)[q.question_type] || q.question_type),
            React.createElement(Tag, { color: q.difficulty === 'EASY' ? 'green' : q.difficulty === 'MEDIUM' ? 'orange' : 'red' }, toLabelMap(diffs)[q.difficulty] || q.difficulty),
            React.createElement(Text, { style: { fontSize: 11 } }, q.score + '分')
          )
        },
          React.createElement('div', { style: { fontWeight: 'bold', marginBottom: 4 } }, q.title || '(无标题)'),
          q.options && q.options.length > 0
            ? React.createElement('div', { style: { marginLeft: 16, fontSize: 13 } },
                q.options.map(function (o) { return React.createElement('div', { key: o.label }, o.label + '. ' + (o.text || '')); })
              )
            : null,
          React.createElement('div', { style: { marginTop: 4, fontSize: 12, color: '#999' } }, '答案: ' + JSON.stringify(q.correct_answer))
        );
      })
    );
    footerButtons = React.createElement(Space, null,
      React.createElement(Button, { onClick: function () { setStep(0); } }, '重新上传'),
      React.createElement(Button, { type: 'default', icon: React.createElement(EditOutlined), onClick: handleEdit }, '编辑纠错'),
      React.createElement(Button, { type: 'primary', icon: React.createElement(CheckOutlined), onClick: handleSave, loading: saving }, '确认入库')
    );
  } else {
    // Step 3: Edit mode
    stepContent = React.createElement('div', null,
      React.createElement(Alert, { type: 'warning', message: '编辑模式：点击字段进行修改，修改完成后点"确认入库"保存', style: { marginBottom: 16 } }),
      questions.map(function (q, i) {
        return React.createElement(Card, { key: i, size: 'small', style: { marginBottom: 12 },
          title: React.createElement(Space, null,
            React.createElement(Tag, { color: 'blue' }, i + 1),
            React.createElement(Select, { value: q.question_type, size: 'small', style: { width: 100 },
              onChange: function (v) { updateQuestion(i, 'question_type', v); },
              options: toSelectOptions(qtypes)
            }),
            React.createElement(Select, { value: q.difficulty, size: 'small', style: { width: 80 },
              onChange: function (v) { updateQuestion(i, 'difficulty', v); },
              options: toSelectOptions(diffs)
            }),
            React.createElement(InputNumber, { value: q.score, size: 'small', min: 1, max: 30, style: { width: 60 },
              onChange: function (v) { updateQuestion(i, 'score', v); }
            }),
            React.createElement(Text, { style: { fontSize: 11 } }, '分')
          )
        },
          React.createElement(Input.TextArea, { value: q.title, rows: 2, style: { marginBottom: 8 },
            onChange: function (e) { updateQuestion(i, 'title', e.target.value); }
          }),
          (q.question_type === 'SINGLE_CHOICE' || q.question_type === 'MULTIPLE_CHOICE')
            ? React.createElement('div', { style: { marginBottom: 8 } },
                React.createElement(Text, { strong: true, style: { fontSize: 12 } }, '选项：'),
                (q.options || []).map(function (o, oi) {
                  return React.createElement(Input, { key: oi, value: o.text, size: 'small', style: { width: 'calc(50% - 8px)', marginRight: 8, marginBottom: 4 },
                    addonBefore: o.label,
                    onChange: function (e) { updateOption(i, oi, 'text', e.target.value); }
                  });
                }),
                React.createElement(Button, { type: 'dashed', size: 'small', onClick: function () { addOption(i); }, style: { marginTop: 4 } }, '+ 添加选项')
              )
            : null,
          React.createElement(Input, { value: typeof q.correct_answer === 'string' ? q.correct_answer : JSON.stringify(q.correct_answer),
            addonBefore: '答案', style: { marginBottom: 8 },
            onChange: function (e) { updateQuestion(i, 'correct_answer', e.target.value); }
          }),
          React.createElement(Input, { value: q.explanation || '', addonBefore: '解析', placeholder: '选填',
            onChange: function (e) { updateQuestion(i, 'explanation', e.target.value); }
          })
        );
      })
    );
    footerButtons = React.createElement(Space, null,
      React.createElement(Button, { onClick: handleBackToPreview }, '返回预览'),
      React.createElement(Button, { type: 'primary', icon: React.createElement(CheckOutlined), onClick: handleSave, loading: saving }, '确认入库（' + questions.length + '题）')
    );
  }

  return React.createElement(Modal, {
    title: React.createElement(Space, null, React.createElement(CameraOutlined, null), React.createElement('span', null, '试卷录入 — 拍照/扫描识别')),
    open: open, onCancel: handleCancel, width: 800, footer: footerButtons,
  },
    React.createElement(Form, { form: form, component: false },
      React.createElement(Steps, { current: step, size: 'small', style: { marginBottom: 24 },
        items: [
          { title: '拍照/扫描', description: '上传试卷图片' },
          { title: 'AI识别', description: '大模型提取试题' },
          { title: '预览确认', description: '查看识别结果' },
          { title: '编辑纠错', description: '修改后入库' },
        ]
      }),
      stepContent
    )
  );
}
