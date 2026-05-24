import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import * as db from '@/services/database';
import { performSync } from '@/services/sync';
import type { Card } from '@/types/models';

export default function CardEditorScreen() {
  const { cardId, collectionId } = useLocalSearchParams<{ cardId?: string; collectionId: string }>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();
  const router = useRouter();

  const isEditing = !!cardId;
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!cardId);

  useEffect(() => {
    if (cardId) {
      (async () => {
        const card = await db.getCardById(cardId);
        if (card) {
          setFront(card.front);
          setBack(card.back);
        }
        setLoading(false);
      })();
    }
  }, [cardId]);

  async function save() {
    if (!front.trim() || !back.trim()) {
      Alert.alert(t.common.error, t.cardEditor.bothRequired);
      return;
    }
    setSaving(true);
    try {
      if (isEditing && cardId) {
        const existing = await db.getCardById(cardId);
        if (existing) {
          const updated: Card = { ...existing, front: front.trim(), back: back.trim() };
          await db.updateCard(updated);
          await db.addToSyncQueue('card', updated.id, 'update', updated);
        }
      } else {
        const created = await db.createCard({
          collection_id: collectionId!,
          front: front.trim(),
          back: back.trim(),
          user_id: user?.id,
        });
        await db.addToSyncQueue('card', created.id, 'create', created);
      }
      performSync().catch(() => {});
      router.back();
    } catch (e: any) {
      Alert.alert(t.common.error, e.message ?? t.cardEditor.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Background glow */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: isDark ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.05)' }} />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', flex: 1 }}>
          {isEditing ? t.cardEditor.editCard : t.cardEditor.newCard}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        {/* Front */}
        <View style={{ marginBottom: 20 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8, fontWeight: '600' }}>{t.cardEditor.front}</Text>
          <View style={{
            backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder,
            borderRadius: 16, padding: 16, minHeight: 140,
          }}>
            <TextInput
              style={{ color: colors.text, fontSize: 16, textAlignVertical: 'top' }}
              placeholder={t.cardEditor.frontPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={front}
              onChangeText={setFront}
              multiline
              numberOfLines={6}
              autoFocus={!isEditing}
            />
          </View>
        </View>

        {/* Divider with swap icon */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder,
            alignItems: 'center', justifyContent: 'center', marginHorizontal: 12,
          }}>
            <Ionicons name="swap-vertical" size={18} color={colors.accentLight} />
          </View>
          <View style={{ flex: 1, height: 1, backgroundColor: colors.divider }} />
        </View>

        {/* Back */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8, fontWeight: '600' }}>{t.cardEditor.back}</Text>
          <View style={{
            backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder,
            borderRadius: 16, padding: 16, minHeight: 140,
          }}>
            <TextInput
              style={{ color: colors.text, fontSize: 16, textAlignVertical: 'top' }}
              placeholder={t.cardEditor.backPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={back}
              onChangeText={setBack}
              multiline
              numberOfLines={6}
            />
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          onPress={save}
          disabled={saving}
          activeOpacity={0.85}
          style={{
            backgroundColor: colors.accent, borderRadius: 14, height: 52,
            alignItems: 'center', justifyContent: 'center',
            shadowColor: colors.accent, shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
              {isEditing ? t.cardEditor.saveChanges : t.cardEditor.createCard}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
