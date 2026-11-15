import { Phone, PhoneMissed } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Call, Contact, contactCategoryLabel } from '../../types';
import { colors, spacing } from '../../theme';
import { formatPhone } from '../../utils/formatPhone';
import { formatDuration, formatListTime } from '../../utils/formatTime';
import { AppText } from '../ui/AppText';
import { Avatar } from '../ui/Avatar';
import { Card } from '../ui/Card';
import { IconButton } from '../ui/IconButton';

interface CallListItemProps {
  call: Call;
  contact?: Contact;
  onPress: () => void;
  onAddUnknown?: () => void;
  /** Web parity: every call row has a call-back button. */
  onCallBack?: () => void;
}

function buildSubtitle(call: Call, contact?: Contact): string {
  const parts: string[] = [];
  if (contact) {
    parts.push(contactCategoryLabel[contact.category]);
  } else {
    parts.push('Not in ATS');
  }
  const duration = formatDuration(call.durationSeconds);
  if (call.direction === 'missed') {
    parts.push('Missed');
  } else if (call.channel === 'whatsapp') {
    parts.push(`WhatsApp call ${duration}`);
  } else {
    parts.push(`${call.direction === 'outgoing' ? 'Outgoing' : 'Incoming'} ${duration}`);
  }
  if (call.isRecorded) parts.push('Recorded');
  if (call.autoReplySent) parts.push('Auto reply sent');
  return parts.join(' · ');
}

export function CallListItem({ call, contact, onPress, onAddUnknown, onCallBack }: CallListItemProps) {
  const title = contact
    ? contact.company && contact.category === 'client'
      ? `${contact.name} – ${contact.company}`
      : contact.name
    : call.contactName || formatPhone(call.phoneNumber);
  const avatarName = contact?.name ?? call.contactName;

  return (
    // The call-back button must be a sibling of the pressable area —
    // nested buttons break on react-native-web.
    <Card style={styles.card}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Call with ${title}`}
          onPress={onPress}
          style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        >
          {avatarName ? (
            <Avatar name={avatarName} size={46} />
          ) : (
            <View style={styles.unknownAvatar}>
              <PhoneMissed size={18} color={colors.secondary} />
            </View>
          )}
          <View style={styles.texts}>
            <AppText variant="cardTitle" numberOfLines={1}>
              {title}
            </AppText>
            <AppText variant="supporting" color={colors.textSecondary} numberOfLines={1}>
              {buildSubtitle(call, contact)}
            </AppText>
            {avatarName && call.phoneNumber ? (
              <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
                {formatPhone(call.phoneNumber)}
              </AppText>
            ) : null}
          </View>
          {!contact && onAddUnknown ? (
            // Pressing the card itself opens the add-contact flow for unknown numbers.
            <AppText variant="bodyMedium">Add</AppText>
          ) : (
            <AppText variant="caption" color={colors.textSecondary}>
              {formatListTime(call.timestamp)}
            </AppText>
          )}
        </Pressable>
        {onCallBack ? (
          <IconButton
            icon={<Phone size={16} color={colors.secondary} />}
            onPress={onCallBack}
            accessibilityLabel={`Call ${title}`}
            size={34}
            backgroundColor={colors.blueLight}
          />
        ) : null}
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
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  unknownAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: 2,
  },
});
