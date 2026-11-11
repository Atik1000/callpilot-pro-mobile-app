import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Availability, BusinessHours, OutOfHoursDestination } from '../types';

interface SettingsState {
  availability: Availability;
  businessHours: BusinessHours;
  outOfHoursDestination: OutOfHoursDestination;

  ringOnMultipleDevices: boolean;
  holdMusicEnabled: boolean;
  recordingNoticeEnabled: boolean;
  /** Mock preference only — real 2FA enforcement needs a backend. */
  twoStepEnabled: boolean;

  setAvailability: (value: Availability) => void;
  setBusinessHours: (value: BusinessHours) => void;
  setOutOfHoursDestination: (value: OutOfHoursDestination) => void;
  toggleRingOnMultipleDevices: () => void;
  toggleHoldMusic: () => void;
  toggleRecordingNotice: () => void;
  toggleTwoStep: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      availability: 'available',
      businessHours: { days: 'Mon–Fri', start: '09:00', end: '17:30' },
      outOfHoursDestination: 'Voicemail',

      ringOnMultipleDevices: true,
      holdMusicEnabled: true,
      recordingNoticeEnabled: true,
      twoStepEnabled: true,

      setAvailability: (availability) => set({ availability }),
      setBusinessHours: (businessHours) => set({ businessHours }),
      setOutOfHoursDestination: (outOfHoursDestination) =>
        set({ outOfHoursDestination }),
      toggleRingOnMultipleDevices: () =>
        set((s) => ({ ringOnMultipleDevices: !s.ringOnMultipleDevices })),
      toggleHoldMusic: () => set((s) => ({ holdMusicEnabled: !s.holdMusicEnabled })),
      toggleRecordingNotice: () =>
        set((s) => ({ recordingNoticeEnabled: !s.recordingNoticeEnabled })),
      toggleTwoStep: () => set((s) => ({ twoStepEnabled: !s.twoStepEnabled })),
    }),
    {
      name: 'callpilot-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
