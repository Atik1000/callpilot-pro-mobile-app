import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, fontFamily, radius, spacing } from '../../theme';
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

/** UI kit chip palette: dot colour, tinted background, readable text. */
const tones: Record<StatusTone, { dot: string; bg: string; text: string }> = {
  success: { dot: colors.mint, bg: colors.mintTint, text: colors.mintText },
  warning: { dot: colors.amber, bg: colors.amberTint, text: colors.amberText },
  error: { dot: colors.red, bg: colors.redTint, text: colors.redText },
  info: { dot: colors.aiBlue, bg: colors.aiBlueTint, text: colors.aiBlueText },
  neutral: { dot: colors.black, bg: colors.lightGrey, text: colors.black },
};

export function StatusBadge({
  label,
  tone = 'neutral',
  variant = 'pill',
  pulse = false,
}: StatusBadgeProps) {
  const t = tones[tone];
  return (
    <View style={[styles.base, variant === 'pill' && [styles.pill, { backgroundColor: t.bg }]]}>
      {pulse ? (
        <PulsingDot color={t.dot} size={7} />
      ) : (
        <View style={[styles.dot, { backgroundColor: t.dot }]} />
      )}
      <AppText
        style={styles.label}
        color={variant === 'pill' ? t.text : colors.black}
        numberOfLines={1}
      >
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
    borderRadius: radius.pill,
    paddingLeft: spacing.sm,
    paddingRight: 10,
    paddingVertical: 4,
  },
  label: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    lineHeight: 16,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
