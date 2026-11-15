import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { rise, popIn } from '../../components/ui/motion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { AppText } from '../../components/ui/AppText';
import { useAuthStore } from '../../store/authStore';
import { colors, radius, spacing } from '../../theme';
import { LoginFormValues, loginSchema } from '../../utils/validators';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, isLoading, error, clearError } = useAuthStore();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async ({ email, password }) => {
    const result = await login(email, password);
    if (result === 'otp') {
      router.push('/(auth)/verify-otp');
    } else if (result === 'signedIn') {
      router.replace('/(tabs)/calls');
    }
  });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxxl * 2, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={popIn(40)}
          style={styles.logo}
        >
          <Image
            source={require('../../../assets/images/logo-mark.png')}
            style={styles.logoImage}
            contentFit="contain"
          />
        </Animated.View>
        <Animated.View entering={rise(80)}>
          <AppText variant="screenTitle" color={colors.headerText} style={styles.title}>
            CallPilot
          </AppText>
          <AppText variant="body" color={colors.headerTextSecondary} style={styles.subtitle}>
            Your business line, WhatsApp and SMS, linked to your ATS.
          </AppText>
        </Animated.View>

        <Animated.View entering={rise(130)}>
        <Controller
          control={control}
          name="email"
          render={({ field: { value, onChange, onBlur } }) => (
            <AppInput
              label="Work email"
              value={value}
              onChangeText={(t) => {
                clearError();
                onChange(t);
              }}
              onBlur={onBlur}
              placeholder="name@company.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              dark
              error={errors.email?.message}
              containerStyle={styles.field}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { value, onChange, onBlur } }) => (
            <AppInput
              label="Password"
              value={value}
              onChangeText={(t) => {
                clearError();
                onChange(t);
              }}
              onBlur={onBlur}
              placeholder="••••••••"
              isPassword
              autoCapitalize="none"
              dark
              error={errors.password?.message}
              containerStyle={styles.field}
            />
          )}
        />

        {error ? (
          <AppText variant="supporting" color={colors.error} style={styles.authError}>
            {error}
          </AppText>
        ) : null}

        <AppButton
          label="Sign in"
          onPress={() => void onSubmit()}
          variant="light"
          fullWidth
          loading={isLoading}
          style={styles.signIn}
        />
        </Animated.View>

        <Animated.View
          entering={rise(190)}
          style={styles.hintRow}
        >
          <View style={styles.hintDot} />
          <AppText variant="supporting" color={colors.headerTextSecondary} style={styles.hintText}>
            Two-step sign-in: a 6-digit code is sent to your phone.
          </AppText>
        </Animated.View>

        <View style={styles.footer}>
          <AppText variant="supporting" color={colors.headerTextSecondary}>
            Same login on laptop and mobile.
          </AppText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.primaryDark,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 48,
    height: 48,
  },
  title: {
    marginTop: spacing.xl,
  },
  subtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.xxxl,
  },
  field: {
    marginBottom: spacing.xl,
  },
  authError: {
    marginBottom: spacing.md,
  },
  signIn: {
    marginTop: spacing.sm,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xxl,
  },
  hintDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
    marginTop: 5,
  },
  hintText: {
    flex: 1,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingTop: spacing.xxxl,
  },
});
