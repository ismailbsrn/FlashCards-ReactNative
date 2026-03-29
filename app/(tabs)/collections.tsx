import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context/ThemeContext';

export default function CollectionsScreen() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700' }}>Collections</Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8 }}>Your card collections will appear here</Text>
      </View>
    </SafeAreaView>
  );
}
