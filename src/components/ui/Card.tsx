import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, spacing } from '../../theme';
import { PressableScale } from './motion';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function Card({
  children,
  onPress,
  padded = true,
  bordered = false,
  style,
  accessibilityLabel,
}: CardProps) {
  const base = [
    styles.card,
    padded && styles.padded,
    bordered && styles.bordered,
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      scaleTo={0.99}
      style={base}
    >
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
  },
  padded: {
    padding: spacing.lg,
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
});
