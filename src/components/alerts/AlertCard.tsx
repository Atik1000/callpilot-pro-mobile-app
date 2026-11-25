import { Briefcase, CalendarClock, FileText, PhoneMissed, Zap } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AlertKind, AppAlert } from '../../types';
import { colors, fontFamily, spacing } from '../../theme';
import { AppButton } from '../ui/AppButton';
import { AppText } from '../ui/AppText';

interface AlertCardProps {
  alert: AppAlert;
  onPress?: () => void;
  onSend?: () => void;
  onDismiss?: () => void;
  /** Non-decision alerts get a "Mark read" action. */
  onMarkRead?: () => void;
}

/** Icon tile per alert kind, coloured by UI kit meaning. */
const KIND_STYLE: Record<AlertKind, { Icon: typeof Zap; color: string }> = {
  'missed-call': { Icon: PhoneMissed, color: colors.red },
  documents: { Icon: FileText, color: colors.mint },
  'ai-suggestion': { Icon: Zap, color: colors.aiBlue },
  'shift-fill': { Icon: CalendarClock, color: colors.amber },
  'client-order': { Icon: Briefcase, color: colors.aiBlue },
};

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const yesterday = new Date(today.getTime() - 86400000).toDateString() === d.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  if (yesterday) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** UI kit alert card: coloured icon tile, bold title with time, description. */
export function AlertCard({ alert, onPress, onSend, onDismiss, onMarkRead }: AlertCardProps) {
  const actioned = alert.status === 'actioned';
  const isNew = !alert.isRead;
  const { Icon, color } = KIND_STYLE[alert.kind] ?? KIND_STYLE['ai-suggestion'];

  return (
    <View style={[styles.card, isNew ? styles.cardNew : styles.cardRead]}>
      {/* The text area opens the related screen; action buttons stay outside it. */}
      <Pressable
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${alert.title}. ${alert.description}`}
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && onPress && styles.pressed]}
      >
        <View style={[styles.icon, { backgroundColor: color }]}>
          <Icon size={18} color={colors.white} />
        </View>
        <View style={styles.texts}>
          <View style={styles.titleRow}>
            <AppText style={styles.title} numberOfLines={2}>
              {alert.title}
            </AppText>
            <AppText style={styles.time}>{timeLabel(alert.timestamp)}</AppText>
          </View>
          <AppText style={styles.description}>{alert.description}</AppText>
        </View>
      </Pressable>

      {alert.requiresConfirmation && !actioned && onSend && onDismiss ? (
        <View style={styles.actions}>
          <AppButton label="Send" onPress={onSend} compact style={styles.action} />
          <AppButton label="Dismiss" onPress={onDismiss} variant="secondary" compact style={styles.action} />
        </View>
      ) : null}
      {!alert.requiresConfirmation && isNew && onMarkRead ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mark "${alert.title}" as read`}
          onPress={onMarkRead}
          hitSlop={10}
          style={({ pressed }) => [styles.markRead, pressed && styles.pressed]}
        >
          <AppText style={styles.markReadText} color={colors.aiBlue}>
            Mark read
          </AppText>
        </Pressable>
      ) : null}
      {actioned ? (
        <View style={styles.sentRow}>
          <View style={styles.sentDot} />
          <AppText variant="caption">Approved — CallPilot is sending it</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  cardNew: {
    backgroundColor: colors.aiBlueTint,
  },
  cardRead: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  main: {
    flexDirection: 'row',
    gap: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  time: {
    fontFamily: fontFamily.semibold,
    fontSize: 12,
    lineHeight: 20,
  },
  description: {
    fontFamily: fontFamily.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 12,
    paddingLeft: 52,
  },
  action: {
    flex: 1,
  },
  markRead: {
    alignSelf: 'flex-start',
    marginTop: 8,
    marginLeft: 52,
  },
  markReadText: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
  },
  sentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 10,
    paddingLeft: 52,
  },
  sentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.mint,
  },
});
