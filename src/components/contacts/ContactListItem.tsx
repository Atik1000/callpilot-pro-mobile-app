import { MessageCircle, Phone } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Contact, contactCategoryLabel } from '../../types';
import { colors, spacing } from '../../theme';
import { AppText } from '../ui/AppText';
import { Avatar } from '../ui/Avatar';
import { IconButton } from '../ui/IconButton';

interface ContactListItemProps {
  contact: Contact;
  onPress: () => void;
  onCall: () => void;
  onMessage: () => void;
}

export function ContactListItem({ contact, onPress, onCall, onMessage }: ContactListItemProps) {
  const subtitleParts = [contactCategoryLabel[contact.category]];
  if (contact.category === 'candidate' && contact.jobTitle) {
    subtitleParts.push(contact.jobTitle);
  } else if (contact.company) {
    subtitleParts.push(contact.company);
  }

  return (
    <View style={styles.row}>
      {/* The open-record press area excludes the call/message buttons so
          pressables are never nested. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open record for ${contact.name}`}
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
      >
        <Avatar name={contact.name} size={44} />
        <View style={styles.texts}>
          <AppText variant="cardTitle" numberOfLines={1}>
            {contact.name}
          </AppText>
          <AppText variant="supporting" color={colors.textSecondary} numberOfLines={1}>
            {subtitleParts.join(' · ')}
          </AppText>
        </View>
      </Pressable>
      <View style={styles.actions}>
        <IconButton
          icon={<Phone size={18} color={colors.secondary} />}
          onPress={onCall}
          accessibilityLabel={`Call ${contact.name}`}
          size={42}
        />
        <IconButton
          icon={<MessageCircle size={18} color={colors.secondary} />}
          onPress={onMessage}
          accessibilityLabel={`Message ${contact.name}`}
          size={42}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
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
  texts: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
