import { useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { OptionPicker } from '../../components/settings/OptionPicker';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { Card } from '../../components/ui/Card';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { Divider } from '../../components/ui/Divider';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { ToggleRow } from '../../components/ui/ToggleRow';
import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { colors, spacing } from '../../theme';
import { OutOfHoursDestination } from '../../types';

const STATUS_TABS = [
  { key: 'available' as const, label: 'Available' },
  { key: 'dnd' as const, label: 'Do not disturb' },
];

const HOUR_PRESETS = ['08:00–16:30', '09:00–17:30', '09:30–18:00'] as const;
const DESTINATIONS: readonly OutOfHoursDestination[] = [
  'Voicemail',
  'Mobile',
  'Out-of-hours team',
];

export default function SettingsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const settings = useSettingsStore();

  const [hoursPickerOpen, setHoursPickerOpen] = useState(false);
  const [destinationPickerOpen, setDestinationPickerOpen] = useState(false);
  const [signOutDevicesOpen, setSignOutDevicesOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const hoursLabel = `${settings.businessHours.start}–${settings.businessHours.end}`;

  const handleSignOutDevices = async () => {
    setRevoking(true);
    await authService.signOutOtherDevices();
    setRevoking(false);
    setSignOutDevicesOpen(false);
  };

  const header = (
    <ScreenHeader
      title="Settings"
      subtitle={`${user?.name ?? ''} · ${user?.businessNumber ?? ''}`}
    />
  );

  return (
    <ScreenContainer header={header} scrollable>
      <Animated.View entering={FadeInDown.delay(40).springify().damping(19)}>
      <SectionHeader title="My status" />
      <SegmentedTabs
        tabs={STATUS_TABS}
        selected={settings.availability}
        onSelect={settings.setAvailability}
      />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).springify().damping(19)}>
      <SectionHeader title="Business hours" />
      <Card padded={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Business hours ${settings.businessHours.days}, ${hoursLabel}`}
          onPress={() => setHoursPickerOpen(true)}
          style={({ pressed }) => [styles.hoursRow, pressed && styles.pressed]}
        >
          <AppText variant="cardTitle">{settings.businessHours.days}</AppText>
          <AppText variant="bodyMedium">[{hoursLabel}]</AppText>
        </Pressable>
        <Divider />
        <View style={styles.outOfHours}>
          <AppText variant="cardTitle">Out of hours, calls go to</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Out of hours destination: ${settings.outOfHoursDestination}`}
            onPress={() => setDestinationPickerOpen(true)}
            style={({ pressed }) => [styles.dropdown, pressed && styles.pressed]}
          >
            <AppText variant="body">{settings.outOfHoursDestination}</AppText>
            <ChevronDown size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).springify().damping(19)}>
      <SectionHeader title="Calls" />
      <Card>
        <ToggleRow
          title="Ring on mobile and laptop"
          subtitle="A call on one shows on the other"
          value={settings.ringOnMultipleDevices}
          onToggle={settings.toggleRingOnMultipleDevices}
        />
        <Divider />
        <ToggleRow
          title="Hold music"
          subtitle="Calm acoustic loop"
          value={settings.holdMusicEnabled}
          onToggle={settings.toggleHoldMusic}
        />
        <Divider />
        <ToggleRow
          title="Recording notice"
          subtitle="Played at the start of every call"
          value={settings.recordingNoticeEnabled}
          onToggle={settings.toggleRecordingNotice}
        />
      </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(280).springify().damping(19)}>
      <SectionHeader title="Security" />
      <Card>
        <ToggleRow
          title="Two-step sign-in"
          subtitle="Code sent to your phone"
          value={settings.twoStepEnabled}
          onToggle={settings.toggleTwoStep}
        />
      </Card>

      <AppButton
        label="Sign out other devices"
        onPress={() => setSignOutDevicesOpen(true)}
        variant="secondary"
        fullWidth
        style={styles.signOutDevices}
      />
      <AppButton
        label="Sign out"
        onPress={() => setSignOutOpen(true)}
        variant="light"
        fullWidth
        style={styles.signOut}
      />
      </Animated.View>

      <OptionPicker
        visible={hoursPickerOpen}
        title="Business hours (Mon–Fri)"
        options={HOUR_PRESETS}
        selected={hoursLabel as (typeof HOUR_PRESETS)[number]}
        onSelect={(value) => {
          const [start, end] = value.split('–');
          settings.setBusinessHours({ days: 'Mon–Fri', start, end });
        }}
        onClose={() => setHoursPickerOpen(false)}
      />
      <OptionPicker
        visible={destinationPickerOpen}
        title="Out of hours, calls go to"
        options={DESTINATIONS}
        selected={settings.outOfHoursDestination}
        onSelect={settings.setOutOfHoursDestination}
        onClose={() => setDestinationPickerOpen(false)}
      />

      <ConfirmationModal
        visible={signOutDevicesOpen}
        title="Sign out other devices?"
        message="Other laptops and phones signed in to your account will be signed out. Mock mode: real device revocation needs the backend."
        confirmLabel="Sign out devices"
        destructive
        loading={revoking}
        onConfirm={() => void handleSignOutDevices()}
        onCancel={() => setSignOutDevicesOpen(false)}
      />
      <ConfirmationModal
        visible={signOutOpen}
        title="Sign out?"
        message="You will need your email, password and a 6-digit code to sign back in."
        confirmLabel="Sign out"
        destructive
        onConfirm={() => {
          setSignOutOpen(false);
          logout();
          router.replace('/(auth)/login');
        }}
        onCancel={() => setSignOutOpen(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },
  outOfHours: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  signOutDevices: {
    marginTop: spacing.xxl,
  },
  signOut: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
});
