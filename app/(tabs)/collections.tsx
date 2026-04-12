import Sheet, { ErrorBanner, SheetInput } from '@/components/Sheet';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import * as db from '@/services/database';
import { exportCollections, importFromFile } from '@/services/importExport';
import { performSync } from '@/services/sync';
import type { Collection } from '@/types/models';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CollectionsScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create / Edit sheet
  const [showSheet, setShowSheet] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState('#3B82F6');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const cols = await db.getCollections(user.id);
      setCollections(cols);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await performSync();
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ─── Create / Edit ───────────────────────────────────────────────────────────

  function openCreateSheet() {
    setEditingCollection(null);
    setName('');
    setDescription('');
    setTags([]);
    setTagInput('');
    setSelectedColor('#3B82F6');
    setError('');
    setShowSheet(true);
  }

  function openEditSheet(col: Collection) {
    setEditingCollection(col);
    setName(col.name);
    setDescription(col.description ?? '');
    setTags([...col.tags]);
    setTagInput('');
    setSelectedColor(col.color || '#3B82F6');
    setError('');
    setShowSheet(true);
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags(prev => [...prev, t]);
      setTagInput('');
    }
  }

  async function saveCollection() {
    if (!name.trim()) { setError('Name is required'); return; }
    if (!user) return;
    setSaving(true);
    setError('');

    try {
      let finalTags = [...tags];
      const pendingTag = tagInput.trim();
      if (pendingTag && !finalTags.includes(pendingTag)) {
        finalTags.push(pendingTag);
      }

      if (editingCollection) {
        const updated: Collection = {
          ...editingCollection,
          name: name.trim(),
          description: description.trim() || null,
          tags: finalTags,
          color: selectedColor,
        };
        await db.updateCollection(updated);
        await db.addToSyncQueue('collection', updated.id, 'update', updated);
      } else {
        const created = await db.createCollection({
          user_id: user.id,
          name: name.trim(),
          description: description.trim() || null,
          tags: finalTags,
          color: selectedColor,
        });
        await db.addToSyncQueue('collection', created.id, 'create', created);
      }
      setShowSheet(false);
      await loadData();
      performSync().catch(() => {});
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // ─── Selection mode ──────────────────────────────────────────────────────────

  function toggleSelection(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }

  function enterSelectionMode(id: string) {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }

  async function bulkDelete() {
    Alert.alert(
      'Delete Collections',
      `Delete ${selectedIds.size} collection(s)? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            for (const id of selectedIds) {
              await db.deleteCollection(id);
              const deletedCol = await db.getCollectionById(id);
              if (deletedCol) await db.addToSyncQueue('collection', id, 'update', deletedCol);
            }
            setSelectionMode(false);
            setSelectedIds(new Set());
            await loadData();
            performSync().catch(() => {});
          },
        },
      ],
    );
  }

  // ─── Import / Export ──────────────────────────────────────────────────────────

  async function handleImport() {
    if (!user) return;
    try {
      const result = await importFromFile(user.id);
      await loadData();
      performSync().catch(() => {});
      let msg = `Imported ${result.collectionsImported} collection(s) with ${result.cardsImported} card(s).`;
      if (result.errors.length > 0) {
        msg += `\n\n${result.errors.length} warning(s):\n${result.errors.slice(0, 3).join('\n')}`;
      }
      Alert.alert('Import Complete', msg);
    } catch (e: any) {
      if (e.message !== 'No file selected') {
        Alert.alert('Import Failed', e.message);
      }
    }
  }

  async function handleBulkExport() {
    try {
      await exportCollections(Array.from(selectedIds));
      setSelectionMode(false);
      setSelectedIds(new Set());
    } catch (e: any) {
      Alert.alert('Export Failed', e.message);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Background glows */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -60, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.04)' }} />

      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>Collections</Text>
        {selectionMode ? (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{selectedIds.size} selected</Text>
            <TouchableOpacity onPress={handleBulkExport}>
              <Ionicons name="share-outline" size={22} color={colors.accentLight} />
            </TouchableOpacity>
            <TouchableOpacity onPress={bulkDelete}>
              <Ionicons name="trash-outline" size={22} color="#F87171" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedIds(new Set()); }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={handleImport}
              style={{
                flexDirection: 'row', gap: 6, paddingHorizontal: 12, height: 38,
                borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="download-outline" size={18} color={colors.accentLight} />
              <Text style={{ color: colors.accentLight, fontSize: 13, fontWeight: '700' }}>Import</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openCreateSheet}
              style={{
                width: 38, height: 38, borderRadius: 12,
                backgroundColor: colors.accent,
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {collections.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Ionicons name="library-outline" size={80} color={colors.textMuted} />
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 20 }}>No Collections Yet</Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
            Tap the + button to create your first flashcard collection.
          </Text>
        </View>
      ) : (
        <FlatList
          data={collections}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          renderItem={({ item: col }) => {
            const isSelected = selectedIds.has(col.id);
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  if (selectionMode) toggleSelection(col.id);
                  else router.push(`/collection/${col.id}`);
                }}
                onLongPress={() => {
                  if (!selectionMode) enterSelectionMode(col.id);
                }}
                style={{
                  backgroundColor: isSelected ? (colors.accent + '18') : colors.surface,
                  borderWidth: 1, borderColor: isSelected ? colors.accent : colors.surfaceBorder,
                  borderRadius: 16, marginBottom: 10, overflow: 'hidden',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                  {selectionMode ? (
                    <View style={{
                      width: 24, height: 24, borderRadius: 12, marginRight: 14,
                      borderWidth: 2, borderColor: isSelected ? colors.accent : colors.textMuted,
                      backgroundColor: isSelected ? colors.accent : 'transparent',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  ) : (
                    <View style={{
                      width: 42, height: 42, borderRadius: 12,
                      backgroundColor: (col.color || colors.accent) + '20',
                      alignItems: 'center', justifyContent: 'center', marginRight: 14,
                    }}>
                      <Ionicons name="library" size={20} color={col.color || colors.accent} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>{col.name}</Text>
                    {col.description ? (
                      <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2 }} numberOfLines={1}>{col.description}</Text>
                    ) : null}
                    {col.tags.length > 0 && (
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      </View>
                    )}
                  </View>
                  {!selectionMode && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── Create / Edit Sheet ── */}
      <Sheet visible={showSheet} title={editingCollection ? 'Edit Collection' : 'New Collection'} onClose={() => setShowSheet(false)} scrollable>
        <ErrorBanner msg={error} />
        <SheetInput label="Name" value={name} onChangeText={setName} placeholder="Collection name" autoCapitalize="words" />
        <SheetInput label="Description (optional)" value={description} onChangeText={setDescription} placeholder="Short description" multiline autoCapitalize="sentences" />


        <TouchableOpacity
          onPress={saveCollection}
          disabled={saving}
          activeOpacity={0.85}
          style={{
            backgroundColor: colors.accent, borderRadius: 14, height: 52,
            alignItems: 'center', justifyContent: 'center', marginTop: 24,
            shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>
              {editingCollection ? 'Save Changes' : 'Create Collection'}
            </Text>
          )}
        </TouchableOpacity>
      </Sheet>
    </SafeAreaView>
  );
}
