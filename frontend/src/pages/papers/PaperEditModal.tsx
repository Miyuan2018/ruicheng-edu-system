import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, InputNumber, message, Steps, Button, Space, Row, Col, Card, Table, Tag } from 'antd';
import apiClient from '../../api/client';
import PaperTemplatePreview from './PaperTemplatePreview';
import { useReferenceValues, toLabelMap, toSelectOptions } from '../../hooks/useReferenceValues';

export default function PaperEditModal(props) {
  const { 'question-types': qtypes, 'difficulty-levels': difficultyLevels, 'paper-statuses': paperStatuses, 'grade-levels': grades } = useReferenceValues();
  var open = props.open;
  var paper = props.paper;
  var onClose = props.onClose;
  var onSuccess = props.onSuccess;
  var form = Form.useForm()[0];
  var loadingState = useState(false);
  var loading = loadingState[0];
  var gradeScopeState = useState('grade_comprehensive');
  var gradeScope = gradeScopeState[0];
  var setGradeScope = gradeScopeState[1];
  var setLoading = loadingState[1];
  var subjectOptionsState = useState([]);
  var subjectOptions = subjectOptionsState[0];
  var setSubjectOptions = subjectOptionsState[1];
  useEffect(function () {
    apiClient.get('/subjects/all').then(function (res) {
      setSubjectOptions((res.data || []).filter(function (s) { return s.is_active; }).map(function (s) { return { value: s.name, label: s.name }; }));
    }).catch(function () {});
  }, []);
  var stepState = useState(0);
  var step = stepState[0];
  var setStep = stepState[1];
  var isEdit = !!paper;

  var distState = useState({ SINGLE_CHOICE: 5, MULTIPLE_CHOICE: 2, FILL_BLANK: 3, SUBJECTIVE: 1 });
  var dist = distState[0];
  var setDist = distState[1];
  var ratioState = useState({ EASY: 40, MEDIUM: 40, HARD: 20 });
  var diffRatio = ratioState[0];
  var setDiffRatio = ratioState[1];
  var availQuestionsState = useState([]);
  var availQuestions = availQuestionsState[0];
  var setAvailQuestions = availQuestionsState[1];
  var selectedIdsState = useState([]);
  var selectedIds = selectedIdsState[0];
  var setSelectedIds = selectedIdsState[1];
  var previewQuestionsState = useState([]);
  var diffFilterMapState = useState({}); var diffFilterMap = diffFilterMapState[0]; var setDiffFilterMap = diffFilterMapState[1];
  var previewQuestions = previewQuestionsState[0];
  var setPreviewQuestions = previewQuestionsState[1];
  var selectModeState = useState('manual');
  var selectMode = selectModeState[0];
  var setSelectMode = selectModeState[1];
  var stepContent;
  // 保存表单值，切换 step 后 Form 卸载时不会丢失
  var savedFormValuesState = useState({});
  var savedFormValues = savedFormValuesState[0];
  var setSavedFormValues = savedFormValuesState[1];

  useEffect(function () {
    if (open) {
      setStep(0);
      if (paper) form.setFieldsValue(paper);
      else form.resetFields();
    }
  }, [open, paper]);

  var totalQuestions = 0;
  Object.keys(dist).forEach(function (k) { totalQuestions = totalQuestions + dist[k]; });

  async function handleSubmit() {
    if (step === 0) {
      await form.validateFields();
      var fv = form.getFieldsValue();
      setSavedFormValues(fv);
      setStep(1);
      return;
    }
    var values = savedFormValues;
    setLoading(true);
    try {
      var payload = {
        title: values.title,
        subtitle: values.subtitle || '',
        subject: values.subject,
        grade_level: { scope: values.grade_scope || 'grade_comprehensive', grades: values.grade_level || [], chapter: values.chapter || undefined, knowledge_points: values.knowledge_points_input ? values.knowledge_points_input.split(',').map(function(s) { return s.trim(); }) : undefined },
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
        var picked = [];
        try {
          var allResp = await apiClient.get('/questions', { params: { subject: payload.subject, limit: 200 } });
          var pool = Array.isArray(allResp.data) ? allResp.data : (allResp.data.items || []);
          if (pool.length === 0) { message.warning('题库中没有' + (payload.subject || '') + '学科的试题，请先录入试题'); setLoading(false); return; }

          var keys = Object.keys(dist);
          for (var ki = 0; ki < keys.length; ki++) {
            var qtype = keys[ki];
            var count = dist[qtype];
            if (count <= 0) continue;
            var easyCount = Math.round(count * diffRatio.EASY / 100);
            var mediumCount = Math.round(count * diffRatio.MEDIUM / 100);
            var hardCount = count - easyCount - mediumCount;
            var typePool = pool.filter(function (q) { return q.question_type === qtype; });
            if (typePool.length < count) { message.warning(toLabelMap(qtypes)[qtype] + '题库中仅有' + typePool.length + '道，需要' + count + '道，请调整分布'); }
            var diffs = [{ diff: 'EASY', cnt: easyCount }, { diff: 'MEDIUM', cnt: mediumCount }, { diff: 'HARD', cnt: hardCount }];
            var typePicked = 0;
            for (var di = 0; di < diffs.length; di++) {
              var d = diffs[di];
              if (d.cnt <= 0) continue;
              var matched = typePool.filter(function (q) { return q.difficulty === d.diff && picked.indexOf(q) < 0; });
              for (var qi = 0; qi < matched.length && qi < d.cnt; qi++) {
                picked.push(matched[qi]);
                typePicked++;
              }
              if (matched.length < d.cnt) {
                message.warning(toLabelMap(qtypes)[qtype] + toLabelMap(difficultyLevels)[d.diff] + '题库不足：需要' + d.cnt + '道，仅有' + matched.length + '道');
              }
            }
          }
        } catch (e) { message.error('自动选题查询失败'); setLoading(false); return; }
        if (picked.length === 0) { message.error('未找到匹配的试题，请调整选题条件或先录入试题'); setLoading(false); return; }
        message.success('自动选题完成：共' + picked.length + '道，请在下方确认或调整');
        setSelectedIds(picked.map(function (q) { return q.id; }));
        setAvailQuestions(pool);
        setSelectMode('auto');
        setStep(2);
      }
    } catch (e) {
      var detail = '操作失败';
      if (e && e.response && e.response.data) {
        detail = e.response.data.detail || JSON.stringify(e.response.data);
      }
      message.error(detail);
    } finally {
      setLoading(false);
    }
  }

  function goManualSelect() {
    var values = savedFormValues;
    setSelectedIds([]);
    setSelectMode('manual');
    setStep(2);
    apiClient.get('/questions', { params: { subject: values.subject, limit: 100 } }).then(function (resp) {
      var data = resp.data;
      setAvailQuestions(Array.isArray(data) ? data : (data.items || []));
    }).catch(function () { message.error('加载试题失败'); });
  }

  async function handleManualCreate() {
    var questions = previewQuestions;
    if (questions.length === 0) { message.warning('请至少选择一道试题'); return; }
    var values = savedFormValues;
    setLoading(true);
    try {
      var payload = { title: values.title, subject: values.subject, grade_level: { scope: values.grade_scope || 'grade_comprehensive', grades: values.grade_level || [], chapter: values.chapter || undefined, knowledge_points: values.knowledge_points_input ? values.knowledge_points_input.split(',').map(function(s) { return s.trim(); }) : undefined },
        total_score: values.total_score, duration_minutes: values.duration_minutes,
        status: values.status, subtitle: values.subtitle || "", description: values.description, instructions: values.notes || "" };
      var resp = await apiClient.post('/exam-papers', payload);
      var pid = resp.data.id;
      if (!pid) { message.error('试卷创建失败'); setLoading(false); return; }
      var scorePerQ = Math.round((values.total_score || 100) / Math.max(questions.length, 1));
      for (var si = 0; si < questions.length; si++) {
        try {
          await apiClient.post('/exam-papers/' + pid + '/questions', {
            question_id: questions[si].id, position: si + 1, score: questions[si].score || scorePerQ
          });
        } catch (e) { /* skip individual question errors */ }
      }
      message.success('试卷创建成功，已添加 ' + questions.length + ' 道试题');
      onSuccess();
    } catch (e) {
      var detail = '操作失败';
      if (e && e.response && e.response.data) { detail = e.response.data.detail || JSON.stringify(e.response.data); }
      message.error(detail);
    } finally { setLoading(false); }
  }

  var statsRow = React.createElement(Row, { gutter: 24 },
    React.createElement(Col, { span: 6 }, React.createElement('div', { style: { textAlign: 'center' } }, React.createElement('b', null, '总题数'), React.createElement('div', { style: { fontSize: 24 } }, totalQuestions))),
    React.createElement(Col, { span: 6 }, React.createElement('div', { style: { textAlign: 'center' } }, React.createElement('b', null, '总分'), React.createElement('div', { style: { fontSize: 24 } }, savedFormValues.total_score || 100))),
    React.createElement(Col, { span: 6 }, React.createElement('div', { style: { textAlign: 'center' } }, React.createElement('b', null, '每题均分'), React.createElement('div', { style: { fontSize: 24 } }, Math.round((savedFormValues.total_score || 100) / Math.max(totalQuestions, 1))))),
    React.createElement(Col, { span: 6 }, React.createElement('div', { style: { textAlign: 'center' } }, React.createElement('b', null, '时长'), React.createElement('div', { style: { fontSize: 24 } }, (savedFormValues.duration_minutes || 60) + '分钟')))
  );

  var typeCards = Object.keys(toLabelMap(qtypes)).map(function (key) {
    return React.createElement(Col, { span: 6, key: key },
      React.createElement(Card, { style: { textAlign: 'center' } },
        React.createElement('div', { style: { fontWeight: 'bold', marginBottom: 8 } }, toLabelMap(qtypes)[key]),
        React.createElement(InputNumber, { min: 0, max: 50, value: dist[key], onChange: function (v) { var nd = {}; Object.keys(dist).forEach(function (k) { nd[k] = k === key ? (v || 0) : dist[k]; }); setDist(nd); }, style: { width: 80 } }),
        React.createElement('div', { style: { color: '#999', fontSize: 12, marginTop: 4 } }, '道')
      )
    );
  });

  var diffSliders = ['EASY', 'MEDIUM', 'HARD'].map(function (diff) {
    var label = diff === 'EASY' ? '简单' : diff === 'MEDIUM' ? '中等' : '困难';
    return React.createElement(Col, { span: 8, key: diff },
      React.createElement('div', { style: { textAlign: 'center', marginBottom: 4 } }, label),
      React.createElement(InputNumber, {
        value: diffRatio[diff], min: 0, max: 100, style: { width: '100%' },
        onChange: function (v) { if (v !== null && v >= 0 && v <= 100) { var nr = {}; Object.keys(diffRatio).forEach(function (k) { nr[k] = k === diff ? v : diffRatio[k]; }); setDiffRatio(nr); } }
      }),
      React.createElement('div', { style: { textAlign: 'center', color: '#999' } }, diffRatio[diff] + '%')
    );
  });

  var diffSummary = ['EASY', 'MEDIUM', 'HARD'].map(function (diff) {
    var cnt = Math.round(totalQuestions * diffRatio[diff] / 100);
    var label = diff === 'EASY' ? '简单' : diff === 'MEDIUM' ? '中等' : '困难';
    return React.createElement(Col, { span: 8, key: 's' + diff, style: { textAlign: 'center', color: '#999', fontSize: 13 } }, '约 ' + cnt + ' 道' + label + '题');
  });

  function goToPreview(questions) {
    setPreviewQuestions(questions);
    setStep(3);
  }

  function handleCancel() {
    if (step === 0) onClose();
    else if (step === 3) setStep(step === 3 && previewQuestions.length > 0 ? 2 : 1);
    else setStep(Math.max(0, step - 1));
  }

  var footerButtons;
  if (step === 0) {
    footerButtons = React.createElement(Space, null,
      React.createElement(Button, { onClick: onClose }, '取消'),
      React.createElement(Button, { type: 'primary', onClick: function () { handleSubmit(); } }, '下一步：选题方式')
    );
    stepContent = React.createElement(Form, { form: form, layout: 'vertical' },
      // ── 基本信息 ──
      React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#888', marginBottom: 12, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 } }, '基本信息'),
      React.createElement(Row, { gutter: 16 },
        React.createElement(Col, { span: 16 },
          React.createElement(Form.Item, { name: 'title', label: '试卷名称', rules: [{ required: true, message: '请输入试卷名称' }] },
            React.createElement(Input, { placeholder: '如：八年级数学期中测试' })
          )
        ),
        React.createElement(Col, { span: 8 },
          React.createElement(Form.Item, { name: 'status', label: '状态', initialValue: 'DRAFT' },
            React.createElement(Select, { options: toSelectOptions(paperStatuses) })
          )
        )
      ),
      React.createElement(Row, { gutter: 16 },
        React.createElement(Col, { span: 8 },
          React.createElement(Form.Item, { name: 'subject', label: '学科', rules: [{ required: true, message: '请选择学科' }] },
            React.createElement(Select, { placeholder: '选择学科', options: subjectOptions })
          )
        ),
        React.createElement(Col, { span: 8 },
          React.createElement(Form.Item, { name: 'total_score', label: '总分', initialValue: 100 },
            React.createElement(InputNumber, { min: 1, max: 300, style: { width: '100%' } })
          )
        ),
        React.createElement(Col, { span: 8 },
          React.createElement(Form.Item, { name: 'duration_minutes', label: '时长(分钟)', initialValue: 60 },
            React.createElement(InputNumber, { min: 1, max: 300, style: { width: '100%' } })
          )
        )
      ),

      // ── 年级范围 ──
      React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#888', marginTop: 8, marginBottom: 12, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 } }, '年级范围'),
      React.createElement(Row, { gutter: 16 },
        React.createElement(Col, { span: 8 },
          React.createElement(Form.Item, { name: 'grade_scope', label: '适用范围', initialValue: 'grade' },
            React.createElement(Select, { options: [
              { value: 'comprehensive', label: '综合 (跨年级)' },
              { value: 'grade_comprehensive', label: '年级综合' },
              { value: 'chapter', label: '章节' },
              { value: 'knowledge_point', label: '知识点' },
            ], onChange: function(v) { setGradeScope(v); } })
          )
        ),
        React.createElement(Col, { span: 8 },
          React.createElement(Form.Item, { name: 'grade_level', label: '年级',
            rules: [{ required: true, message: '请选择年级' }] },
            React.createElement(Select, {
              mode: gradeScope === 'comprehensive' ? 'multiple' : undefined,
              placeholder: '选择年级',
              options: toSelectOptions(grades) })
          )
        ),
        (gradeScope === 'chapter' || gradeScope === 'knowledge_point') ? React.createElement(Col, { span: 8 },
          React.createElement(Form.Item, { name: 'chapter', label: '章节名称',
            rules: [{ required: true, message: '请输入章节名称' }] },
            React.createElement(Input, { placeholder: '如：二次函数' })
          )
        ) : null
      ),
      gradeScope === 'knowledge_point' ? React.createElement(Row, { gutter: 16 },
        React.createElement(Col, { span: 16 },
          React.createElement(Form.Item, { name: 'knowledge_points_input', label: '知识点',
            rules: [{ required: true, message: '请输入知识点' }] },
            React.createElement(Input, { placeholder: '如：顶点式, 判别式, 图像平移' })
          ),
          React.createElement('div', { style: { color: '#888', fontSize: 11, marginTop: -16 } },
            '多个知识点用逗号分隔'
          )
        )
      ) : null,

      // ── 描述 ──
      React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: '#888', marginTop: 8, marginBottom: 12, borderBottom: '1px solid #f0f0f0', paddingBottom: 8 } }, '描述信息'),
      React.createElement(Row, { gutter: 16 },
        React.createElement(Col, { span: 12 },
          React.createElement(Form.Item, { name: 'subtitle', label: '副标题' },
            React.createElement(Input, { placeholder: '如：满分100分，考试时间60分钟' })
          )
        ),
        React.createElement(Col, { span: 12 },
          React.createElement(Form.Item, { name: 'description', label: '试卷描述' },
            React.createElement(Input, { placeholder: '简要描述试卷内容和范围' })
          )
        )
      ),
      React.createElement(Form.Item, { name: 'notes', label: '注意事项' },
        React.createElement(Input.TextArea, { rows: 2, placeholder: '考生注意事项，如：请使用2B铅笔填涂答题卡' })
      )
    );
  } else if (step === 1) {
    footerButtons = React.createElement(Space, null,
      React.createElement(Button, { onClick: function () { setStep(0); } }, '上一步'),
      React.createElement(Button, { type: 'primary', onClick: function () { handleSubmit(); }, loading: loading }, '自动选题组卷'),
      React.createElement(Button, { onClick: goManualSelect }, '手动选题组卷')
    );
    stepContent = React.createElement('div', null,
      statsRow,
      React.createElement('div', { style: { marginTop: 24, marginBottom: 12, fontWeight: 'bold', fontSize: 14 } }, '题型分布'),
      React.createElement(Row, { gutter: 16 }, ...typeCards),
      React.createElement('div', { style: { marginTop: 24, marginBottom: 12, fontWeight: 'bold', fontSize: 14 } }, '难度比例'),
      React.createElement(Row, { gutter: 16 }, ...diffSliders),
      React.createElement(Row, { style: { marginTop: 8 } }, ...diffSummary)
    );
  } else if (step === 2) {
    footerButtons = React.createElement(Space, null,
      React.createElement(Button, { onClick: function () { setStep(1); } }, '上一步'),
      React.createElement(Button, { type: 'primary', onClick: function () {
        var selected = availQuestions.filter(function (q) { return selectedIds.indexOf(q.id) >= 0; });
        if (selected.length === 0) { message.warning('请至少选择一道试题'); return; }
        goToPreview(selected);
      } }, '预览确认')
    );
    var typeOrder = ['FILL_BLANK', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SUBJECTIVE'];
    var selectedQs = availQuestions.filter(function (q) { return selectedIds.indexOf(q.id) >= 0; });
    var totalScore = savedFormValues.total_score || 100;
    var totalRequired = 0;
    Object.keys(dist).forEach(function (k) { totalRequired += dist[k] || 0; });

    // LEFT: status panel
    var leftCards = typeOrder.map(function (t) {
      var req = dist[t] || 0;
      if (req <= 0) return null;
      var sel = selectedQs.filter(function (q) { return q.question_type === t; }).length;
      return React.createElement('div', { key: t, style: { display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 } },
        React.createElement('span', null, toLabelMap(qtypes)[t]),
        React.createElement('span', { style: { color: sel >= req ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' } }, sel + '/' + req)
      );
    }).filter(Boolean);

    var leftPanel = React.createElement('div', { style: { width: '28%', paddingRight: 12, borderRight: '1px solid #f0f0f0' } },
      React.createElement('div', { style: { fontWeight: 'bold', fontSize: 14, marginBottom: 12 } }, '选题状态'),
      React.createElement('div', { style: { marginBottom: 8, fontSize: 13 } }, '已选: ' + selectedQs.length + '/' + totalRequired + ' 道'),
      React.createElement('div', { style: { marginBottom: 8, fontSize: 13 } }, '得分: ' + selectedQs.reduce(function (s,q) { return s+(q.score||0); }, 0) + '/' + totalScore),
      React.createElement('hr', null),
      ...leftCards
    );

    // RIGHT: question browser by type (split into selected top / unselected bottom)
    var rightPanels = typeOrder.map(function (qtype) {
      var required = dist[qtype] || 0;
      if (required <= 0) return null;
      var typeQs = availQuestions.filter(function (q) { return q.question_type === qtype; });
      // Split into selected and unselected
      var selectedOfType = typeQs.filter(function (q) { return selectedIds.indexOf(q.id) >= 0; });
      var unselectedOfType = typeQs.filter(function (q) { return selectedIds.indexOf(q.id) < 0; });
      // Apply diff filter only to unselected
      var typeDiffFilter = diffFilterMap[qtype] || '';
      var filteredUnselected = typeDiffFilter ? unselectedOfType.filter(function (q) { return q.difficulty === typeDiffFilter; }) : unselectedOfType;
      var selCount = selectedOfType.length;

      // Helper: render a question row
      function renderQRow(q, isSelected) {
        var diffColor = q.difficulty === 'EASY' ? 'green' : q.difficulty === 'MEDIUM' ? 'orange' : 'red';
        var diffLabel = q.difficulty === 'EASY' ? '简' : q.difficulty === 'MEDIUM' ? '中' : '难';
        return React.createElement('div', { key: q.id, onClick: function () {
          if (isSelected) {
            // Remove from selection
            setSelectedIds(selectedIds.filter(function (id) { return id !== q.id; }));
          } else {
            // Add to selection (check limits)
            var currentSelected = selectedIds.filter(function (id) { return id !== q.id; });
            var typeSel = currentSelected.filter(function (id) {
              var fq = availQuestions.filter(function (x) { return x.id === id; })[0];
              return fq && fq.question_type === qtype;
            }).length;
            if (typeSel >= required) {
              message.warning(toLabelMap(qtypes)[qtype] + '已达到' + required + '道上限');
              return;
            }
            setSelectedIds(selectedIds.concat([q.id]));
          }
        }, style: { padding: '4px 8px', cursor: 'pointer', background: isSelected ? '#e6f7ff' : '#fff', borderBottom: '1px solid #f0f0f0', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('span', { style: { flex: 1 } },
            (q.title || '').substring(0, 60) + (isSelected ? '' : ''),
            isSelected ? null : React.createElement(Tag, { color: diffColor, style: { marginLeft: 4, fontSize: 10 } }, diffLabel)
          ),
          isSelected ? React.createElement('span', { style: { color: '#ff4d4f', fontSize: 11, cursor: 'pointer' } }, '移除') : null,
          isSelected ? null : React.createElement(Tag, { color: 'blue', style: { marginLeft: 4, fontSize: 10, cursor: 'pointer' } }, '添加')
        );
      }

      // TOP section: selected questions
      var topSection = React.createElement('div', { style: { marginBottom: 4 } },
        React.createElement('div', { style: { fontSize: 12, color: '#1890ff', fontWeight: 'bold', marginBottom: 4 } },
          '已选 ' + selCount + '/' + required + ' 道（点击移除）'
        ),
        selectedOfType.length > 0
          ? React.createElement('div', { style: { maxHeight: 100, overflow: 'auto' } },
              ...selectedOfType.map(function (q) { return renderQRow(q, true); })
            )
          : React.createElement('div', { style: { padding: 8, textAlign: 'center', color: '#ccc', fontSize: 12 } }, '暂无已选题，从下方选择添加')
      );

      // BOTTOM section: filter + unselected questions
      var bottomSection = React.createElement('div', null,
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 } },
          React.createElement('div', { style: { fontSize: 12, color: '#666', fontWeight: 'bold' } }, '可选题目（点击添加）'),
          React.createElement(Select, { placeholder: '难度筛选', allowClear: true, value: (diffFilterMap[qtype] || '') || undefined,
            onChange: function (v) { var nd = {}; Object.keys(diffFilterMap).forEach(function (k) { nd[k] = diffFilterMap[k]; }); nd[qtype] = v || ''; setDiffFilterMap(nd); },
            size: 'small', style: { width: 100 },
            options: toSelectOptions(difficultyLevels) })
        ),
        filteredUnselected.length > 0
          ? React.createElement('div', { style: { maxHeight: 140, overflow: 'auto' } },
              ...filteredUnselected.map(function (q) { return renderQRow(q, false); })
            )
          : React.createElement('div', { style: { padding: 8, textAlign: 'center', color: '#ccc', fontSize: 12 } }, '无匹配题目')
      );

      return React.createElement(Card, { key: qtype, size: 'small', style: { marginBottom: 8 },
        title: React.createElement('span', { style: { fontSize: 13 } }, toLabelMap(qtypes)[qtype])
      },
        topSection,
        React.createElement('hr', { style: { margin: '8px 0' } }),
        bottomSection
      );
    }).filter(function (p) { return p !== null; });

    var rightPanel = React.createElement('div', { style: { width: '72%', paddingLeft: 12, maxHeight: '55vh', overflow: 'auto' } }, ...rightPanels);

    stepContent = React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start' } }, leftPanel, rightPanel);
  } else {
    footerButtons = React.createElement(Space, null,
      React.createElement(Button, { onClick: function () { setStep(2); } }, '上一步'),
      React.createElement(Button, { type: 'primary', loading: loading, onClick: handleManualCreate }, '确认生成试卷')
    );
    stepContent = React.createElement('div', null,
      React.createElement('div', { style: { marginBottom: 12, color: '#666' } }, '预览试卷结构，共 ' + previewQuestions.length + ' 道试题，可点击替换按钮更换试题'),
      React.createElement(PaperTemplatePreview, {
        title: savedFormValues.title || '试卷预览',
        subtitle: savedFormValues.subtitle || '',
        notes: savedFormValues.notes || '',
        questions: previewQuestions,
        readonly: false,
        onReplace: function (q, qtype) {
          var newIds = previewQuestions.filter(function (x) { return x.id !== q.id; }).map(function (x) { return x.id; });
          setSelectedIds(newIds);
          setPreviewQuestions(previewQuestions.filter(function (x) { return x.id !== q.id; }));
          setStep(2);
          message.info('请选择替换试题');
        }
      })
    );
  }

  return React.createElement(Modal, {
    title: isEdit ? '编辑试卷' : '新建试卷',
    open: open, onCancel: handleCancel, width: 900, footer: footerButtons
  },
    React.createElement(Steps, { current: step, style: { marginBottom: 24 }, items: [{ title: '基本信息' }, { title: '选题方式' }, { title: '选择试题' }, { title: '预览确认' }] }),
    stepContent
  );
}
