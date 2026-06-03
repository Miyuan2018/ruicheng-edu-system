import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Steps, Button, Space, message, Spin, Tooltip, Modal } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { usePaperEditorStore } from '../../store/paperEditor';
import BasicInfoStep from './steps/BasicInfoStep';
import StructureStep from './steps/StructureStep';
import RecommendStep from './steps/RecommendStep';
import PreviewFinalizeStep from './steps/PreviewFinalizeStep';
import ErrorBoundary from '../../components/ErrorBoundary';

const STEP_TITLES = ['基本信息', '试卷结构', '选题', '预览保存'];

export default function PaperWizardPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { paper, currentStep, loading, saving, dirty, pendingDraft, initNew, loadDraft, setStep, autoSave, reset } = usePaperEditorStore();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Init or load draft
  useEffect(() => {
    if (id) {
      loadDraft(id);
    } else {
      // 新建试卷：检查是否有未完成草稿
      const checkDrafts = async () => {
        try {
          const { draftApi } = await import('../../api/drafts');
          const resp = await draftApi.list();
          const drafts = Array.isArray(resp?.data) ? resp.data : [];
          if (drafts.length > 0) {
            usePaperEditorStore.setState({ pendingDraft: drafts[0].data });
          }
        } catch {}
      };
      checkDrafts();
      initNew();
    }
    return () => {
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Beforeunload handler
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Auto-save polling (every 30s if dirty)
  useEffect(() => {
    if (dirty && !saving) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        handleAutoSave();
      }, 30000);
    }
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, currentStep]);

  const handleAutoSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      await autoSave();
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 2000);
    } catch {
      setSaveStatus('error');
    }
  }, [autoSave]);

  const handleManualSave = async () => {
    setSaveStatus('saving');
    try {
      // Validate basic info
      if (!paper?.title || !paper?.subject) {
        message.warning('请先在"基本信息"步骤填写试卷标题和学科');
        setStep(0);
        setSaveStatus('error');
        return;
      }
      await autoSave();
      setSaveStatus('saved');
      message.success('已保存');
      setTimeout(() => {
        setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
      }, 2000);
    } catch {
      setSaveStatus('error');
      message.error('保存失败');
    }
  };

  const TYPE_LABELS: Record<string, string> = {
    SINGLE_CHOICE: '单选题', MULTIPLE_CHOICE: '多选题', FILL_BLANK: '填空题', SUBJECTIVE: '解答题',
  };

  const handleNext = async () => {
    // Validate current step before proceeding
    if (currentStep === 0) {
      if (!paper?.title) {
        message.warning('请输入试卷标题');
        return;
      }
      if (!paper?.subject) {
        message.warning('请选择学科');
        return;
      }
      if (!paper?.grade_level?.grades || paper.grade_level.grades.length === 0) {
        message.warning('请选择年级');
        return;
      }
    }
    if (currentStep === 1) {
      const units = paper?.units || [];
      if (units.length === 0) {
        message.warning('请至少添加一个题型');
        return;
      }
      for (const unit of units) {
        const configs = unit.question_config || [];
        if (configs.length === 0) {
          message.warning('存在未配置的题型行，请补充或删除');
          return;
        }
        for (const cfg of configs) {
          const label = TYPE_LABELS[cfg.question_type] || cfg.question_type;
          if ((cfg.count || 0) <= 0) {
            message.warning(`「${label}」题数不能为 0，请填写题数`);
            return;
          }
          if ((cfg.score_per_question || 0) <= 0) {
            message.warning(`「${label}」每题分值不能为 0，请填写分值`);
            return;
          }
        }
      }
      // 校验结构总分与试卷总分一致
      const computedTotal = units.reduce(
        (sum, u) => sum + (u.question_config || []).reduce((s, c) => s + (c.count || 0) * (c.score_per_question || 0), 0),
        0,
      );
      const targetTotal = paper?.total_score || 0;
      if (targetTotal > 0 && computedTotal !== targetTotal) {
        message.warning(`题型总分 ${computedTotal} 与试卷总分 ${targetTotal} 不一致，请调整题数或分值`);
        return;
      }
    }
    if (currentStep === 2) {
      const units = paper?.units || [];
      const allQuestions = units.reduce((sum, u) => sum + (u.questions?.length || 0), 0);
      if (allQuestions === 0) {
        message.warning('请先生成题目推荐');
        return;
      }

      // 校验题目数量/分数与结构一致
      const errors: string[] = [];
      units.forEach(u => {
        (u.question_config || []).forEach(cfg => {
          const label = TYPE_LABELS[cfg.question_type] || cfg.question_type;
          const actual = (u.questions || []).filter(q => q.question_type === cfg.question_type);
          const actualCount = actual.length;
          const targetCount = cfg.count || 0;
          const targetScore = cfg.score_per_question || 0;

          if (actualCount !== targetCount) {
            const diff = Math.abs(actualCount - targetCount);
            errors.push(`「${label}」需 ${targetCount} 题，当前 ${actualCount} 题（${actualCount > targetCount ? '多' : '少'}${diff} 题）`);
          }
          const wrongScore = actual.find(q => q.score !== targetScore);
          if (wrongScore) {
            errors.push(`「${label}」卷面分应为 ${targetScore} 分/题，存在 ${wrongScore.score} 分的题目`);
          }
        });
      });

      if (errors.length > 0) {
        message.warning(errors.join('\n'), 6);
        return;
      }
    }

    const nextStep = currentStep + 1;
    if (nextStep < STEP_TITLES.length) {
      // 先保存再切换步骤，避免后续操作读到旧数据
      if (dirty) {
        setSaveStatus('saving');
        try {
          await autoSave();
        } catch { /* ignore */ }
        setSaveStatus('idle');
      }
      setStep(nextStep);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      if (currentStep === 2) {
        // 从选题退回结构：保留题目分配在 units 中，清除推荐报告
        usePaperEditorStore.getState().setGenerateReport(null);
      }
      setStep(currentStep - 1);
    }
  };

  const renderStep= () => {
    switch (currentStep) {
      case 0: return <BasicInfoStep />;
      case 1: return <StructureStep />;
      case 2: return <RecommendStep />;
      case 3: return <PreviewFinalizeStep />;
      default: return null;
    }
  };

  // Save status indicator
  const saveStatusEl = (
    <Tooltip title={saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '已保存' : saveStatus === 'error' ? '保存失败' : ''}>
      <span style={{ fontSize: 12, color: saveStatus === 'saving' ? '#1890ff' : saveStatus === 'saved' ? '#52c41a' : saveStatus === 'error' ? '#ff4d4f' : '#999' }}>
        {saveStatus === 'saving' && <><Spin size="small" style={{ marginRight: 4 }} />保存中...</>}
        {saveStatus === 'saved' && <><SaveOutlined style={{ marginRight: 4 }} />已保存</>}
        {saveStatus === 'error' && <>保存失败</>}
        {saveStatus === 'idle' && dirty && <>未保存</>}
        {saveStatus === 'idle' && !dirty && <>已保存</>}
      </span>
    </Tooltip>
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin tip="加载中..." />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <span style={{ color: '#999', fontSize: 13 }}>
            <a onClick={() => navigate('/papers')} style={{ cursor: 'pointer' }}>试卷管理</a>
            {' > '}
            <span>{id ? '编辑试卷' : '新建试卷'}</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saveStatusEl}
          <Button size="small" onClick={handleManualSave} icon={<SaveOutlined />} loading={saving}>
            保存草稿
          </Button>
        </div>
      </div>

      {/* Steps */}
      <Steps
        current={currentStep}
        style={{ marginBottom: 24 }}
        items={STEP_TITLES.map((title) => ({ title }))}
      />

      {/* 草稿恢复弹窗 */}
      {pendingDraft && (
        <Modal
          title="发现未完成的试卷"
          open={true}
          onOk={() => {
            const draft = pendingDraft;
            usePaperEditorStore.setState({
              paper: draft,
              pendingDraft: null,
              currentStep: 0,
              dirty: false,
            });
            message.info('已恢复草稿');
          }}
          onCancel={() => {
            usePaperEditorStore.setState({ pendingDraft: null });
            message.info('已放弃草稿，开始新建');
          }}
          okText="继续编辑"
          cancelText="重新开始"
        >
          <p>检测到上次未完成的试卷「{pendingDraft?.title || '未命名'}」，是否继续编辑？</p>
        </Modal>
      )}

      {/* Step content */}
      <div style={{ minHeight: 400 }}>
        <ErrorBoundary>
          {renderStep()}
        </ErrorBoundary>
      </div>

      {/* Bottom navigation */}
      <div style={{
        marginTop: 24,
        padding: '16px 0',
        borderTop: '1px solid #f0f0f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          {currentStep > 0 && (
            <Button onClick={handlePrev} icon={<ArrowLeftOutlined />}>
              上一步
            </Button>
          )}
        </div>
        <Space>
          {currentStep < STEP_TITLES.length - 1 ? (
            <Button type="primary" onClick={handleNext} icon={<ArrowRightOutlined />}>
              下一步
            </Button>
          ) : null}
          {/* 确认入库按钮在 PreviewFinalizeStep 内 */}
        </Space>
      </div>
    </div>
  );
}
