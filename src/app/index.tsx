import { Image } from 'expo-image';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { popIn } from '../components/ui/motion';
import { AppText } from '../components/ui/AppText';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme';

/** Expo Go ignores the native splash config, so the brand shows here too. */
const MIN_SPLASH_MS = 1400;

export default function Index() {
  const stage = useAuthStore((s) => s.stage);
  const restore = useAuthStore((s) => s.restore);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    if (stage === 'restoring') void restore();
  }, [stage, restore]);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  if (stage === 'restoring' || !minTimeElapsed) {
    return (
      <View style={styles.splash}>
        <StatusBar style="dark" />
        <Animated.View entering={popIn(0, 420)}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="CallPilot"
          />
        </Animated.View>
        <Animated.View entering={FadeIn.delay(225).duration(400)} style={styles.footer}>
          <ActivityIndicator color={colors.secondary} />
          <AppText variant="supporting" color={colors.textMuted}>
            AI phone calls for recruiters
          </AppText>
        </Animated.View>
      </View>
    );
  }
  if (stage === 'signedIn') return <Redirect href="/(tabs)/calls" />;
  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 232,
  },
  footer: {
    position: 'absolute',
    bottom: 72,
    alignItems: 'center',
    gap: 12,
  },
});
