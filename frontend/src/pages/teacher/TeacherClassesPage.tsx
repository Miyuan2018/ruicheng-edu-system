import React, { useEffect, useState, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Tag, message, Popconfirm, Typography, Card, Row, Col, Tabs, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined, UserAddOutlined, EditOutlined, SearchOutlined, TeamOutlined, UserOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';

var Title = Typography.Title;

export default function TeacherClassesPage() {
  var classesState = useState([]); var classes = classesState[0]; var setClasses = classesState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var searchState = useState(''); var search = searchState[0]; var setSearch = searchState[1];

  // Class modal
  var classModalState = useState(false); var classModalOpen = classModalState[0]; var setClassModalOpen = classModalState[1];
  var editingClassState = useState(null); var editingClass = editingClassState[0]; var setEditingClass = editingClassState[1];
  var classSavingState = useState(false); var classSaving = classSavingState[0]; var setClassSaving = classSavingState[1];
  var classForm = Form.useForm()[0];

  // Student modal
  var studentModalState = useState(false); var studentModalOpen = studentModalState[0]; var setStudentModalOpen = studentModalState[1];
  var selectedClassState = useState(null); var selectedClass = selectedClassState[0]; var setSelectedClass = selectedClassState[1];
  var studentsState = useState([]); var students = studentsState[0]; var setStudents = studentsState[1];
  var availStudentsState = useState([]); var availStudents = availStudentsState[0]; var setAvailStudents = availStudentsState[1];
  var availSearchState = useState(''); var availSearch = availSearchState[0]; var setAvailSearch = availSearchState[1];
  var studentTabState = useState('select'); var studentTab = studentTabState[0]; var setStudentTab = studentTabState[1];

  // Edit student modal
  var editStudentState = useState(false); var editStudentOpen = editStudentState[0]; var setEditStudentOpen = editStudentState[1];
  var editingStudentState = useState(null); var editingStudent = editingStudentState[0]; var setEditingStudent = editingStudentState[1];
  var studentForm = Form.useForm()[0];
  var studentSavingState = useState(false); var studentSaving = studentSavingState[0]; var setStudentSaving = studentSavingState[1];
  var manualForm = Form.useForm()[0];

  var loadClasses = useCallback(async function () {
    setLoading(true);
    try {
      var params = {};
      if (search) params.search = search;
      var resp = await apiClient.get('/classes', { params: params });
      setClasses(Array.isArray(resp.data) ? resp.data : []);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, [search]);

  useEffect(function () { loadClasses(); }, [loadClasses]);

  // ── Class CRUD ──
  function openCreateClass() { setEditingClass(null); classForm.resetFields(); setClassModalOpen(true); }
  function openEditClass(cls) { setEditingClass(cls); classForm.setFieldsValue(cls); setClassModalOpen(true); }

  async function handleClassSave() {
    var values = await classForm.validateFields();
    setClassSaving(true);
    try {
      if (editingClass) {
        await apiClient.put('/classes/' + editingClass.id, values);
        message.success('班级已更新');
      } else {
        await apiClient.post('/classes', values);
        message.success('班级创建成功');
      }
      setClassModalOpen(false);
      loadClasses();
    } catch (e) {
      var detail = '操作失败';
      if (e && e.response && e.response.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    }
    setClassSaving(false);
  }

  async function handleDeleteClass(id) {
    try { await apiClient.delete('/classes/' + id); message.success('已删除'); loadClasses(); }
    catch (e) { message.error('删除失败'); }
  }

  // ── Student Management ──
  async function openStudentModal(cls) {
    setSelectedClass(cls);
    setStudentTab('select');
    setAvailSearch('');
    try {
      var stuResp = await apiClient.get('/classes/' + cls.id + '/students');
      setStudents(Array.isArray(stuResp.data) ? stuResp.data : []);
      var availResp = await apiClient.get('/classes/' + cls.id + '/available-students');
      setAvailStudents(Array.isArray(availResp.data) ? availResp.data : []);
    } catch (e) { /* ignore */ }
    setStudentModalOpen(true);
  }

  async function loadStudents() {
    if (!selectedClass) return;
    try {
      var stuResp = await apiClient.get('/classes/' + selectedClass.id + '/students');
      setStudents(Array.isArray(stuResp.data) ? stuResp.data : []);
      var params = {};
      if (availSearch) params.search = availSearch;
      var availResp = await apiClient.get('/classes/' + selectedClass.id + '/available-students', { params: params });
      setAvailStudents(Array.isArray(availResp.data) ? availResp.data : []);
    } catch (e) { /* ignore */ }
  }

  async function addExistingStudent(studentId) {
    try {
      await apiClient.post('/classes/' + selectedClass.id + '/students', { student_id: studentId });
      message.success('学生已添加');
      loadStudents();
    } catch (e) {
      var detail = '添加失败';
      if (e && e.response && e.response.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    }
  }

  async function addManualStudent(values) {
    try {
      await apiClient.post('/classes/' + selectedClass.id + '/students', values);
      message.success('学生已添加');
      manualForm.resetFields();
      loadStudents();
    } catch (e) {
      var detail = '添加失败';
      if (e && e.response && e.response.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    }
  }

  async function removeStudent(studentId) {
    try {
      await apiClient.delete('/classes/' + selectedClass.id + '/students/' + studentId);
      message.success('已移除');
      loadStudents();
    } catch (e) { message.error('移除失败'); }
  }

  function openEditStudent(s) {
    setEditingStudent(s);
    studentForm.setFieldsValue(s);
    setEditStudentOpen(true);
  }

  async function handleSaveStudent() {
    var values = await studentForm.validateFields();
    setStudentSaving(true);
    try {
      await apiClient.put('/classes/' + selectedClass.id + '/students/' + editingStudent.id, values);
      message.success('学生信息已更新');
      setEditStudentOpen(false);
      loadStudents();
    } catch (e) {
      var detail = '保存失败';
      if (e && e.response && e.response.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    }
    setStudentSaving(false);
  }

  // ── Render ──
  return React.createElement('div', null,
    // Header
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 16 } },
      React.createElement(Title, { level: 4, style: { margin: 0 } }, React.createElement(TeamOutlined, { style: { marginRight: 8 } }), '班级管理'),
      React.createElement(Space, null,
        React.createElement(Input, { placeholder: '搜索班级名称', value: search, onChange: function (e) { setSearch(e.target.value); },
          style: { width: 200 }, prefix: React.createElement(SearchOutlined), allowClear: true,
          onPressEnter: loadClasses
        }),
        React.createElement(Button, { type: 'primary', icon: React.createElement(PlusOutlined), onClick: openCreateClass }, '新建班级')
      )
    ),

    // Class table
    React.createElement(Table, {
      rowKey: 'id', loading: loading, dataSource: classes, size: 'middle',
      columns: [
        { title: '班级名称', dataIndex: 'name', ellipsis: true },
        { title: '学科', dataIndex: 'subject', width: 80 },
        { title: '年级', dataIndex: 'grade_level', width: 80 },
        { title: '学生数', dataIndex: 'student_count', width: 80, align: 'center' },
        { title: '状态', dataIndex: 'is_active', width: 70, render: function (v) { return v ? React.createElement(Tag, { color: 'green' }, '启用') : React.createElement(Tag, null, '停用'); } },
        { title: '操作', width: 240, render: function (_, r) {
          return React.createElement(Space, null,
            React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(UserAddOutlined), onClick: function () { openStudentModal(r); } }, '学生'),
            React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(EditOutlined), onClick: function () { openEditClass(r); } }, '编辑'),
            React.createElement(Popconfirm, { title: '确定删除该班级？', onConfirm: function () { handleDeleteClass(r.id); } },
              React.createElement(Button, { type: 'link', size: 'small', danger: true, icon: React.createElement(DeleteOutlined) }, '删除')
            )
          );
        }}
      ]
    }),

    // ── Class Create/Edit Modal ──
    React.createElement(Modal, {
      title: editingClass ? '编辑班级' : '新建班级',
      open: classModalOpen,
      onOk: handleClassSave,
      onCancel: function () { setClassModalOpen(false); },
      confirmLoading: classSaving,
    },
      React.createElement(Form, { form: classForm, layout: 'vertical' },
        React.createElement(Form.Item, { name: 'name', label: '班级名称', rules: [{ required: true, message: '请输入班级名称' }] },
          React.createElement(Input, { placeholder: '如: 八年级数学提高班' })
        ),
        React.createElement(Row, { gutter: 16 },
          React.createElement(Col, { span: 12 },
            React.createElement(Form.Item, { name: 'subject', label: '学科', rules: [{ required: true }] },
              React.createElement(Select, { options: [{ value: '数学', label: '数学' }, { value: '语文', label: '语文' }, { value: '英语', label: '英语' }, { value: '物理', label: '物理' }, { value: '化学', label: '化学' }] })
            )
          ),
          React.createElement(Col, { span: 12 },
            React.createElement(Form.Item, { name: 'grade_level', label: '年级' },
              React.createElement(Select, { options: [{ value: '六年级', label: '六年级' }, { value: '七年级', label: '七年级' }, { value: '八年级', label: '八年级' }, { value: '九年级', label: '九年级' }] })
            )
          )
        ),
        React.createElement(Form.Item, { name: 'description', label: '描述' },
          React.createElement(Input.TextArea, { rows: 2, placeholder: '班级描述（选填）' })
        ),
        React.createElement(Form.Item, { name: 'is_active', label: '状态', initialValue: true, valuePropName: 'checked' },
          React.createElement(Select, { options: [{ value: true, label: '启用' }, { value: false, label: '停用' }] })
        )
      )
    ),

    // ── Student Management Modal ──
    React.createElement(Modal, {
      title: '管理学生 — ' + (selectedClass ? selectedClass.name : ''),
      open: studentModalOpen,
      onCancel: function () { setStudentModalOpen(false); },
      footer: null, width: 750,
    },
      // Currently enrolled students
      React.createElement(Card, { title: '班级学生（' + students.length + '人）', size: 'small', style: { marginBottom: 16 } },
        students.length === 0
          ? React.createElement(Empty, { description: '暂无学生', image: Empty.PRESENTED_IMAGE_SIMPLE })
          : React.createElement(Table, { rowKey: 'id', size: 'small', dataSource: students, pagination: false,
              columns: [
                { title: '姓名', dataIndex: 'full_name' },
                { title: '用户名', dataIndex: 'username' },
                { title: '手机号', dataIndex: 'phone', render: function (v) { return v || '-'; } },
                { title: '年级', dataIndex: 'grade' },
                { title: '操作', width: 120, render: function (_, s) {
                  return React.createElement(Space, null,
                    React.createElement(Button, { type: 'link', size: 'small', onClick: function () { openEditStudent(s); } }, '编辑'),
                    React.createElement(Popconfirm, { title: '从班级移除？', onConfirm: function () { removeStudent(s.id); } },
                      React.createElement(Button, { type: 'link', size: 'small', danger: true }, '移除')
                    )
                  );
                }}
              ]
            })
      ),

      // Add student
      React.createElement(Card, { title: '添加学生', size: 'small' },
        React.createElement(Tabs, { activeKey: studentTab, onChange: setStudentTab, size: 'small', items: [
          { key: 'select', label: '从学生库选择', children: React.createElement('div', null,
            React.createElement(Input, { placeholder: '搜索学生姓名', value: availSearch,
              onChange: function (e) { setAvailSearch(e.target.value); },
              onPressEnter: loadStudents, style: { marginBottom: 12, width: 250 },
              prefix: React.createElement(SearchOutlined), allowClear: true
            }),
            React.createElement(Table, { rowKey: 'id', size: 'small', dataSource: availStudents,
              pagination: { pageSize: 5 },
              columns: [
                { title: '姓名', dataIndex: 'full_name' },
                { title: '用户名', dataIndex: 'username' },
                { title: '年级', dataIndex: 'grade' },
                { title: '操作', width: 80, render: function (_, s) {
                  return React.createElement(Button, { type: 'primary', size: 'small', onClick: function () { addExistingStudent(s.id); } }, '添加');
                }}
              ]
            })
          )},
          { key: 'manual', label: '直接录入', children: React.createElement(Form, { form: manualForm, layout: 'inline', onFinish: addManualStudent },
            React.createElement(Form.Item, { name: 'full_name', label: '姓名', rules: [{ required: true }] },
              React.createElement(Input, { placeholder: '学生姓名', style: { width: 100 } })
            ),
            React.createElement(Form.Item, { name: 'phone', label: '手机号' },
              React.createElement(Input, { placeholder: '手机号', style: { width: 120 } })
            ),
            React.createElement(Form.Item, { name: 'grade', label: '年级' },
              React.createElement(Input, { placeholder: '年级', style: { width: 80 } })
            ),
            React.createElement(Form.Item, { name: 'school', label: '学校' },
              React.createElement(Input, { placeholder: '学校', style: { width: 120 } })
            ),
            React.createElement(Form.Item, null,
              React.createElement(Button, { type: 'primary', htmlType: 'submit' }, '添加')
            )
          )},
        ]})
      )
    ),

    // ── Edit Student Modal ──
    React.createElement(Modal, {
      title: '编辑学生 — ' + (editingStudent ? editingStudent.full_name : ''),
      open: editStudentOpen,
      onOk: handleSaveStudent,
      onCancel: function () { setEditStudentOpen(false); },
      confirmLoading: studentSaving,
    },
      React.createElement(Form, { form: studentForm, layout: 'vertical' },
        React.createElement(Form.Item, { name: 'full_name', label: '姓名', rules: [{ required: true }] },
          React.createElement(Input)
        ),
        React.createElement(Form.Item, { name: 'email', label: '邮箱' },
          React.createElement(Input)
        ),
        React.createElement(Row, { gutter: 16 },
          React.createElement(Col, { span: 12 },
            React.createElement(Form.Item, { name: 'grade', label: '年级' },
              React.createElement(Input)
            )
          ),
          React.createElement(Col, { span: 12 },
            React.createElement(Form.Item, { name: 'school', label: '学校' },
              React.createElement(Input)
            )
          )
        ),
        React.createElement(Form.Item, { label: '手机号' },
          React.createElement(Input, { value: editingStudent ? editingStudent.phone || '' : '', disabled: true, addonAfter: React.createElement(Tag, { color: 'orange', style: { margin: 0 } }, '不可修改') })
        )
      )
    )
  );
}
