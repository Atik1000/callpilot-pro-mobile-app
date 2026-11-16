import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Contact, Conversation } from '../../types';
import { colors, fontFamily } from '../../theme';
import { formatPhone } from '../../utils/formatPhone';
import { formatListTime } from '../../utils/formatTime';
import { AppText } from '../ui/AppText';
import { Avatar } from '../ui/Avatar';

interface ConversationListItemProps {
  conversation: Conversation;
  contact?: Contact;
  onPress: () => void;
}

/** UI kit message row: avatar, name, "WhatsApp · preview", time and unread count. */
export function ConversationListItem({ conversation, contact, onPress }: ConversationListItemProps) {
  const isNumber = conversation.contactId.startsWith('+');
  const name = contact?.name ?? (isNumber ? formatPhone(conversation.contactId) : 'Unknown');
  const unread = conversation.unreadCount > 0;
  const whatsapp = conversation.channel === 'whatsapp';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${name}${unread ? `, ${conversation.unreadCount} unread` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {contact ? (
        <Avatar name={name} size={44} />
      ) : (
        <View style={styles.unknown}>
          <AppText style={styles.unknownText}>?</AppText>
        </View>
      )}
      <View style={styles.texts}>
        <View style={styles.topRow}>
          <AppText variant="cardTitle" numberOfLines={1} style={styles.name}>
            {name}
          </AppText>
          <AppText
            style={unread ? styles.timeUnread : styles.time}
            color={unread ? colors.aiBlue : colors.black}
          >
            {formatListTime(conversation.lastMessageAt)}
          </AppText>
        </View>
        <View style={styles.bottomRow}>
          <AppText variant="supporting" numberOfLines={1} style={styles.preview}>
            <AppText style={styles.channel} color={whatsapp ? colors.mintText : colors.black}>
              {whatsapp ? 'WhatsApp' : 'SMS'}
            </AppText>
            {' · '}
            {conversation.lastMessagePreview}
          </AppText>
          {unread ? (
            <View style={styles.count}>
              <AppText style={styles.countText} color={colors.white}>
                {conversation.unreadCount > 9 ? '9+' : String(conversation.unreadCount)}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  pressed: {
    opacity: 0.6,
  },
  unknown: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unknownText: {
    fontFamily: fontFamily.extrabold,
    fontSize: 15,
  },
  texts: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    flex: 1,
  },
  time: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
  },
  timeUnread: {
    fontFamily: fontFamily.extrabold,
    fontSize: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  preview: {
    flex: 1,
  },
  channel: {
    fontFamily: fontFamily.bold,
    fontSize: 12.5,
  },
  count: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.aiBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontFamily: fontFamily.extrabold,
    fontSize: 11,
  },
});
