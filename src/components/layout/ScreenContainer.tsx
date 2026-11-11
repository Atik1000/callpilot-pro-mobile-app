import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  /** Rendered above the content, outside any scrolling (e.g. ScreenHeader). */
  header?: React.ReactNode;
  /** Rendered below the content (e.g. StandaloneTabBar on detail screens). */
  footer?: React.ReactNode;
  scrollable?: boolean;
  backgroundColor?: string;
  /** Horizontal page padding for the content area. */
  padded?: boolean;
  keyboardAware?: boolean;
  /** Adds bottom padding = safe area (for screens without the tab bar). */
  safeBottom?: boolean;
}

export function ScreenContainer({
  children,
  header,
  footer,
  scrollable = false,
  backgroundColor = colors.background,
  padded = true,
  keyboardAware = false,
  safeBottom = false,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  const contentStyle = [
    padded && styles.padded,
    safeBottom && { paddingBottom: insets.bottom + spacing.lg },
  ];

  let body: React.ReactNode;
  if (scrollable) {
    body = (
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, ...contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  } else {
    body = <View style={[styles.flex, ...contentStyle]}>{children}</View>;
  }

  const inner = (
    <View style={[styles.flex, { backgroundColor }]}>
      {header}
      {body}
      {footer}
    </View>
  );

  if (!keyboardAware) return inner;
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {inner}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
});
