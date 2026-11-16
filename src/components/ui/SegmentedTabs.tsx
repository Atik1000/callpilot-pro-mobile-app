import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, fontFamily, spacing } from '../../theme';
import { AppText } from './AppText';

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
 * Grey track with a white pill that slides between tabs
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
      transform: [
        {
          translateX: withTiming(selectedIndex * tabWidth, {
            duration: 200,
            easing: Easing.out(Easing.cubic),
          }),
        },
      ],
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
              style={active ? styles.labelActive : styles.label}
              color={colors.black}
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
    backgroundColor: colors.lightGrey,
    borderRadius: 13,
    padding: PAD,
  },
  pill: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: 10,
    backgroundColor: colors.white,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    paddingHorizontal: spacing.sm,
  },
  label: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    lineHeight: 18,
  },
  labelActive: {
    fontFamily: fontFamily.extrabold,
    fontSize: 13,
    lineHeight: 18,
  },
});
