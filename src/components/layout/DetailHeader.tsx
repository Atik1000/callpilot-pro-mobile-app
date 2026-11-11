import { ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../ui/AppText';

interface DetailHeaderProps {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  /** Extra content under the title row (e.g. contact summary on Record). */
  children?: React.ReactNode;
  onBack?: () => void;
}

/**
 * Black detail header with a back button — used by Keypad, Contact
 * Record and Chat Details.
 */
export function DetailHeader({
  title,
  subtitle,
  rightElement,
  children,
  onBack,
}: DetailHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/calls')));

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          hitSlop={10}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <ArrowLeft size={22} color={colors.headerText} />
        </Pressable>
        <View style={styles.titles}>
          <AppText variant="screenTitle" color={colors.headerText} style={styles.title}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="supporting" color={colors.headerTextSecondary}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {rightElement}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.headerBackground,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  back: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  titles: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    lineHeight: 27,
  },
});
