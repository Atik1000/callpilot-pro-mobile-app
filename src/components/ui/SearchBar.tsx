import { Search, X } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onClear?: () => void;
}

export function SearchBar({ value, onChangeText, placeholder, onClear }: SearchBarProps) {
  return (
    <View style={styles.container}>
      <Search size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
          onPress={() => (onClear ? onClear() : onChangeText(''))}
        >
          <X size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGrey,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 46,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
});
