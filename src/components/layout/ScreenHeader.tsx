import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { colors, fontFamily, spacing } from '../../theme';
import { getInitials } from '../../utils/getInitials';
import { AppText } from '../ui/AppText';
import { SearchBar } from '../ui/SearchBar';

interface ScreenHeaderProps {
  title: string;
  /** Kept for call sites; the UI kit headers show no subtitle. */
  subtitle?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  /** Optional round action left of the status chip (e.g. compose, add). */
  action?: React.ReactNode;
  /** Status chip + profile avatar (hidden on Settings itself). */
  showStatus?: boolean;
  /** Shows a back chevron before the title (Settings). */
  showBack?: boolean;
  /** @deprecated replaced by the built-in status chip. */
  rightElement?: React.ReactNode;
}

/**
 * UI kit header: white, large left-aligned title, then an "Available" chip
 * and the user's initials (both open Settings). Optional search below.
 */
export function ScreenHeader({
  title,
  showSearch = false,
  searchPlaceholder = 'Search',
  searchValue = '',
  onSearchChange,
  action,
  showStatus = true,
  showBack = false,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const userName = useAuthStore((s) => s.user?.name ?? '');
  const available = useSettingsStore((s) => s.availability === 'available');
  const openSettings = () => router.navigate('/(tabs)/settings');

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.row}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.navigate('/(tabs)/calls'))}
            hitSlop={10}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <ChevronLeft size={26} color={colors.black} />
          </Pressable>
        ) : null}
        <AppText variant="screenTitle" numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
        {showStatus ? (
          <View style={styles.right}>
            {action}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Status: ${available ? 'Available' : 'Do not disturb'}. Open settings`}
              onPress={openSettings}
              hitSlop={6}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <View
                style={[styles.dot, { backgroundColor: available ? colors.mint : colors.amber }]}
              />
              <AppText style={styles.chipText}>{available ? 'Available' : 'Do not disturb'}</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings and profile"
              onPress={openSettings}
              hitSlop={4}
              style={({ pressed }) => [styles.me, pressed && styles.pressed]}
            >
              <AppText style={styles.meText} color={colors.white}>
                {getInitials(userName || 'Me')}
              </AppText>
            </Pressable>
          </View>
        ) : null}
      </View>
      {showSearch && onSearchChange ? (
        <View style={styles.search}>
          <SearchBar value={searchValue} onChangeText={onSearchChange} placeholder={searchPlaceholder} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flexShrink: 1,
    flexGrow: 1,
  },
  back: {
    marginLeft: -6,
    marginRight: -4,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    lineHeight: 16,
  },
  me: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meText: {
    fontFamily: fontFamily.extrabold,
    fontSize: 11,
    lineHeight: 14,
  },
  search: {
    marginTop: 14,
  },
  pressed: {
    opacity: 0.6,
  },
});
