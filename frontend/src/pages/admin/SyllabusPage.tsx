import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Form, Input, Row, Col, Tag, Space, message, Typography, Tree } from 'antd';
import { BookOutlined, ReloadOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';

var Title = Typography.Title;

export default function SyllabusPage() {
  var syllabiState = useState([]); var syllabi = syllabiState[0]; var setSyllabi = syllabiState[1];
  var knowledgeTreeState = useState(null); var knowledgeTree = knowledgeTreeState[0]; var setKnowledgeTree = knowledgeTreeState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var subjectOptionsState = useState([]); var subjectOptions = subjectOptionsState[0]; var setSubjectOptions = subjectOptionsState[1];
  var selectedModelState = useState(''); var selectedModel = selectedModelState[0]; var setSelectedModel = selectedModelState[1];

  useEffect(function () {
    loadSyllabi();
    loadModel();
    apiClient.get('/subjects/my').then(function (r) {
      setSubjectOptions((r.data || []).map(function (s) { return { value: s, label: s }; }));
    }).catch(function () {});
  }, []);

  var loadSyllabi = async function () {
    try { var r = await apiClient.get('/question-admin/syllabi'); setSyllabi(r.data); } catch (e) {}
  };
  var loadModel = async function () {
    try {
      var r = await apiClient.get('/admin/llm/config');
      var models = r.data.available_models || [];
      setSelectedModel(r.data.model || '');
    } catch (e) {}
  };

  var handleCreateSyllabus = async function (values) {
    try {
      await apiClient.post('/question-admin/syllabi', null, { params: values });
      message.success('考纲创建成功');
      loadSyllabi();
    } catch (e) { message.error('创建失败'); }
  };

  var handleExtractKnowledge = async function (syllabusId) {
    setLoading(true);
    try {
      var r = await apiClient.post('/question-admin/syllabi/' + syllabusId + '/extract-knowledge',
        null, { params: { model_config_id: selectedModel } });
      setKnowledgeTree(r.data.knowledge_tree);
      message.success('知识点提取完成');
      loadSyllabi();
    } catch (e) { message.error('提取失败'); }
    setLoading(false);
  };

  var renderTree = function (nodes) {
    if (!nodes || !Array.isArray(nodes)) return null;
    return nodes.map(function (n) {
      return {
        title: React.createElement('span', null, n.label || n.name || n.id,
          n.status ? React.createElement(Tag, { color: n.status === 'INACTIVE' ? 'red' : 'green', style: { marginLeft: 8, fontSize: 10 } }, n.status) : null
        ),
        key: n.id,
        children: n.children ? renderTree(n.children) : undefined,
      };
    });
  };

  return React.createElement('div', null,
    React.createElement(Title, { level: 4, style: { marginBottom: 16 } },
      React.createElement(BookOutlined, { style: { marginRight: 8 } }), '考纲管理'
    ),
    React.createElement(Row, { gutter: 16 },
      React.createElement(Col, { span: 12 },
        React.createElement(Card, { title: '新建考纲', size: 'small', style: { marginBottom: 16 } },
          React.createElement(Form, { onFinish: handleCreateSyllabus, layout: 'inline' },
            React.createElement(Form.Item, { name: 'title', label: '标题', rules: [{ required: true }] },
              React.createElement(Input, { placeholder: '如: 八年级数学(上海)' })
            ),
            React.createElement(Form.Item, { name: 'grade_level', label: '年级' },
              React.createElement(Input, { placeholder: '八年级' })
            ),
            React.createElement(Form.Item, { name: 'province', label: '省份' },
              React.createElement(Input, { placeholder: '上海' })
            ),
            React.createElement(Form.Item, { name: 'subject', label: '学科' },
              React.createElement(Input, { placeholder: '数学' })
            ),
            React.createElement(Form.Item, null,
              React.createElement(Button, { type: 'primary', htmlType: 'submit' }, '创建考纲')
            )
          )
        ),
        React.createElement(Card, { title: '考纲列表', size: 'small' },
          React.createElement(Table, {
            rowKey: 'id', dataSource: syllabi, pagination: false, size: 'small',
            columns: [
              { title: '标题', dataIndex: 'title', ellipsis: true },
              { title: '年级', dataIndex: 'grade_level', width: 80 },
              { title: '省份', dataIndex: 'province', width: 80 },
              { title: '状态', dataIndex: 'status', width: 80, render: function (s) { return React.createElement(Tag, null, s); } },
              { title: '操作', width: 120, render: function (_, r) {
                return React.createElement(Button, { size: 'small', onClick: function () { handleExtractKnowledge(r.id); }, loading: loading, icon: React.createElement(ReloadOutlined) }, '提取知识点');
              }},
            ]
          })
        )
      ),
      React.createElement(Col, { span: 12 },
        React.createElement(Card, { title: '知识树', size: 'small', style: { minHeight: 400 } },
          knowledgeTree
            ? React.createElement(Tree, { treeData: renderTree(knowledgeTree), defaultExpandAll: true })
            : React.createElement('div', { style: { textAlign: 'center', color: '#999', padding: 40 } }, '创建考纲后点击"提取知识点"生成知识树')
        )
      )
    )
  );
}
