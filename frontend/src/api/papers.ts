import apiClient from './client';

export const paperApi = {
  // Paper CRUD
  create: (data: any) => apiClient.post('/exam-papers', data),
  get: (id: string) => apiClient.get(`/exam-papers/${id}`),
  list: (params?: any) => apiClient.get('/exam-papers', { params }),
  update: (id: string, data: any) => apiClient.put(`/exam-papers/${id}`, data),
  delete: (id: string) => apiClient.delete(`/exam-papers/${id}`),
  saveAll: (id: string, data: any) => apiClient.post(`/exam-papers/${id}/save-all`, data),
  publish: (id: string, data?: any) => apiClient.post(`/exam-papers/${id}/publish`, data),
  copy: (id: string) => apiClient.post(`/exam-papers/${id}/copy`),

  // Preview & Export
  preview: (id: string) => apiClient.get(`/exam-papers/${id}/preview`),
  exportWord: (id: string) => apiClient.get(`/exam-papers/${id}/export/word`, { responseType: 'blob' }),
  exportPdf: (id: string) => apiClient.get(`/exam-papers/${id}/export/pdf`, { responseType: 'blob' }),

  // Units
  addUnit: (paperId: string, data: any) => apiClient.post(`/exam-papers/${paperId}/units`, data),
  updateUnit: (paperId: string, uid: string, data: any) => apiClient.put(`/exam-papers/${paperId}/units/${uid}`, data),
  deleteUnit: (paperId: string, uid: string) => apiClient.delete(`/exam-papers/${paperId}/units/${uid}`),
  sortUnits: (paperId: string, data: any) => apiClient.put(`/exam-papers/${paperId}/units/sort`, data),

  // Unit questions
  addQuestion: (paperId: string, uid: string, data: any) => apiClient.post(`/exam-papers/${paperId}/units/${uid}/questions`, data),
  removeQuestion: (paperId: string, uid: string, qid: string) => apiClient.delete(`/exam-papers/${paperId}/units/${uid}/questions/${qid}`),
  sortQuestions: (paperId: string, uid: string, data: any) => apiClient.put(`/exam-papers/${paperId}/units/${uid}/questions/sort`, data),
  moveQuestion: (paperId: string, uid: string, qid: string, data: any) => apiClient.put(`/exam-papers/${paperId}/units/${uid}/questions/${qid}/move`, data),
  getUnitQuestions: (paperId: string, uid: string) => apiClient.get(`/exam-papers/${paperId}/units/${uid}/questions`),

  // Auto-select
  autoSelectUnit: (paperId: string, uid: string) => apiClient.post(`/exam-papers/${paperId}/units/${uid}/auto-select`),
  autoSelectAll: (paperId: string) => apiClient.post(`/exam-papers/${paperId}/auto-select-all`),

  // V3.6 推荐引擎
  autoGenerate: (paperId: string, data: {
    difficulty_ratio: { EASY: number; MEDIUM: number; HARD: number };
    knowledge_node_ids: string[];
    existing_question_ids?: string[];
    type_configs?: any[];
  }) => apiClient.post(`/exam-papers/${paperId}/auto-generate`, data),

  swapQuestion: (paperId: string, questionId: string) =>
    apiClient.post(`/exam-papers/${paperId}/questions/${questionId}/swap`),

  // Student
  submitUnit: (paperId: string, uid: string, data: any) => apiClient.post(`/exam-papers/${paperId}/units/${uid}/submit`, data),
  getSubmissionStatus: (paperId: string) => apiClient.get(`/exam-papers/${paperId}/submission-status`),

  // Questions pool
  getQuestions: (params?: any) => apiClient.get('/questions', { params }),
  getSubjects: () => apiClient.get('/subjects/all'),
};
