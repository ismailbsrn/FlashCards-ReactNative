import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import * as db from '@/services/database';
import { performSync } from '@/services/sync';
import type { Collection } from '@/types/models';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [dueCards, setDueCards] = useState(0);
  const [studiedToday, setStudiedToday] = useState(0);
  const [reviewHistory, setReviewHistory] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const cols = await db.getCollections(user.id);
      setCollections(cols);
      setTotalCards(await db.getTotalCardCount(user.id));
      setDueCards(await db.getDueCardCount(user.id));
      setStudiedToday(await db.getReviewCountToday(user.id));

      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 29);
      setReviewHistory(await db.getReviewCountByDateRange(user.id, start, end));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const init = async () => {
        await loadData();
        const lastSync = await db.getLastSyncTime();
        if (!lastSync && isActive) {
          setSyncing(true);
          await performSync();
          if (isActive) {
            setSyncing(false);
            await loadData();
          }
        }
      };
      init();
      return () => { isActive = false; };
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSyncing(true);
    await performSync();
    setSyncing(false);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleStudyNow = () => router.push('/study-select');

  // ─── Heatmap helpers ───
  function getHeatmapColor(count: number): string {
    if (count === 0) return isDark ? '#374151' : '#E5E7EB';
    if (count < 5) return isDark ? '#166534' : '#BBF7D0';
    if (count < 10) return isDark ? '#15803D' : '#4ADE80';
    if (count < 20) return isDark ? '#16A34A' : '#16A34A';
    return isDark ? '#22C55E' : '#166534';
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  /* Heatmap */
  const heatmapDays: { date: Date; dateStr: string; count: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - 29 + i);
    const ds = d.toISOString().slice(0, 10);
    heatmapDays.push({ date: d, dateStr: ds, count: reviewHistory[ds] ?? 0 });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Background glows */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: isDark ? 'rgba(109,40,217,0.12)' : 'rgba(139,92,246,0.06)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 40, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: isDark ? 'rgba(79,70,229,0.08)' : 'rgba(99,102,241,0.04)' }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>Welcome back,</Text>
          <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 2 }}>
            {user?.display_name || 'Learner'} 👋
          </Text>
        </View>

        {/* Study Now Button */}
        <TouchableOpacity
          onPress={handleStudyNow}
          activeOpacity={0.85}
          style={{
            marginHorizontal: 20, marginTop: 20, borderRadius: 16, overflow: 'hidden',
            backgroundColor: colors.accent,
            shadowColor: colors.accent, shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
          }}
        >
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            paddingVertical: 16, gap: 10,
          }}>
            <Ionicons name="play-circle" size={24} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Study Now</Text>
            {dueCards > 0 && (
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12,
                paddingHorizontal: 10, paddingVertical: 3,
              }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{dueCards} due</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
