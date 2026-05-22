import React, { useEffect, useState } from 'react';
import { Table, Button, Tag, Typography, Space, message, Card, Statistic, Row, Col, Empty, DatePicker, Select, Input, Modal, Form, Popconfirm, Descriptions, Divider, Upload } from 'antd';
import { SearchOutlined, ReloadOutlined, DeleteOutlined, CameraOutlined, EyeOutlined, PrinterOutlined, ThunderboltOutlined, ScanOutlined } from '@ant-design/icons';
import apiClient from '../../api/client';

var Title = Typography.Title;
var Text = Typography.Text;
var RangePicker = DatePicker.RangePicker;
var userId = localStorage.getItem('user_id') || '';

export default function MistakeBookPage() {
  var booksState = useState([]); var books = booksState[0]; var setBooks = booksState[1];
  var loadingState = useState(false); var loading = loadingState[0]; var setLoading = loadingState[1];
  var generatingState = useState(false); var generating = generatingState[0]; var setGenerating = generatingState[1];
  var quickEntryOpenState = useState(false); var quickEntryOpen = quickEntryOpenState[0]; var setQuickEntryOpen = quickEntryOpenState[1];
  var entrySavingState = useState(false); var entrySaving = entrySavingState[0]; var setEntrySaving = entrySavingState[1];
  var printLoadingState = useState(false); var printLoading = printLoadingState[0]; var setPrintLoading = printLoadingState[1];
  var previewOpenState = useState(false); var previewOpen = previewOpenState[0]; var setPreviewOpen = previewOpenState[1];
  var previewBookState = useState(null); var previewBook = previewBookState[0]; var setPreviewBook = previewBookState[1];
  var practiceLoadingState = useState({}); var practiceLoading = practiceLoadingState[0]; var setPracticeLoading = practiceLoadingState[1];

  // Filters
  var dateRangeState = useState(null); var dateRange = dateRangeState[0]; var setDateRange = dateRangeState[1];
  var filterSubjectState = useState(''); var filterSubject = filterSubjectState[0]; var setFilterSubject = filterSubjectState[1];
  var filterKeywordState = useState(''); var filterKeyword = filterKeywordState[0]; var setFilterKeyword = filterKeywordState[1];
  var quickEntryForm = Form.useForm()[0];

  useEffect(function () { loadBooks(); }, []);

  function loadBooks() {
    setLoading(true);
    var params = {};
    if (dateRange && dateRange[0]) params.date_from = dateRange[0].format('YYYY-MM-DD');
    if (dateRange && dateRange[1]) params.date_to = dateRange[1].format('YYYY-MM-DD');
    apiClient.get('/error-notebooks/student/' + userId, { params: params }).then(function (resp) {
      var data = resp.data || [];
      setBooks(Array.isArray(data) ? data : []);
    }).catch(function () { setBooks([]); })
    .finally(function () { setLoading(false); });
  }

  useEffect(function () { loadBooks(); }, [dateRange]);

  function generateMistakeBook() {
    setGenerating(true);
    apiClient.post('/error-notebooks/generate').then(function () {
      message.success('纸质错题练习本生成成功');
      setTimeout(loadBooks, 1500);
    }).catch(function () { message.error('生成失败'); })
    .finally(function () { setGenerating(false); });
  }

  function generatePractice(bookId) {
    var pl = {}; pl[bookId] = true; setPracticeLoading(Object.assign({}, practiceLoading, pl));
    apiClient.post('/error-notebooks/' + bookId + '/practice').then(function () {
      message.success('加强练习题已生成');
      loadBooks();
    }).catch(function (e) {
      if (e && e.response && e.response.status === 404) message.info('加强练习功能将在下一版本完善');
      else message.error('生成失败');
    }).finally(function () {
      var pl2 = {}; pl2[bookId] = false; setPracticeLoading(Object.assign({}, practiceLoading, pl2));
    });
  }

  async function handleDelete(id) {
    try { await apiClient.delete('/error-notebooks/' + id); message.success('已删除'); loadBooks(); }
    catch (e) { message.error('删除失败'); }
  }

  function handleExport(id, format) {
    var url = '/api/v1/error-notebooks/' + id + '/export/' + format;
    var token = localStorage.getItem('access_token');
    fetch(url, { headers: { Authorization: 'Bearer ' + token } }).then(function (r) {
      if (!r.ok) { message.error('导出失败'); return; }
      return r.blob();
    }).then(function (blob) {
      if (!blob) return;
      var u = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = u; a.download = 'mistake_book.' + (format === 'word' ? 'docx' : 'pdf'); a.click();
    }).catch(function () { message.error('导出失败'); });
  }

  function handlePreview(book) {
    setPreviewBook(book);
    apiClient.get('/error-notebooks/' + book.id).then(function (resp) {
      setPreviewBook(Object.assign({}, book, resp.data || {}));
    }).catch(function () {
      setPreviewBook(Object.assign({}, book, { questions: [] }));
    });
    setPreviewOpen(true);
  }

  function handlePrintPractice() {
    setPrintLoading(true);
    var incomplete = books.filter(function (b) { return b.status !== 'EXPORTED'; });
    if (incomplete.length === 0) { message.info('所有错题已全部完成，无需打印'); setPrintLoading(false); return; }
    var w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { message.info('请允许弹出窗口'); setPrintLoading(false); return; }
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>纸质错题练习本</title>';
    html += '<style>body{font-family:"Microsoft YaHei",SimSun,serif;font-size:14px;padding:30px;color:#333;line-height:1.6;}';
    html += 'h1{text-align:center;font-size:22px;margin-bottom:4px;}';
    html += '.meta{text-align:center;color:#999;font-size:12px;margin-bottom:20px;}';
    html += '.book{margin-bottom:30px;page-break-after:always;}';
    html += '.book h2{font-size:17px;border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:10px;}';
    html += '.book-info{color:#666;font-size:12px;margin-bottom:8px;}';
    html += '.mistake{border:1px solid #e8e8e8;border-radius:6px;padding:12px;margin-bottom:10px;}';
    html += '.mistake .q-title{font-weight:bold;margin-bottom:4px;}';
    html += '.mistake .wrong{color:#d4380d;margin:2px 0;}';
    html += '.mistake .right{color:#389e0d;margin:2px 0;}';
    html += '.mistake .practice{border-top:1px dashed #d9d9d9;margin-top:8px;padding-top:8px;color:#1677ff;}';
    html += '.practice .field{margin-bottom:6px;}';
    html += '.print-btn{position:fixed;top:15px;right:15px;padding:8px 16px;background:#1677ff;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;}';
    html += '@media print{.print-btn{display:none;}body{padding:10px;}.mistake{page-break-inside:avoid;}}</style></head><body>';
    html += '<button class="print-btn" onclick="window.print()">🖨 打印</button>';
    html += '<h1>纸质错题练习本</h1>';
    html += '<p class="meta">筛选未完成错题 · 共' + incomplete.length + '本 · 打印时间: ' + new Date().toLocaleDateString('zh-CN') + '</p>';

    incomplete.forEach(function (book) {
      html += '<div class="book">';
      html += '<h2>' + (book.title || '错题本') + '</h2>';
      html += '<p class="book-info">生成时间: ' + (book.generated_at || '').substring(0, 16) + ' | 错题数: ' + (book.question_count || 0) + ' | 来源: ' + (book.exam_paper_id ? '试卷' : '手动录入') + '</p>';

      if (book.questions && book.questions.length > 0) {
        book.questions.forEach(function (q, i) {
          html += '<div class="mistake">';
          html += '<div class="q-title">' + (i+1) + '. ' + (q.question_title || q.title || '题目') + '</div>';
          html += '<div class="wrong">✗ 错误答案: ' + (q.student_answer || '未作答') + '</div>';
          html += '<div class="right">✓ 正确答案: ' + (q.correct_answer || '') + '</div>';
          html += '<div class="practice">';
          html += '<div class="field"><strong>📝 原题信息:</strong></div>';
          html += '<div>' + (q.question_title || q.title || '题目') + '</div>';
          if (q.practice_question) {
            html += '<div class="field" style="margin-top:8px;"><strong>💪 加强训练题:</strong></div>';
            html += '<div>' + q.practice_question + '</div>';
          } else {
            html += '<div class="field" style="margin-top:8px;"><strong>💪 加强训练题:</strong></div>';
            html += '<div style="color:#999;">（点击"生成加强练习"按钮获取）</div>';
          }
          html += '<div style="margin-top:8px;border-bottom:1px dotted #ccc;padding-bottom:4px;">作答区: ________________________</div>';
          html += '</div>';
          html += '</div>';
        });
      } else {
        html += '<p style="color:#999;">暂无详细错题数据，请先通过预览查看或生成加强练习题</p>';
      }
      html += '</div>';
    });

    html += '</body></html>';
    w.document.write(html);
    w.document.close();
    setTimeout(function () { w.print(); }, 800);
    setPrintLoading(false);
  }

  async function handleQuickEntry(values) {
    setEntrySaving(true);
    try {
      var resp = await apiClient.post('/error-notebooks/manual-entry', values);
      if (resp.data && resp.data.ok) {
        message.success('错题已录入');
        setQuickEntryOpen(false);
        quickEntryForm.resetFields();
        loadBooks();
      }
    } catch (e) {
      var detail = '录入失败';
      if (e && e.response && e.response.data) detail = e.response.data.detail || JSON.stringify(e.response.data);
      message.error(detail);
    }
    setEntrySaving(false);
  }

  function handleScanEntry() {
    setQuickEntryOpen(false);
    message.info('请使用 Tab 页中的「拍照扫描」功能录入错题');
    // Navigate to scan tab - triggered by parent or menu
  }

  // Apply subject + keyword filters client-side
  var filteredBooks = books.filter(function (b) {
    if (filterSubject && (b.subject || '') !== filterSubject) return false;
    if (filterKeyword) {
      var kw = filterKeyword.toLowerCase();
      if ((b.title || '').toLowerCase().indexOf(kw) < 0 && (b.exam_paper_title || '').toLowerCase().indexOf(kw) < 0) return false;
    }
    return true;
  });

  return React.createElement('div', null,
    // Header
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 } },
      React.createElement(Title, { level: 4, style: { margin: 0 } }, '错题本'),
      React.createElement(Space, null,
        React.createElement(Button, { icon: React.createElement(CameraOutlined), type: 'default', onClick: function () { setQuickEntryOpen(true); quickEntryForm.resetFields(); } }, '快速录入'),
        React.createElement(Button, { type: 'primary', icon: React.createElement(PrinterOutlined), loading: generating, onClick: generateMistakeBook }, '生成纸质错题练习本')
      )
    ),

    // Stats cards
    React.createElement(Row, { gutter: 16, style: { marginBottom: 20 } },
      React.createElement(Col, { span: 6 }, React.createElement(Card, { size: 'small' }, React.createElement(Statistic, { title: '错题本数量', value: books.length, valueStyle: { fontSize: 24 } }))),
      React.createElement(Col, { span: 6 }, React.createElement(Card, { size: 'small' }, React.createElement(Statistic, { title: '总错题数', value: books.reduce(function (s, b) { return s + (b.question_count || 0); }, 0), valueStyle: { fontSize: 24 } }))),
      React.createElement(Col, { span: 6 }, React.createElement(Card, { size: 'small' }, React.createElement(Statistic, { title: '已完成', value: books.filter(function (b) { return b.status === 'EXPORTED'; }).length, valueStyle: { fontSize: 24, color: '#52c41a' } }))),
      React.createElement(Col, { span: 6 }, React.createElement(Card, { size: 'small' }, React.createElement(Statistic, { title: '待完成', value: books.filter(function (b) { return b.status !== 'EXPORTED'; }).length, valueStyle: { fontSize: 24, color: '#faad14' } })))
    ),

    // 纸质错题练习本
    React.createElement(Card, { title: React.createElement(Space, null, React.createElement(PrinterOutlined, null), '纸质错题练习本'), size: 'small', style: { marginBottom: 16 },
      extra: React.createElement(Button, { icon: React.createElement(PrinterOutlined), onClick: handlePrintPractice, loading: printLoading, type: 'primary', ghost: true }, '筛选并打印')
    },
      React.createElement(Row, { justify: 'space-between', align: 'middle' },
        React.createElement(Col, null,
          React.createElement(Text, { type: 'secondary' }, '自动筛选未完成的错题，打印「原错题信息 + 错题加强训练题」。打印前请先为各错题本生成加强练习题。')
        ),
        React.createElement(Col, null,
          React.createElement(Text, { type: 'secondary', style: { fontSize: 12 } },
            '未完成: ' + books.filter(function (b) { return b.status !== 'EXPORTED'; }).length + ' 本 | ' +
            '总错题: ' + books.filter(function (b) { return b.status !== 'EXPORTED'; }).reduce(function (s, b) { return s + (b.question_count || 0); }, 0) + ' 题'
          )
        )
      )
    ),

    // Filter bar
    React.createElement(Card, { size: 'small', style: { marginBottom: 16 } },
      React.createElement(Row, { gutter: 12, align: 'middle' },
        React.createElement(Col, null, React.createElement(Text, { strong: true }, '筛选:')),
        React.createElement(Col, null, React.createElement(RangePicker, { value: dateRange, onChange: setDateRange, size: 'small', placeholder: ['开始日期', '结束日期'], style: { width: 220 } })),
        React.createElement(Col, null, React.createElement(Select, { placeholder: '学科', value: filterSubject || undefined, onChange: function (v) { setFilterSubject(v || ''); },
          allowClear: true, style: { width: 90 }, size: 'small',
          options: [{ value: '数学', label: '数学' }, { value: '语文', label: '语文' }, { value: '英语', label: '英语' }, { value: '物理', label: '物理' }, { value: '化学', label: '化学' }]
        })),
        React.createElement(Col, { flex: 1 },
          React.createElement(Input, { placeholder: '搜索错题本名称或试卷名', value: filterKeyword, onChange: function (e) { setFilterKeyword(e.target.value); },
            allowClear: true, size: 'small', prefix: React.createElement(SearchOutlined)
          })
        )
      )
    ),

    // Table
    filteredBooks.length === 0 && !loading
      ? React.createElement(Empty, { description: '暂无错题本，提交试卷作答或使用"快速录入"添加错题', image: Empty.PRESENTED_IMAGE_SIMPLE, style: { padding: 40 } })
      : React.createElement(Table, { rowKey: 'id', loading: loading, dataSource: filteredBooks, size: 'middle',
          pagination: { pageSize: 15, showSizeChanger: false, showTotal: function (t) { return '共 ' + t + ' 个错题本'; } },
          columns: [
            { title: '错题出处', dataIndex: 'title', ellipsis: true, width: 220,
              render: function (t, r) {
                return React.createElement(Space, { direction: 'vertical', size: 0 },
                  React.createElement(Text, { strong: true }, (t || '未命名错题本').substring(0, 35)),
                  React.createElement(Space, { size: 4, style: { marginTop: 2 } },
                    r.exam_paper_id
                      ? React.createElement(Tag, { color: 'blue', style: { fontSize: 11 } }, '试卷')
                      : React.createElement(Tag, { color: 'orange', style: { fontSize: 11 } }, '作业/手动'),
                    React.createElement(Text, { type: 'secondary', style: { fontSize: 11 } }, (r.generated_at || '').substring(0, 16))
                  )
                );
              }
            },
            { title: '错题数', dataIndex: 'question_count', width: 70, align: 'center' },
            { title: '学科', dataIndex: 'subject', width: 60, render: function (v) { return v || '数学'; } },
            { title: '状态', dataIndex: 'status', width: 80,
              render: function (s) {
                var map = { DRAFT: { color: 'default', label: '生成中' }, GENERATED: { color: 'green', label: '已完成' }, EXPORTED: { color: 'blue', label: '已导出' } };
                return React.createElement(Tag, { color: (map[s] || {}).color }, (map[s] || {}).label || s);
              }
            },
            { title: '操作', width: 290,
              render: function (_, r) {
                return React.createElement(Space, { size: 2 },
                  React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(EyeOutlined), onClick: function () { handlePreview(r); } }, '预览'),
                  React.createElement(Button, { type: 'link', size: 'small', icon: React.createElement(ThunderboltOutlined), loading: practiceLoading[r.id],
                    onClick: function () { generatePractice(r.id); } }, '加强练习'),
                  React.createElement(Popconfirm, { title: '确定删除此错题本？', description: '删除后不可恢复', onConfirm: function () { handleDelete(r.id); },
                    okButtonProps: { danger: true } },
                    React.createElement(Button, { type: 'link', size: 'small', danger: true, icon: React.createElement(DeleteOutlined) }, '删除')
                  )
                );
              }
            },
          ]
        }),

    // Preview Modal
    React.createElement(Modal, { title: React.createElement(Space, null, React.createElement(EyeOutlined, null), '错题预览 — ' + (previewBook ? (previewBook.title || '').substring(0, 30) : '')), open: previewOpen,
      onCancel: function () { setPreviewOpen(false); setPreviewBook(null); }, width: 700, footer: React.createElement(Button, { onClick: function () { setPreviewOpen(false); } }, '关闭')
    },
      previewBook ? React.createElement('div', null,
        React.createElement(Descriptions, { column: 2, size: 'small', bordered: true, style: { marginBottom: 16 } },
          React.createElement(Descriptions.Item, { label: '名称' }, previewBook.title || '未命名'),
          React.createElement(Descriptions.Item, { label: '错题数' }, previewBook.question_count || 0),
          React.createElement(Descriptions.Item, { label: '来源' }, previewBook.exam_paper_id ? '试卷' : '手动录入'),
          React.createElement(Descriptions.Item, { label: '状态' }, previewBook.status === 'EXPORTED' ? '已导出' : previewBook.status === 'GENERATED' ? '已完成' : '生成中'),
          React.createElement(Descriptions.Item, { label: '生成时间', span: 2 }, (previewBook.generated_at || '').substring(0, 16) || '-')
        ),
        previewBook.questions && previewBook.questions.length > 0
          ? React.createElement('div', null,
              React.createElement(Text, { strong: true, style: { marginBottom: 8, display: 'block' } }, '错题列表（共' + previewBook.questions.length + '题）'),
              ...previewBook.questions.map(function (q, i) {
                return React.createElement(Card, { key: i, size: 'small', style: { marginBottom: 8 }, type: 'inner',
                  title: React.createElement(Text, { strong: true }, (i+1) + '. ' + (q.question_title || q.title || '题目' || '').substring(0, 60))
                },
                  React.createElement(Descriptions, { column: 1, size: 'small' },
                    React.createElement(Descriptions.Item, { label: '你的答案' },
                      React.createElement(Text, { type: 'danger' }, q.student_answer || '未作答')
                    ),
                    React.createElement(Descriptions.Item, { label: '正确答案' },
                      React.createElement(Text, { type: 'success' }, q.correct_answer || '-')
                    ),
                    q.practice_question ? React.createElement(Descriptions.Item, { label: '加强训练' },
                      React.createElement(Text, { type: 'secondary' }, q.practice_question.substring(0, 200))
                    ) : null
                  )
                );
              })
            )
          : React.createElement(Empty, { description: '暂无详细错题数据，请点击"加强练习"按钮生成', image: Empty.PRESENTED_IMAGE_SIMPLE })
      ) : null
    ),

    // Quick entry modal
    React.createElement(Modal, { title: React.createElement(Space, null, React.createElement(ScanOutlined, null), '快速录入错题'), open: quickEntryOpen,
      onCancel: function () { setQuickEntryOpen(false); },
      footer: React.createElement(Space, null,
        React.createElement(Button, { icon: React.createElement(CameraOutlined), onClick: handleScanEntry }, '拍照录入'),
        React.createElement(Button, { type: 'primary', loading: entrySaving, onClick: function () { quickEntryForm.submit(); } }, '保存错题')
      )
    },
      React.createElement('div', { style: { marginBottom: 16 } },
        React.createElement(Upload, { accept: 'image/*', showUploadList: false, beforeUpload: function () { message.info('拍照功能将在下一版本开放'); return false; } },
          React.createElement(Button, { icon: React.createElement(CameraOutlined), block: true, style: { marginBottom: 12 } }, '拍照/扫描识别题目（即将开放）')
        )
      ),
      React.createElement(Divider, { plain: true }, React.createElement(Text, { type: 'secondary' }, '或手动输入')),
      React.createElement(Form, { form: quickEntryForm, layout: 'vertical', onFinish: handleQuickEntry },
        React.createElement(Form.Item, { name: 'question_title', label: '题目内容', rules: [{ required: true, message: '请输入题目内容' }] },
          React.createElement(Input.TextArea, { rows: 3, placeholder: '请输入错题内容（可从拍照识别结果粘贴）' })
        ),
        React.createElement(Row, { gutter: 16 },
          React.createElement(Col, { span: 8 },
            React.createElement(Form.Item, { name: 'subject', label: '学科', initialValue: '数学' },
              React.createElement(Select, { options: [{ value: '数学', label: '数学' }, { value: '语文', label: '语文' }, { value: '英语', label: '英语' }, { value: '物理', label: '物理' }, { value: '化学', label: '化学' }] })
            )
          ),
          React.createElement(Col, { span: 8 },
            React.createElement(Form.Item, { name: 'question_type', label: '题型', initialValue: 'FILL_BLANK' },
              React.createElement(Select, { options: [{ value: 'SINGLE_CHOICE', label: '单选题' }, { value: 'MULTIPLE_CHOICE', label: '多选题' }, { value: 'FILL_BLANK', label: '填空题' }, { value: 'SUBJECTIVE', label: '解答题' }] })
            )
          ),
          React.createElement(Col, { span: 8 },
            React.createElement(Form.Item, { name: 'error_type', label: '错误类型', initialValue: '概念错误' },
              React.createElement(Select, { options: [{ value: '概念错误', label: '概念错误' }, { value: '记忆错误', label: '记忆错误' }, { value: '理解偏差', label: '理解偏差' }, { value: '计算错误', label: '计算错误' }, { value: '未作答', label: '未作答' }] })
            )
          )
        ),
        React.createElement(Row, { gutter: 16 },
          React.createElement(Col, { span: 12 },
            React.createElement(Form.Item, { name: 'student_answer', label: '错误答案' },
              React.createElement(Input, { placeholder: '学生填写的错误答案' })
            )
          ),
          React.createElement(Col, { span: 12 },
            React.createElement(Form.Item, { name: 'correct_answer', label: '正确答案' },
              React.createElement(Input, { placeholder: '题目正确答案' })
            )
          )
        )
      )
    )
  );
}
