import { Tabs, useRouter } from 'expo-router';
import { Bell, Grip, MessageCircle, Phone, UserRound } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlertStore } from '../../store/alertStore';
import { useMessageStore } from '../../store/messageStore';
import { colors, fontFamily, spacing } from '../../theme';
import { AppText } from '../ui/AppText';

/** Tab bar props as expected by expo-router's vendored bottom-tabs navigator. */
type BottomTabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>
>[0];

/** Bar items. Keypad opens the /keypad screen; Settings is reached from the header. */
export type TabName = 'calls' | 'messages' | 'keypad' | 'contacts' | 'alerts' | 'settings';

interface TabConfig {
  name: Exclude<TabName, 'settings'>;
  label: string;
  Icon: typeof Phone;
}

const TABS: TabConfig[] = [
  { name: 'calls', label: 'Calls', Icon: Phone },
  { name: 'messages', label: 'Messages', Icon: MessageCircle },
  { name: 'keypad', label: 'Keypad', Icon: Grip },
  { name: 'contacts', label: 'Contacts', Icon: UserRound },
  { name: 'alerts', label: 'Alerts', Icon: Bell },
];

/** Red count badges on Messages (unread conversations) and Alerts (new). */
function useBadges(): Partial<Record<TabName, number>> {
  const unreadMessages = useMessageStore(
    (s) => s.conversations.filter((c) => c.unreadCount > 0).length,
  );
  const newAlerts = useAlertStore(
    (s) => s.alerts.filter((a) => a.status === 'new' && !a.isRead).length,
  );
  return { messages: unreadMessages, alerts: newAlerts };
}

interface TabItemProps {
  config: TabConfig;
  active: boolean;
  badge?: number;
  onPress: () => void;
}

function TabItem({ config: { label, Icon }, active, badge, onPress }: TabItemProps) {
  const color = active ? colors.aiBlue : colors.black;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={badge ? `${label}, ${badge} new` : label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
    >
      <View>
        <Icon size={24} color={color} strokeWidth={active ? 2.2 : 1.8} />
        {badge ? (
          <View style={styles.badge}>
            <AppText style={styles.badgeText} color={colors.white}>
              {badge > 99 ? '99+' : String(badge)}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="tabLabel" color={color} style={active ? styles.labelActive : undefined}>
        {label}
      </AppText>
    </Pressable>
  );
}

interface TabBarViewProps {
  activeName: TabName;
  onSelect: (name: TabName) => void;
}

/** Presentational tab bar shared by the tab navigator and detail screens. */
export function TabBarView({ activeName, onSelect }: TabBarViewProps) {
  const insets = useSafeAreaInsets();
  const badges = useBadges();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {TABS.map((config) => (
        <TabItem
          key={config.name}
          config={config}
          active={config.name === activeName}
          badge={badges[config.name]}
          onPress={() => onSelect(config.name)}
        />
      ))}
    </View>
  );
}

/** Tab bar wired to the (tabs) navigator. */
export function BottomTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const router = useRouter();
  const activeName = (state.routes[state.index]?.name ?? 'calls') as TabName;
  return (
    <TabBarView
      activeName={activeName}
      onSelect={(name) => {
        if (name === 'keypad') {
          router.push('/keypad');
          return;
        }
        const route = state.routes.find((r) => r.name === name);
        if (route) navigateToTab(route.key);
      }}
    />
  );
}

interface StandaloneTabBarProps {
  /** Which item to highlight on screens outside the tab navigator. */
  activeName: TabName;
}

/** Tab bar for detail screens outside the tab navigator (Keypad, Contact record). */
export function StandaloneTabBar({ activeName }: StandaloneTabBarProps) {
  const router = useRouter();
  return (
    <TabBarView
      activeName={activeName}
      onSelect={(name) => {
        if (name === activeName) return;
        if (name === 'keypad') router.push('/keypad');
        else router.navigate(`/(tabs)/${name}`);
      }}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pressed: {
    opacity: 0.6,
  },
  labelActive: {
    fontFamily: fontFamily.extrabold,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: fontFamily.extrabold,
    fontSize: 11,
    lineHeight: 14,
  },
});
