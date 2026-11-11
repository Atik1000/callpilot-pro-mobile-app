import React from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { colors, spacing } from '../../theme';
import { AppText } from './AppText';

interface ToggleRowProps {
  title: string;
  subtitle?: string;
  value: boolean;
  onToggle: () => void;
}

/** Settings row with a blue toggle, as on the Settings design page. */
export function ToggleRow({ title, subtitle, value, onToggle }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <AppText variant="cardTitle">{title}</AppText>
        {subtitle ? (
          <AppText variant="supporting" color={colors.textSecondary}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: colors.secondary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
});
