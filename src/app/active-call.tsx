import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Database,
  Grip,
  Mic,
  MicOff,
  Pause,
  Pencil,
  Volume2,
  X,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CallControlButton } from '../components/calls/CallControlButton';
import { DialPad } from '../components/calls/DialPad';
import { AppButton } from '../components/ui/AppButton';
import { AppText } from '../components/ui/AppText';
import { Avatar } from '../components/ui/Avatar';
import { PressableScale, PulsingDot } from '../components/ui/motion';
import { useContact, useContacts } from '../hooks/useContacts';
import { callService } from '../services/callService';
import { useCallStore } from '../store/callStore';
import { colors, fontFamily, radius, spacing } from '../theme';
import { formatCallTimer } from '../utils/formatTime';

export default function ActiveCallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const activeCall = useCallStore((s) => s.activeCall);
  const isMuted = useCallStore((s) => s.isMuted);
  const isOnHold = useCallStore((s) => s.isOnHold);
  const isSpeakerOn = useCallStore((s) => s.isSpeakerOn);
  const callPhase = useCallStore((s) => s.callPhase);
  const isLiveCall = useCallStore((s) => s.isLiveCall);
  const { toggleMute, toggleHold, toggleSpeaker, addCallNote, endCall, sendDtmf } =
    useCallStore();

  const contact = useContact(activeCall?.contactId);
  const { data: contacts } = useContacts();

  const [elapsed, setElapsed] = useState(0);
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [dtmf, setDtmf] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [transferredTo, setTransferredTo] = useState<string | null>(null);

  // The blue avatar ring breathes gently for the lifetime of the call.
  const ringPulse = useSharedValue(0);
  useEffect(() => {
    ringPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [ringPulse]);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + ringPulse.value * 0.045 }],
    shadowOpacity: 0.35 + ringPulse.value * 0.4,
  }));

  useEffect(() => {
    if (!activeCall) return;
    const update = () =>
      setElapsed(Math.floor((Date.now() - activeCall.startedAt) / 1000));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [activeCall]);

  // If there is no active call (e.g. after ending), leave this screen.
  useEffect(() => {
    if (!activeCall) {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/calls');
    }
  }, [activeCall, router]);

  if (!activeCall) return <View style={styles.root} />;

  const handleEnd = () => {
    endCall();
    // The effect above navigates away once activeCall clears.
  };

  const handleSaveNote = () => {
    if (noteText.trim()) addCallNote(noteText.trim());
    setNoteText('');
    setNoteOpen(false);
  };

  const transferTargets = (contacts ?? []).filter(
    (c) => c.id !== activeCall.contactId,
  );

  // Live calls show the Telnyx phase until connected; the timer starts then.
  const phaseLabel =
    callPhase === 'dialing'
      ? 'Calling…'
      : callPhase === 'ringing'
        ? 'Ringing…'
        : callPhase === 'connecting'
          ? 'Connecting…'
          : null;
  const statusLine = [
    'Business line',
    isLiveCall && phaseLabel ? phaseLabel : formatCallTimer(elapsed),
    ...(isOnHold ? ['On hold'] : []),
    ...(activeCall.isRecording ? ['Recording'] : []),
  ].join(' · ');

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]}>
      {/* Status */}
      <Animated.View entering={FadeIn.duration(350)} style={styles.statusRow}>
        <PulsingDot color={colors.secondary} size={8} duration={1300} />
        <AppText variant="supporting" color={colors.headerText}>
          {statusLine}
        </AppText>
      </Animated.View>

      {/* Caller */}
      <View style={styles.caller}>
        <Animated.View entering={ZoomIn.delay(80).springify().damping(13)}>
          <Animated.View style={[styles.avatarRing, ringStyle]}>
            <Avatar
              name={activeCall.displayName}
              size={96}
              backgroundColor="#FFFFFF"
              textColor={colors.textPrimary}
            />
          </Animated.View>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(180).springify().damping(18)} style={styles.callerTexts}>
          <AppText style={styles.callerName} color={colors.headerText}>
            {transferredTo ? `Transferring to ${transferredTo}…` : activeCall.displayName}
          </AppText>
          <AppText variant="body" color={colors.headerTextSecondary}>
            {activeCall.displaySubtitle}
          </AppText>
        </Animated.View>
      </View>

      {/* ATS card */}
      {contact?.atsId ? (
        <Animated.View
          entering={FadeInDown.delay(260).springify().damping(18)}
          style={styles.atsCard}
        >
          <View style={styles.atsIcon}>
            <Database size={20} color={colors.secondary} />
          </View>
          <View style={styles.atsTexts}>
            <AppText variant="cardTitle">ATS record open</AppText>
            <AppText variant="supporting" color={colors.textSecondary} numberOfLines={1}>
              Open jobs: {contact.openJobs ?? 0}
              {contact.lastContact
                ? ` · Last contact: ${new Date(contact.lastContact).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                : ''}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ATS record for ${contact.name}`}
            onPress={() =>
              router.push({ pathname: '/contact/[id]', params: { id: contact.id } })
            }
            hitSlop={8}
          >
            <AppText variant="bodyMedium" style={styles.viewLink}>
              View
            </AppText>
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Controls */}
      <View style={styles.controls}>
        <Animated.View
          entering={FadeInDown.delay(340).springify().damping(18)}
          style={styles.controlRow}
        >
          <CallControlButton
            icon={
              isMuted ? (
                <MicOff size={22} color="#FFFFFF" />
              ) : (
                <Mic size={22} color="#FFFFFF" />
              )
            }
            label="Mute"
            active={isMuted}
            onPress={toggleMute}
          />
          <CallControlButton
            icon={<Grip size={22} color="#FFFFFF" />}
            label="Keypad"
            onPress={() => setKeypadOpen(true)}
          />
          <CallControlButton
            icon={<Volume2 size={22} color="#FFFFFF" />}
            label="Speaker"
            active={isSpeakerOn}
            onPress={toggleSpeaker}
          />
        </Animated.View>
        <Animated.View
          entering={FadeInDown.delay(420).springify().damping(18)}
          style={styles.controlRow}
        >
          <CallControlButton
            icon={<Pause size={22} color="#FFFFFF" />}
            label="Hold"
            active={isOnHold}
            onPress={toggleHold}
          />
          <CallControlButton
            icon={<ArrowRight size={22} color="#FFFFFF" />}
            label="Transfer"
            onPress={() => setTransferOpen(true)}
          />
          <CallControlButton
            icon={<Pencil size={22} color="#FFFFFF" />}
            label="Note"
            onPress={() => setNoteOpen(true)}
          />
        </Animated.View>
      </View>

      {/* End call */}
      <View style={[styles.endRow, { paddingBottom: insets.bottom + spacing.xxl }]}>
        <Animated.View entering={ZoomIn.delay(500).springify().damping(13)}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="End call"
            onPress={handleEnd}
            scaleTo={0.85}
            style={styles.endButton}
          >
            <X size={28} color={colors.textPrimary} />
          </PressableScale>
        </Animated.View>
      </View>

      {/* In-call keypad overlay */}
      <Modal visible={keypadOpen} transparent animationType="slide" onRequestClose={() => setKeypadOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
            <AppText variant="cardTitle" align="center" style={styles.sheetTitle}>
              {dtmf || 'Keypad'}
            </AppText>
            <DialPad
              onDigit={(d) => {
                sendDtmf(d);
                setDtmf((v) => (v + d).slice(-20));
              }}
            />
            <AppButton
              label="Close"
              onPress={() => {
                setKeypadOpen(false);
                setDtmf('');
              }}
              variant="secondary"
              fullWidth
            />
          </View>
        </View>
      </Modal>

      {/* Mock transfer selection */}
      <Modal visible={transferOpen} transparent animationType="slide" onRequestClose={() => setTransferOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
            <AppText variant="cardTitle" style={styles.sheetTitle}>
              Transfer call to…
            </AppText>
            {transferTargets.map((target) => (
              <Pressable
                key={target.id}
                accessibilityRole="button"
                accessibilityLabel={`Transfer to ${target.name}`}
                onPress={() => {
                  setTransferOpen(false);
                  setTransferredTo(target.name);
                  if (isLiveCall) {
                    // Server-side transfer (same endpoint the dashboard uses);
                    // the local leg ends when Telnyx completes the hand-off.
                    callService
                      .transferToNumber(target.phone)
                      .catch(() => setTransferredTo(null));
                    setTimeout(() => endCall(), 1500);
                  } else {
                    // Simulated: hand off, then end the local leg shortly after.
                    setTimeout(() => endCall(), 1200);
                  }
                }}
                style={({ pressed }) => [styles.transferRow, pressed && styles.pressed]}
              >
                <Avatar name={target.name} size={40} />
                <AppText variant="bodyMedium">{target.name}</AppText>
              </Pressable>
            ))}
            <AppButton
              label="Cancel"
              onPress={() => setTransferOpen(false)}
              variant="secondary"
              fullWidth
            />
          </View>
        </View>
      </Modal>

      {/* Call note */}
      <Modal visible={noteOpen} transparent animationType="slide" onRequestClose={() => setNoteOpen(false)}>
        <KeyboardAvoidingView
          style={styles.sheetBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}>
            <AppText variant="cardTitle" style={styles.sheetTitle}>
              Call note
            </AppText>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Saved to the call activity in the ATS"
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
              style={styles.noteInput}
              accessibilityLabel="Call note"
            />
            <View style={styles.noteActions}>
              <AppButton
                label="Cancel"
                onPress={() => setNoteOpen(false)}
                variant="secondary"
                compact
                style={styles.noteAction}
              />
              <AppButton
                label="Save note"
                onPress={handleSaveNote}
                compact
                disabled={!noteText.trim()}
                style={styles.noteAction}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  caller: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    gap: spacing.xs,
  },
  callerTexts: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.secondary,
    marginBottom: spacing.md,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 18,
    elevation: 8,
  },
  callerName: {
    fontFamily: fontFamily.bold,
    fontSize: 28,
    lineHeight: 34,
  },
  atsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xxl,
  },
  atsIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.blueLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  atsTexts: {
    flex: 1,
    gap: 2,
  },
  viewLink: {
    textDecorationLine: 'underline',
  },
  controls: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  endRow: {
    alignItems: 'center',
  },
  endButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 430,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  sheetTitle: {
    marginBottom: spacing.sm,
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  noteInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    minHeight: 110,
    textAlignVertical: 'top',
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: colors.textPrimary,
  },
  noteActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  noteAction: {
    flex: 1,
  },
});
