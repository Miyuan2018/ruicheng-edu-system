import apiClient from './client';

export const draftApi = {
  save: (paperId: string | null, data: any) =>
    apiClient.post('/drafts', { paper_id: paperId, data }),

  getByPaper: (paperId: string) =>
    apiClient.get(`/drafts?paper_id=${paperId}`),

  list: () =>
    apiClient.get('/drafts'),

  delete: (draftId: string) =>
    apiClient.delete(`/drafts/${draftId}`),
};
