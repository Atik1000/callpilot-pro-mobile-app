import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { MOCK_OTP } from '../../data/constants';
import { SERVICE_MODE } from '../../services/config';
import { useAuthStore } from '../../store/authStore';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { OTP_LENGTH, otpSchema } from '../../utils/validators';

const RESEND_SECONDS = 30;

export default function VerifyOtpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { verifyOtp, resendOtp, isLoading, error, clearError, pendingEmail } =
    useAuthStore();

  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const shake = useSharedValue(0);

  // Shake the code boxes when verification fails.
  useEffect(() => {
    if (error) {
      shake.value = withSequence(
        withTiming(-9, { duration: 50 }),
        withTiming(9, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(0, { duration: 60 }),
      );
    }
  }, [error, shake]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (value: string) => {
    clearError();
    setCode(value.replace(/\D/g, '').slice(0, OTP_LENGTH));
  };

  const handleVerify = async () => {
    if (!otpSchema.safeParse(code).success) return;
    const ok = await verifyOtp(code);
    if (ok) router.replace('/(tabs)/calls');
  };

  const handleResend = async () => {
    setCountdown(RESEND_SECONDS);
    await resendOtp();
  };

  const canVerify = code.length === OTP_LENGTH && !isLoading;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.back}
        >
          <ArrowLeft size={22} color={colors.headerText} />
        </Pressable>

        <Animated.View entering={FadeInDown.delay(60).springify().damping(18)}>
          <AppText variant="screenTitle" color={colors.headerText} style={styles.title}>
            Enter the 6-digit code
          </AppText>
          <AppText variant="body" color={colors.headerTextSecondary} style={styles.subtitle}>
            Two-step sign-in for {pendingEmail ?? 'your account'}.
          </AppText>
        </Animated.View>

        <Animated.View style={shakeStyle}>
          <Pressable onPress={() => inputRef.current?.focus()} style={styles.boxes}>
            {Array.from({ length: OTP_LENGTH }).map((_, i) => {
              const filled = i < code.length;
              const activeBox = i === code.length;
              return (
                <Animated.View
                  key={i}
                  entering={ZoomIn.delay(140 + i * 55).springify().damping(14)}
                  style={[styles.box, activeBox && styles.boxActive, filled && styles.boxFilled]}
                >
                  <AppText style={styles.boxDigit} color={colors.headerText}>
                    {code[i] ?? ''}
                  </AppText>
                </Animated.View>
              );
            })}
          </Pressable>
        </Animated.View>
        {/* Hidden input drives all boxes — supports paste and auto-focus. */}
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={handleChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          maxLength={OTP_LENGTH}
          style={styles.hiddenInput}
          accessibilityLabel="6-digit verification code"
        />

        {error ? (
          <AppText variant="supporting" color={colors.error} style={styles.error}>
            {error}
          </AppText>
        ) : null}

        <AppButton
          label="Verify"
          onPress={() => void handleVerify()}
          variant="light"
          fullWidth
          disabled={!canVerify}
          loading={isLoading}
          style={styles.verify}
        />

        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <AppText variant="supporting" color={colors.headerTextSecondary}>
              Resend code in 0:{countdown.toString().padStart(2, '0')}
            </AppText>
          ) : (
            <AppText
              variant="bodyMedium"
              color={colors.headerText}
              onPress={() => void handleResend()}
              accessibilityRole="button"
              suppressHighlighting
            >
              Resend code
            </AppText>
          )}
        </View>

        <View style={styles.devNote}>
          {SERVICE_MODE === 'mock' ? (
            <AppText variant="caption" color={colors.textMuted}>
              Development build: no code is really sent. Use {MOCK_OTP}.
            </AppText>
          ) : (
            <AppText variant="caption" color={colors.textMuted}>
              The code was sent by CallPilot to your registered device.
            </AppText>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  back: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  title: {
    marginTop: spacing.xxl,
  },
  subtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.xxxl,
  },
  boxes: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  box: {
    flex: 1,
    aspectRatio: 0.82,
    maxWidth: 58,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: colors.inputDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    borderColor: colors.secondary,
    borderWidth: 2,
  },
  boxFilled: {
    borderColor: 'rgba(255,255,255,0.75)',
  },
  boxDigit: {
    fontFamily: fontFamily.semibold,
    fontSize: 24,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  error: {
    marginTop: spacing.lg,
  },
  verify: {
    marginTop: spacing.xxl,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  devNote: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
});
