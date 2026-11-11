import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './AppText';
import { PressableScale } from './motion';

export type AppButtonVariant =
  | 'primary' // black bg, white text
  | 'secondary' // white bg, dark text, border
  | 'light' // white bg, dark text
  | 'accent' // light blue bg, blue text
  | 'danger'; // red bg, white text

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  compact?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const backgrounds: Record<AppButtonVariant, string> = {
  primary: colors.primary,
  secondary: colors.surface,
  light: colors.surface,
  accent: colors.blueLight,
  danger: colors.error,
};

const labelColors: Record<AppButtonVariant, string> = {
  primary: '#FFFFFF',
  secondary: colors.textPrimary,
  light: colors.textPrimary,
  accent: colors.secondary,
  danger: '#FFFFFF',
};

export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  compact = false,
  iconLeft,
  iconRight,
  style,
  accessibilityLabel,
}: AppButtonProps) {
  const isInactive = disabled || loading;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive }}
      disabled={isInactive}
      onPress={onPress}
      scaleTo={0.96}
      style={[
        styles.base,
        compact ? styles.compact : styles.regular,
        { backgroundColor: backgrounds[variant] },
        variant === 'secondary' && styles.bordered,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColors[variant]} />
      ) : (
        <View style={styles.content}>
          {iconLeft}
          <AppText variant="button" color={labelColors[variant]}>
            {label}
          </AppText>
          {iconRight}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regular: {
    minHeight: 52,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  compact: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
