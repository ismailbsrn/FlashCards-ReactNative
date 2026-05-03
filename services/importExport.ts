import type { Card, Collection } from '@/types/models';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system/next';
import * as Sharing from 'expo-sharing';
import * as db from './database';


export interface ExportData {
  version: 1;
  exported_at: string;
  collections: ExportCollection[];
}

interface ExportCollection {
  name: string;
  description: string | null;
  tags: string[];
  color: string | null;
  cards: ExportCard[];
}

interface ExportCard {
  front: string;
  back: string;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review_date: string | null;
  last_review_date: string | null;
}


export async function exportCollection(collectionId: string): Promise<void> {
  const collection = await db.getCollectionById(collectionId);
  if (!collection) throw new Error('Collection not found');

  const cards = await db.getCardsByCollection(collectionId);

  const data: ExportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    collections: [collectionToExport(collection, cards)],
  };

  await shareExportData(data, `${sanitizeFilename(collection.name)}.json`);
}

export async function exportCollections(collectionIds: string[]): Promise<void> {
  const exportCollections: ExportCollection[] = [];

  for (const id of collectionIds) {
    const collection = await db.getCollectionById(id);
    if (!collection) continue;
    const cards = await db.getCardsByCollection(id);
    exportCollections.push(collectionToExport(collection, cards));
  }

  if (exportCollections.length === 0) throw new Error('No collections to export');

  const data: ExportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    collections: exportCollections,
  };

  const filename = exportCollections.length === 1
    ? `${sanitizeFilename(exportCollections[0].name)}.json`
    : `flashcards_export_${exportCollections.length}_decks.json`;

  await shareExportData(data, filename);
}

export async function exportAllData(userId: string): Promise<void> {
  const collections = await db.getCollections(userId);
  const exportCollections: ExportCollection[] = [];

  for (const col of collections) {
    const cards = await db.getCardsByCollection(col.id);
    exportCollections.push(collectionToExport(col, cards));
  }

  const data: ExportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    collections: exportCollections,
  };

  const totalCards = exportCollections.reduce((sum, c) => sum + c.cards.length, 0);
  await shareExportData(data, `flashcards_all_${collections.length}_decks_${totalCards}_cards.json`);
}

export interface ImportResult {
  collectionsImported: number;
  cardsImported: number;
  errors: string[];
}

export async function importFromFile(userId: string): Promise<ImportResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    throw new Error('No file selected');
  }

  const fileUri = result.assets[0].uri;
  const file = new File(fileUri);
  const content = await file.text();

  let data: ExportData;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error('Invalid JSON file');
  }

  return importData(data, userId);
}

export async function importData(data: ExportData, userId: string): Promise<ImportResult> {
  const errors: string[] = [];
  let collectionsImported = 0;
  let cardsImported = 0;

  if (!data || !data.collections || !Array.isArray(data.collections)) {
    throw new Error('Invalid export format. Expected { version, collections: [...] }');
  }

  for (const colData of data.collections) {
    try {
      if (!colData.name) {
        errors.push(`Skipped collection with no name`);
        continue;
      }

      const collection = await db.createCollection({
        user_id: userId,
        name: colData.name,
        description: colData.description ?? null,
        tags: colData.tags ?? [],
        color: colData.color ?? null,
      });
      await db.addToSyncQueue('collection', collection.id, 'create', collection);
      collectionsImported++;

      if (colData.cards && Array.isArray(colData.cards)) {
        for (const cardData of colData.cards) {
          try {
            if (!cardData.front || !cardData.back) {
              errors.push(`Skipped card in "${colData.name}" with empty front/back`);
              continue;
            }

            const card = await db.createCard({
              collection_id: collection.id,
              front: cardData.front,
              back: cardData.back,
              user_id: userId,
            });

            if (cardData.ease_factor || cardData.interval || cardData.repetitions || cardData.next_review_date) {
              const updatedCard: Card = {
                ...card,
                ease_factor: cardData.ease_factor ?? card.ease_factor,
                interval: cardData.interval ?? card.interval,
                repetitions: cardData.repetitions ?? card.repetitions,
                next_review_date: cardData.next_review_date ?? card.next_review_date,
                last_review_date: cardData.last_review_date ?? card.last_review_date,
              };
              await db.updateCard(updatedCard);
              await db.addToSyncQueue('card', card.id, 'update', updatedCard);
            } else {
              await db.addToSyncQueue('card', card.id, 'create', card);
            }
            cardsImported++;
          } catch (e: any) {
            errors.push(`Card error in "${colData.name}": ${e.message}`);
          }
        }
      }
    } catch (e: any) {
      errors.push(`Collection "${colData.name}": ${e.message}`);
    }
  }

  return { collectionsImported, cardsImported, errors };
}


export async function importCSVToCollection(collectionId: string, userId: string): Promise<ImportResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    throw new Error('No file selected');
  }

  const fileUri = result.assets[0].uri;
  const file = new File(fileUri);
  const content = await file.text();
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const errors: string[] = [];
  let cardsImported = 0;

  const startIdx = lines.length > 0 && (lines[0].toLowerCase().includes('front') || lines[0].toLowerCase().includes('question')) ? 1 : 0;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const sep = line.includes('\t') ? '\t' : ',';
    const parts = line.split(sep).map(p => p.trim().replace(/^["']|["']$/g, ''));

    if (parts.length < 2 || !parts[0] || !parts[1]) {
      errors.push(`Line ${i + 1}: Skipped — needs at least front and back separated by ${sep === '\t' ? 'tab' : 'comma'}`);
      continue;
    }

    try {
      const card = await db.createCard({
        collection_id: collectionId,
        front: parts[0],
        back: parts[1],
        user_id: userId,
      });
      await db.addToSyncQueue('card', card.id, 'create', card);
      cardsImported++;
    } catch (e: any) {
      errors.push(`Line ${i + 1}: ${e.message}`);
    }
  }

  return { collectionsImported: 0, cardsImported, errors };
}


function collectionToExport(collection: Collection, cards: Card[]): ExportCollection {
  return {
    name: collection.name,
    description: collection.description,
    tags: collection.tags,
    color: collection.color,
    cards: cards.map(c => ({
      front: c.front,
      back: c.back,
      ease_factor: c.ease_factor,
      interval: c.interval,
      repetitions: c.repetitions,
      next_review_date: c.next_review_date,
      last_review_date: c.last_review_date,
    })),
  };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
}

async function shareExportData(data: ExportData, filename: string): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const file = new File(Paths.cache, filename);
  try {
    if (!file.exists) file.create();
  } catch {}
  file.write(json);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export Flashcards',
      UTI: 'public.json',
    });
  } else {
    throw new Error('Sharing is not available on this device');
  }
}
