import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Message } from '../../types';
import { colors, radius, spacing } from '../../theme';
import { formatClockTime } from '../../utils/formatTime';
import { AppText } from '../ui/AppText';

interface MessageBubbleProps {
  message: Message;
}

function metaLine(message: Message): string {
  const parts: string[] = [];
  if (message.isTemplate) parts.push('Template');
  parts.push(formatClockTime(message.timestamp));
  if (message.status === 'read') parts.push('Read');
  else if (message.status === 'delivered') parts.push('Delivered');
  else if (message.status === 'sent') parts.push('Sent');
  else if (message.status === 'pending') parts.push('Sending…');
  else if (message.status === 'failed') parts.push('Not delivered');
  return parts.join(' · ');
}

/** Outgoing = black bubble/white text; incoming = white bubble/black text. */
export function MessageBubble({ message }: MessageBubbleProps) {
  const outgoing = message.sender === 'user';
  return (
    <View style={[styles.row, outgoing ? styles.rowOut : styles.rowIn]}>
      <View style={[styles.bubble, outgoing ? styles.bubbleOut : styles.bubbleIn]}>
        {message.title ? (
          <AppText variant="cardTitle" color={outgoing ? '#FFFFFF' : colors.textPrimary}>
            {message.title}
          </AppText>
        ) : null}
        {message.content ? (
          <AppText variant="body" color={outgoing ? '#FFFFFF' : colors.textPrimary}>
            {message.content}
          </AppText>
        ) : null}
        <AppText
          variant="caption"
          color={outgoing ? 'rgba(255,255,255,0.65)' : colors.textMuted}
          style={styles.meta}
        >
          {metaLine(message)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  rowOut: {
    justifyContent: 'flex-end',
  },
  rowIn: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 3,
  },
  bubbleOut: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: radius.sm,
  },
  bubbleIn: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: radius.sm,
  },
  meta: {
    marginTop: 2,
  },
});
