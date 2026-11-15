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
 * Blue, center-aligned detail header with a back button — used by Keypad, Contact
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
        <View style={styles.side}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={goBack}
            hitSlop={10}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <ArrowLeft size={22} color={colors.headerText} />
          </Pressable>
        </View>
        <View style={styles.titles}>
          <AppText
            variant="screenTitle"
            color={colors.headerText}
            align="center"
            numberOfLines={1}
            style={styles.title}
          >
            {title}
          </AppText>
          {subtitle ? (
            <AppText
              variant="supporting"
              color={colors.headerTextSecondary}
              align="center"
              numberOfLines={2}
            >
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <View style={[styles.side, styles.sideRight]}>{rightElement}</View>
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
  side: {
    width: 44,
    alignItems: 'flex-start',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.headerControl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  titles: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    lineHeight: 27,
  },
});
