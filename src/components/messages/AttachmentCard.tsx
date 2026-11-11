import { FileText, Image as ImageIcon } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Message } from '../../types';
import { colors, radius, spacing } from '../../theme';
import { formatClockTime } from '../../utils/formatTime';
import { AppText } from '../ui/AppText';

interface AttachmentCardProps {
  message: Message;
}

/** Attachment tile inside a chat (e.g. incoming "Photo · IMG_0412.jpg"). */
export function AttachmentCard({ message }: AttachmentCardProps) {
  const outgoing = message.sender === 'user';
  const isPhoto = message.attachmentKind !== 'document';
  const Icon = isPhoto ? ImageIcon : FileText;
  return (
    <View style={[styles.row, outgoing ? styles.rowOut : styles.rowIn]}>
      <View style={styles.card}>
        <View style={styles.iconBox}>
          <Icon size={22} color={colors.secondary} />
        </View>
        <View style={styles.texts}>
          <AppText variant="cardTitle">{isPhoto ? 'Photo' : 'Document'}</AppText>
          {message.attachmentName ? (
            <AppText variant="supporting" color={colors.textSecondary} numberOfLines={1}>
              {message.attachmentName}
            </AppText>
          ) : null}
        </View>
        <AppText variant="caption" color={colors.textMuted} style={styles.time}>
          {formatClockTime(message.timestamp)}
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    maxWidth: '82%',
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    gap: 2,
    flexShrink: 1,
  },
  time: {
    alignSelf: 'flex-end',
  },
});
