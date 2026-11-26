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
import { Href, router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { VoipWebBridge } from '../components/voip/VoipWebBridge';
import { usesWebVoipEngine, voipSupported } from '../services/voipService';
import { notificationService } from '../services/notificationService';
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

  useEffect(() => {
    if (!signedIn || Platform.OS !== 'android' || usesWebVoipEngine) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void notificationService.registerRemotePush().then((status) => {
        if (useAuthStore.getState().stage !== 'signedIn') return;
        useCallStore.setState({ pushReady: status.ready, pushDetail: status.detail });
      });
    });
    return () => subscription.remove();
  }, [signedIn]);

  // Native FCM handles cold-start ringing. The signed-in UI connects signaling
  // and registers this handset for server push; screen removal is not logout.
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
  const hasIncomingCall = useCallStore((s) => Boolean(s.incomingCall));
  useEffect(() => {
    if (hasIncomingCall && signedIn) {
      router.push('/incoming-call');
    }
  }, [hasIncomingCall, signedIn]);

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
