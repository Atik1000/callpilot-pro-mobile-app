import { MessageCircle, Phone, StickyNote, Voicemail } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ATSActivity } from '../../types';
import { colors, spacing } from '../../theme';
import { AppText } from '../ui/AppText';
import { Card } from '../ui/Card';

interface ActivityListItemProps {
  activity: ATSActivity;
  onPress?: () => void;
}

const icons: Record<ATSActivity['type'], React.ComponentType<{ size?: number; color?: string }>> = {
  call: Phone,
  message: MessageCircle,
  voicemail: Voicemail,
  note: StickyNote,
};

export function ActivityListItem({ activity, onPress }: ActivityListItemProps) {
  const Icon = icons[activity.type];
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={activity.title}
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={styles.iconCircle}>
          <Icon size={17} color={colors.secondary} />
        </View>
        <View style={styles.texts}>
          <AppText variant="cardTitle" numberOfLines={1}>
            {activity.title}
          </AppText>
          <AppText variant="supporting" color={colors.textSecondary} numberOfLines={1}>
            {activity.detail}
          </AppText>
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
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: 2,
  },
});
