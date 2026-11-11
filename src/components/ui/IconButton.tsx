import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme';
import { PressableScale } from './motion';

interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

/** Circular icon-only button (blue call/message actions, chat send, etc.) */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 44,
  backgroundColor = colors.blueLight,
  style,
  disabled = false,
}: IconButtonProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.88}
      hitSlop={4}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
        style,
      ]}
    >
      {icon}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
