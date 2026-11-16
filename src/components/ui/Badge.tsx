import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './AppText';

interface BadgeProps {
  label: string;
  /** dark = brand-tinted pill (channel badges), light = bordered */
  variant?: 'dark' | 'light';
}

/** Small channel badge, e.g. "WhatsApp" / "SMS" on conversation rows. */
export function Badge({ label, variant = 'dark' }: BadgeProps) {
  return (
    <View style={[styles.base, variant === 'dark' ? styles.dark : styles.light]}>
      <AppText
        style={styles.text}
        color={variant === 'dark' ? colors.primary : colors.textSecondary}
      >
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm - 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  dark: {
    backgroundColor: colors.primaryTint,
  },
  light: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
});
