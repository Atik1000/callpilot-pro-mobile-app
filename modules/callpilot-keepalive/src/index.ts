import { Platform } from 'react-native';

/**
 * Android call-lifecycle foreground support and native incoming-call alerts.
 * Incoming wake-up is handled by nativeCallPush/FCM, not an idle socket service.
 * No-ops on iOS/web and when the native module is missing (Expo Go).
 */
interface NativeKeepAlive {
  start(title: string, body: string): void;
  stop(): void;
  showIncomingCall(caller: string, detail: string): void;
  clearIncomingCall(): void;
  startRinging(): void;
  stopRinging(): void;
  setShowOverLockScreen(on: boolean): void;
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
  start: (title = 'CallPilot', body = 'Call in progress') =>
    safe(() => native!.start(title, body), undefined),
  stop: () => safe(() => native!.stop(), undefined),
  showIncomingCall: (caller: string, detail: string) =>
    safe(() => native!.showIncomingCall(caller, detail), undefined),
  clearIncomingCall: () => safe(() => native!.clearIncomingCall(), undefined),
  /** Loud ringtone + vibration; returns false when the native ringer is missing. */
  startRinging: () => safe(() => (native!.startRinging(), true), false),
  stopRinging: () => safe(() => native!.stopRinging(), undefined),
  setShowOverLockScreen: (on: boolean) => safe(() => native!.setShowOverLockScreen(on), undefined),
  isIgnoringBatteryOptimizations: () => safe(() => native!.isIgnoringBatteryOptimizations(), true),
  requestIgnoreBatteryOptimizations: () =>
    safe(() => native!.requestIgnoreBatteryOptimizations(), undefined),
};

/** Nonsecret server-push invitation; fetch authenticated call details before connect. */
export interface PendingNativeInvitation {
  call_uuid: string;
  organization_uid: string;
  expires_at: string;
  action: 'open' | 'answer' | 'decline';
  /** Active call end actions may occur after the original ringing deadline. */
  call_active?: boolean;
}

export interface NativePushDiagnostics {
  session_configured: boolean;
  notifications_enabled: boolean;
  full_screen_intent_allowed: boolean;
}

interface NativeCallPushModule {
  configureSession(deviceUid: string, organizationUid: string): void;
  clearSession(): void;
  getPendingInvitation(): PendingNativeInvitation | null;
  clearInvitation(callUuid: string): void;
  markCallActive(callUuid: string): void;
  endCall(callUuid: string): void;
  getPushDiagnostics(): NativePushDiagnostics;
  addListener(event: 'onIncomingCallInvitation', callback: (invitation: PendingNativeInvitation) => void): { remove(): void };
}

const candidate = native as unknown as NativeCallPushModule | null;
const pushNative = candidate && typeof candidate.configureSession === 'function' ? candidate : null;

export const nativeCallPush = {
  available: pushNative !== null && typeof pushNative.configureSession === 'function',
  configureSession(deviceUid: string, organizationUid: string): void {
    pushNative?.configureSession(deviceUid, organizationUid);
  },
  clearSession(): void { pushNative?.clearSession(); },
  getPendingInvitation(): PendingNativeInvitation | null {
    return pushNative?.getPendingInvitation() ?? null;
  },
  clearInvitation(callUuid: string): void { pushNative?.clearInvitation(callUuid); },
  markCallActive(callUuid: string): void { pushNative?.markCallActive(callUuid); },
  endCall(callUuid: string): void { pushNative?.endCall(callUuid); },
  getDiagnostics(): NativePushDiagnostics | null { return pushNative?.getPushDiagnostics() ?? null; },
  addInviteListener(callback: (invitation: PendingNativeInvitation) => void): { remove(): void } {
    return pushNative?.addListener('onIncomingCallInvitation', callback) ?? { remove() {} };
  },
};
