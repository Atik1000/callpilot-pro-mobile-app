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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../components/ui/AppButton';
import { AppInput } from '../../components/ui/AppInput';
import { AppText } from '../../components/ui/AppText';
import { useAuthStore } from '../../store/authStore';
import { colors, fontFamily, spacing } from '../../theme';
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
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={require('../../../assets/images/logo-mark.png')}
          style={styles.logoImage}
          contentFit="contain"
        />
        <AppText variant="screenTitle" style={styles.title}>
          Welcome back
        </AppText>
        <AppText variant="body" style={styles.subtitle}>
          Sign in to your CallPilot business line.
        </AppText>

        <View>
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
              error={errors.password?.message}
              containerStyle={styles.field}
            />
          )}
        />

        {error ? (
          <AppText variant="supporting" color={colors.redText} style={styles.authError}>
            {error}
          </AppText>
        ) : null}

        <AppButton
          label="Sign in"
          onPress={() => void onSubmit()}
          variant="primary"
          fullWidth
          loading={isLoading}
          style={styles.signIn}
        />
        </View>

        <View style={styles.hintRow}>
          <View style={styles.hintDot} />
          <AppText style={styles.hintText}>
            A 6-digit code is sent to your phone the first time you sign in on this device.
          </AppText>
        </View>

        <View style={styles.footer}>
          <AppText style={styles.footerText} align="center">
            Same login as the CallPilot web app.
          </AppText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
  },
  logoImage: {
    width: 64,
    height: 64,
  },
  title: {
    marginTop: spacing.lg,
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 30,
  },
  field: {
    marginBottom: spacing.lg,
  },
  authError: {
    marginBottom: spacing.md,
  },
  signIn: {
    marginTop: spacing.xs,
    shadowColor: colors.aiBlue,
    shadowOpacity: 0.32,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 30,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    backgroundColor: colors.aiBlueTint,
  },
  hintDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.aiBlue,
    marginTop: 6,
  },
  hintText: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingTop: spacing.xxxl,
  },
  footerText: {
    fontFamily: fontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
  },
});
