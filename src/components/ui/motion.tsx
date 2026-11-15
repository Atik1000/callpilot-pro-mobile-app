import React, { useEffect } from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

export const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

/**
 * Shared spring configs so every interaction feels consistent. All are
 * (near-)critically damped: they settle smoothly without wobbling.
 */
export const springs = {
  press: { damping: 22, stiffness: 420, mass: 0.6 },
  gentle: { damping: 26, stiffness: 260 },
  bouncy: { damping: 20, stiffness: 300 },
} as const;

/** One easing curve for every entrance: fast start, soft landing. */
const easeOut = Easing.bezier(0.22, 1, 0.36, 1);

/**
 * Entrance: short fade + 10px rise. `delay` orders sections on a screen;
 * keep it small (≤ 200ms) so screens feel instant.
 */
export function rise(delay = 0, duration = 260) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 10 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }], easing: easeOut },
  })
    .duration(duration)
    .delay(delay);
}

/** Entrance for small elements (badges, FABs, dialogs): fade + slight scale. */
export function popIn(delay = 0, duration = 240) {
  return new Keyframe({
    0: { opacity: 0, transform: [{ scale: 0.92 }] },
    100: { opacity: 1, transform: [{ scale: 1 }], easing: easeOut },
  })
    .duration(duration)
    .delay(delay);
}

/**
 * Entrance for list rows. Only the first screenful staggers (30ms apart,
 * capped); rows mounted later while scrolling appear without animation so
 * fast scrolling never stutters.
 */
export function listEnter(index: number) {
  if (index >= 10) return undefined;
  return rise(Math.min(index * 30, 180), 240);
}

/** Smooth, non-bouncy re-layout when a list item is removed. */
export const listLayout = LinearTransition.duration(220).easing(easeOut);

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  /** How far the element shrinks while pressed. */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * Pressable with springy scale feedback — the app-wide replacement for
 * opacity-only pressed states.
 */
export function PressableScale({
  scaleTo = 0.95,
  style,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressableBase
      {...rest}
      disabled={disabled}
      onPressIn={(event) => {
        // Writing shared values inside event handlers is Reanimated's
        // documented pattern; the React Compiler lint can't see that.
        // eslint-disable-next-line react-hooks/immutability
        scale.value = withSpring(scaleTo, springs.press);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        // eslint-disable-next-line react-hooks/immutability
        scale.value = withSpring(1, springs.press);
        onPressOut?.(event);
      }}
      style={[animatedStyle, style, disabled ? { opacity: 0.45 } : null]}
    >
      {children}
    </AnimatedPressableBase>
  );
}

interface PulsingDotProps {
  color: string;
  size?: number;
  /** Full pulse cycle in ms. */
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

/** Softly pulsing dot for live states: Recording, Available, unread. */
export function PulsingDot({ color, size = 8, duration = 1600, style }: PulsingDotProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: duration / 2, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [duration, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + pulse.value * 0.45,
    transform: [{ scale: 0.9 + pulse.value * 0.25 }],
  }));

  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Caps stagger delays so long lists never feel sluggish. */
export function staggerDelay(index: number, step = 55, max = 440): number {
  return Math.min(index * step, max);
}
