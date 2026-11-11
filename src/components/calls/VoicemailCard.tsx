import { Pause, Play } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Contact, Voicemail, contactCategoryLabel } from '../../types';
import { colors, radius, spacing } from '../../theme';
import { formatDuration, formatListTime } from '../../utils/formatTime';
import { AppButton } from '../ui/AppButton';
import { AppText } from '../ui/AppText';
import { Avatar } from '../ui/Avatar';
import { Card } from '../ui/Card';
import { PressableScale } from '../ui/motion';

interface VoicemailCardProps {
  voicemail: Voicemail;
  contact?: Contact;
  expanded: boolean;
  onToggleExpanded: () => void;
  onCallBack: () => void;
  onWhatsApp?: () => void;
}

/**
 * Voicemail card with mock playback. There is no real audio file in mock
 * mode — the play button animates a local progress state only.
 */
export function VoicemailCard({
  voicemail,
  contact,
  expanded,
  onToggleExpanded,
  onCallBack,
  onWhatsApp,
}: VoicemailCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSeconds, setPositionSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isPlaying) {
      timer.current = setInterval(() => {
        setPositionSeconds((p) => {
          if (p + 1 >= voicemail.durationSeconds) {
            setIsPlaying(false);
            return 0;
          }
          return p + 1;
        });
      }, 1000);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [isPlaying, voicemail.durationSeconds]);

  // Smooth, continuous progress bar driven on the UI thread.
  useEffect(() => {
    const target = voicemail.durationSeconds > 0 ? positionSeconds / voicemail.durationSeconds : 0;
    progress.value =
      positionSeconds === 0
        ? withTiming(0, { duration: 200 })
        : withTiming(target, { duration: 1000, easing: Easing.linear });
  }, [positionSeconds, progress, voicemail.durationSeconds]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.min(progress.value, 1) * 100}%`,
  }));

  const title = contact
    ? contact.company
      ? `${contact.name} – ${contact.company}`
      : contact.name
    : voicemail.phoneNumber;
  const subtitle = [
    contact ? contactCategoryLabel[contact.category] : 'Not in ATS',
    formatDuration(voicemail.durationSeconds),
    formatListTime(voicemail.timestamp),
  ].join(' · ');

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Voicemail from ${title}, ${expanded ? 'collapse' : 'expand'}`}
        onPress={onToggleExpanded}
        style={styles.headerRow}
      >
        <Avatar name={contact?.name ?? voicemail.phoneNumber} size={46} />
        <View style={styles.texts}>
          <AppText variant="cardTitle" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="supporting" color={colors.textSecondary}>
            {subtitle}
          </AppText>
        </View>
      </Pressable>

      {expanded ? (
        <Animated.View
          entering={FadeInDown.duration(260).springify().damping(19)}
          exiting={FadeOut.duration(140)}
          style={styles.body}
        >
          <View style={styles.playerRow}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Pause voicemail' : 'Play voicemail'}
              onPress={() => setIsPlaying((v) => !v)}
              scaleTo={0.85}
              style={styles.playButton}
            >
              {isPlaying ? (
                <Pause size={20} color="#FFFFFF" fill="#FFFFFF" />
              ) : (
                <Play size={20} color="#FFFFFF" fill="#FFFFFF" style={styles.playIcon} />
              )}
            </PressableScale>
            <View style={styles.track}>
              <Animated.View style={[styles.trackFill, progressStyle]} />
            </View>
            <AppText variant="caption" color={colors.textSecondary}>
              {formatDuration(positionSeconds)}
            </AppText>
          </View>

          <View style={styles.transcript}>
            <AppText variant="sectionTitle" color={colors.textSecondary}>
              Transcript
            </AppText>
            <AppText variant="supporting" style={styles.transcriptText}>
              {voicemail.transcript}
            </AppText>
          </View>

          {voicemail.savedToATS ? (
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <AppText variant="supporting">
                Saved to ATS record
                {voicemail.consultantNotified ? ' · consultant notified' : ''}
              </AppText>
            </View>
          ) : null}

          <View style={styles.actions}>
            <AppButton label="Call back" onPress={onCallBack} compact style={styles.action} />
            {onWhatsApp ? (
              <AppButton
                label="WhatsApp"
                onPress={onWhatsApp}
                variant="secondary"
                compact
                style={styles.action}
              />
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  body: {
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    marginLeft: 3,
  },
  pressed: {
    opacity: 0.75,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.secondary,
  },
  transcript: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  transcriptText: {
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  action: {
    flex: 1,
  },
});
