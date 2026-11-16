import { ArrowDownLeft, ArrowUpRight, Phone } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Call, Contact, contactCategoryLabel } from '../../types';
import { colors, fontFamily } from '../../theme';
import { formatPhone } from '../../utils/formatPhone';
import { formatDuration } from '../../utils/formatTime';
import { AppText } from '../ui/AppText';
import { Avatar } from '../ui/Avatar';

interface CallListItemProps {
  call: Call;
  contact?: Contact;
  onPress: () => void;
  onAddUnknown?: () => void;
  onCallBack?: () => void;
}

/** "Outgoing · Candidate" style secondary line. */
function buildSubtitle(call: Call, contact?: Contact): string {
  const direction =
    call.direction === 'missed' ? 'Missed' : call.direction === 'outgoing' ? 'Outgoing' : 'Incoming';
  const parts: string[] = [direction];
  if (contact) {
    parts.push(contactCategoryLabel[contact.category]);
    if (contact.company && contact.category === 'client') parts.push(contact.company);
  } else if (!call.contactName) {
    parts.push('Not in ATS');
  }
  if (call.direction !== 'missed' && call.durationSeconds > 0) {
    parts.push(formatDuration(call.durationSeconds));
  }
  return parts.join(' · ');
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** UI kit call row: avatar, name (red when missed), direction line, time, call-back. */
export function CallListItem({ call, contact, onPress, onCallBack }: CallListItemProps) {
  const name = contact?.name || call.contactName;
  const title = name || formatPhone(call.phoneNumber);
  const missed = call.direction === 'missed';
  const ArrowIcon = call.direction === 'outgoing' ? ArrowUpRight : ArrowDownLeft;
  const arrowColor = missed ? colors.red : call.direction === 'outgoing' ? colors.aiBlue : colors.mint;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${buildSubtitle(call, contact)}`}
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        {name ? (
          <Avatar name={name} size={44} />
        ) : (
          <View style={styles.unknown}>
            <AppText style={styles.unknownText}>?</AppText>
          </View>
        )}
        <View style={styles.texts}>
          <AppText
            variant="cardTitle"
            color={missed ? colors.redText : colors.black}
            numberOfLines={1}
          >
            {title}
          </AppText>
          <View style={styles.subRow}>
            <ArrowIcon size={14} color={arrowColor} strokeWidth={2.4} />
            <AppText variant="supporting" numberOfLines={1} style={styles.sub}>
              {buildSubtitle(call, contact)}
            </AppText>
          </View>
        </View>
      </Pressable>
      <AppText variant="caption">{timeLabel(call.timestamp)}</AppText>
      {onCallBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Call ${title}`}
          onPress={onCallBack}
          hitSlop={4}
          style={({ pressed }) => [styles.callBack, pressed && styles.pressed]}
        >
          <Phone size={18} color={colors.aiBlue} />
        </Pressable>
      ) : null}
    </View>
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
  main: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sub: {
    flexShrink: 1,
  },
  callBack: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.aiBlueTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
