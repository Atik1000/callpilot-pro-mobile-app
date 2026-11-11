import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme';
import { AppText } from './AppText';
import { AppButton } from './AppButton';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Could not load this screen.',
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <AppText variant="cardTitle" align="center">
        {title}
      </AppText>
      <AppText variant="supporting" color={colors.textSecondary} align="center">
        {description}
      </AppText>
      {onRetry ? (
        <AppButton label="Try again" onPress={onRetry} variant="secondary" compact />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl * 2,
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
});
