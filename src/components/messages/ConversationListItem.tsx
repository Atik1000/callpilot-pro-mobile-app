import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Contact, Conversation } from '../../types';
import { colors, spacing } from '../../theme';
import { formatPhone } from '../../utils/formatPhone';
import { formatListTime } from '../../utils/formatTime';
import { AppText } from '../ui/AppText';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { PulsingDot } from '../ui/motion';

interface ConversationListItemProps {
  conversation: Conversation;
  contact?: Contact;
  onPress: () => void;
}

export function ConversationListItem({
  conversation,
  contact,
  onPress,
}: ConversationListItemProps) {
  const name =
    contact?.name ??
    (conversation.contactId.startsWith('+')
      ? formatPhone(conversation.contactId)
      : 'Unknown');
  const unread = conversation.unreadCount > 0;
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`Conversation with ${name}${unread ? ', unread' : ''}`}
      style={styles.card}
    >
      <View style={styles.row}>
        <Avatar name={name} size={46} />
        <View style={styles.texts}>
          <AppText variant="cardTitle" numberOfLines={1}>
            {name}
          </AppText>
          <View style={styles.previewRow}>
            <Badge label={conversation.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} />
            <AppText
              variant="supporting"
              color={unread ? colors.textPrimary : colors.textSecondary}
              numberOfLines={1}
              style={styles.preview}
            >
              {conversation.lastMessagePreview}
            </AppText>
          </View>
          {contact?.phone ? (
            <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
              {formatPhone(contact.phone)}
            </AppText>
          ) : null}
        </View>
        <View style={styles.meta}>
          <AppText variant="caption" color={colors.textSecondary}>
            {formatListTime(conversation.lastMessageAt)}
          </AppText>
          {unread ? <PulsingDot color={colors.secondary} size={9} duration={2000} /> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  texts: {
    flex: 1,
    gap: 4,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  preview: {
    flex: 1,
  },
  meta: {
    alignItems: 'flex-end',
    gap: spacing.sm,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
});
