import { create } from 'zustand';
import type { PaperDraft, ExamPaperUnit, ExamPaperUnitQuestion, AutoSelectReport, GenerateReport } from '../types/paper';
import { paperApi } from '../api/papers';

interface PaperEditorState {
  // State
  paper: PaperDraft | null;
  currentStep: number;
  loading: boolean;
  saving: boolean;
  lastSaved: Date | null;
  dirty: boolean;
  autoSelectReports: AutoSelectReport[];
  generateReport: GenerateReport | null;

  // Actions
  initNew: () => void;
  loadDraft: (id: string) => Promise<void>;
  updateMeta: (data: Partial<PaperDraft>) => void;
  setStep: (step: number) => void;

  // Unit operations
  addUnit: (unit?: Partial<ExamPaperUnit>) => void;
  updateUnit: (uid: string, data: Partial<ExamPaperUnit>) => void;
  removeUnit: (uid: string) => void;
  reorderUnits: (fromIndex: number, toIndex: number) => void;
  addQuickUnits: (preset: 'byType' | 'blank') => void;
  addUnitFromTemplate: (template: ExamPaperUnit) => void;

  // Question operations
  addQuestionToUnit: (uid: string, question: ExamPaperUnitQuestion) => void;
  removeQuestionFromUnit: (uid: string, qid: string) => void;
  moveQuestion: (fromUid: string, toUid: string, qid: string) => void;
  reorderQuestions: (uid: string, fromIndex: number, toIndex: number) => void;
  replaceQuestion: (uid: string, oldQid: string, newQuestion: ExamPaperUnitQuestion) => void;
  clearUnitQuestions: (uid: string) => void;
  clearAllQuestions: () => void;

  // Type config operations
  addTypeConfig: (uid: string, config: any) => void;
  updateTypeConfig: (uid: string, index: number, config: any) => void;
  removeTypeConfig: (uid: string, index: number) => void;

  // Persistence
  autoSave: () => Promise<void>;
  saveAll: () => Promise<void>;
  setDirty: (dirty: boolean) => void;
  setUnitQuestions: (uid: string, questions: ExamPaperUnitQuestion[]) => void;
  regenerateAll: (paperId: string) => Promise<void>;
  fillGaps: (paperId: string) => Promise<void>;
  reset: () => void;
  setGenerateReport: (report: GenerateReport | null) => void;
}

const newEmptyPaper = (): PaperDraft => ({
  title: '',
  subject: '',
  grade_level: { scope: 'grade_comprehensive', grades: [] },
  duration_minutes: null,
  difficulty_ratio: { EASY: 20, MEDIUM: 50, HARD: 30 },
  total_score: 0,
  status: 'DRAFT',
  subtitle: '',
  instructions: '',
  description: '',
  show_units: false,
  per_unit_timer: false,
  units: [],
  knowledge_node_ids: [],
});

const QUICK_PRESETS: Record<string, ExamPaperUnit[]> = {
  byType: [
    { name: '填空题', position: 1, question_config: [{ question_type: 'FILL_BLANK', count: 0, score_per_question: 5 }], time_limit_minutes: null },
    { name: '单选题', position: 2, question_config: [{ question_type: 'SINGLE_CHOICE', count: 0, score_per_question: 4 }], time_limit_minutes: null },
    { name: '多选题', position: 3, question_config: [{ question_type: 'MULTIPLE_CHOICE', count: 0, score_per_question: 6 }], time_limit_minutes: null },
    { name: '解答题', position: 4, question_config: [{ question_type: 'SUBJECTIVE', count: 0, score_per_question: 10 }], time_limit_minutes: null },
  ],
};

export const usePaperEditorStore = create<PaperEditorState>((set, get) => ({
  paper: null,
  currentStep: 0,
  loading: false,
  saving: false,
  lastSaved: null,
  dirty: false,
  autoSelectReports: [],
  generateReport: null,

  initNew: () => set({ paper: newEmptyPaper(), currentStep: 0, dirty: false, lastSaved: null, autoSelectReports: [], generateReport: null }),

  loadDraft: async (id: string) => {
    set({ loading: true });
    try {
      const resp = await paperApi.preview(id);
      // API interceptor unwraps {code,message,data} → data
      // preview returns { paper: {...}, units: [...] }
      const previewData = resp.data || resp;
      const paperData = previewData.paper || previewData;
      set({
        paper: {
          ...paperData,
          units: previewData.units || paperData.units || [],
        },
        currentStep: 0,
        loading: false,
        dirty: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  updateMeta: (data) => {
    const { paper } = get();
    if (!paper) return;
    set({ paper: { ...paper, ...data }, dirty: true });
  },

  setStep: (step) => set({ currentStep: step }),

  // Unit operations
  addUnit: (unit) => {
    const { paper } = get();
    if (!paper) return;
    const newUnit: ExamPaperUnit = {
      id: '_temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: '未命名单元',
      position: paper.units.length + 1,
      question_config: [],
      time_limit_minutes: null,
      ...unit,
    };
    set({ paper: { ...paper, units: [...paper.units, newUnit] }, dirty: true });
  },

  updateUnit: (uid, data) => {
    const { paper } = get();
    if (!paper) return;
    set({
      paper: {
        ...paper,
        units: paper.units.map((u) => (u.id === uid ? { ...u, ...data } : u)),
      },
      dirty: true,
    });
  },

  removeUnit: (uid) => {
    const { paper } = get();
    if (!paper) return;
    set({
      paper: {
        ...paper,
        units: paper.units.filter((u) => u.id !== uid).map((u, i) => ({ ...u, position: i + 1 })),
      },
      dirty: true,
    });
  },

  reorderUnits: (from, to) => {
    const { paper } = get();
    if (!paper) return;
    const units = [...paper.units];
    const [moved] = units.splice(from, 1);
    units.splice(to, 0, moved);
    set({ paper: { ...paper, units: units.map((u, i) => ({ ...u, position: i + 1 })) }, dirty: true });
  },

  addQuickUnits: (preset) => {
    const { paper } = get();
    if (!paper) return;
    const templates = QUICK_PRESETS[preset] || [];
    const tempId = () => '_temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const newUnits = templates.map((t, i) => ({ ...t, id: tempId(), position: i + 1 }));
    // 替换所有现有单元（快速创建是互斥操作）
    set({ paper: { ...paper, units: newUnits }, dirty: true });
  },

  addUnitFromTemplate: (template) => {
    const { paper } = get();
    if (!paper) return;
    set({
      paper: { ...paper, units: [...paper.units, { ...template, id: undefined, position: paper.units.length + 1 }] },
      dirty: true,
    });
  },

  // Question operations
  addQuestionToUnit: (uid, question) => {
    const { paper } = get();
    if (!paper) return;
    set({
      paper: {
        ...paper,
        units: paper.units.map((u) => {
          if (u.id !== uid) return u;
          const questions = u.questions || [];
          const pos = questions.length + 1;
          return { ...u, questions: [...questions, { ...question, position: pos }] };
        }),
      },
      dirty: true,
    });
  },

  removeQuestionFromUnit: (uid, qid) => {
    const { paper } = get();
    if (!paper) return;
    set({
      paper: {
        ...paper,
        units: paper.units.map((u) => {
          if (u.id !== uid) return u;
          return {
            ...u,
            questions: (u.questions || []).filter((q) => q.question_id !== qid && q.id !== qid),
          };
        }),
      },
      dirty: true,
    });
  },

  moveQuestion: (fromUid, toUid, qid) => {
    const { paper } = get();
    if (!paper) return;
    const fromUnit = paper.units.find((u) => u.id === fromUid);
    if (!fromUnit) return;
    const question = (fromUnit.questions || []).find((q) => q.question_id === qid || q.id === qid);
    if (!question) return;
    // Remove from source, add to target
    get().removeQuestionFromUnit(fromUid, qid);
    get().addQuestionToUnit(toUid, question);
  },

  reorderQuestions: (uid, from, to) => {
    const { paper } = get();
    if (!paper) return;
    set({
      paper: {
        ...paper,
        units: paper.units.map((u) => {
          if (u.id !== uid) return u;
          const questions = [...(u.questions || [])];
          const [moved] = questions.splice(from, 1);
          questions.splice(to, 0, moved);
          return { ...u, questions: questions.map((q, i) => ({ ...q, position: i + 1 })) };
        }),
      },
      dirty: true,
    });
  },

  replaceQuestion: (uid, oldQid, newQ) => {
    const { paper } = get();
    if (!paper) return;
    set({
      paper: {
        ...paper,
        units: paper.units.map((u) => {
          if (u.id !== uid) return u;
          return {
            ...u,
            questions: (u.questions || []).map((q) => {
              if ((q.question_id === oldQid || q.id === oldQid)) {
                return { ...newQ, position: q.position };
              }
              return q;
            }),
          };
        }),
      },
      dirty: true,
    });
  },

  clearUnitQuestions: (uid) => {
    const { paper } = get();
    if (!paper) return;
    set({ paper: { ...paper, units: paper.units.map(u => u.id === uid ? { ...u, questions: [] } : u) }, dirty: true });
  },

  clearAllQuestions: () => {
    const { paper } = get();
    if (!paper) return;
    set({ paper: { ...paper, units: paper.units.map(u => ({ ...u, questions: [] })) }, dirty: true });
  },

  setUnitQuestions: (uid: string, questions: ExamPaperUnitQuestion[]) => {
    const { paper } = get();
    if (!paper) return;
    set({
      paper: {
        ...paper,
        units: paper.units.map((u) =>
          u.id === uid ? { ...u, questions } : u
        ),
      },
      dirty: true,
    });
  },

  regenerateAll: async (paperId: string) => {
    set({ loading: true });
    try {
      const paper = get().paper;
      if (!paper) return;
      const resp = await paperApi.autoGenerate(paperId, {
        difficulty_ratio: paper.difficulty_ratio || { EASY: 20, MEDIUM: 50, HARD: 30 },
        knowledge_node_ids: paper.knowledge_node_ids || [],
        existing_question_ids: [],
      });
      const data = resp.data;
      get().clearAllQuestions();
      (data.questions || []).forEach((rec: any) => {
        const unit = paper.units.find(u =>
          (u.question_config || []).some(c => c.question_type === rec.question_type)
        );
        if (unit?.id) {
          get().addQuestionToUnit(unit.id, {
            question_id: rec.question_id,
            question_type: rec.question_type,
            position: (unit.questions?.length || 0) + 1,
            score: rec.score,
            question: {
              id: rec.question_id,
              title: rec.title,
              question_type: rec.question_type,
              difficulty: rec.difficulty,
              subject: paper.subject,
            },
            recommendation_tags: rec.recommendation_tags || [],
            alternatives: rec.alternatives || [],
          });
        }
      });
      set({ generateReport: { constraint_dashboard: data.constraint_dashboard || {} } });
      set({ dirty: true });
    } finally {
      set({ loading: false });
    }
  },

  fillGaps: async (paperId: string) => {
    const { paper } = get();
    if (!paper) return;
    const allExistingIds: string[] = [];
    const gaps: { unitId: string; questionType: string; deficit: number }[] = [];
    paper.units.forEach(u => {
      (u.question_config || []).forEach(cfg => {
        const existing = (u.questions || []).filter(q => q.question_type === cfg.question_type);
        existing.forEach(q => allExistingIds.push(q.question_id));
        if (cfg.count > existing.length) {
          gaps.push({ unitId: u.id || '', questionType: cfg.question_type, deficit: cfg.count - existing.length });
        }
      });
    });
    if (gaps.length === 0) return;

    set({ loading: true });
    try {
      const resp = await paperApi.autoGenerate(paperId, {
        difficulty_ratio: paper.difficulty_ratio || { EASY: 20, MEDIUM: 50, HARD: 30 },
        knowledge_node_ids: paper.knowledge_node_ids || [],
        existing_question_ids: allExistingIds,
      });
      const data = resp.data;
      const gapTypes = new Set(gaps.map(g => g.questionType));
      const newQuestions = (data.questions || []).filter((rec: any) => gapTypes.has(rec.question_type));
      gaps.forEach(gap => {
        const typeQuestions = newQuestions.filter((q: any) => q.question_type === gap.questionType);
        const toAdd = typeQuestions.slice(0, gap.deficit);
        toAdd.forEach((rec: any) => {
          const unit = paper.units.find(u => u.id === gap.unitId);
          if (unit) {
            get().addQuestionToUnit(gap.unitId, {
              question_id: rec.question_id,
              question_type: rec.question_type,
              position: (unit.questions?.length || 0) + (toAdd.indexOf(rec) + 1),
              score: rec.score,
              question: {
                id: rec.question_id,
                title: rec.title,
                question_type: rec.question_type,
                difficulty: rec.difficulty,
                subject: paper.subject,
              },
              recommendation_tags: rec.recommendation_tags || [],
              alternatives: rec.alternatives || [],
            });
          }
        });
      });
      set({ generateReport: { constraint_dashboard: data.constraint_dashboard || {} } });
      set({ dirty: true });
    } finally {
      set({ loading: false });
    }
  },

  // Type config
  addTypeConfig: (uid, config) => {
    const { paper } = get();
    if (!paper) return;
    set({
      paper: {
        ...paper,
        units: paper.units.map((u) =>
          u.id === uid ? { ...u, question_config: [...u.question_config, config] } : u
        ),
      },
      dirty: true,
    });
  },

  updateTypeConfig: (uid, index, config) => {
    const { paper } = get();
    if (!paper) return;
    const newScorePerQuestion = config.score_per_question;
    set({
      paper: {
        ...paper,
        units: paper.units.map((u) => {
          if (u.id !== uid) return u;
          const cfgs = [...u.question_config];
          const oldCfg = cfgs[index];
          cfgs[index] = { ...oldCfg, ...config };
          // 同步更新该题型已有题目的分值
          let questions = u.questions;
          if (newScorePerQuestion !== undefined && newScorePerQuestion !== oldCfg.score_per_question) {
            const targetType = cfgs[index].question_type;
            questions = (questions || []).map((q) =>
              q.question_type === targetType ? { ...q, score: newScorePerQuestion } : q
            );
          }
          return { ...u, question_config: cfgs, questions };
        }),
      },
      dirty: true,
    });
  },

  removeTypeConfig: (uid, index) => {
    const { paper } = get();
    if (!paper) return;
    const newUnits = paper.units
      .map((u) => {
        if (u.id !== uid) return u;
        const cfgs = u.question_config.filter((_, i) => i !== index);
        return { ...u, question_config: cfgs };
      })
      .filter((u) => (u.question_config || []).length > 0)  // 清理空单元
      .map((u, i) => ({ ...u, position: i + 1 }));  // 重新编号
    set({ paper: { ...paper, units: newUnits }, dirty: true });
  },

  // Persistence
  autoSave: async () => {
    const { paper, dirty } = get();
    if (!paper || !dirty) return;
    set({ saving: true });
    try {
      if (paper.id) {
        await paperApi.saveAll(paper.id, paper);
      } else {
        const resp = await paperApi.create({
          title: paper.title || '未命名试卷',
          subject: paper.subject,
          grade_level: paper.grade_level,
          status: 'DRAFT',
        });
        const newId = resp.data?.id || resp.data;
        set({ paper: { ...paper, id: newId }, saving: false, dirty: false, lastSaved: new Date() });
        return;
      }
      set({ saving: false, dirty: false, lastSaved: new Date() });
    } catch {
      set({ saving: false });
    }
  },

  saveAll: async () => {
    const { paper } = get();
    if (!paper || !paper.id) return;
    set({ saving: true });
    try {
      await paperApi.saveAll(paper.id, paper);
      set({ saving: false, dirty: false, lastSaved: new Date() });
    } catch {
      set({ saving: false });
    }
  },

  setDirty: (dirty) => set({ dirty }),
  setGenerateReport: (report) => set({ generateReport: report ? { constraint_dashboard: report.constraint_dashboard } : null }),
  reset: () => set({ paper: null, currentStep: 0, dirty: false, lastSaved: null, autoSelectReports: [], generateReport: null }),
}));
