import { apiRequest } from './api';
import type { Card } from '@/types/models';

export const cardsApi = {
  getAll: (collectionId?: string, since?: string) => {
    const params: string[] = [];
    if (collectionId) params.push(`collection_id=${encodeURIComponent(collectionId)}`);
    if (since) params.push(`since=${encodeURIComponent(since)}`);
    const qs = params.length > 0 ? `?${params.join('&')}` : '';
    return apiRequest<Card[]>(`/api/cards${qs}`);
  },

  getById: (id: string) =>
    apiRequest<Card>(`/api/cards/${id}`),

  create: (data: {
    id?: string;
    collection_id: string;
    front: string;
    back: string;
    ease_factor?: number;
    interval?: number;
    repetitions?: number;
    next_review_date?: string | null;
    last_review_date?: string | null;
    version?: number;
  }) =>
    apiRequest<Card>('/api/cards', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: {
    front?: string;
    back?: string;
    collection_id?: string;
    ease_factor?: number;
    interval?: number;
    repetitions?: number;
    next_review_date?: string | null;
    last_review_date?: string | null;
    is_deleted?: boolean;
    version: number;
  }) =>
    apiRequest<Card>(`/api/cards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest<void>(`/api/cards/${id}`, { method: 'DELETE' }),
};
