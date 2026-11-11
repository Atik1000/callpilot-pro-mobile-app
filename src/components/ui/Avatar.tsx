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
  size = 48,
  backgroundColor = colors.primary,
  textColor = '#FFFFFF',
  imageUri,
  onPress,
}: AvatarProps) {
  const circle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor,
  };
  const content = imageUri ? (
    <Image source={{ uri: imageUri }} style={[circle, styles.image]} />
  ) : (
    <View style={[styles.circle, circle]}>
      <AppText
        color={textColor}
        style={{ fontSize: size * 0.34, fontFamily: fontFamily.semibold }}
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
