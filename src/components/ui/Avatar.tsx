import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { colors, fontFamily } from '../../theme';
import { getInitials } from '../../utils/getInitials';
import { AppText } from './AppText';

interface AvatarProps {
  name: string;
  size?: number;
  backgroundColor?: string;
  textColor?: string;
  imageUri?: string;
  onPress?: () => void;
}

export function Avatar({
  name,
  size = 44,
  backgroundColor = colors.black,
  textColor = colors.white,
  imageUri,
  onPress,
}: AvatarProps) {
  const circle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor,
  };
  const fontSize = Math.round(size * 0.32);
  const content = imageUri ? (
    <Image source={{ uri: imageUri }} style={[circle, styles.image]} />
  ) : (
    <View style={[styles.circle, circle]}>
      <AppText
        color={textColor}
        numberOfLines={1}
        // lineHeight must scale with the font: the default body line height
        // (21) clips the initials on large avatars (call screens).
        style={{
          fontSize,
          lineHeight: Math.round(fontSize * 1.25),
          fontFamily: fontFamily.extrabold,
          textAlign: 'center',
          includeFontPadding: false,
        }}
      >
        {getInitials(name)}
      </AppText>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    resizeMode: 'cover',
  },
  pressed: {
    opacity: 0.7,
  },
});
