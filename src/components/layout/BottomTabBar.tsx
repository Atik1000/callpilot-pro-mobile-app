import { Tabs, useRouter } from 'expo-router';
import { ContactRound, Link2, MessageCircle, Phone, Zap } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';
import { AppText } from '../ui/AppText';
import { springs } from '../ui/motion';

/** Tab bar props as expected by expo-router's vendored bottom-tabs navigator. */
type BottomTabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>
>[0];

export type TabName = 'calls' | 'messages' | 'contacts' | 'alerts' | 'settings';

interface TabConfig {
  name: TabName;
  label: string;
  Icon: typeof Phone;
}

const TABS: TabConfig[] = [
  { name: 'calls', label: 'Calls', Icon: Phone },
  { name: 'messages', label: 'Messages', Icon: MessageCircle },
  { name: 'contacts', label: 'Contacts', Icon: ContactRound },
  { name: 'alerts', label: 'Alerts', Icon: Zap },
  { name: 'settings', label: 'Settings', Icon: Link2 },
];

interface TabBarViewProps {
  activeName: string;
  onSelect: (name: TabName) => void;
}

interface TabItemProps {
  config: TabConfig;
  active: boolean;
  onPress: () => void;
}

function TabItem({ config: { label, Icon }, active, onPress }: TabItemProps) {
  const bounce = useSharedValue(1);

  useEffect(() => {
    if (active) {
      bounce.value = withSequence(
        withSpring(1.22, springs.bouncy),
        withSpring(1, springs.gentle),
      );
    }
  }, [active, bounce]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounce.value }],
  }));

  const color = active ? colors.secondary : colors.textPrimary;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
    >
      <Animated.View style={iconStyle}>
        <Icon size={22} color={color} strokeWidth={active ? 2.2 : 1.8} />
      </Animated.View>
      <AppText variant="tabLabel" color={color}>
        {label}
      </AppText>
      {active ? (
        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.indicatorActive} />
      ) : (
        <View style={styles.indicator} />
      )}
    </Pressable>
  );
}

/** Presentational tab bar shared by the tab navigator and detail screens. */
export function TabBarView({ activeName, onSelect }: TabBarViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {TABS.map((config) => (
        <TabItem
          key={config.name}
          config={config}
          active={config.name === activeName}
          onPress={() => onSelect(config.name)}
        />
      ))}
    </View>
  );
}

/** Tab bar wired to the (tabs) navigator. */
export function BottomTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const activeName = state.routes[state.index]?.name ?? 'calls';
  return (
    <TabBarView
      activeName={activeName}
      onSelect={(name) => {
        const route = state.routes.find((r) => r.name === name);
        if (route) navigateToTab(route.key);
      }}
    />
  );
}

interface StandaloneTabBarProps {
  /** Which tab to highlight (Keypad belongs to Calls, Record to Contacts). */
  activeName: TabName;
}

/**
 * Tab bar for detail screens that live outside the tab navigator but show
 * the bar in the designs (Keypad, Contact Record).
 */
export function StandaloneTabBar({ activeName }: StandaloneTabBarProps) {
  const router = useRouter();
  return (
    <TabBarView
      activeName={activeName}
      onSelect={(name) => router.navigate(`/(tabs)/${name}`)}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  pressed: {
    opacity: 0.6,
  },
  indicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.secondary,
  },
});
