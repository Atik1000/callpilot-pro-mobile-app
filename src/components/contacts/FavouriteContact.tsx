import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Contact } from '../../types';
import { spacing } from '../../theme';
import { AppText } from '../ui/AppText';
import { Avatar } from '../ui/Avatar';

interface FavouriteContactProps {
  contact: Contact;
  onPress: () => void;
}

export function FavouriteContact({ contact, onPress }: FavouriteContactProps) {
  return (
    <View style={styles.item}>
      <Avatar name={contact.name} size={56} onPress={onPress} />
      <AppText variant="caption" numberOfLines={1}>
        {contact.name}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    gap: spacing.xs,
    width: 72,
  },
});
