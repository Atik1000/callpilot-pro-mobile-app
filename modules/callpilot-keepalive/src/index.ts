import { Platform } from 'react-native';

/**
 * Android keep-alive for the business line: a foreground service so calls
 * still ring while the app is minimised, plus a visible incoming-call alert.
 * No-ops on iOS/web and when the native module is missing (Expo Go).
 */
interface NativeKeepAlive {
  start(title: string, body: string): void;
  stop(): void;
  showIncomingCall(caller: string, detail: string): void;
  clearIncomingCall(): void;
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): void;
}

let native: NativeKeepAlive | null = null;
if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    native = require('expo-modules-core').requireNativeModule('CallPilotKeepAlive') as NativeKeepAlive;
  } catch {
    native = null;
  }
}

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return native ? fn() : fallback;
  } catch {
    return fallback;
  }
};

export const keepAlive = {
  available: native !== null,
  start: (title = 'CallPilot', body = 'Ready for calls on your business line') =>
    safe(() => native!.start(title, body), undefined),
  stop: () => safe(() => native!.stop(), undefined),
  showIncomingCall: (caller: string, detail: string) =>
    safe(() => native!.showIncomingCall(caller, detail), undefined),
  clearIncomingCall: () => safe(() => native!.clearIncomingCall(), undefined),
  isIgnoringBatteryOptimizations: () => safe(() => native!.isIgnoringBatteryOptimizations(), true),
  requestIgnoreBatteryOptimizations: () =>
    safe(() => native!.requestIgnoreBatteryOptimizations(), undefined),
};
