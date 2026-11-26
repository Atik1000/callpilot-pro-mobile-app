import { Platform } from 'react-native';

/**
 * Native calling support.
 * - Android: keep-alive service, FCM call pushes, ringer, call notification
 *   with Answer/Decline, self-managed Telecom (ConnectionService).
 * - iOS: PushKit VoIP token + CallKit (no keep-alive functions; they no-op).
 * Everything no-ops on web and when the native module is missing (Expo Go).
 */
/** A tapped CallPilot message/alert notification. */
export interface OpenedNotification {
  kind: 'callpilot_message' | 'callpilot_alert';
  message_uid?: string;
  alert_uid?: string;
}

/** A user action on the native call UI (CallKit, Telecom, call notification). */
export interface NativeCallAction {
  action: 'answer' | 'end' | 'mute' | 'dtmf' | 'timeout';
  call_uuid: string;
  muted?: boolean;
  digits?: string;
}

/** Why the native call screen closes (maps to CallKit/Telecom end reasons). */
export type NativeEndReason =
  | 'local'
  | 'remoteEnded'
  | 'unanswered'
  | 'answeredElsewhere'
  | 'declinedElsewhere'
  | 'failed';

type Subscription = { remove(): void };

interface NativeKeepAlive {
  getLaunchNotification(): OpenedNotification | null;
  getLaunchCallAction?(): NativeCallAction | null;
  getApnsEnvironment?(): 'sandbox' | 'production';
  updateCall(uuid: string, name: string, number: string, whatsapp: boolean): void;
  answerCall(uuid: string): void;
  callConnected(uuid: string): void;
  endCall(uuid: string, reason: NativeEndReason): void;
  addListener(event: 'onNotificationOpened', listener: (n: OpenedNotification) => void): Subscription;
  addListener(event: 'onCallAction', listener: (a: NativeCallAction) => void): Subscription;
  addListener(event: 'onCallPush', listener: (e: { push: string }) => void): Subscription;
  start(title: string, body: string): void;
  stop(): void;
  startForCall(title: string, body: string): void;
  setPushMode(on: boolean): void;
  getPushToken(): Promise<string | null>;
  showIncomingCall(caller: string, detail: string): void;
  clearIncomingCall(): void;
  startRinging(): void;
  stopRinging(): void;
  setShowOverLockScreen(on: boolean): void;
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): void;
}

let native: NativeKeepAlive | null = null;
if (Platform.OS === 'android' || Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    native = require('expo-modules-core').requireNativeModule('CallPilotKeepAlive') as NativeKeepAlive;
  } catch {
    native = null;
  }
}

const noSub: Subscription = { remove: () => {} };

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return native ? fn() : fallback;
  } catch {
    return fallback;
  }
};

export const keepAlive = {
  /** Android keep-alive service present (iOS has only the calling functions). */
  available: native !== null && Platform.OS === 'android',
  start: (title = 'CallPilot', body = 'Ready for calls on your business line') =>
    safe(() => native!.start(title, body), undefined),
  stop: () => safe(() => native!.stop(), undefined),
  /** Foreground service for the duration of one call (push wake-up mode). */
  startForCall: (title = 'CallPilot', body = 'Call in progress') =>
    safe(() => native!.startForCall(title, body), undefined),
  /** On: incoming-call pushes ring this phone and no always-on service is kept. */
  setPushMode: (on: boolean) => safe(() => native!.setPushMode(on), undefined),
  /** Android: FCM token. iOS: PushKit VoIP token. Null when push is not set up. */
  getPushToken: async (): Promise<string | null> => {
    try {
      const token = native ? await native.getPushToken() : null;
      return typeof token === 'string' && token ? token : null;
    } catch {
      return null;
    }
  },
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
  /** The message/alert notification that launched the app (returned once). */
  getLaunchNotification: () => safe(() => native!.getLaunchNotification(), null),
  /** Taps on message/alert notifications while the app is running. */
  addNotificationOpenedListener: (listener: (n: OpenedNotification) => void): Subscription =>
    safe(() => native!.addListener('onNotificationOpened', listener), noSub),

  /** iOS: APNs environment of the signed build (registration must match). */
  getApnsEnvironment: (): 'sandbox' | 'production' =>
    safe(() => native!.getApnsEnvironment?.() ?? 'production', 'production'),
  /** Android: the call-notification "Answer" tap that launched the app. */
  getLaunchCallAction: (): NativeCallAction | null =>
    safe(() => native!.getLaunchCallAction?.() ?? null, null),
  /** Caller details on the native call UI once the call state is fetched. */
  updateCall: (uuid: string, name: string, number: string, whatsapp = false) =>
    safe(() => native!.updateCall(uuid, name, number, whatsapp), undefined),
  /** Answered in the app's own screen: keep CallKit/Telecom in step. */
  answerCall: (uuid: string) => safe(() => native!.answerCall(uuid), undefined),
  /** SDK media connected: Telecom active / CallKit connected, ring deadline off. */
  callConnected: (uuid: string) => safe(() => native!.callConnected(uuid), undefined),
  /** Closes the native call UI for this call_uuid (idempotent). */
  endCall: (uuid: string, reason: NativeEndReason) =>
    safe(() => native!.endCall(uuid, reason), undefined),
  addCallActionListener: (listener: (a: NativeCallAction) => void): Subscription =>
    safe(() => native!.addListener('onCallAction', listener), noSub),
  /** iOS: VoIP pushes (already reported to CallKit) as JSON of their data. */
  addCallPushListener: (listener: (push: string) => void): Subscription =>
    safe(() => native!.addListener('onCallPush', (e) => listener(e.push)), noSub),
};
