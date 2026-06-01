// V3.5.1: 单元化试卷类型定义

export interface QuestionConfigItem {
  question_type: string;
  count: number;
  score_per_question: number;
}

export interface ExamPaperUnit {
  id?: string;
  exam_paper_id?: string;
  name: string;
  description?: string;
  position: number;
  time_limit_minutes?: number | null;
  question_config: QuestionConfigItem[];
  total_score?: number;
  questions?: ExamPaperUnitQuestion[];
  created_at?: string;
  updated_at?: string;
  // UI state
  _expanded?: boolean;
  _typeRowsExpanded?: Record<number, boolean>;
}

export interface ExamPaperUnitQuestion {
  id?: string;
  unit_id?: string;
  question_id: string;
  question_type: string;
  position: number;
  score: number;
  // joined question data
  question?: QuestionBrief;
}

export interface QuestionBrief {
  id: string;
  title: string;
  question_type: string;
  difficulty: string;
  subject: string;
  grade_level?: any;
  correct_answer?: string;
  options?: { label: string; text: string }[];
  score?: number;
  explanation?: string;
  is_typical?: boolean;
  review_status?: string;
}

export interface PaperDraft {
  id?: string;
  title: string;
  subject: string;
  grade_level: any;
  duration_minutes?: number | null;
  difficulty_ratio: DifficultyRatio;
  total_score: number;
  status: string;
  subtitle?: string;
  instructions?: string;
  description?: string;
  units: ExamPaperUnit[];
  knowledge_node_ids: string[];
}

export interface AutoSelectReport {
  unit_name: string;
  type_label: string;
  required: number;
  filled: number;
  status: 'full' | 'partial' | 'empty';
  warnings: string[];
}

export interface PaperListItem {
  id: string;
  title: string;
  subject?: string;
  grade_level?: any;
  total_score?: number;
  duration_minutes?: number;
  status: string;
  unit_count?: number;
  question_count?: number;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

// V3.6 推荐引擎类型
export interface DifficultyRatio {
  EASY: number;
  MEDIUM: number;
  HARD: number;
}

export interface GenerateRecommendation {
  question_id: string;
  question_type: string;
  difficulty: string;
  score: number;
  title: string;
  recommendation_tags: string[];
  alternatives: AlternativeQuestion[];
}

export interface AlternativeQuestion {
  question_id: string;
  title: string;
  difficulty: string;
  tags: string[];
}

export interface ConstraintDashboard {
  difficulty: Record<string, { target: number; actual: number; matched: boolean }>;
  knowledge_coverage: { matched: number; total: number };
  total_score: number;
}

export interface GenerateReport {
  questions: GenerateRecommendation[];
  constraint_dashboard: ConstraintDashboard;
}
