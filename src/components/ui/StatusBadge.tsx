import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './AppText';
import { PulsingDot } from './motion';

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  /** Pill with border (like "Available" / document statuses) vs plain dot+text */
  variant?: 'pill' | 'plain';
  /** Softly pulses the dot — for live states like "Available". */
  pulse?: boolean;
}

const dotColors: Record<StatusTone, string> = {
  success: colors.success,
  warning: colors.warning,
  error: colors.error,
  info: colors.secondary,
  neutral: colors.textMuted,
};

export function StatusBadge({
  label,
  tone = 'neutral',
  variant = 'pill',
  pulse = false,
}: StatusBadgeProps) {
  return (
    <View style={[styles.base, variant === 'pill' && styles.pill]}>
      {pulse ? (
        <PulsingDot color={dotColors[tone]} size={7} />
      ) : (
        <View style={[styles.dot, { backgroundColor: dotColors[tone] }]} />
      )}
      <AppText variant="caption" color={colors.textPrimary} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  pill: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
