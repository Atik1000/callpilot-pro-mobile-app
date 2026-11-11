import { Redirect } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { colors } from '../theme';

export default function Index() {
  const stage = useAuthStore((s) => s.stage);
  const restore = useAuthStore((s) => s.restore);

  useEffect(() => {
    if (stage === 'restoring') void restore();
  }, [stage, restore]);

  if (stage === 'restoring') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }
  if (stage === 'signedIn') return <Redirect href="/(tabs)/calls" />;
  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
