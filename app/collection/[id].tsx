import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import * as db from '@/services/database';
import { performSync } from '@/services/sync';
import Sheet, { SheetInput, ErrorBanner } from '@/components/Sheet';
import ColorPicker from '@/components/ColorPicker';
import type { Card, Collection } from '@/types/models';

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit collection sheet
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [editColor, setEditColor] = useState('#3B82F6');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const col = await db.getCollectionById(id);
      setCollection(col);
      const cardList = await db.getCardsByCollection(id);
      setCards(cardList);
      setFilteredCards(cardList);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCards(cards);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredCards(cards.filter(c => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)));
    }
  }, [searchQuery, cards]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await performSync();
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // ─── Edit Collection ─────────────────────────────────────────────────────────

  function openEditSheet() {
    if (!collection) return;
    setEditName(collection.name);
    setEditDesc(collection.description ?? '');
    setEditTags([...collection.tags]);
    setEditTagInput('');
    setEditColor(collection.color || '#3B82F6');
    setError('');
    setShowEditSheet(true);
  }

  function addEditTag() {
    const t = editTagInput.trim();
    if (t && !editTags.includes(t)) {
      setEditTags(prev => [...prev, t]);
      setEditTagInput('');
    }
  }

  async function saveCollectionEdits() {
    if (!editName.trim()) { setError('Name is required'); return; }
    if (!collection) return;
    setSaving(true);
    setError('');
    try {
      const updated: Collection = {
        ...collection,
        name: editName.trim(),
        description: editDesc.trim() || null,
        tags: editTags,
        color: editColor,
      };
      await db.updateCollection(updated);
      await db.addToSyncQueue('collection', updated.id, 'update', updated);
      setShowEditSheet(false);
      await loadData();
      performSync().catch(() => {});
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete Collection ───────────────────────────────────────────────────────

  function confirmDeleteCollection() {
    Alert.alert('Delete Collection', 'This will delete the collection and all its cards.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          if (!collection) return;
          await db.deleteCollection(collection.id);
          const deletedCol = await db.getCollectionById(collection.id);
          if (deletedCol) await db.addToSyncQueue('collection', collection.id, 'update', deletedCol);
          performSync().catch(() => {});
          router.back();
        },
      },
    ]);
  }

  // ─── Card selection ──────────────────────────────────────────────────────────

  function toggleSelection(cid: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }

  async function bulkDeleteCards() {
    Alert.alert('Delete Cards', `Delete ${selectedIds.size} card(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          for (const cid of selectedIds) {
            await db.deleteCard(cid);
            const deletedCard = await db.getCardById(cid);
            if (deletedCard) await db.addToSyncQueue('card', cid, 'update', deletedCard);
          }
          setSelectionMode(false);
          setSelectedIds(new Set());
          await loadData();
          performSync().catch(() => {});
        },
      },
    ]);
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (!collection) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.textMuted }}>Collection not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Background glows */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -80, right: -80, width: 260, height: 260, borderRadius: 130, backgroundColor: (collection.color || colors.accent) + (isDark ? '15' : '08') }} />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }} numberOfLines={1}>{collection.name}</Text>
          {collection.description ? <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={1}>{collection.description}</Text> : null}
        </View>
        {selectionMode ? (
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{selectedIds.size}</Text>
            <TouchableOpacity onPress={bulkDeleteCards}>
              <Ionicons name="trash-outline" size={22} color="#F87171" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedIds(new Set()); }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={openEditSheet}>
              <Ionicons name="pencil-outline" size={22} color={colors.accentLight} />
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmDeleteCollection}>
              <Ionicons name="trash-outline" size={22} color="#F87171" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Search bar */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder,
        borderRadius: 14, marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 14, height: 44,
      }}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={{ flex: 1, color: colors.text, fontSize: 14, marginLeft: 10 }}
          placeholder="Search cards..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {filteredCards.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Ionicons name="documents-outline" size={64} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 15, marginTop: 16, textAlign: 'center' }}>
            {cards.length === 0 ? 'No cards yet.\nTap + to add your first card.' : 'No cards match your search.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredCards}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
          renderItem={({ item: card, index }) => {
            const isSelected = selectedIds.has(card.id);
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  if (selectionMode) toggleSelection(card.id);
                  else router.push({ pathname: '/card-editor', params: { cardId: card.id, collectionId: id } });
                }}
                onLongPress={() => {
                  if (!selectionMode) {
                    setSelectionMode(true);
                    setSelectedIds(new Set([card.id]));
                  }
                }}
                style={{
                  backgroundColor: isSelected ? (colors.accent + '18') : colors.surface,
                  borderWidth: 1, borderColor: isSelected ? colors.accent : colors.surfaceBorder,
                  borderRadius: 14, marginBottom: 8, overflow: 'hidden',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
                  {selectionMode && (
                    <View style={{
                      width: 22, height: 22, borderRadius: 11, marginRight: 12,
                      borderWidth: 2, borderColor: isSelected ? colors.accent : colors.textMuted,
                      backgroundColor: isSelected ? colors.accent : 'transparent',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSelected && <Ionicons name="checkmark" size={13} color="#fff" />}
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }} numberOfLines={2}>{card.front}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }} numberOfLines={2}>{card.back}</Text>
                  </View>
                  {!selectionMode && (
                    <View style={{ marginLeft: 12, alignItems: 'center' }}>
                      {card.next_review_date ? (
                        <Text style={{
                          fontSize: 10, fontWeight: '600',
                          color: new Date(card.next_review_date) <= new Date() ? '#F59E0B' : colors.textMuted,
                        }}>
                          {new Date(card.next_review_date) <= new Date() ? 'DUE' : `${Math.ceil((new Date(card.next_review_date).getTime() - Date.now()) / 86400000)}d`}
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 10, fontWeight: '600', color: '#22C55E' }}>NEW</Text>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* FABs */}
      {!selectionMode && (
        <View style={{ position: 'absolute', bottom: 24, right: 16, gap: 10, alignItems: 'center' }}>
          {cards.length > 0 && (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/study-select', params: { collectionId: id } })}
              activeOpacity={0.85}
              style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: '#22C55E',
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
              }}
            >
              <Ionicons name="play" size={22} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/card-editor', params: { collectionId: id } })}
            activeOpacity={0.85}
            style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: colors.accent,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
            }}
          >
            <Ionicons name="add" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Edit Collection Sheet ── */}
      <Sheet visible={showEditSheet} title="Edit Collection" onClose={() => setShowEditSheet(false)} scrollable>
        <ErrorBanner msg={error} />
        <SheetInput label="Name" value={editName} onChangeText={setEditName} placeholder="Collection name" autoCapitalize="words" />
        <SheetInput label="Description" value={editDesc} onChangeText={setEditDesc} placeholder="Short description" multiline autoCapitalize="sentences" />

        {/* Tags */}
        <View style={{ marginBottom: 16 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8, marginLeft: 2 }}>Tags</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{
              flex: 1, flexDirection: 'row', alignItems: 'center',
              backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.inputBorder,
              borderRadius: 14, paddingHorizontal: 16, height: 44,
            }}>
              <TextInput
                style={{ flex: 1, color: colors.text, fontSize: 14 }}
                placeholder="Add tag" placeholderTextColor={colors.textMuted}
                value={editTagInput} onChangeText={setEditTagInput}
                onSubmitEditing={addEditTag} returnKeyType="done"
              />
            </View>
            <TouchableOpacity onPress={addEditTag} style={{
              width: 44, height: 44, borderRadius: 14,
              backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
            }}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
          {editTags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {editTags.map((tag) => (
                <View key={tag} style={{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  backgroundColor: colors.accentSoft, borderRadius: 10,
                  paddingHorizontal: 10, paddingVertical: 5,
                }}>
                  <Text style={{ color: colors.accentLight, fontSize: 13 }}>{tag}</Text>
                  <TouchableOpacity onPress={() => setEditTags(prev => prev.filter(t => t !== tag))}>
                    <Ionicons name="close-circle" size={16} color={colors.accentLight} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <ColorPicker selected={editColor} onSelect={setEditColor} />

        <TouchableOpacity
          onPress={saveCollectionEdits} disabled={saving} activeOpacity={0.85}
          style={{
            backgroundColor: colors.accent, borderRadius: 14, height: 52,
            alignItems: 'center', justifyContent: 'center', marginTop: 24,
            shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </Sheet>
    </SafeAreaView>
  );
}
