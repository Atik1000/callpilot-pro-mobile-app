import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { BottomTabBar } from '../../components/layout/BottomTabBar';
import { useLiveSync } from '../../hooks/useLiveSync';
import { useAuthStore } from '../../store/authStore';

export const unstable_settings = {
  anchor: 'calls',
};

export default function TabsLayout() {
  const stage = useAuthStore((s) => s.stage);
  // Background refresh + local notifications for the whole signed-in area.
  useLiveSync();
  if (stage !== 'signedIn') return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      backBehavior="initialRoute"
      screenOptions={{ headerShown: false, animation: 'fade' }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      <Tabs.Screen name="calls" options={{ title: 'Calls' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="contacts" options={{ title: 'Contacts' }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
      {/* Not shown in the custom bar; opened from the header avatar / status chip. */}
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
