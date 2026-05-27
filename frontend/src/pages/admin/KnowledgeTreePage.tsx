import { useState, useEffect, useCallback } from 'react';
import {
  Card, Tree, Button, Modal, Form, Input, Select, InputNumber,
  Space, Tag, Typography, message, Spin, Empty, Badge, Dropdown,
  Row, Col, Divider, Descriptions, Popconfirm, Alert, Timeline
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined,
  BranchesOutlined, ApartmentOutlined,
  RollbackOutlined, HistoryOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import apiClient from '../../api/client';

const { Title, Text } = Typography;

interface TreeNode {
  key: string;
  title: string;
  node_type: string;
  is_active: boolean;
  invalid_reason?: string;
  is_modified: boolean;
  children: TreeNode[];
  isLeaf: boolean;
  sort_order: number;
  description?: string;
}

export default function KnowledgeTreePage() {
  const [syllabi, setSyllabi] = useState<any[]>([]);
  const [selectedSyllabus, setSelectedSyllabus] = useState<string>('');
  const [versions, setVersions] = useState<any[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<number>(0);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<TreeNode | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [versionStats, setVersionStats] = useState<Record<number, { active: number; total: number }>>({});

  useEffect(() => { loadSyllabi(); }, []);

  const loadSyllabi = async () => {
    try { const { data } = await apiClient.get('/question-admin/syllabi'); setSyllabi(data); } catch {}
  };

  const loadVersions = async (sid: string) => {
    try { const { data } = await apiClient.get(`/knowledge-tree/syllabi/${sid}/versions`); setVersions(data); } catch {}
  };

  // Count active and total nodes in tree
  const countNodes = (nodes: TreeNode[]): { active: number; total: number } => {
    let active = 0, total = 0;
    const walk = (list: TreeNode[]) => {
      for (const n of list) {
        total++;
        if (n.is_active) active++;
        if (n.children) walk(n.children);
      }
    };
    walk(nodes);
    return { active, total };
  };

  const loadTree = useCallback(async (sid: string, ver?: number) => {
    if (!sid) return;
    setLoading(true);
    try {
      const params = ver ? `?version=${ver}` : '';
      const { data } = await apiClient.get(`/knowledge-tree/syllabi/${sid}/tree${params}`);
      const tree = data.tree || [];
      setTreeData(tree);
      const loadedVer = data.requested_version || data.current_version;
      setSelectedVersion(loadedVer);
      setExpandedKeys(tree.map((n: TreeNode) => n.key));
      // Compute version stats
      const stats = countNodes(tree);
      setVersionStats((prev) => ({ ...prev, [loadedVer]: stats }));
    } catch { message.error('加载知识树失败'); }
    finally { setLoading(false); }
  }, []);

  const handleSyllabusChange = (sid: string) => {
    setSelectedSyllabus(sid);
    setSelectedNode(null);
    loadVersions(sid);
    loadTree(sid);
  };

  const handleVersionChange = (ver: number) => {
    loadTree(selectedSyllabus, ver);
  };

  // Node operations
  const handleAddNode = (parentKey?: string) => {
    setEditingNode(null);
    setParentId(parentKey || null);
    form.resetFields();
    form.setFieldsValue({ node_type: 'POINT', sort_order: 0 });
    setNodeModalOpen(true);
  };

  const handleEditNode = (node: TreeNode) => {
    setEditingNode(node);
    setParentId(null);
    form.setFieldsValue({ name: node.title, node_type: node.node_type, description: node.description, sort_order: node.sort_order });
    setNodeModalOpen(true);
  };

  const handleNodeSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editingNode) {
        await apiClient.put(`/knowledge-tree/syllabi/${selectedSyllabus}/nodes/${editingNode.key}`, null, { params: values });
        message.success('节点已更新，子节点已失效');
      } else {
        await apiClient.post(`/knowledge-tree/syllabi/${selectedSyllabus}/nodes`, null, {
          params: { ...values, parent_id: parentId }
        });
        message.success('节点已创建');
      }
      setNodeModalOpen(false);
      loadTree(selectedSyllabus, selectedVersion);
    } catch { message.error('操作失败'); }
  };

  const handleDeleteNode = async (nodeId: string) => {
    try {
      await apiClient.delete(`/knowledge-tree/syllabi/${selectedSyllabus}/nodes/${nodeId}`);
      message.success('节点及子树已删除');
      setSelectedNode(null);
      loadTree(selectedSyllabus, selectedVersion);
    } catch { message.error('删除失败'); }
  };

  const handleSetBranchActive = async (nodeId: string, active: boolean) => {
    try {
      await apiClient.post(`/knowledge-tree/syllabi/${selectedSyllabus}/nodes/${nodeId}/set-branch-active`, null, {
        params: { active }
      });
      message.success(active ? '分支已设为有效' : '分支已设为无效');
      loadTree(selectedSyllabus, selectedVersion);
    } catch { message.error('操作失败'); }
  };

  const handleNewVersion = async () => {
    try {
      await apiClient.post(`/knowledge-tree/syllabi/${selectedSyllabus}/new-version`);
      message.success('新版本创建成功');
      loadVersions(selectedSyllabus);
      loadTree(selectedSyllabus);
    } catch { message.error('创建新版本失败'); }
  };

  const handleRollback = async (targetVersion: number) => {
    setRollbackLoading(true);
    try {
      const { data } = await apiClient.put(
        `/knowledge-tree/syllabi/${selectedSyllabus}/rollback`,
        null,
        { params: { target_version: targetVersion } }
      );
      message.success(data.message || '回滚成功');
      // Update selectedSyllabus to the rolled-back version's ID
      if (data.syllabus_id) {
        setSelectedSyllabus(data.syllabus_id);
        loadVersions(data.syllabus_id);
        loadTree(data.syllabus_id, targetVersion);
      } else {
        loadVersions(selectedSyllabus);
        loadTree(selectedSyllabus, targetVersion);
      }
    } catch { message.error('回滚失败'); }
    finally { setRollbackLoading(false); }
  };

  const currentVersion = versions.find((v: any) => v.is_current)?.version;

  // Custom tree node rendering
  const getInvalidTag = (reason?: string) => {
    if (reason === 'PARENT_MODIFIED') return <Tag color="orange" style={{ fontSize: 10 }}>父变更</Tag>;
    if (reason === 'VERSION_CUT') return <Tag color="purple" style={{ fontSize: 10 }}>版本切割</Tag>;
    return <Tag color="red" style={{ fontSize: 10 }}>无效</Tag>;
  };

  const renderTreeNodes = (nodes: TreeNode[]): any[] =>
    nodes.map((node) => ({
      ...node,
      icon: node.node_type === 'AREA'
        ? <BranchesOutlined style={{ color: node.is_active ? '#52c41a' : '#ff4d4f' }} />
        : <ApartmentOutlined style={{ color: node.is_active ? '#1890ff' : '#ff4d4f' }} />,
      title: (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            textDecoration: node.is_active ? 'none' : 'line-through',
            color: node.is_active ? 'inherit' : '#999',
          }}>
            {node.title}
          </span>
          {!node.is_active && getInvalidTag(node.invalid_reason)}
          {node.is_modified && <Badge status="processing" title="已修改" />}
          {node.node_type === 'AREA' && <Tag color="blue" style={{ fontSize: 10 }}>领域</Tag>}
        </span>
      ),
      children: renderTreeNodes(node.children),
    }));

  // Right-click context menu
  const getContextMenu = (node: TreeNode): MenuProps['items'] => [
    { key: 'edit', icon: <EditOutlined />, label: '编辑节点', onClick: () => handleEditNode(node) },
    { key: 'add', icon: <PlusOutlined />, label: '添加子节点', onClick: () => handleAddNode(node.key) },
    { type: 'divider' },
    { key: 'activate', icon: <CheckCircleOutlined />, label: '分支全部有效',
      onClick: () => handleSetBranchActive(node.key, true), disabled: node.is_active },
    { key: 'deactivate', icon: <CloseCircleOutlined />, label: '分支全部无效',
      onClick: () => handleSetBranchActive(node.key, false), disabled: !node.is_active },
    { type: 'divider' },
    { key: 'delete', icon: <DeleteOutlined />, label: '删除分支', danger: true,
      onClick: () => handleDeleteNode(node.key) },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}><ApartmentOutlined /> 考纲知识树管理</Title>
      </div>

      {/* Top bar: syllabus + version selectors */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Text strong>考纲:</Text>
            <Select placeholder="选择考纲" style={{ width: 280, marginLeft: 8 }} size="small"
              value={selectedSyllabus} onChange={handleSyllabusChange}
              options={syllabi.map((s: any) => ({ value: s.id, label: `${s.title} (${s.grade_level || ''} ${s.province || ''})` }))} />
          </Col>
          <Col>
            <Text strong>版本:</Text>
            <Select style={{ width: 100, marginLeft: 8 }} value={selectedVersion} size="small"
              onChange={handleVersionChange}
              options={versions.map((v: any) => ({ value: v.version, label: `v${v.version}${v.is_current ? '●' : ''}` }))} />
          </Col>
          <Col>
            <Button size="small" icon={<PlusOutlined />} onClick={handleNewVersion} disabled={!selectedSyllabus}>新版本</Button>
          </Col>
          <Col>
            <Popconfirm
              title={`确定要回滚到版本 v${selectedVersion} 吗？`}
              description="回滚后该版本将成为当前版本"
              onConfirm={() => handleRollback(selectedVersion)}
              disabled={!selectedSyllabus || selectedVersion === currentVersion}
            >
              <Button
                size="small"
                icon={<RollbackOutlined />}
                loading={rollbackLoading}
                disabled={!selectedSyllabus || selectedVersion === currentVersion}
              >
                回滚到此版本
              </Button>
            </Popconfirm>
          </Col>
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Space>
              <Button size="small" icon={<ReloadOutlined />} onClick={() => loadTree(selectedSyllabus, selectedVersion)}>刷新</Button>
              <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => handleAddNode()}
                disabled={!selectedSyllabus}>添加根节点</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Version Timeline */}
      {selectedSyllabus && versions.length > 1 && (
        <Card size="small" title={<span><HistoryOutlined style={{ marginRight: 6 }} />版本历史</span>} style={{ marginBottom: 16 }}>
          <Timeline
            items={versions.map((v: any) => ({
              key: v.id,
              color: v.is_current ? 'green' : 'gray',
              dot: v.is_current ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : undefined,
              children: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text strong>v{v.version}</Text>
                  {v.is_current && <Tag color="green" style={{ fontSize: 11 }}>当前</Tag>}
                  {versionStats[v.version] && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      ({versionStats[v.version].active}/{versionStats[v.version].total} 节点)
                    </Text>
                  )}
                  <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}
                    onClick={() => handleVersionChange(v.version)}>查看</Button>
                  {!v.is_current && (
                    <Popconfirm title={`确定回滚到 v${v.version}？`} onConfirm={() => handleRollback(v.version)}>
                      <Button type="link" size="small" danger style={{ padding: 0, fontSize: 12 }}>回滚</Button>
                    </Popconfirm>
                  )}
                </span>
              ),
            }))}
          />
        </Card>
      )}

      {/* Legend */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 16, fontSize: 13 }}>
        <span><Badge status="success" /> 有效节点</span>
        <span><Badge status="warning" /> 父变更失效</span>
        <span><Badge color="purple" /> 版本切割失效</span>
        <span><Badge status="error" /> 手动无效</span>
        <span><Badge status="processing" /> 已修改</span>
        <span>| 右键节点查看更多操作</span>
      </div>

      {/* Main content */}
      <Row gutter={16}>
        <Col span={10}>
          <Card title="知识树" size="small" style={{ minHeight: 400 }}>
            {!selectedSyllabus ? (
              <Empty description="请先选择考纲" />
            ) : loading ? (
              <Spin />
            ) : (
              <Tree
                showIcon
                defaultExpandAll
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys as string[])}
                treeData={renderTreeNodes(treeData)}
                selectedKeys={selectedNode ? [selectedNode.key] : []}
                onSelect={(_, info) => setSelectedNode(info.node as any)}
                titleRender={({ title, key, is_active, invalid_reason, is_modified, node_type }: any) => (
                  <Dropdown menu={{ items: getContextMenu({ key, title, node_type, is_active, invalid_reason, is_modified, children: [], isLeaf: false, sort_order: 0 }) }} trigger={['contextMenu']}>
                    <span>{title}</span>
                  </Dropdown>
                )}
                blockNode
              />
            )}
          </Card>
        </Col>

        {/* Right panel: node details */}
        <Col span={14}>
          <Card title="节点详情" size="small" style={{ minHeight: 400 }}>
            {selectedNode ? (
              <>
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label="名称">{selectedNode.title}</Descriptions.Item>
                  <Descriptions.Item label="类型">
                    <Tag>{selectedNode.node_type === 'AREA' ? '知识领域' : '知识点'}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    {selectedNode.is_active
                      ? <Tag color="green">有效</Tag>
                      : selectedNode.invalid_reason === 'PARENT_MODIFIED'
                        ? <Tag color="orange">父节点变更导致失效</Tag>
                        : selectedNode.invalid_reason === 'VERSION_CUT'
                          ? <Tag color="purple">版本切割失效</Tag>
                          : <Tag color="red">手动设为无效</Tag>
                    }
                  </Descriptions.Item>
                  <Descriptions.Item label="已修改">
                    {selectedNode.is_modified ? <Tag color="yellow">是</Tag> : <Tag>否</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="子节点数">{selectedNode.children?.length || 0}</Descriptions.Item>
                  <Descriptions.Item label="排序">{selectedNode.sort_order}</Descriptions.Item>
                  {selectedNode.description && (
                    <Descriptions.Item label="描述" span={2}>{selectedNode.description}</Descriptions.Item>
                  )}
                </Descriptions>

                <Divider />
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => handleEditNode(selectedNode)}>编辑</Button>
                  <Button size="small" icon={<PlusOutlined />} onClick={() => handleAddNode(selectedNode.key)}>添加子节点</Button>
                  <Popconfirm title="确定删除此节点及所有子节点?" onConfirm={() => handleDeleteNode(selectedNode.key)}>
                    <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
                <Divider />
                <Space>
                  <Button size="small" icon={<CheckCircleOutlined />} type="primary" ghost
                    disabled={selectedNode.is_active}
                    onClick={() => handleSetBranchActive(selectedNode.key, true)}>分支全部有效</Button>
                  <Button size="small" icon={<CloseCircleOutlined />} danger
                    disabled={!selectedNode.is_active}
                    onClick={() => handleSetBranchActive(selectedNode.key, false)}>分支全部无效</Button>
                </Space>

                {!selectedNode.is_active && selectedNode.invalid_reason === 'PARENT_MODIFIED' && (
                  <Alert style={{ marginTop: 12 }} type="warning"
                    message="此节点因父节点修改而自动失效，请检查上层节点变更" showIcon />
                )}
              </>
            ) : (
              <Empty description="点击树节点查看详情" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Add/Edit Node Modal */}
      <Modal
        title={editingNode ? '编辑节点' : '添加节点'}
        open={nodeModalOpen}
        onOk={handleNodeSubmit}
        onCancel={() => setNodeModalOpen(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="如: 一元二次方程" size="small" />
          </Form.Item>
          <Form.Item name="node_type" label="类型" rules={[{ required: true }]}>
            <Select size="small" options={[
              { value: 'AREA', label: '知识领域（可包含子节点）' },
              { value: 'POINT', label: '知识点（叶子节点）' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} size="small" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序">
            <InputNumber min={0} size="small" />
          </Form.Item>
        </Form>
        {editingNode && (
          <Alert type="warning" message="修改此节点后，其所有子节点将被设为失效状态" showIcon />
        )}
      </Modal>
    </div>
  );
}
