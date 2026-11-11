import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { spacing } from '../../theme';
import { DialPadKey } from './DialPadKey';

interface DialPadProps {
  onDigit: (digit: string) => void;
  /** Long-press 0 inserts "+". */
  onLongZero?: () => void;
}

const KEYS: { digit: string; letters?: string }[][] = [
  [{ digit: '1' }, { digit: '2', letters: 'ABC' }, { digit: '3', letters: 'DEF' }],
  [
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
  ],
  [
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
  ],
  [{ digit: '*' }, { digit: '0', letters: '+' }, { digit: '#' }],
];

export function DialPad({ onDigit, onLongZero }: DialPadProps) {
  const { width } = useWindowDimensions();
  // Three keys + gaps must fit comfortably on small phones.
  const keySize = Math.min(80, Math.floor((width - spacing.lg * 2 - spacing.xl * 4) / 3));

  return (
    <View style={styles.pad}>
      {KEYS.map((row, i) => (
        <Animated.View
          key={i}
          entering={FadeInDown.delay(60 + i * 45).springify().damping(18)}
          style={styles.row}
        >
          {row.map(({ digit, letters }) => (
            <DialPadKey
              key={digit}
              digit={digit}
              letters={letters}
              size={keySize}
              onPress={onDigit}
              onLongPress={digit === '0' && onLongZero ? () => onLongZero() : undefined}
            />
          ))}
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    gap: spacing.lg,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xl * 2,
  },
});
