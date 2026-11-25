import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Contact, contactCategoryLabel } from '../../types';
import { colors } from '../../theme';
import { AppText } from '../ui/AppText';
import { Avatar } from '../ui/Avatar';
import { StatusBadge, StatusTone } from '../ui/StatusBadge';

interface ContactListItemProps {
  contact: Contact;
  onPress: () => void;
  /** Kept for call sites; calling/messaging lives on the contact record. */
  onCall?: () => void;
  onMessage?: () => void;
}

/** Colour meaning from the UI kit: mint done, amber waiting, red missing, blue progress. */
export function atsStatusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (/(unsuccess|missing|reject|declin|fail|lost|inactive)/.test(s)) return 'error';
  if (/(request|waiting|pending|chas|await)/.test(s)) return 'warning';
  if (/(submit|interview|offer|progress|shortlist)/.test(s)) return 'info';
  if (/(received|active|placed|complete|verified|approved|working)/.test(s)) return 'success';
  return 'neutral';
}

/** UI kit contact row: avatar, name, category line and ATS status chip. */
export function ContactListItem({ contact, onPress }: ContactListItemProps) {
  const subtitleParts = [contactCategoryLabel[contact.category]];
  if (contact.category === 'candidate' && contact.jobTitle) subtitleParts.push(contact.jobTitle);
  else if (contact.company) subtitleParts.push(contact.company);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open record for ${contact.name}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar name={contact.name} size={44} />
      <View style={styles.texts}>
        <AppText variant="cardTitle" numberOfLines={1}>
          {contact.name}
        </AppText>
        <AppText variant="supporting" numberOfLines={1}>
          {subtitleParts.join(' · ')}
        </AppText>
      </View>
      {contact.atsStatus ? (
        <View style={styles.status}>
          <StatusBadge label={contact.atsStatus} tone={atsStatusTone(contact.atsStatus)} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
  },
  pressed: {
    opacity: 0.6,
  },
  texts: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  status: {
    maxWidth: '46%',
  },
});
