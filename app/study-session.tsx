import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import * as db from '@/services/database';
import { calculateNextReview, isCardDue } from '@/services/spacedRepetition';
import { performSync } from '@/services/sync';
import type { Card, ReviewQuality } from '@/types/models';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StudySessionScreen() {
  const { collectionIds, filterMode } = useLocalSearchParams<{ collectionIds: string; filterMode?: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();

  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [startTime] = useState(Date.now());

  const flipAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const loadCards = useCallback(async () => {
    if (!user || !collectionIds) return;
    try {
      const ids = collectionIds.split(',');
      let allCards: Card[] = [];

      for (const colId of ids) {
        const colCards = await db.getCardsByCollection(colId);
        allCards = allCards.concat(colCards);
      }

      let filtered: Card[];
      switch (filterMode) {
        case 'new':
          filtered = allCards.filter(c => !c.next_review_date);
          break;
        case 'learning':
          filtered = allCards.filter(c => c.repetitions > 0 && c.interval < 21);
          break;
        case 'all':
          filtered = allCards;
          break;
        case 'due':
        default:
          filtered = allCards.filter(c => isCardDue(c));
          break;
      }

      for (let i = filtered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
      }

      setCards(filtered);
    } catch {} finally {
      setLoading(false);
    }
  }, [user, collectionIds, filterMode]);

  useEffect(() => { loadCards(); }, [loadCards]);

  function flipCard() {
    if (isFlipped) return;
    setIsFlipped(true);
    Animated.spring(flipAnim, {
      toValue: 180,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }

  function resetFlip() {
    setIsFlipped(false);
    flipAnim.setValue(0);
  }

  async function rateCard(quality: ReviewQuality) {
    const card = cards[currentIndex];
    if (!card || !user) return;

    const result = calculateNextReview(card, quality);

    const updatedCard: Card = {
      ...card,
      ease_factor: result.easeFactor,
      interval: result.interval,
      repetitions: result.repetitions,
      next_review_date: result.nextReviewDate.toISOString(),
      last_review_date: new Date().toISOString(),
    };
    await db.updateCard(updatedCard);
    await db.addToSyncQueue('card', card.id, 'update', updatedCard);

    const log = await db.createReviewLog({
      card_id: card.id,
      user_id: user.id,
      quality,
      reviewed_at: new Date().toISOString(),
      interval_before: card.interval,
      interval_after: result.interval,
      ease_factor_before: card.ease_factor,
      ease_factor_after: result.easeFactor,
    });
    await db.addToSyncQueue('review_log', log.id, 'create', log);

    setReviewCount(prev => prev + 1);

    if (currentIndex + 1 >= cards.length) {
      setCompleted(true);
      performSync().catch(() => {});
      return;
    }

    Animated.timing(fadeAnim, {
      toValue: 0, duration: 150, useNativeDriver: true,
    }).start(() => {
      resetFlip();
      setCurrentIndex(prev => prev + 1);
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 200, useNativeDriver: true,
      }).start();
    });
  }

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backRotate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const ratingButtons: { quality: ReviewQuality; label: string; color: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { quality: 'wrong', label: 'Again', color: '#EF4444', icon: 'close-circle' },
    { quality: 'hard', label: 'Hard', color: '#F59E0B', icon: 'alert-circle' },
    { quality: 'good', label: 'Good', color: '#3B82F6', icon: 'checkmark-circle' },
    { quality: 'easy', label: 'Easy', color: '#22C55E', icon: 'star' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  if (cards.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>Study</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
          <Ionicons name="checkmark-done-circle" size={80} color="#22C55E" />
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 16 }}>All caught up!</Text>
          <Text style={{ color: colors.textMuted, fontSize: 15, marginTop: 8, textAlign: 'center' }}>
            No cards to study right now. Check back later!
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              backgroundColor: colors.accent, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14,
              marginTop: 28,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (completed) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(34,197,94,0.1)' }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: 'rgba(34,197,94,0.15)', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
          }}>
            <Ionicons name="trophy" size={48} color="#22C55E" />
          </View>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>Great Job! 🎉</Text>
          <Text style={{ color: colors.textMuted, fontSize: 15, marginTop: 8, textAlign: 'center' }}>
            You completed this study session!
          </Text>

          <View style={{
            flexDirection: 'row', gap: 16, marginTop: 32,
          }}>
            <View style={{
              backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder,
              borderRadius: 16, padding: 20, alignItems: 'center', flex: 1,
            }}>
              <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>{reviewCount}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Cards Reviewed</Text>
            </View>
            <View style={{
              backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder,
              borderRadius: 16, padding: 20, alignItems: 'center', flex: 1,
            }}>
              <Text style={{ color: colors.text, fontSize: 26, fontWeight: '800' }}>
                {minutes > 0 ? `${minutes}m` : ''}{seconds}s
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Time Spent</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.back()}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.accent, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 16,
              marginTop: 32,
              shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3, shadowRadius: 14, elevation: 8,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const card = cards[currentIndex];
  const progress = (currentIndex + 1) / cards.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Background glows */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -60, left: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: isDark ? 'rgba(109,40,217,0.1)' : 'rgba(139,92,246,0.05)' }} />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface, overflow: 'hidden' }}>
            <View style={{
              height: '100%', borderRadius: 3,
              backgroundColor: colors.accent,
              width: `${progress * 100}%`,
            }} />
          </View>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600', marginLeft: 12 }}>
          {currentIndex + 1}/{cards.length}
        </Text>
      </View>

      {/* Card */}
      <Animated.View style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 16, opacity: fadeAnim }}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={flipCard}
          style={{ flex: 1 }}
        >
          <View style={{ flex: 1, position: 'relative' }}>
            {/* Front of card */}
            <Animated.View
              style={{
                position: 'absolute', width: '100%', height: '100%',
                backfaceVisibility: 'hidden',
                transform: [{ rotateY: frontRotate }],
              }}
            >
              <View style={{
                flex: 1,
                backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder,
                borderRadius: 24, padding: 28,
                justifyContent: 'center', alignItems: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDark ? 0.3 : 0.1, shadowRadius: 20, elevation: 8,
              }}>
                <View style={{
                  position: 'absolute', top: 16, left: 20,
                  backgroundColor: colors.accentSoft, borderRadius: 8,
                  paddingHorizontal: 10, paddingVertical: 4,
                }}>
                  <Text style={{ color: colors.accentLight, fontSize: 11, fontWeight: '700' }}>FRONT</Text>
                </View>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '600', textAlign: 'center', lineHeight: 32 }}>
                  {card.front}
                </Text>
                {!isFlipped && (
                  <View style={{
                    position: 'absolute', bottom: 20,
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                  }}>
                    <Ionicons name="hand-left-outline" size={14} color={colors.textMuted} />
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>Tap to reveal</Text>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* Back of card */}
            <Animated.View
              style={{
                position: 'absolute', width: '100%', height: '100%',
                backfaceVisibility: 'hidden',
                transform: [{ rotateY: backRotate }],
              }}
            >
              <View style={{
                flex: 1,
                backgroundColor: isDark ? '#0F172A' : '#F0F9FF',
                borderWidth: 1, borderColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.15)',
                borderRadius: 24, padding: 28,
                justifyContent: 'center', alignItems: 'center',
                shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDark ? 0.3 : 0.1, shadowRadius: 20, elevation: 8,
              }}>
                <View style={{
                  position: 'absolute', top: 16, left: 20,
                  backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 8,
                  paddingHorizontal: 10, paddingVertical: 4,
                }}>
                  <Text style={{ color: '#3B82F6', fontSize: 11, fontWeight: '700' }}>BACK</Text>
                </View>
                <Text style={{ color: colors.text, fontSize: 20, textAlign: 'center', lineHeight: 30 }}>
                  {card.back}
                </Text>
              </View>
            </Animated.View>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Rating buttons */}
      {isFlipped && (
        <View style={{
          flexDirection: 'row', gap: 8,
          paddingHorizontal: 16, paddingBottom: 20, paddingTop: 8,
        }}>
          {ratingButtons.map((btn) => (
            <TouchableOpacity
              key={btn.quality}
              onPress={() => rateCard(btn.quality)}
              activeOpacity={0.8}
              style={{
                flex: 1, alignItems: 'center', justifyContent: 'center',
                paddingVertical: 14, borderRadius: 14,
                backgroundColor: btn.color + '18',
                borderWidth: 1, borderColor: btn.color + '30',
              }}
            >
              <Ionicons name={btn.icon} size={22} color={btn.color} />
              <Text style={{ color: btn.color, fontSize: 12, fontWeight: '700', marginTop: 4 }}>{btn.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}
