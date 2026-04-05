import type { Card, Collection, ReviewLog, SyncEntity, SyncOperation, SyncQueueItem } from '@/types/models';
import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

const uuidv4 = () => Crypto.randomUUID();

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('flashcards.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await initTables();
  return db;
}

async function initTables() {
  const d = db!;
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      tags TEXT,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_deleted INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      collection_id TEXT NOT NULL,
      user_id TEXT,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      interval INTEGER NOT NULL DEFAULT 0,
      repetitions INTEGER NOT NULL DEFAULT 0,
      next_review_date TEXT,
      last_review_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      is_deleted INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (collection_id) REFERENCES collections(id)
    );

    CREATE TABLE IF NOT EXISTS review_logs (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      quality TEXT NOT NULL,
      reviewed_at TEXT NOT NULL DEFAULT (datetime('now')),
      interval_before INTEGER NOT NULL DEFAULT 0,
      interval_after INTEGER NOT NULL DEFAULT 0,
      ease_factor_before REAL NOT NULL DEFAULT 2.5,
      ease_factor_after REAL NOT NULL DEFAULT 2.5,
      FOREIGN KEY (card_id) REFERENCES cards(id)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

// Sync 

export async function getLastSyncTime(): Promise<string | null> {
  const d = await getDatabase();
  const row = await d.getFirstAsync<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', ['last_sync']);
  return row?.value ?? null;
}

export async function setLastSyncTime(time: string): Promise<void> {
  const d = await getDatabase();
  await d.runAsync('INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)', ['last_sync', time]);
}

export async function addToSyncQueue(entityType: SyncEntity, entityId: string, operation: SyncOperation, payload: object): Promise<void> {
  const d = await getDatabase();
  await d.runAsync(
    'INSERT INTO sync_queue (entity_type, entity_id, operation, payload) VALUES (?, ?, ?, ?)',
    [entityType, entityId, operation, JSON.stringify(payload)]
  );
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const d = await getDatabase();
  return await d.getAllAsync<SyncQueueItem>('SELECT * FROM sync_queue ORDER BY created_at ASC');
}

export async function clearSyncQueue(): Promise<void> {
  const d = await getDatabase();
  await d.runAsync('DELETE FROM sync_queue');
}

export async function getSyncQueueCount(): Promise<number> {
  const d = await getDatabase();
  const row = await d.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sync_queue');
  return row?.count ?? 0;
}

export async function removeSyncQueueItem(id: number): Promise<void> {
  const d = await getDatabase();
  await d.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
}

// Collections

function rowToCollection(row: any): Collection {
  return {
    ...row,
    tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
    is_deleted: !!row.is_deleted,
  };
}

export async function getCollections(userId: string): Promise<Collection[]> {
  const d = await getDatabase();
  const rows = await d.getAllAsync('SELECT * FROM collections WHERE user_id = ? AND is_deleted = 0 ORDER BY updated_at DESC', [userId]);
  return rows.map(rowToCollection);
}

export async function getCollectionById(id: string): Promise<Collection | null> {
  const d = await getDatabase();
  const row = await d.getFirstAsync('SELECT * FROM collections WHERE id = ?', [id]);
  return row ? rowToCollection(row) : null;
}

export async function createCollection(collection: { id?: string; user_id: string; name: string; description: string | null; tags: string[]; color: string | null }): Promise<Collection> {
  const d = await getDatabase();
  const id = collection.id || uuidv4();
  const now = new Date().toISOString();
  const tagsStr = collection.tags.join(',');
  await d.runAsync(
    'INSERT INTO collections (id, user_id, name, description, tags, color, created_at, updated_at, is_deleted, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)',
    [id, collection.user_id, collection.name, collection.description, tagsStr, collection.color, now, now]
  );
  const created = await getCollectionById(id);
  return created!;
}

export async function updateCollection(collection: Collection): Promise<void> {
  const d = await getDatabase();
  const tagsStr = collection.tags.join(',');
  const now = new Date().toISOString();
  await d.runAsync(
    'UPDATE collections SET name = ?, description = ?, tags = ?, color = ?, updated_at = ?, version = version + 1 WHERE id = ?',
    [collection.name, collection.description, tagsStr, collection.color, now, collection.id]
  );
}

export async function deleteCollection(id: string): Promise<void> {
  const d = await getDatabase();
  const now = new Date().toISOString();
  await d.runAsync('UPDATE collections SET is_deleted = 1, updated_at = ?, version = version + 1 WHERE id = ?', [now, id]);
  await d.runAsync('UPDATE cards SET is_deleted = 1, updated_at = ?, version = version + 1 WHERE collection_id = ?', [now, id]);
}

export async function upsertCollection(collection: Collection): Promise<void> {
  const d = await getDatabase();
  const tagsStr = collection.tags.join(',');
  await d.runAsync(
    `INSERT INTO collections (id, user_id, name, description, tags, color, created_at, updated_at, is_deleted, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name, description = excluded.description, tags = excluded.tags,
       color = excluded.color, updated_at = excluded.updated_at,
       is_deleted = excluded.is_deleted, version = excluded.version
     WHERE excluded.version >= collections.version`,
    [collection.id, collection.user_id, collection.name, collection.description, tagsStr, collection.color, collection.created_at, collection.updated_at, collection.is_deleted ? 1 : 0, collection.version]
  );
}

// Cards

function rowToCard(row: any): Card {
  return {
    ...row,
    is_deleted: !!row.is_deleted, // Double Bang because of sqlite
  };
}

export async function getCardsByCollection(collectionId: string): Promise<Card[]> {
  const d = await getDatabase();
  const rows = await d.getAllAsync('SELECT * FROM cards WHERE collection_id = ? AND is_deleted = 0 ORDER BY created_at DESC', [collectionId]);
  return rows.map(rowToCard);
}

export async function getCardById(id: string): Promise<Card | null> {
  const d = await getDatabase();
  const row = await d.getFirstAsync('SELECT * FROM cards WHERE id = ?', [id]);
  return row ? rowToCard(row) : null;
}

export async function getTotalCardCount(userId: string): Promise<number> {
  const d = await getDatabase();
  const row = await d.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM cards c JOIN collections col ON c.collection_id = col.id WHERE col.user_id = ? AND c.is_deleted = 0 AND col.is_deleted = 0',
    [userId]
  );
  return row?.count ?? 0;
}

export async function getDueCardCount(userId: string): Promise<number> {
  const d = await getDatabase();
  const now = new Date().toISOString();
  const row = await d.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM cards c JOIN collections col ON c.collection_id = col.id
     WHERE col.user_id = ? AND c.is_deleted = 0 AND col.is_deleted = 0
     AND (c.next_review_date IS NULL OR c.next_review_date <= ?)`,
    [userId, now]
  );
  return row?.count ?? 0;
}

export async function getDueCards(userId: string, collectionId?: string | null, limit?: number): Promise<Card[]> {
  const d = await getDatabase();
  const now = new Date().toISOString();
  let sql = `SELECT c.* FROM cards c JOIN collections col ON c.collection_id = col.id
     WHERE col.user_id = ? AND c.is_deleted = 0 AND col.is_deleted = 0
     AND (c.next_review_date IS NULL OR c.next_review_date <= ?)`;
  const params: any[] = [userId, now];

  if (collectionId) {
    sql += ' AND c.collection_id = ?';
    params.push(collectionId);
  }

  sql += ' ORDER BY c.next_review_date ASC';

  if (limit) {
    sql += ' LIMIT ?';
    params.push(limit);
  }

  const rows = await d.getAllAsync(sql, params);
  return rows.map(rowToCard);
}

export async function createCard(card: { collection_id: string; front: string; back: string; user_id?: string }): Promise<Card> {
  const d = await getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();
  await d.runAsync(
    'INSERT INTO cards (id, collection_id, user_id, front, back, ease_factor, interval, repetitions, created_at, updated_at, is_deleted, version) VALUES (?, ?, ?, ?, ?, 2.5, 0, 0, ?, ?, 0, 1)',
    [id, card.collection_id, card.user_id ?? null, card.front, card.back, now, now]
  );
  return (await getCardById(id))!;
}

export async function updateCard(card: Card): Promise<void> {
  const d = await getDatabase();
  const now = new Date().toISOString();
  await d.runAsync(
    `UPDATE cards SET front = ?, back = ?, ease_factor = ?, interval = ?, repetitions = ?,
     next_review_date = ?, last_review_date = ?, updated_at = ?, version = version + 1
     WHERE id = ?`,
    [card.front, card.back, card.ease_factor, card.interval, card.repetitions,
     card.next_review_date, card.last_review_date, now, card.id]
  );
}

export async function deleteCard(id: string): Promise<void> {
  const d = await getDatabase();
  const now = new Date().toISOString();
  await d.runAsync('UPDATE cards SET is_deleted = 1, updated_at = ?, version = version + 1 WHERE id = ?', [now, id]);
}

export async function upsertCard(card: Card): Promise<void> {
  const d = await getDatabase();
  await d.runAsync(
    `INSERT INTO cards (id, collection_id, user_id, front, back, ease_factor, interval, repetitions,
       next_review_date, last_review_date, created_at, updated_at, is_deleted, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       collection_id = excluded.collection_id, front = excluded.front, back = excluded.back,
       ease_factor = excluded.ease_factor, interval = excluded.interval, repetitions = excluded.repetitions,
       next_review_date = excluded.next_review_date, last_review_date = excluded.last_review_date,
       updated_at = excluded.updated_at, is_deleted = excluded.is_deleted, version = excluded.version
     WHERE excluded.version >= cards.version`,
    [card.id, card.collection_id, card.user_id ?? null, card.front, card.back,
     card.ease_factor, card.interval, card.repetitions,
     card.next_review_date, card.last_review_date,
     card.created_at, card.updated_at, card.is_deleted ? 1 : 0, card.version]
  );
}

// Review Logs

function rowToReviewLog(row: any): ReviewLog {
  return row as ReviewLog;
}

export async function getReviewCountToday(userId: string): Promise<number> {
  const d = await getDatabase();
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const row = await d.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM review_logs WHERE user_id = ? AND reviewed_at >= ?',
    [userId, startOfDay]
  );
  return row?.count ?? 0;
}

export async function getReviewCountByDateRange(userId: string, start: Date, end: Date): Promise<Record<string, number>> {
  const d = await getDatabase();
  const rows = await d.getAllAsync<{ date: string; count: number }>(
    `SELECT DATE(reviewed_at) as date, COUNT(*) as count FROM review_logs
     WHERE user_id = ? AND reviewed_at >= ? AND reviewed_at <= ?
     GROUP BY DATE(reviewed_at)`,
    [userId, start.toISOString(), end.toISOString()]
  );
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.date] = row.count;
  }
  return result;
}

export async function createReviewLog(log: Omit<ReviewLog, 'id'> & { id?: string }): Promise<ReviewLog> {
  const d = await getDatabase();
  const id = log.id || uuidv4();
  await d.runAsync(
    'INSERT INTO review_logs (id, card_id, user_id, quality, reviewed_at, interval_before, interval_after, ease_factor_before, ease_factor_after) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, log.card_id, log.user_id, log.quality, log.reviewed_at, log.interval_before, log.interval_after, log.ease_factor_before, log.ease_factor_after]
  );
  const row = await d.getFirstAsync('SELECT * FROM review_logs WHERE id = ?', [id]);
  return rowToReviewLog(row);
}

export async function upsertReviewLog(log: ReviewLog): Promise<void> {
  const d = await getDatabase();
  await d.runAsync(
    `INSERT OR IGNORE INTO review_logs (id, card_id, user_id, quality, reviewed_at, interval_before, interval_after, ease_factor_before, ease_factor_after)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [log.id, log.card_id, log.user_id, log.quality, log.reviewed_at, log.interval_before, log.interval_after, log.ease_factor_before, log.ease_factor_after]
  );
}

//  Bulk delete

export async function clearAllData(): Promise<void> {
  const d = await getDatabase();
  await d.execAsync(`
    DELETE FROM sync_queue;
    DELETE FROM review_logs;
    DELETE FROM cards;
    DELETE FROM collections;
    DELETE FROM sync_meta;
  `);
}
