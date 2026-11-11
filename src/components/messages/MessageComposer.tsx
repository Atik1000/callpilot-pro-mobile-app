import { ArrowRight, FileText } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { colors, fontFamily, radius, spacing } from '../../theme';
import { IconButton } from '../ui/IconButton';

interface MessageComposerProps {
  onSend: (text: string) => void;
  onAttach: () => void;
  /** Controlled mode (used by chat so "Suggest reply" can fill the box). */
  value?: string;
  onChangeText?: (text: string) => void;
}

export function MessageComposer({ onSend, onAttach, value, onChangeText }: MessageComposerProps) {
  const [ownText, setOwnText] = useState('');
  const text = value ?? ownText;
  const setText = onChangeText ?? setOwnText;
  const canSend = text.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;
    onSend(text);
    setText('');
  };

  return (
    <View style={styles.bar}>
      <IconButton
        icon={<FileText size={20} color={colors.secondary} />}
        onPress={onAttach}
        accessibilityLabel="Add attachment"
        size={46}
        backgroundColor={colors.surface}
      />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Message"
        placeholderTextColor={colors.textMuted}
        multiline
        style={styles.input}
        accessibilityLabel="Message input"
      />
      <IconButton
        icon={<ArrowRight size={20} color="#FFFFFF" />}
        onPress={handleSend}
        accessibilityLabel="Send message"
        size={46}
        backgroundColor={colors.primary}
        disabled={!canSend}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 120,
  },
});
