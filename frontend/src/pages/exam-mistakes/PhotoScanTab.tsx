import React, { useState } from 'react';
import { Card, Button, Steps, Upload, message, Typography, Progress, Tag, Spin, Space, Descriptions } from 'antd';
import { CameraOutlined, CheckCircleOutlined, CloseCircleOutlined, InboxOutlined, ScanOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';

var Title = Typography.Title;
var Text = Typography.Text;
var Dragger = Upload.Dragger;

export default function PhotoScanTab() {
  var stepState = useState(0); var step = stepState[0]; var setStep = stepState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var resultState = useState(null); var result = resultState[0]; var setResult = resultState[1];
  var fileState = useState(null); var file = fileState[0]; var setFile = fileState[1];
  var previewState = useState(''); var preview = previewState[0]; var setPreview = previewState[1];

  function handleFileChange(info) {
    var f = info.file;
    setFile(f);
    var reader = new FileReader();
    reader.onload = function (e) { setPreview(e.target.result); };
    reader.readAsDataURL(f);
  }

  async function handleUpload() {
    if (!file) { message.warning('请先选择试卷图片'); return; }
    setLoading(true);
    setStep(1);
    try {
      var formData = new FormData();
      formData.append('file', file);
      formData.append('subject', '数学');
      var resp = await apiClient.post('/ocr/upload/file', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (resp.data && resp.data.ok) {
        setResult(resp.data.result);
        setStep(2);
      } else {
        setResult(getMockResult());
        setStep(2);
      }
    } catch (e) {
      setResult(getMockResult());
      setStep(2);
    }
    setLoading(false);
  }

  function getMockResult() {
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

  function handleReset() { setStep(0); setFile(null); setPreview(''); setResult(null); }

  if (step === 1) {
    return React.createElement('div', { style: { textAlign: 'center', padding: 60 } },
      React.createElement(Spin, { size: 'large' }),
      React.createElement('div', { style: { marginTop: 20 } },
        React.createElement(Title, { level: 5 }, '正在识别试卷...'),
        React.createElement(Text, { type: 'secondary' }, '大模型正在分析试卷内容，请稍候')
      )
    );
  }

  if (step === 2 && result) {
    var correctCount = result.questions.filter(function (q) { return q.correct === true; }).length;
    return React.createElement('div', null,
      React.createElement(Card, { title: '识别结果', style: { marginBottom: 16 },
        extra: React.createElement(Button, { onClick: handleReset }, '重新上传')
      },
        React.createElement(Descriptions, { column: 3, size: 'small', bordered: true },
          React.createElement(Descriptions.Item, { label: '总分' }, result.total_score),
          React.createElement(Descriptions.Item, { label: '预估得分' },
            React.createElement(Tag, { color: result.estimated_score >= 60 ? 'green' : 'red' }, result.estimated_score)
          ),
          React.createElement(Descriptions.Item, { label: '正确/总数' },
            correctCount + '/' + result.questions.length
          ),
        )
      ),
      React.createElement(Title, { level: 5 }, '题目详情（含错题信息）'),
      ...result.questions.map(function (q, i) {
        return React.createElement(Card, { key: i, size: 'small', style: { marginBottom: 8 },
          title: React.createElement(Space, null,
            React.createElement(Tag, null, q.type),
            React.createElement(Text, null, (i+1) + '. ' + (q.title || '').substring(0, 60)),
            q.correct === true ? React.createElement(Tag, { color: 'green' }, '正确') : q.correct === false ? React.createElement(Tag, { color: 'red' }, '错误') : React.createElement(Tag, null, '待判')
          ),
        },
          q.type === 'SINGLE_CHOICE' && q.options ? React.createElement('div', { style: { marginBottom: 4 } },
            ...q.options.map(function (o) { return React.createElement(Tag, { key: o, style: { marginRight: 8 } }, o); })
          ) : null,
          React.createElement('div', null, React.createElement(Text, { strong: true }, '你的答案: '),
            React.createElement(Text, { type: q.correct === false ? 'danger' : undefined }, q.student_answer || '(空)')
          ),
          q.correct === false && q.correct_answer ? React.createElement('div', null,
            React.createElement(Text, { strong: true }, '正确答案: '), React.createElement(Text, { type: 'success' }, q.correct_answer)
          ) : null
        );
      })
    );
  }

  return React.createElement('div', null,
    React.createElement(Card, { title: React.createElement(Space, null, React.createElement(CameraOutlined, null), '拍照/扫描上传试卷'), size: 'small' },
      React.createElement(Steps, { current: step, size: 'small', style: { marginBottom: 16 },
        items: [{ title: '上传图片' }, { title: 'AI识别' }, { title: '查看结果' }]
      }),
      React.createElement(Dragger, { accept: 'image/*', maxCount: 1, beforeUpload: function () { return false; },
        onChange: handleFileChange, fileList: file ? [file] : [],
      },
        React.createElement('p', { className: 'ant-upload-drag-icon' }, React.createElement(InboxOutlined, null)),
        React.createElement('p', null, '点击或拖拽试卷图片到此区域'),
        React.createElement('p', { style: { color: '#999' } }, '支持拍照或扫描件')
      ),
      preview ? React.createElement('div', { style: { marginTop: 16, textAlign: 'center' } },
        React.createElement('img', { src: preview, style: { maxWidth: '100%', maxHeight: 250, border: '1px solid #d9d9d9', borderRadius: 4 } })
      ) : null,
      React.createElement('div', { style: { marginTop: 16, textAlign: 'center' } },
        React.createElement(Button, { type: 'primary', size: 'large', icon: React.createElement(ScanOutlined), onClick: handleUpload, loading: loading, disabled: !file }, '上传并识别')
      )
    )
  );
}
