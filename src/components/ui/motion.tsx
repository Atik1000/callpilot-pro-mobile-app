import React from 'react';
import { Platform, Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  Keyframe,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
 * Entrance: a quick, quiet fade. No movement and no staggered delays, so
 * screens appear calm and immediately usable. `_delay` is accepted for
 * existing call sites but ignored on purpose. Honors the OS reduce-motion
 * setting.
 */
export function rise(_delay = 0, duration = 160) {
  // On web, Reanimated keyframe entrances can leave elements absolutely
  // positioned (overlapping layout), so web renders without them.
  if (Platform.OS === 'web') return undefined;
  return new Keyframe({
    0: { opacity: 0 },
    100: { opacity: 1, easing: easeOut },
  })
    .duration(duration)
    .reduceMotion(ReduceMotion.System);
}

/** Entrance for small elements (dialogs, FABs): the same quiet fade. */
export function popIn(_delay = 0, duration = 160) {
  return rise(0, duration);
}

/** List rows appear immediately — no per-row entrance animation. */
export function listEnter(_index: number) {
  return undefined;
}

/** Smooth, non-bouncy re-layout when a list item is removed. */
export const listLayout = LinearTransition.duration(200)
  .easing(easeOut)
  .reduceMotion(ReduceMotion.System);

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
  scaleTo = 0.97,
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

/**
 * Status dot for live states (Recording, Available, unread). Kept static:
 * colour alone carries the state, without constant motion.
 */
export function PulsingDot({ color, size = 8, style }: PulsingDotProps) {
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

/** Caps stagger delays so long lists never feel sluggish. */
export function staggerDelay(index: number, step = 55, max = 440): number {
  return Math.min(index * step, max);
}
