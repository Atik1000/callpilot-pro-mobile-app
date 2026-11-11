import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppAlert } from '../../types';
import { colors, spacing } from '../../theme';
import { AppButton } from '../ui/AppButton';
import { AppText } from '../ui/AppText';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

interface AlertCardProps {
  alert: AppAlert;
  onPress?: () => void;
  onSend?: () => void;
  onDismiss?: () => void;
  /** Web parity: non-decision alerts get a "Mark read" action. */
  onMarkRead?: () => void;
}

export function AlertCard({ alert, onPress, onSend, onDismiss, onMarkRead }: AlertCardProps) {
  const actioned = alert.status === 'actioned';
  return (
    <Card style={styles.card}>
      <View style={styles.body}>
        {/* The text area opens the related screen; the Send/Dismiss buttons
            stay outside it so pressables are never nested. */}
        <Pressable
          accessibilityRole={onPress ? 'button' : undefined}
          accessibilityLabel={alert.title}
          onPress={onPress}
          style={({ pressed }) => [styles.body, pressed && onPress && styles.pressed]}
        >
          <View style={styles.titleRow}>
            <AppText variant="cardTitle" style={styles.title}>
              {alert.title}
            </AppText>
            {!alert.isRead ? <Badge label="New" /> : null}
          </View>
          <AppText variant="supporting" color={colors.textSecondary}>
            {alert.description}
          </AppText>
        </Pressable>
        {alert.requiresConfirmation && !actioned && onSend && onDismiss ? (
          <View style={styles.actions}>
            <AppButton label="Send" onPress={onSend} compact />
            <AppButton label="Dismiss" onPress={onDismiss} variant="secondary" compact />
          </View>
        ) : null}
        {!alert.requiresConfirmation && !alert.isRead && onMarkRead ? (
          <View style={styles.actions}>
            <AppButton label="Mark read" onPress={onMarkRead} variant="secondary" compact />
          </View>
        ) : null}
        {actioned ? (
          <View style={styles.sentRow}>
            <View style={styles.sentDot} />
            <AppText variant="caption" color={colors.textSecondary}>
              Approved — CallPilot is sending it
            </AppText>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  body: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flexShrink: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
});
