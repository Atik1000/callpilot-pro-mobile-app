import React from 'react';
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, spacing } from '../../theme';
import { AppText } from './AppText';
import { PressableScale } from './motion';

export type AppButtonVariant =
  | 'primary' // AI Blue bg, white text — main actions
  | 'secondary' // white bg, black text, black outline
  | 'light' // white bg, black text (on black call screens)
  | 'accent' // blue tint bg, blue text
  | 'danger' // red bg, white text
  | 'success' // mint bg, white text — Call / Answer
  | 'dark'; // black bg, white text — automation actions

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
  accent: colors.aiBlueTint,
  danger: colors.red,
  success: colors.mint,
  dark: colors.black,
};

const labelColors: Record<AppButtonVariant, string> = {
  primary: '#FFFFFF',
  secondary: colors.black,
  light: colors.black,
  accent: colors.aiBlueText,
  danger: '#FFFFFF',
  success: '#FFFFFF',
  dark: '#FFFFFF',
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
      scaleTo={0.98}
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
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regular: {
    minHeight: 54,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  compact: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  bordered: {
    borderWidth: 1.5,
    borderColor: colors.black,
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
