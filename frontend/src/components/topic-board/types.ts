export type PandaEmotion = 'idle' | 'thinking' | 'explaining' | 'satisfied';

export interface ExplanationStepData {
  id: string;
  step_order: number;
  text: string;
  panda_emotion: PandaEmotion;
  board_line: string | null;
  created_at: string;
}

export interface GraphConfig {
  fn: string;
  fn2: string;
  fn3: string;
  points: string;
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
}

export interface ExplanationSession {
  id: string;
  question_id: string | null;
  title: string;
  topic: string | null;
  difficulty_label: string | null;
  problem_statement: string | null;
  graph_config: GraphConfig | null;
  is_active: boolean;
  steps: ExplanationStepData[];
}

export interface ExplanationSessionSummary {
  id: string;
  title: string;
  topic: string | null;
  difficulty_label: string | null;
}

export type BubbleType = 'thought' | 'speech' | 'callout';

export interface BubbleInstance {
  id: string;
  text: string;
  type: BubbleType;
  side: 'left' | 'right';
  delay: number;
}

export function getBubbleConfig(
  emotion: PandaEmotion,
  stepIndex: number,
  text: string,
): BubbleInstance[] {
  const side = (stepIndex % 2 === 0 ? 'right' : 'left') as 'left' | 'right';

  switch (emotion) {
    case 'thinking':
      return [{ id: `thought-${stepIndex}`, text, type: 'thought', side: 'left', delay: 0 }];
    case 'explaining':
      return [{ id: `speech-${stepIndex}`, text, type: 'speech', side, delay: 0 }];
    case 'satisfied':
      return [{ id: `speech-${stepIndex}`, text, type: 'speech', side, delay: 0 }];
    default:
      return [{ id: `speech-${stepIndex}`, text, type: 'speech', side: 'right', delay: 0 }];
  }
}
