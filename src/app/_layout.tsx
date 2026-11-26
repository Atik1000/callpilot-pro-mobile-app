import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Href, router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { keepAlive } from '../../modules/callpilot-keepalive/src';
import { VoipWebBridge } from '../components/voip/VoipWebBridge';
import { useNativeCallActions } from '../hooks/useNativeCallActions';
import { openCallPilotNotification, useNotificationRouting } from '../hooks/useNotificationRouting';
import { usesWebVoipEngine, voipSupported } from '../services/voipService';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

export default function RootLayout() {
  const signedIn = useAuthStore((s) => s.stage === 'signedIn');
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // CallPilot message/alert pushes (native FCM) open their thread or Alerts.
  useNotificationRouting(signedIn);
  // CallKit / Telecom / call-notification actions and iOS VoIP pushes.
  useNativeCallActions();
  // A notification tapped before sign-in finishes restoring is kept here
  // and opened once the protected screens become available.
  const pendingNotificationUrl = useRef<string | null>(null);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const open = (response: Notifications.NotificationResponse | null) => {
      // iOS APNs message/alert pushes (Android ones are native notifications).
      if (openCallPilotNotification(response?.notification.request.content.data)) return;
      const url = response?.notification.request.content.data?.url;
      if (typeof url !== 'string') return;
      if (useAuthStore.getState().stage === 'signedIn') {
        router.push(url as Href);
      } else {
        pendingNotificationUrl.current = url;
      }
    };
    // The tap that launched the app (cold start), then taps while running.
    open(Notifications.getLastNotificationResponse());
    const subscription =
      Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (signedIn && pendingNotificationUrl.current) {
      const url = pendingNotificationUrl.current;
      pendingNotificationUrl.current = null;
      router.push(url as Href);
    }
  }, [signedIn]);

  // The VoIP phone registers while signed in and tears down only on sign-out.
  // No unmount cleanup: closing/swiping the app destroys this screen, but the
  // line must stay registered in the background service to receive calls.
  const wasSignedIn = useRef(false);
  useEffect(() => {
    const { initVoip, shutdownVoip } = useCallStore.getState();
    if (signedIn) {
      wasSignedIn.current = true;
      initVoip();
    } else if (wasSignedIn.current) {
      wasSignedIn.current = false;
      shutdownVoip();
    }
  }, [signedIn]);

  // An incoming Telnyx call surfaces the full-screen incoming call UI.
  // Opened exactly once per call: a second copy of the screen stacked on top
  // made it flash when the call was answered or ended.
  const hasIncomingCall = useCallStore((s) => Boolean(s.incomingCall));
  const pathname = usePathname();
  const onIncomingScreen = pathname === '/incoming-call';
  useEffect(() => {
    if (hasIncomingCall && signedIn && !onIncomingScreen) {
      router.push('/incoming-call');
    }
  }, [hasIncomingCall, signedIn, onIncomingScreen]);

  // Show over the lock screen and wake the display only while a call rings.
  // Driven by the call itself (not the screen mounting and unmounting), so the
  // flag flips once per call instead of flickering.
  useEffect(() => {
    keepAlive.setShowOverLockScreen(hasIncomingCall);
  }, [hasIncomingCall]);

  if (!fontsLoaded && !fontError) return null;

  const app = (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          // iOS: native push with swipe-back. Android: the same smooth
          // parallax slide instead of the default Material transition.
          animation: Platform.OS === 'android' ? 'ios_from_right' : 'default',
        }}
      >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
          {/* Every signed-in screen is guarded, so a reload on a detail
              route lands on login instead of a half-empty screen. */}
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen
              name="active-call"
              options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
            />
            <Stack.Screen
              name="incoming-call"
              options={{ animation: 'fade', gestureEnabled: false }}
            />
            <Stack.Screen name="chat/[id]" />
            <Stack.Screen name="keypad" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="contact/[id]" />
          </Stack.Protected>
      </Stack>
      {/* Expo Go: hidden WebView that runs the Telnyx browser SDK. */}
      {signedIn && usesWebVoipEngine && voipSupported ? <VoipWebBridge /> : null}
    </>
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        {Platform.OS === 'web' ? (
          // On the web the app renders inside a centered phone-width frame,
          // so it always presents as a mobile UI. Native is untouched.
          <View style={styles.webBackdrop}>
            <View style={styles.phoneFrame}>{app}</View>
          </View>
        ) : (
          app
        )}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webBackdrop: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#0B1B3F',
  },
  phoneFrame: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    overflow: 'hidden',
  },
});
