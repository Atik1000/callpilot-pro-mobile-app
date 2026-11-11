import React from 'react';
import { StyleSheet } from 'react-native';
import { colors, fontFamily } from '../../theme';
import { AppText } from '../ui/AppText';
import { PressableScale } from '../ui/motion';

interface DialPadKeyProps {
  digit: string;
  letters?: string;
  onPress: (digit: string) => void;
  onLongPress?: (digit: string) => void;
  size?: number;
}

export function DialPadKey({
  digit,
  letters,
  onPress,
  onLongPress,
  size = 76,
}: DialPadKeyProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={letters ? `${digit}, ${letters}` : digit}
      onPress={() => onPress(digit)}
      onLongPress={onLongPress ? () => onLongPress(digit) : undefined}
      scaleTo={0.86}
      style={[styles.key, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <AppText style={styles.digit}>{digit}</AppText>
      {letters ? (
        <AppText style={styles.letters} color={colors.textSecondary}>
          {letters}
        </AppText>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  key: {
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontFamily: fontFamily.medium,
    fontSize: 28,
    lineHeight: 34,
    color: colors.textPrimary,
  },
  letters: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.5,
  },
});
