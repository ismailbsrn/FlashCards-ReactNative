import { apiRequest } from './api';
import type { ReviewLog } from '@/types/models';

export const reviewLogsApi = {
  getAll: (cardId?: string, since?: string) => {
    const params: string[] = [];
    if (cardId) params.push(`card_id=${encodeURIComponent(cardId)}`);
    if (since) params.push(`since=${encodeURIComponent(since)}`);
    const qs = params.length > 0 ? `?${params.join('&')}` : '';
    return apiRequest<ReviewLog[]>(`/api/review-logs${qs}`);
  },

  create: (data: {
    id?: string;
    card_id: string;
    quality: string;
    reviewed_at?: string;
    interval_before: number;
    interval_after: number;
    ease_factor_before: number;
    ease_factor_after: number;
  }) =>
    apiRequest<ReviewLog>('/api/review-logs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
