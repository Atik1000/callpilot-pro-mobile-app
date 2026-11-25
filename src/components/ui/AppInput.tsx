import { Eye, EyeOff } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, fontFamily, spacing } from '../../theme';
import { AppText } from './AppText';

interface AppInputProps extends TextInputProps {
  label?: string;
  error?: string;
  /** Dark style used on the black Login screen */
  dark?: boolean;
  isPassword?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export function AppInput({
  label,
  error,
  dark = false,
  isPassword = false,
  containerStyle,
  style,
  ...rest
}: AppInputProps) {
  const [hidden, setHidden] = useState(isPassword);
  return (
    <View style={containerStyle}>
      {label ? (
        <AppText
          variant="inputLabel"
          color={dark ? colors.headerText : colors.textPrimary}
          style={styles.label}
        >
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          dark ? styles.fieldDark : styles.fieldLight,
          error ? styles.fieldError : null,
        ]}
      >
        <TextInput
          {...rest}
          secureTextEntry={hidden}
          placeholderTextColor={dark ? colors.textMuted : colors.textMuted}
          style={[
            styles.input,
            { color: dark ? colors.headerText : colors.textPrimary },
            style,
          ]}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((v) => !v)}
            hitSlop={8}
            style={styles.eye}
          >
            {hidden ? (
              <EyeOff size={19} color={colors.textMuted} />
            ) : (
              <Eye size={19} color={colors.textMuted} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.error} style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 7,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  fieldLight: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  fieldDark: {
    backgroundColor: colors.inputDark,
    borderColor: colors.borderDark,
  },
  fieldError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    paddingVertical: spacing.md,
  },
  eye: {
    marginLeft: spacing.sm,
  },
  error: {
    marginTop: spacing.xs,
  },
});
