import { useRouter } from 'expo-router';
import { Phone, PhoneOff } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/ui/AppText';
import { Avatar } from '../components/ui/Avatar';
import { popIn, PressableScale, PulsingDot, rise } from '../components/ui/motion';
import { useCallStore } from '../store/callStore';
import { colors, fontFamily, spacing } from '../theme';

export default function IncomingCallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const incomingCall = useCallStore((s) => s.incomingCall);
  const answerIncoming = useCallStore((s) => s.answerIncoming);
  const declineIncoming = useCallStore((s) => s.declineIncoming);

  // The avatar ring pulses while ringing.
  const ringPulse = useSharedValue(0);
  useEffect(() => {
    ringPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [ringPulse]);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ringPulse.value * 0.07 }],
    shadowOpacity: 0.3 + ringPulse.value * 0.5,
  }));

  // Leave when the call stops ringing (declined, answered elsewhere, timeout).
  useEffect(() => {
    if (!incomingCall) {
      if (useCallStore.getState().activeCall) {
        router.replace('/active-call');
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/calls');
      }
    }
  }, [incomingCall, router]);

  if (!incomingCall) return <View style={styles.root} />;

  const handleAnswer = () => {
    answerIncoming().catch((error: unknown) => {
      Alert.alert(
        'Could not answer',
        error instanceof Error ? error.message : 'The call could not be answered.',
      );
    });
    // The effect above moves to /active-call once the store flips over.
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]}>
      <Animated.View entering={FadeIn.duration(350)} style={styles.statusRow}>
        <PulsingDot color={colors.secondary} size={8} duration={900} />
        <AppText variant="supporting" color={colors.headerText}>
          Incoming call · Business line
        </AppText>
      </Animated.View>

      <View style={styles.caller}>
        <Animated.View entering={popIn(40)}>
          <Animated.View style={[styles.avatarRing, ringStyle]}>
            <Avatar
              name={incomingCall.displayName}
              size={104}
              backgroundColor="#FFFFFF"
              textColor={colors.textPrimary}
            />
          </Animated.View>
        </Animated.View>
        <Animated.View
          entering={rise(80)}
          style={styles.callerTexts}
        >
          <AppText style={styles.callerName} color={colors.headerText}>
            {incomingCall.displayName}
          </AppText>
          <AppText variant="body" color={colors.headerTextSecondary}>
            {incomingCall.phoneNumber}
          </AppText>
        </Animated.View>
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Animated.View entering={popIn(150)} style={styles.action}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Decline call"
            onPress={declineIncoming}
            scaleTo={0.85}
            style={[styles.actionButton, styles.decline]}
          >
            <PhoneOff size={28} color="#FFFFFF" />
          </PressableScale>
          <AppText variant="supporting" color={colors.headerTextSecondary}>
            Decline
          </AppText>
        </Animated.View>
        <Animated.View entering={popIn(190)} style={styles.action}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Answer call"
            onPress={handleAnswer}
            scaleTo={0.85}
            style={[styles.actionButton, styles.answer]}
          >
            <Phone size={28} color="#FFFFFF" />
          </PressableScale>
          <AppText variant="supporting" color={colors.headerTextSecondary}>
            Answer
          </AppText>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primaryDark,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  caller: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  callerTexts: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: colors.secondary,
    marginBottom: spacing.md,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 22,
    elevation: 8,
  },
  callerName: {
    fontFamily: fontFamily.bold,
    fontSize: 30,
    lineHeight: 36,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  action: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decline: {
    backgroundColor: '#E5484D',
  },
  answer: {
    backgroundColor: '#30A46C',
  },
});
