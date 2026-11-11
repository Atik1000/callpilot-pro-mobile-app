import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme';
import { AppText } from '../ui/AppText';
import { PressableScale } from '../ui/motion';

interface CallControlButtonProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  active?: boolean;
}

/** Dark circular in-call control (Mute, Keypad, Speaker, Hold, Transfer, Note). */
export function CallControlButton({ icon, label, onPress, active = false }: CallControlButtonProps) {
  return (
    <View style={styles.wrapper}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={onPress}
        scaleTo={0.85}
        style={[styles.circle, active && styles.circleActive]}
      >
        {icon}
      </PressableScale>
      <AppText variant="supporting" color="#FFFFFF">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: spacing.sm,
    width: 84,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.darkControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    backgroundColor: colors.darkControlActive,
  },
});
