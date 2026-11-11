import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme';
import { AppText } from './AppText';

interface SectionHeaderProps {
  title: string;
  /** Optional trailing text action (e.g. "Sync ATS"). */
  actionLabel?: string;
  onAction?: () => void;
}

/** Uppercase gray label: FAVOURITES, ATS STATUS, DOCUMENTS, ACTIVITY… */
export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText variant="sectionTitle" color={colors.textSecondary}>
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <AppText variant="caption" color={colors.secondary}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});
