import { Check } from 'lucide-react-native';
import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../ui/AppText';
import { Divider } from '../ui/Divider';

interface OptionPickerProps<T extends string> {
  visible: boolean;
  title: string;
  options: readonly T[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}

/** Bottom-sheet style option list used by Settings pickers. */
export function OptionPicker<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: OptionPickerProps<T>) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={ZoomIn.springify().damping(16)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
          <AppText variant="cardTitle" style={styles.title}>
            {title}
          </AppText>
          {options.map((option, index) => (
            <View key={option}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: option === selected }}
                onPress={() => {
                  onSelect(option);
                  onClose();
                }}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              >
                <AppText variant="body">{option}</AppText>
                {option === selected ? <Check size={18} color={colors.secondary} /> : null}
              </Pressable>
            </View>
          ))}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  sheet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  title: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});
