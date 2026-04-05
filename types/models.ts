// ─── Collection ────────────────────────────────────────────────────────────────

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  tags: string[];
  color: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  version: number;
}

// Card

export interface Card {
  id: string;
  collection_id: string;
  user_id?: string;
  front: string;
  back: string;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review_date: string | null;
  last_review_date: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  version: number;
}

// Review

export type ReviewQuality = 'wrong' | 'hard' | 'good' | 'easy';

export interface ReviewLog {
  id: string;
  card_id: string;
  user_id: string;
  quality: ReviewQuality;
  reviewed_at: string;
  interval_before: number;
  interval_after: number;
  ease_factor_before: number;
  ease_factor_after: number;
}

// Study Settings

export interface StudySettings {
  userId: string;
  maxReviewsPerDay: number;
  maxNewCardsPerDay: number;
  showAnswerTimer: boolean;
  autoPlayAudio: boolean;
  showIntervalButtons: boolean;
  darkMode: boolean;
  updatedAt: string;
}

// Spaced Repetition

export interface ReviewResult {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: Date;
}

// Sync Queue

export type SyncOperation = 'create' | 'update' | 'delete';
export type SyncEntity = 'collection' | 'card' | 'review_log';

export interface SyncQueueItem {
  id: number;
  entity_type: SyncEntity;
  entity_id: string;
  operation: SyncOperation;
  payload: string; // data in JSON format
  created_at: string;
}
