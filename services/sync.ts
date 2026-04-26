import type { Card, Collection, ReviewLog } from '@/types/models';
import { apiRequest } from './api';
import * as db from './database';

interface SyncPayload {
  collections?: any[];
  cards?: any[];
  review_logs?: any[];
  since?: string | null;
}

interface SyncResponse {
  collections: Collection[];
  cards: Card[];
  review_logs: ReviewLog[];
}

export async function performSync(): Promise<{ success: boolean; error?: string }> {
  try {
    const queue = await db.getSyncQueue();
    const lastSync = await db.getLastSyncTime();

    const payload: SyncPayload = {
      collections: [],
      cards: [],
      review_logs: [],
      since: lastSync,
    };

    for (const item of queue) {
      const data = JSON.parse(item.payload);
      switch (item.entity_type) {
        case 'collection':
          payload.collections!.push(data);
          break;
        case 'card':
          payload.cards!.push(data);
          break;
        case 'review_log':
          payload.review_logs!.push(data);
          break;
      }
    }

    const response = await apiRequest<SyncResponse>('/api/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (response.collections) {
      for (const col of response.collections) {
        const collection: Collection = {
          ...col,
          tags: Array.isArray(col.tags)
            ? col.tags
            : col.tags
              ? String(col.tags).split(',').map((t: string) => t.trim()).filter(Boolean)
              : [],
        };
        await db.upsertCollection(collection);
      }
    }

    if (response.cards) {
      for (const card of response.cards) {
        await db.upsertCard(card);
      }
    }

    if (response.review_logs) {
      for (const log of response.review_logs) {
        await db.upsertReviewLog(log);
      }
    }

    await db.clearSyncQueue();
    await db.setLastSyncTime(new Date().toISOString());

    return { success: true };
  } catch (e: any) {
    const errorMsg = e.message ?? '';
    if (errorMsg.includes('type_error') || errorMsg.includes('value_error') || errorMsg.includes('loc') || errorMsg.includes('msg')) {
      await db.clearSyncQueue();
      return { success: false, error: 'Sync queue contained invalid legacy data and was cleared. ' + errorMsg };
    }
    return { success: false, error: errorMsg || 'Sync failed' };
  }
}

// wrappers
export async function getPendingSyncCount(): Promise<number> {
  return db.getSyncQueueCount();
}

export async function clearPendingSync(): Promise<void> {
  return db.clearSyncQueue();
}
