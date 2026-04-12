import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useTheme } from '@/context/ThemeContext';

interface SheetProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  scrollable?: boolean;
}

export default function Sheet({ visible, title, onClose, children, scrollable }: SheetProps) {
  const { colors } = useTheme();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(600)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1, duration: 180, useNativeDriver: true,
        }),
        Animated.spring(sheetY, {
          toValue: 0, damping: 22, stiffness: 280, mass: 0.7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0, duration: 140, useNativeDriver: true,
        }),
        Animated.timing(sheetY, {
          toValue: 600, duration: 180, useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        {/* Backdrop */}
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            opacity: backdropOpacity,
          }}
        >
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* Sheet anchored to bottom */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
          keyboardVerticalOffset={0}
        >
          <Animated.View style={{ transform: [{ translateY: sheetY }] }}>
            <View style={{
              backgroundColor: colors.sheetBg,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              borderWidth: 1, borderColor: colors.surfaceBorder,
              paddingHorizontal: 24, paddingTop: 16, paddingBottom: 36,
            }}>
              <View style={{
                width: 40, height: 4, borderRadius: 2,
                backgroundColor: colors.divider,
                alignSelf: 'center', marginBottom: 20,
              }} />
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 24 }}>
                {title}
              </Text>
              <ScrollView
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={scrollable ?? false}
                scrollEnabled={scrollable ?? true}
                style={{ maxHeight: scrollable ? 420 : undefined }}
              >
                {children}
              </ScrollView>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* ── Helper components ───────────────────────────────────────────────────────── */

export function SheetInput({
  label, value, onChangeText, placeholder, secure, keyboardType, autoCapitalize, multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboardType?: 'email-address' | 'default' | 'numeric';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  multiline?: boolean;
}) {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);
  const { Ionicons } = require('@expo/vector-icons');

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8, marginLeft: 2 }}>{label}</Text>
      <View style={{
        flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center',
        backgroundColor: colors.inputBg,
        borderWidth: 1, borderColor: colors.inputBorder,
        borderRadius: 14, paddingHorizontal: 16,
        minHeight: multiline ? 80 : 52,
        paddingVertical: multiline ? 12 : 0,
      }}>
        <View style={{ flex: 1 }}>
          {React.createElement(require('react-native').TextInput, {
            style: { color: colors.text, fontSize: 15, textAlignVertical: multiline ? 'top' : 'center' },
            placeholder, placeholderTextColor: colors.textMuted,
            value, onChangeText,
            secureTextEntry: secure && !show,
            keyboardType: keyboardType ?? 'default',
            autoCapitalize: autoCapitalize ?? 'none',
            autoCorrect: false,
            multiline,
            numberOfLines: multiline ? 3 : 1,
          })}
        </View>
        {secure && (
          <TouchableOpacity onPress={() => setShow(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function ErrorBanner({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <View style={{
      backgroundColor: 'rgba(239,68,68,0.1)',
      borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
    }}>
      <Text style={{ color: '#F87171', fontSize: 13 }}>{msg}</Text>
    </View>
  );
}
