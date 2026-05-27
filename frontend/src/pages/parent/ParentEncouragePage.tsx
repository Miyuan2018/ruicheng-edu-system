import React, { useEffect, useState } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  Button,
  Form,
  Input,
  Tag,
  List,
  Typography,
  message,
  Space,
  Tabs,
} from 'antd';
import {
  HeartOutlined,
  SendOutlined,
  SmileOutlined,
} from '@ant-design/icons';
import useParentStore from '../../store/useParentStore';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

type AnyObj = Record<string, any>;

const CATEGORY_OPTIONS = [
  { label: '全部', value: '' },
  { label: '努力', value: '努力' },
  { label: '进步', value: '进步' },
  { label: '坚持', value: '坚持' },
  { label: '完成', value: '完成' },
  { label: '通用', value: '通用' },
];

const TYPE_TAG_COLOR: Record<string, string> = {
  努力: 'blue',
  进步: 'green',
  坚持: 'orange',
  完成: 'purple',
  通用: 'default',
};

const ParentEncouragePage: React.FC = () => {
  const [form] = Form.useForm();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [sending, setSending] = useState<boolean>(false);

  const {
    linkedStudents,
    selectedStudentId,
    templates,
    encouragements,
    fetchLinkedStudents,
    fetchTemplates,
    fetchSentEncouragements,
    selectStudent,
    sendEncouragement,
  } = useParentStore();

  // On mount: fetch linked students, templates, and sent encouragements
  useEffect(() => {
    const init = async () => {
      await fetchLinkedStudents();
      await fetchTemplates();
    };
    init();
  }, [fetchLinkedStudents, fetchTemplates]);

  // Auto-select first student when linkedStudents loads
  useEffect(() => {
    if (linkedStudents && linkedStudents.length > 0 && !selectedStudentId) {
      const firstStudent = linkedStudents[0];
      const studentId = firstStudent.student_id || firstStudent.id;
      selectStudent(studentId);
    }
  }, [linkedStudents, selectedStudentId, selectStudent]);

  // When student changes, refetch sent encouragements
  useEffect(() => {
    if (selectedStudentId) {
      fetchSentEncouragements(selectedStudentId);
    }
  }, [selectedStudentId, fetchSentEncouragements]);

  // Refetch templates when category changes
  useEffect(() => {
    fetchTemplates(selectedCategory || undefined);
  }, [selectedCategory, fetchTemplates]);

  const handleStudentChange = (value: string) => {
    selectStudent(value);
  };

  const handleUseTemplate = (template: AnyObj) => {
    setSelectedTemplateId(template.id);
    form.setFieldsValue({
      title: template.title || '',
      message: template.message || template.content || '',
    });
  };

  const handleSend = async (values: AnyObj) => {
    if (!selectedStudentId) {
      message.warning('请先选择一个学生');
      return;
    }

    setSending(true);
    try {
      await sendEncouragement({
        student_id: selectedStudentId,
        encouragement_type: values.encouragement_type || '通用',
        title: values.title || undefined,
        message: values.message,
        template_id: selectedTemplateId || undefined,
      });
      message.success('鼓励消息已发送');
      form.resetFields();
      setSelectedTemplateId(null);
      if (selectedStudentId) {
        await fetchSentEncouragements(selectedStudentId);
      }
    } catch {
      message.error('发送失败，请稍后重试');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timeStr: string): string => {
    if (!timeStr) return '';
    try {
      const d = new Date(timeStr);
      return d.toLocaleString('zh-CN');
    } catch {
      return timeStr;
    }
  };

  const filteredTemplates = selectedCategory
    ? templates.filter((t: AnyObj) => t.category === selectedCategory)
    : templates;

  const renderSendTab = () => (
    <Row gutter={24}>
      {/* Left: Template browser */}
      <Col xs={24} md={12}>
        <Card
          title="鼓励模板"
          extra={
            <Select
              value={selectedCategory}
              onChange={setSelectedCategory}
              style={{ minWidth: 120 }}
              size="small"
              options={CATEGORY_OPTIONS}
              placeholder="按分类筛选"
            />
          }
          style={{ height: '100%' }}
        >
          {filteredTemplates.length > 0 ? (
            <List
              dataSource={filteredTemplates}
              renderItem={(template: AnyObj) => (
                <List.Item
                  style={{
                    padding: '12px 0',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                  actions={[
                    <Button
                      type="link"
                      size="small"
                      key="use"
                      onClick={() => handleUseTemplate(template)}
                    >
                      使用
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      <SmileOutlined style={{ fontSize: 20, color: '#1677ff', marginTop: 4 }} />
                    }
                    title={
                      <Space>
                        <Text strong>{template.title || '鼓励模板'}</Text>
                        {template.category && (
                          <Tag color={TYPE_TAG_COLOR[template.category] || 'default'}>
                            {template.category}
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <Paragraph
                        ellipsis={{ rows: 2 }}
                        style={{ marginBottom: 0, color: '#666' }}
                      >
                        {template.message || template.content || ''}
                      </Paragraph>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              暂无模板
            </div>
          )}
        </Card>
      </Col>

      {/* Right: Custom message form */}
      <Col xs={24} md={12}>
        <Card title="编写鼓励消息" style={{ height: '100%' }}>
          {!selectedStudentId ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
              请先在上方选择一个学生
            </div>
          ) : (
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSend}
              initialValues={{ encouragement_type: '通用' }}
            >
              <Form.Item label="鼓励类型" name="encouragement_type">
                <Select
                  size="small"
                  options={CATEGORY_OPTIONS.filter((c) => c.value !== '')}
                  placeholder="选择鼓励类型"
                />
              </Form.Item>

              <Form.Item label="标题（可选）" name="title">
                <Input placeholder="给这条鼓励起个标题" maxLength={50} />
              </Form.Item>

              <Form.Item
                label="鼓励内容"
                name="message"
                rules={[{ required: true, message: '请输入鼓励内容' }]}
              >
                <TextArea
                  rows={6}
                  placeholder="写下你想对孩子说的话..."
                  maxLength={500}
                  showCount
                />
              </Form.Item>

              {selectedTemplateId && (
                <div style={{ marginBottom: 16 }}>
                  <Tag color="blue">已选用模板</Tag>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setSelectedTemplateId(null);
                      form.resetFields();
                    }}
                  >
                    清除模板
                  </Button>
                </div>
              )}

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  loading={sending}
                  block
                >
                  发送鼓励
                </Button>
              </Form.Item>
            </Form>
          )}
        </Card>
      </Col>
    </Row>
  );

  const renderHistoryTab = () => (
    <Card title="已发送的鼓励消息">
      {encouragements && encouragements.length > 0 ? (
        <List
          dataSource={encouragements}
          renderItem={(item: AnyObj) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <HeartOutlined
                    style={{
                      fontSize: 22,
                      color: item.is_read ? '#d9d9d9' : '#ff4d4f',
                      marginTop: 4,
                    }}
                  />
                }
                title={
                  <Space>
                    <Tag color={TYPE_TAG_COLOR[item.encouragement_type] || 'default'}>
                      {item.encouragement_type || '通用'}
                    </Tag>
                    <Text strong>{item.title || '鼓励消息'}</Text>
                    {item.is_read ? (
                      <Tag color="default">已读</Tag>
                    ) : (
                      <Tag color="red">未读</Tag>
                    )}
                  </Space>
                }
                description={
                  <div>
                    <Paragraph
                      ellipsis={{ rows: 2 }}
                      style={{ marginBottom: 4, color: '#666' }}
                    >
                      {item.message || item.content || ''}
                    </Paragraph>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatTime(item.created_at || item.send_time || '')}
                    </Text>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
          <HeartOutlined style={{ fontSize: 40, color: '#d9d9d9', marginBottom: 16 }} />
          <div>暂无发送记录</div>
          <div style={{ marginTop: 8, fontSize: 12 }}>切换到"发送鼓励"标签页，给孩子发一条鼓励吧</div>
        </div>
      )}
    </Card>
  );

  const tabItems = [
    {
      key: 'send',
      label: (
        <span>
          <SendOutlined />
          发送鼓励
        </span>
      ),
      children: renderSendTab(),
    },
    {
      key: 'history',
      label: (
        <span>
          <HeartOutlined />
          历史消息
        </span>
      ),
      children: renderHistoryTab(),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Student selector */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="large" align="center">
          <Text strong style={{ fontSize: 16 }}>选择学生：</Text>
          <Select
            value={selectedStudentId}
            onChange={handleStudentChange}
            style={{ minWidth: 200 }}
            placeholder="请选择学生"
            options={linkedStudents.map((s: AnyObj) => ({
              label: s.student_name || s.name,
              value: s.student_id || s.id,
            }))}
          />
          {selectedStudentId && (
            <Text style={{ fontSize: 14, color: '#999' }}>
              当前选择：
              <Text style={{ fontSize: 16, color: '#1677ff' }}>
                {linkedStudents.find(
                  (s: AnyObj) => (s.student_id || s.id) === selectedStudentId
                )?.student_name ||
                  linkedStudents.find(
                    (s: AnyObj) => (s.student_id || s.id) === selectedStudentId
                  )?.name ||
                  ''}
              </Text>
            </Text>
          )}
        </Space>
      </Card>

      {/* Tabs: Send encouragement / History */}
      <Tabs items={tabItems} defaultActiveKey="send" />
    </div>
  );
};

export default ParentEncouragePage;
