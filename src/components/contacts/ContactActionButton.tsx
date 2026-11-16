import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../ui/AppText';

interface ContactActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

/** White square action tile (Call / WhatsApp / SMS / Email) on Contact Record. */
export function ContactActionButton({ icon, label, onPress }: ContactActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      {icon}
      <AppText variant="supporting">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.lightGrey,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.8,
  },
});
