import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useTheme } from '@/context/ThemeContext';

const PRESET_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#EF4444', // red
  '#F97316', // orange
  '#F59E0B', // amber
  '#22C55E', // green
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#6366F1', // indigo
  '#A855F7', // purple
  '#D946EF', // fuchsia
  '#78716C', // stone
  '#64748B', // slate
  '#0EA5E9', // sky
  '#84CC16', // lime
];

interface ColorPickerProps {
  selected: string;
  onSelect: (color: string) => void;
}

export default function ColorPicker({ selected, onSelect }: ColorPickerProps) {
  const { colors } = useTheme();

  return (
    <View>
      <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12, marginLeft: 2 }}>Color</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {PRESET_COLORS.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => onSelect(c)}
            activeOpacity={0.7}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: c,
              borderWidth: selected.toUpperCase() === c.toUpperCase() ? 3 : 0,
              borderColor: '#fff',
              shadowColor: selected.toUpperCase() === c.toUpperCase() ? c : 'transparent',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.5,
              shadowRadius: 6,
              elevation: selected.toUpperCase() === c.toUpperCase() ? 4 : 0,
            }}
          />
        ))}
      </View>
    </View>
  );
}
