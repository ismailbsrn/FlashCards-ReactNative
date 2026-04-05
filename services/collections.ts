import { apiRequest } from './api';
import type { Collection } from '@/types/models';

export const collectionsApi = {
  getAll: (since?: string) => {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    return apiRequest<Collection[]>(`/api/collections${qs}`);
  },

  getById: (id: string) =>
    apiRequest<Collection>(`/api/collections/${id}`),

  create: (data: { id?: string; name: string; description?: string | null; tags?: string[]; color?: string | null }) =>
    apiRequest<Collection>('/api/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name?: string; description?: string | null; tags?: string[]; color?: string | null; is_deleted?: boolean; version: number }) =>
    apiRequest<Collection>(`/api/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest<void>(`/api/collections/${id}`, { method: 'DELETE' }),
};
