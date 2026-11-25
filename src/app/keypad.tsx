import { Delete, Phone } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DialPad } from '../components/calls/DialPad';
import { StandaloneTabBar } from '../components/layout/BottomTabBar';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { ScreenHeader } from '../components/layout/ScreenHeader';
import { AppText } from '../components/ui/AppText';
import { PressableScale } from '../components/ui/motion';
import { StatusBadge } from '../components/ui/StatusBadge';
import { BUSINESS_NUMBER } from '../data/constants';
import { useCommunications } from '../hooks/useCommunications';
import { findContactByPhone, useContacts } from '../hooks/useContacts';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';
import { colors, fontFamily, spacing } from '../theme';
import { contactCategoryLabel } from '../types';
import { formatPhone, isDiallable } from '../utils/formatPhone';

export default function KeypadScreen() {
  // Falls back to the shared constant so the card never shows an empty number.
  const businessNumber = useAuthStore((s) => s.user?.businessNumber) ?? BUSINESS_NUMBER;
  const dialedNumber = useCallStore((s) => s.dialedNumber);
  const appendDigit = useCallStore((s) => s.appendDigit);
  const deleteDigit = useCallStore((s) => s.deleteDigit);
  const clearDialedNumber = useCallStore((s) => s.clearDialedNumber);
  const voipStatus = useCallStore((s) => s.voipStatus);
  const voipDetail = useCallStore((s) => s.voipDetail);

  const lineIssue =
    voipStatus === 'connecting'
      ? 'Connecting your business line…'
      : voipStatus === 'offline'
        ? `Line offline — ${voipDetail || 'retrying'}`
        : null;

  const { data: contacts } = useContacts();
  const { startCall } = useCommunications();

  const match = useMemo(
    () => (dialedNumber.length >= 6 ? findContactByPhone(contacts, dialedNumber) : undefined),
    [contacts, dialedNumber],
  );

  const canCall = isDiallable(dialedNumber);

  const handleCall = () => {
    if (!canCall) return;
    const number = match ? match.phone : formatPhone(dialedNumber);
    clearDialedNumber();
    startCall(number, match);
  };

  return (
    <ScreenContainer
      header={<ScreenHeader title="Keypad" />}
      footer={<StandaloneTabBar activeName="keypad" />}
      scrollable
      padded={false}
    >
      <View style={styles.body}>
        <View style={styles.fromCard}>
          <AppText variant="sectionTitle" style={styles.fromLabel}>
            Call from
          </AppText>
          <AppText style={styles.fromValue} numberOfLines={1}>
            Business line · {formatPhone(businessNumber)}
          </AppText>
          {lineIssue ? (
            <AppText variant="caption" color={colors.amberText} style={styles.lineIssue}>
              {lineIssue}
            </AppText>
          ) : null}
        </View>

        <View style={styles.display}>
          <AppText style={styles.number} numberOfLines={1} adjustsFontSizeToFit>
            {dialedNumber ? formatPhone(dialedNumber) : ' '}
          </AppText>
          <View style={styles.matchRow}>
            {match ? (
              <>
                <StatusBadge label="In ATS" tone="info" />
                <AppText variant="supporting" numberOfLines={1}>
                  {match.name} · {contactCategoryLabel[match.category]}
                </AppText>
              </>
            ) : (
              <AppText variant="supporting" color={colors.textMuted}>
                {dialedNumber ? 'Not in ATS' : 'Enter a number'}
              </AppText>
            )}
          </View>
        </View>

        <DialPad onDigit={appendDigit} onLongZero={() => appendDigit('+')} />

        <View style={styles.actions}>
          <View style={styles.side} />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Call"
            accessibilityState={{ disabled: !canCall }}
            disabled={!canCall}
            onPress={handleCall}
            scaleTo={0.94}
            style={styles.callButton}
          >
            <Phone size={28} color={colors.white} fill={colors.white} />
          </PressableScale>
          <View style={styles.side}>
            {dialedNumber.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete last digit"
                onPress={deleteDigit}
                onLongPress={clearDialedNumber}
                hitSlop={10}
                style={({ pressed }) => [styles.backspace, pressed && styles.pressed]}
              >
                <Delete size={26} color={colors.black} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    paddingBottom: spacing.xl,
  },
  fromCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: spacing.xs,
  },
  fromLabel: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  fromValue: {
    fontFamily: fontFamily.bold,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  lineIssue: {
    marginTop: 4,
  },
  display: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  number: {
    fontFamily: fontFamily.extrabold,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: 0.3,
    textAlign: 'center',
    minHeight: 38,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    minHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  side: {
    width: 88,
    alignItems: 'center',
  },
  callButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.mint,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  backspace: {
    padding: spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});
