import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import * as db from '@/services/database';
import { isCardDue } from '@/services/spacedRepetition';
import type { Collection } from '@/types/models';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FilterMode = 'all' | 'due' | 'new' | 'learning';

export default function StudySelectScreen() {
  const { collectionId } = useLocalSearchParams<{ collectionId?: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [cardCounts, setCardCounts] = useState<Record<string, { total: number; due: number; new_: number; learning: number }>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterMode, setFilterMode] = useState<FilterMode>('due');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const cols = await db.getCollections(user.id);
      setCollections(cols);

      if (collectionId) {
        setSelectedIds(new Set([collectionId]));
      }

      const tagSet = new Set<string>();
      cols.forEach(c => c.tags.forEach(t => tagSet.add(t)));
      setAllTags(Array.from(tagSet).sort());

      const counts: typeof cardCounts = {};
      for (const col of cols) {
        const cards = await db.getCardsByCollection(col.id);
        let dueCount = 0, newCount = 0, learningCount = 0;
        for (const card of cards) {
          if (!card.next_review_date) newCount++;
          else if (isCardDue(card)) dueCount++;
          else if (card.repetitions > 0 && card.interval < 21) learningCount++;
        }
        counts[col.id] = { total: cards.length, due: dueCount, new_: newCount, learning: learningCount };
      }
      setCardCounts(counts);
    } catch {} finally {
      setLoading(false);
    }
  }, [user, collectionId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  // helpers
  function getFilteredCount(colId: string): number {
    const c = cardCounts[colId];
    if (!c) return 0;
    switch (filterMode) {
      case 'all': return c.total;
      case 'due': return c.due + c.new_;
      case 'new': return c.new_;
      case 'learning': return c.learning;
    }
  }

  function totalSelectedCount(): number {
    let total = 0;
    for (const id of selectedIds) {
      total += getFilteredCount(id);
    }
    return total;
  }

  function toggleCollection(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTag(tag: string) {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  const filteredCollections = selectedTags.size > 0
    ? collections.filter(c => c.tags.some(t => selectedTags.has(t)))
    : collections;

  function startStudy() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds).join(',');
    router.push({ pathname: '/study-session', params: { collectionIds: ids, filterMode } });
  }


  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  const filters: { key: FilterMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'due', label: 'Due', icon: 'time-outline' },
    { key: 'new', label: 'New', icon: 'sparkles-outline' },
    { key: 'learning', label: 'Learning', icon: 'trending-up-outline' },
    { key: 'all', label: 'All', icon: 'layers-outline' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Background glows */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -60, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: isDark ? 'rgba(34,197,94,0.08)' : 'rgba(34,197,94,0.04)' }} />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800', flex: 1 }}>Study</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Filter chips */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>Filter</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4 }}>
              {filters.map((f) => {
                const isActive = filterMode === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => setFilterMode(f.key)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 6,
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
                      backgroundColor: isActive ? colors.accent : colors.surface,
                      borderWidth: 1, borderColor: isActive ? colors.accent : colors.surfaceBorder,
                    }}
                  >
                    <Ionicons name={f.icon} size={15} color={isActive ? '#fff' : colors.textMuted} />
                    <Text style={{ color: isActive ? '#fff' : colors.text, fontSize: 13, fontWeight: '600' }}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Tag chips */}
        {allTags.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>Tags</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {allTags.map((tag) => {
                const isActive = selectedTags.has(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    activeOpacity={0.7}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
                      backgroundColor: isActive ? colors.accentSoft : colors.surface,
                      borderWidth: 1, borderColor: isActive ? colors.accentBorder : colors.surfaceBorder,
                    }}
                  >
                    <Text style={{ color: isActive ? colors.accentLight : colors.textMuted, fontSize: 13, fontWeight: '500' }}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Collection list */}
        <View style={{ paddingHorizontal: 16 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>Decks</Text>
          {filteredCollections.map((col) => {
            const isSelected = selectedIds.has(col.id);
            const count = getFilteredCount(col.id);

            return (
              <TouchableOpacity
                key={col.id}
                onPress={() => toggleCollection(col.id)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row', alignItems: 'center', padding: 14,
                  backgroundColor: isSelected ? (colors.accent + '12') : colors.surface,
                  borderWidth: 1, borderColor: isSelected ? colors.accent : colors.surfaceBorder,
                  borderRadius: 14, marginBottom: 8,
                }}
              >
                <View style={{
                  width: 24, height: 24, borderRadius: 12,
                  borderWidth: 2, borderColor: isSelected ? colors.accent : colors.textMuted,
                  backgroundColor: isSelected ? colors.accent : 'transparent',
                  alignItems: 'center', justifyContent: 'center', marginRight: 14,
                }}>
                  {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <View style={{
                  width: 4, height: 36, borderRadius: 2,
                  backgroundColor: col.color || colors.accent, marginRight: 12,
                }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{col.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                    {count} card{count !== 1 ? 's' : ''}
                  </Text>
                </View>
                {count > 0 && (
                  <View style={{
                    backgroundColor: colors.accentSoft, borderRadius: 10,
                    paddingHorizontal: 10, paddingVertical: 4,
                  }}>
                    <Text style={{ color: colors.accentLight, fontSize: 12, fontWeight: '700' }}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Start button */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20, paddingBottom: 32, paddingTop: 16,
        backgroundColor: colors.background,
      }}>
        <TouchableOpacity
          onPress={startStudy}
          disabled={selectedIds.size === 0 || totalSelectedCount() === 0}
          activeOpacity={0.85}
          style={{
            backgroundColor: selectedIds.size === 0 || totalSelectedCount() === 0 ? colors.textMuted : '#22C55E',
            borderRadius: 16, height: 56,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: '#22C55E', shadowOffset: { width: 0, height: 6 },
            shadowOpacity: selectedIds.size > 0 ? 0.4 : 0, shadowRadius: 14, elevation: 8,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="play-circle" size={22} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>
              Start Study ({totalSelectedCount()})
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
