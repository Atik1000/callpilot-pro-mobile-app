import { Delete, MessageCircle, Phone } from 'lucide-react-native';
import React, { useEffect, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { DialPad } from '../components/calls/DialPad';
import { StandaloneTabBar } from '../components/layout/BottomTabBar';
import { DetailHeader } from '../components/layout/DetailHeader';
import { ScreenContainer } from '../components/layout/ScreenContainer';
import { AppText } from '../components/ui/AppText';
import { PressableScale, rise, springs } from '../components/ui/motion';
import { BUSINESS_NUMBER } from '../data/constants';
import { useCommunications } from '../hooks/useCommunications';
import { findContactByPhone, useContacts } from '../hooks/useContacts';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';
import { colors, fontFamily, spacing } from '../theme';
import { contactCategoryLabel } from '../types';
import { formatPhone, isDiallable } from '../utils/formatPhone';

export default function KeypadScreen() {
  // Falls back to the shared constant so the header never shows an empty
  // number (e.g. right after a dev reload before the mock user exists).
  const businessNumber =
    useAuthStore((s) => s.user?.businessNumber) ?? BUSINESS_NUMBER;
  const dialedNumber = useCallStore((s) => s.dialedNumber);
  const appendDigit = useCallStore((s) => s.appendDigit);
  const deleteDigit = useCallStore((s) => s.deleteDigit);
  const clearDialedNumber = useCallStore((s) => s.clearDialedNumber);
  const voipStatus = useCallStore((s) => s.voipStatus);
  const voipDetail = useCallStore((s) => s.voipDetail);

  const phoneStatus =
    voipStatus === 'online'
      ? 'Phone online'
      : voipStatus === 'connecting'
        ? 'Connecting phone…'
        : voipStatus === 'offline'
          ? `Phone offline — ${voipDetail || 'retrying'}`
          : 'Simulated calls';

  const { data: contacts } = useContacts();
  const { startCall, openConversation } = useCommunications();

  const match = useMemo(
    () => (dialedNumber.length >= 6 ? findContactByPhone(contacts, dialedNumber) : undefined),
    [contacts, dialedNumber],
  );

  const canCall = isDiallable(dialedNumber);

  // The number display pops slightly on every keypress.
  const pop = useSharedValue(1);
  useEffect(() => {
    if (dialedNumber.length > 0) {
      pop.value = withSequence(
        withSpring(1.05, springs.press),
        withSpring(1, springs.gentle),
      );
    }
  }, [dialedNumber, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const handleCall = () => {
    if (!canCall) return;
    const number = match ? match.phone : formatPhone(dialedNumber);
    clearDialedNumber();
    startCall(number, match);
  };

  const handleMessage = () => {
    if (!canCall) return;
    if (match) {
      clearDialedNumber();
      openConversation(match, 'whatsapp');
    } else {
      Alert.alert(
        'Not in ATS',
        `${formatPhone(dialedNumber)} is not an ATS contact yet. Add the contact to start a WhatsApp or SMS conversation.`,
      );
    }
  };

  return (
    <ScreenContainer
      header={
        <DetailHeader
          title="Keypad"
          subtitle={`Calling from ${businessNumber ?? ''} · ${phoneStatus}`}
        />
      }
      footer={<StandaloneTabBar activeName="calls" />}
      scrollable
    >
      <View style={styles.display}>
        <Animated.View style={[styles.numberRow, popStyle]}>
          <AppText style={styles.number} numberOfLines={1} adjustsFontSizeToFit>
            {dialedNumber ? formatPhone(dialedNumber) : ' '}
          </AppText>
          {dialedNumber.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete last digit"
              onPress={deleteDigit}
              onLongPress={clearDialedNumber}
              hitSlop={10}
              style={({ pressed }) => [styles.backspace, pressed && styles.pressed]}
            >
              <Delete size={22} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </Animated.View>
        <View style={styles.matchRow}>
          {match ? (
            <Animated.View
              entering={rise()}
              exiting={FadeOut.duration(120)}
              style={styles.matchInner}
            >
              <View style={styles.matchDot} />
              <AppText variant="supporting">
                Match: {match.name} · {contactCategoryLabel[match.category]}
              </AppText>
            </Animated.View>
          ) : (
            <AppText variant="supporting" color={colors.textMuted}>
              {dialedNumber ? 'No ATS match' : 'Enter a number'}
            </AppText>
          )}
        </View>
      </View>

      <DialPad onDigit={appendDigit} onLongZero={() => appendDigit('+')} />

      <Animated.View
        entering={rise(130)}
        style={styles.actions}
      >
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Call"
          accessibilityState={{ disabled: !canCall }}
          disabled={!canCall}
          onPress={handleCall}
          scaleTo={0.85}
          style={styles.callButton}
        >
          <Phone size={24} color="#FFFFFF" />
        </PressableScale>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Message"
          accessibilityState={{ disabled: !canCall }}
          disabled={!canCall}
          onPress={handleMessage}
          scaleTo={0.85}
          style={styles.messageButton}
        >
          <MessageCircle size={24} color={colors.secondary} />
        </PressableScale>
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  display: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.xxl,
  },
  number: {
    fontFamily: fontFamily.bold,
    fontSize: 34,
    lineHeight: 42,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  backspace: {
    padding: spacing.xs,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    minHeight: 20,
  },
  matchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  matchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
    marginTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  callButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.4,
  },
});
