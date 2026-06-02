import { useState } from 'react';
import { Modal, Input, Select, Button, Space, Tag, message } from 'antd';
import { DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined, PlusOutlined } from '@ant-design/icons';

interface GeneratedStep {
  step_order: number;
  text: string;
  panda_emotion: 'thinking' | 'explaining' | 'satisfied';
  board_line: string | null;
}

interface ExplanationReviewModalProps {
  open: boolean;
  onClose: () => void;
  steps: GeneratedStep[];
  onSave: (steps: GeneratedStep[]) => void;
  saving?: boolean;
  headerExtra?: React.ReactNode;
}

const EMOTION_OPTIONS = [
  { value: 'thinking', label: '思考中', color: 'blue' },
  { value: 'explaining', label: '讲解中', color: 'orange' },
  { value: 'satisfied', label: '总结', color: 'green' },
];

export default function ExplanationReviewModal({
  open,
  onClose,
  steps,
  onSave,
  saving,
  headerExtra,
}: ExplanationReviewModalProps) {
  const [editSteps, setEditSteps] = useState<GeneratedStep[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Initialize editSteps when modal opens with new steps
  if (open && !initialized && steps.length > 0) {
    setEditSteps(steps.map((s, i) => ({ ...s, step_order: i + 1 })));
    setInitialized(true);
  }

  const handleClose = () => {
    setEditSteps([]);
    setInitialized(false);
    onClose();
  };

  const handleSave = () => {
    const cleaned = editSteps
      .filter((s) => s.text.trim())
      .map((s, i) => ({ ...s, step_order: i + 1 }));
    if (cleaned.length === 0) {
      message.warning('至少需要一个步骤');
      return;
    }
    onSave(cleaned);
  };

  const updateStep = (index: number, field: keyof GeneratedStep, value: string | null) => {
    setEditSteps((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeStep = (index: number) => {
    setEditSteps((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_order: i + 1 }))
    );
  };

  const addStep = () => {
    setEditSteps((prev) => [
      ...prev,
      {
        step_order: prev.length + 1,
        text: '',
        panda_emotion: 'explaining',
        board_line: null,
      },
    ]);
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= editSteps.length) return;
    setEditSteps((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((s, i) => ({ ...s, step_order: i + 1 }));
    });
  };

  return (
    <Modal
      title="讲解步骤审核"
      open={open}
      onCancel={handleClose}
      width={720}
      footer={[
        <Button key="cancel" onClick={handleClose}>取消</Button>,
        <Button key="save" type="primary" loading={saving} onClick={handleSave}>
          确认保存
        </Button>,
      ]}
      destroyOnClose
    >
      {headerExtra}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 500, overflowY: 'auto', padding: '8px 0' }}>
        {editSteps.map((step, idx) => (
          <div
            key={idx}
            style={{
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              padding: 12,
              background: '#fafafa',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Tag color="default" style={{ fontSize: 13 }}>步骤 {idx + 1}</Tag>
              <Space size={4}>
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowUpOutlined />}
                  disabled={idx === 0}
                  onClick={() => moveStep(idx, -1)}
                />
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowDownOutlined />}
                  disabled={idx === editSteps.length - 1}
                  onClick={() => moveStep(idx, 1)}
                />
                <Button
                  size="small"
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeStep(idx)}
                />
              </Space>
            </div>
            <Input.TextArea
              value={step.text}
              onChange={(e) => updateStep(idx, 'text', e.target.value)}
              autoSize={{ minRows: 2, maxRows: 6 }}
              placeholder="步骤内容..."
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Select
                size="small"
                value={step.panda_emotion}
                onChange={(val) => updateStep(idx, 'panda_emotion', val)}
                options={EMOTION_OPTIONS}
                style={{ width: 120 }}
              />
              <Input
                size="small"
                value={step.board_line || ''}
                onChange={(e) => updateStep(idx, 'board_line', e.target.value || null)}
                placeholder="板书要点（可选）"
                style={{ flex: 1 }}
              />
            </div>
          </div>
        ))}
      </div>
      <Button
        type="dashed"
        onClick={addStep}
        icon={<PlusOutlined />}
        block
        style={{ marginTop: 8 }}
      >
        添加步骤
      </Button>
    </Modal>
  );
}
