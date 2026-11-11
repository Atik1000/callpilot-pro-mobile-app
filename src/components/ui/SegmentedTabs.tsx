import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { colors, radius, spacing } from '../../theme';
import { AppText } from './AppText';
import { springs } from './motion';

export interface SegmentedTab<T extends string> {
  key: T;
  label: string;
}

interface SegmentedTabsProps<T extends string> {
  tabs: SegmentedTab<T>[];
  selected: T;
  onSelect: (key: T) => void;
}

const PAD = spacing.xs;

/**
 * White rounded container with a black pill that springs between tabs
 * (Calls, Contacts, Messages filters and Settings status).
 */
export function SegmentedTabs<T extends string>({
  tabs,
  selected,
  onSelect,
}: SegmentedTabsProps<T>) {
  const [containerWidth, setContainerWidth] = useState(0);
  const tabWidth = containerWidth > 0 ? (containerWidth - PAD * 2) / tabs.length : 0;
  const selectedIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === selected),
  );

  const pillStyle = useAnimatedStyle(
    () => ({
      width: tabWidth,
      transform: [{ translateX: withSpring(selectedIndex * tabWidth, springs.gentle) }],
    }),
    [selectedIndex, tabWidth],
  );

  return (
    <View
      style={styles.container}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      {tabWidth > 0 ? <Animated.View style={[styles.pill, pillStyle]} /> : null}
      {tabs.map((tab) => {
        const active = tab.key === selected;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(tab.key)}
            style={styles.tab}
          >
            <AppText
              variant="bodyMedium"
              color={active ? '#FFFFFF' : colors.textPrimary}
              numberOfLines={1}
            >
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: PAD,
  },
  pill: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radius.lg - PAD,
    backgroundColor: colors.primary,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
});
