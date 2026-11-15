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
 * Blue, center-aligned top header with rounded bottom corners, used by all main tab
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
      <View style={styles.titles}>
        <AppText variant="screenTitle" color={colors.headerText} align="center">
          {title}
        </AppText>
        {subtitle ? (
          <AppText
            variant="supporting"
            color={colors.headerTextSecondary}
            align="center"
            style={styles.subtitle}
          >
            {subtitle}
          </AppText>
        ) : null}
        {rightElement ? <View style={styles.extra}>{rightElement}</View> : null}
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
  titles: {
    alignItems: 'center',
  },
  subtitle: {
    marginTop: 2,
  },
  extra: {
    marginTop: spacing.sm,
  },
  search: {
    marginTop: spacing.lg,
  },
});
