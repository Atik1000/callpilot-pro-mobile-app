import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../ui/AppText';
import { SearchBar } from '../ui/SearchBar';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showSearch?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  rightElement?: React.ReactNode;
}

/**
 * Black top header with rounded bottom corners, used by all main tab
 * screens (Calls, Contacts, Messages, Alerts, Settings).
 */
export function ScreenHeader({
  title,
  subtitle,
  showSearch = false,
  searchPlaceholder = 'Search',
  searchValue = '',
  onSearchChange,
  rightElement,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <View style={styles.titleRow}>
        <View style={styles.titles}>
          <AppText variant="screenTitle" color={colors.headerText}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText
              variant="supporting"
              color={colors.headerTextSecondary}
              style={styles.subtitle}
            >
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {rightElement}
      </View>
      {showSearch && onSearchChange ? (
        <View style={styles.search}>
          <SearchBar
            value={searchValue}
            onChangeText={onSearchChange}
            placeholder={searchPlaceholder}
          />
        </View>
      ) : null}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titles: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  search: {
    marginTop: spacing.lg,
  },
});
