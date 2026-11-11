import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Message } from '../../types';
import { colors, radius, spacing } from '../../theme';
import { AppText } from '../ui/AppText';

interface ChatSystemNoticeProps {
  message: Message;
}

/** Centered pill notice ("Saved to ATS record…", "Sent by SMS…"). */
export function ChatSystemNotice({ message }: ChatSystemNoticeProps) {
  const dotColor =
    message.systemTone === 'warning' ? colors.warning : colors.success;
  return (
    <View style={styles.row}>
      <View style={styles.pill}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <AppText variant="caption" style={styles.text}>
          {message.content}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    maxWidth: '92%',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    flexShrink: 1,
  },
});
