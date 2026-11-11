import React from 'react';
import { StyleProp, Text, TextProps, TextStyle } from 'react-native';
import { colors, typography, TypographyVariant } from '../../theme';

interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: TextStyle['textAlign'];
  style?: StyleProp<TextStyle>;
}

export function AppText({
  variant = 'body',
  color = colors.textPrimary,
  align,
  style,
  children,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[typography[variant], { color }, align ? { textAlign: align } : null, style]}
    >
      {children}
    </Text>
  );
}
