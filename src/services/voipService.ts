import Constants, { ExecutionEnvironment } from 'expo-constants';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { keepAlive } from '../../modules/callpilot-keepalive/src';
import { apiRequest, ApiError, tokenStore } from './api';
import { matchesMobileCall } from './mobileCallProtocol';
import type { MobileCallInvitation } from './mobileCallService';
import { SERVICE_MODE } from './config';

/**
 * Telnyx VoIP calling, ported from the CallPilot web dashboard:
 * - POST /voice/api/token/  -> Telnyx WebRTC login token (JWT)
 * - GET  /organizations/me  -> organization phone number (outbound caller ID)
 * - GET  /me/               -> profile uid (sent as the X-Voice-Ext header)
 *
 * Two engines share one interface (VoipEngine):
 * - this file: @telnyx/react-native-voice-sdk (native WebRTC) for dev/prod builds;
 * - webVoipService.ts: the Telnyx browser SDK inside a hidden WebView (Expo
 *   Go, which lacks native WebRTC) or a hidden iframe (web).
 */

export type VoipStatus = 'unavailable' | 'offline' | 'connecting' | 'online';

export type VoipCallPhase =
  | 'dialing'
  | 'ringing'
  | 'connecting'
  | 'active'
  | 'held'
  | 'ended';

export interface IncomingCallInfo {
  phoneNumber: string;
  callerName?: string;
}

export interface VoipListener {
  onStatus(status: VoipStatus, detail?: string): void;
  onIncoming(info: IncomingCallInfo): void;
  onCallPhase(phase: VoipCallPhase): void;
  /** A call ended abnormally (rejected, busy, unreachable…); message is user-facing. */
  onCallFailed?(message: string): void;
}

/** True inside the Expo Go app, which lacks the native WebRTC modules. */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Real calls work everywhere in live mode: native SDK on iOS/Android builds,
 * the Telnyx browser SDK (WebView in Expo Go, iframe on web) otherwise.
 */
export const voipSupported = SERVICE_MODE === 'live';

/** Calls run through the Telnyx browser SDK bridge (Expo Go or web). */
export const usesWebVoipEngine = isExpoGo || Platform.OS === 'web';

/** The native Telnyx SDK is usable (dev/production build, not Expo Go/web). */
export const nativeVoipSupported = voipSupported && !usesWebVoipEngine;

/** Common surface of the native and WebView calling engines. */
export interface VoipEngine {
  setListener(listener: VoipListener | null): void;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  readonly isOnline: boolean;
  startCall(destinationNumber: string): Promise<void>;
  answer(): Promise<void>;
  decline(): void;
  hangup(): void;
  setMuted(muted: boolean): void;
  setHeld(held: boolean): Promise<void>;
  sendDtmf(digit: string): void;
  setSpeaker(on: boolean): void;
}

/**
 * Minimal local typings for @telnyx/react-native-voice-sdk. The SDK ships raw
 * TypeScript sources that fail this project's strict typecheck, so it is
 * loaded with require() and typed here instead of importing its types.
 */
interface TelnyxCall {
  on(event: 'telnyx.call.state', handler: (call: TelnyxCall, state: string) => void): void;
  answer(): Promise<void>;
  hangup(): void;
  hold(): Promise<void>;
  unhold(): Promise<void>;
  mute(): void;
  unmute(): void;
  dtmf(digits: string): Promise<void>;
}

interface TelnyxClient {
  on(event: 'telnyx.client.ready', handler: () => void): void;
  on(event: 'telnyx.client.error', handler: (error: Error) => void): void;
  on(
    event: 'telnyx.call.incoming',
    handler: (call: TelnyxCall, msg: { params?: { caller_id_number?: string; caller_id_name?: string } }) => void,
  ): void;
  on(
    event: 'telnyx.call.remoteEnded',
    handler: (callId: string, reason: CallEndReason) => void,
  ): void;
  connect(): Promise<void>;
  disconnect(): void | Promise<void>;
  newCall(options: {
    destinationNumber: string;
    audio?: boolean;
    callerIdNumber?: string;
    customHeaders?: { name: string; value: string }[];
  }): Promise<TelnyxCall>;
}

export interface CallEndReason {
  cause?: string;
  causeCode?: number;
  sipCode?: number;
  sipReason?: string;
}

/**
 * User-facing text for an abnormal hang-up, or null for a normal one.
 * `wasActive`: the call connected, so a normal clear is just "call ended".
 */
export function describeCallEnd(reason: CallEndReason | null, wasActive: boolean): string | null {
  if (!reason) return wasActive ? null : 'The call could not be connected.';
  const cause = (reason.cause || '').toUpperCase();
  if (cause === 'NORMAL_CLEARING' && wasActive) return null;
  const known: Record<string, string> = {
    USER_BUSY: 'The number is busy.',
    NO_ANSWER: 'No answer.',
    NO_USER_RESPONSE: 'No answer.',
    CALL_REJECTED: 'The call was rejected.',
    UNALLOCATED_NUMBER: 'That number does not exist. Check it includes the country code.',
    INVALID_NUMBER_FORMAT: 'Invalid number format. Use the full number with country code, e.g. +44….',
    NORMAL_TEMPORARY_FAILURE: 'The network could not connect the call. Try again.',
    DESTINATION_OUT_OF_ORDER: 'The number is unreachable.',
    ORIGINATOR_CANCEL: '',
  };
  const sipKnown: Record<number, string> = {
    403: 'The call was refused by the phone network (SIP 403). Check the business line can call this destination.',
    404: 'That number could not be found (SIP 404). Check it includes the country code.',
    480: 'The call could not be connected (SIP 480 Temporarily Unavailable). Try again in a moment.',
    486: 'The number is busy.',
    487: '',
    603: 'The call was declined.',
  };
  if (reason.sipCode && reason.sipCode in sipKnown && !(cause === 'NORMAL_CLEARING' && wasActive)) {
    return sipKnown[reason.sipCode] || null;
  }
  if (cause in known) return known[cause] || null;
  if (cause === 'NORMAL_CLEARING') return 'The call was ended before it connected.';
  const sip = reason.sipCode ? ` (SIP ${reason.sipCode}${reason.sipReason ? ` ${reason.sipReason}` : ''})` : '';
  return `Call failed: ${reason.cause || 'unknown reason'}${sip}.`;
}

interface TelnyxModule {
  TelnyxRTC: new (options: { login_token: string }) => TelnyxClient;
}

/**
 * Same cleanup the dashboard applies before dialing: digits only, keeping a
 * leading "+" (e.g. "+44 7700 900123" -> "+447700900123").
 */
export function toDialableNumber(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/** The backend wraps the Telnyx token in varying envelopes; unwrap them all. */
export function normalizeVoiceToken(payload: unknown): string | null {
  if (typeof payload === 'string') {
    const value = payload.trim();
    if (!value) return null;
    if (value.startsWith('"') || value.startsWith('{')) {
      try {
        return normalizeVoiceToken(JSON.parse(value));
      } catch {
        return null;
      }
    }
    return value;
  }
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Record<string, unknown>;
  for (const key of ['token', 'login_token', 'jwt', 'data']) {
    const token = normalizeVoiceToken(data[key]);
    if (token) return token;
  }
  return null;
}

export async function fetchVoiceToken(): Promise<string> {
  const payload = await apiRequest<unknown>('/voice/api/token/', { method: 'POST' });
  const token = normalizeVoiceToken(payload);
  if (!token || token.split('.').length !== 3 || /[\s<>]/.test(token)) {
    throw new Error('The phone service did not return a valid token.');
  }
  return token;
}

/**
 * Caller ID + extension, fetched like the dashboard does (organization
 * number and profile uid). Failures are non-fatal: Telnyx falls back to
 * the connection's default caller ID.
 */
/** Some endpoints wrap the record in `data`; read the field either way. */
type IdentityPayload = Record<string, unknown> & { data?: Record<string, unknown> };
function pick(payload: IdentityPayload | null, key: string): string | undefined {
  const value = payload?.[key] ?? payload?.data?.[key];
  return typeof value === 'string' && value ? value : undefined;
}

export async function fetchCallIdentity(): Promise<{ callerId?: string; extensionUid?: string }> {
  const [org, me] = await Promise.all([
    apiRequest<IdentityPayload>('/organizations/me').catch((e) => {
      console.warn('[voip] /organizations/me failed:', e instanceof Error ? e.message : e);
      return null;
    }),
    apiRequest<IdentityPayload>('/me/').catch((e) => {
      console.warn('[voip] /me/ failed:', e instanceof Error ? e.message : e);
      return null;
    }),
  ]);
  const identity = {
    callerId: pick(org, 'phone_number') || undefined,
    extensionUid: pick(me, 'uid') || undefined,
  };
  if (__DEV__) console.log('[voip] call identity', JSON.stringify(identity));
  return identity;
}

export interface CallAuthorization {
  callerId?: string;
  /** SIP headers the CallPilot backend requires on every outbound call. */
  headers: { name: string; value: string }[];
}

/**
 * Per-call authorization, matching devfront.callpilot.pro: right before each
 * outbound call, POST /voice/api/token/ again; its `call_session_proof` goes
 * out as X-CallPilot-Session (and `extension_uid` as X-Voice-Ext). Calls
 * without the proof are rejected by the backend with SIP 480.
 */
export async function authorizeOutboundCall(): Promise<CallAuthorization> {
  const [session, identity] = await Promise.all([
    apiRequest<Record<string, unknown>>('/voice/api/token/', { method: 'POST' }),
    fetchCallIdentity(),
  ]);
  const proof = session?.call_session_proof;
  if (typeof proof !== 'string' || !proof) {
    throw new Error('The phone service did not authorize this call. Reconnect your business phone.');
  }
  const headers = [{ name: 'X-CallPilot-Session', value: proof }];
  const ext = typeof session.extension_uid === 'string' ? session.extension_uid.trim() : '';
  if (ext) headers.push({ name: 'X-Voice-Ext', value: ext });
  if (__DEV__) console.log('[voip] call authorized', JSON.stringify({ ext: Boolean(ext), callerId: Boolean(identity.callerId) }));
  return { callerId: identity.callerId, headers };
}

export async function ensureMicrophonePermission(): Promise<void> {
  if (Platform.OS !== 'android') return; // iOS prompts from getUserMedia.
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone access',
      message: 'CallPilot needs the microphone to make and receive calls.',
      buttonPositive: 'Allow',
    },
  );
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Microphone access is required to make calls.');
  }
}

class NativeVoipService implements VoipEngine {
  private sdk: TelnyxModule | null = null;
  private inCallManager: any = null;
  private client: TelnyxClient | null = null;
  private clientReady = false;
  private currentCall: TelnyxCall | null = null;
  private incomingCall: TelnyxCall | null = null;
  /** Hang-up reason from the last BYE, reported when the call ends. */
  private endReason: CallEndReason | null = null;
  private callWasActive = false;
  private outbound = false;
  private listener: VoipListener | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connecting = false;
  private stopped = true;
  /** Re-registers the line if the socket silently died (screen off, Doze, network swap). */
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private appStateSub: { remove(): void } | null = null;
  private expectedMobile: MobileCallInvitation | null = null;
  private mobileAnswer: { resolve(): void; reject(error: Error): void } | null = null;
  private mobileAnswerTimeout: ReturnType<typeof setTimeout> | null = null;

  private startWatchdog() {
    if (!this.watchdog) {
      this.watchdog = setInterval(() => this.ensureOnline(), 45000);
    }
    if (!this.appStateSub) {
      this.appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') this.ensureOnline();
      });
    }
  }

  private stopWatchdog() {
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    this.appStateSub?.remove();
    this.appStateSub = null;
  }

  /** Reconnects only when the line is down and nothing is in progress. */
  private ensureOnline() {
    if (this.stopped || this.connecting || this.reconnectTimer) return;
    if (this.currentCall || this.incomingCall) return;
    if (!this.clientReady || !this.client) void this.connect();
  }

  setListener(listener: VoipListener | null) {
    this.listener = listener;
  }

  /** Loads the native SDK; returns null when unavailable (Expo Go / web). */
  private loadSdk(): TelnyxModule | null {
    if (this.sdk) return this.sdk;
    if (!nativeVoipSupported) return null;
    try {
      // Lazy require keeps web/Expo Go bundles from crashing on import.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.sdk = require('@telnyx/react-native-voice-sdk') as TelnyxModule;
      return this.sdk;
    } catch {
      return null;
    }
  }

  private getInCallManager(): any {
    if (this.inCallManager !== null) return this.inCallManager;
    if (!nativeVoipSupported) {
      this.inCallManager = undefined;
      return undefined;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.inCallManager = require('react-native-incall-manager').default;
    } catch {
      this.inCallManager = undefined;
    }
    return this.inCallManager;
  }

  /** Connects (or reconnects) the Telnyx client. Safe to call repeatedly. */
  async connect(): Promise<void> {
    const sdk = this.loadSdk();
    if (!sdk) {
      this.listener?.onStatus(
        'unavailable',
        Platform.OS === 'web'
          ? 'In-app calling is not available on web.'
          : 'In-app calling needs a development build (not Expo Go).',
      );
      return;
    }
    if (this.connecting) return;
    this.stopped = false;
    this.connecting = true;
    this.startWatchdog();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.listener?.onStatus('connecting', 'Connecting phone…');

    try {
      const token = await fetchVoiceToken();
      if (this.stopped) return;

      await this.teardownClient();

      const client = new sdk.TelnyxRTC({ login_token: token });
      this.client = client;
      this.clientReady = false;

      client.on('telnyx.client.ready', () => {
        if (this.client !== client) return;
        this.clientReady = true;
        this.listener?.onStatus('online', 'Online — ready for calls');
      });

      client.on('telnyx.client.error', (error: Error) => {
        if (this.client !== client) return;
        this.clientReady = false;
        // Keep an in-flight call alive; otherwise cycle the connection.
        if (!this.currentCall && !this.incomingCall) {
          this.listener?.onStatus('offline', error?.message || 'Phone offline. Retrying…');
          this.scheduleReconnect();
        }
      });

      client.on('telnyx.call.remoteEnded', (_callId: string, reason: CallEndReason) => {
        if (this.client === client) this.endReason = reason ?? null;
      });

      client.on('telnyx.call.incoming', (call: TelnyxCall, msg: any) => {
        if (this.client !== client) return;
        // A second call while busy is declined, matching the dashboard.
        if (this.currentCall || this.incomingCall) {
          try {
            call.hangup();
          } catch {}
          return;
        }
        // Device-bound Android legs are dialled only after the user answers a
        // particular authenticated server invitation. Never accept an
        // unrelated next SIP invite, even if it arrives during that request.
        if (Platform.OS === 'android' && tokenStore.isDeviceBound()) {
          const expected = this.expectedMobile;
          if (!expected || Date.parse(expected.expires_at) <= Date.now() || !matchesMobileCall(msg, expected, call)) {
            try { call.hangup(); } catch {}
            return;
          }
          this.incomingCall = call;
          this.watchCall(call);
          void this.answer().then(() => {
            this.completeMobileAnswer();
          }, (error: unknown) => {
            this.completeMobileAnswer(error instanceof Error ? error : new Error('Could not answer this call.'));
            this.hangup();
          });
          return;
        }
        this.incomingCall = call;
        this.watchCall(call);
        this.startRinging();
        this.listener?.onIncoming({
          phoneNumber: msg?.params?.caller_id_number || 'Unknown number',
          callerName: msg?.params?.caller_id_name || undefined,
        });
      });

      await client.connect();
    } catch (error) {
      if (!this.stopped) {
        this.listener?.onStatus(
          'offline',
          error instanceof Error ? error.message : 'Could not reach the phone service.',
        );
        this.scheduleReconnect();
      }
    } finally {
      this.connecting = false;
    }
  }

  private scheduleReconnect(delayMs = 12000) {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delayMs);
  }

  private async teardownClient(): Promise<void> {
    const old = this.client;
    this.client = null;
    this.clientReady = false;
    if (old) {
      try {
        await Promise.resolve(old.disconnect());
      } catch {}
    }
  }

  async disconnect(): Promise<void> {
    this.completeMobileAnswer(new Error('Phone disconnected.'));
    this.stopped = true;
    this.stopWatchdog();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.finishCall();
    await this.teardownClient();
    this.listener?.onStatus('offline');
  }

  get isOnline(): boolean {
    return this.clientReady && Boolean(this.client);
  }

  private completeMobileAnswer(error?: Error): void {
    const pending = this.mobileAnswer;
    this.mobileAnswer = null;
    this.expectedMobile = null;
    if (this.mobileAnswerTimeout) clearTimeout(this.mobileAnswerTimeout);
    this.mobileAnswerTimeout = null;
    if (error) pending?.reject(error);
    else pending?.resolve();
  }

  /** Wake/register SDK, request this invitation's leg once, then match both headers. */
  async answerMobileInvitation(invitation: MobileCallInvitation): Promise<void> {
    if (this.mobileAnswer || this.currentCall || this.incomingCall) throw new Error('Another call is already in progress.');
    await ensureMicrophonePermission();
    const deadline = Date.parse(invitation.expires_at);
    if (!Number.isFinite(deadline) || deadline <= Date.now()) throw new Error('This call has expired.');
    if (!this.isOnline) void this.connect();
    while (!this.isOnline && Date.now() < deadline) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      if (this.stopped) throw new Error('Phone disconnected.');
    }
    if (!this.isOnline || Date.now() >= deadline) throw new Error('The call expired before the phone connected.');
    this.expectedMobile = invitation;
    const answer = new Promise<void>((resolve, reject) => { this.mobileAnswer = { resolve, reject }; });
    this.mobileAnswerTimeout = setTimeout(() => {
      this.completeMobileAnswer(new Error('The incoming call connection timed out.'));
      this.hangup();
    }, deadline - Date.now());
    // Set the expected identity before POST: its SIP leg can arrive before the
    // HTTP response. A transport/502 result is uncertain, so wait for that same
    // correlated leg until expiry instead of blindly dialing another one.
    void apiRequest<MobileCallInvitation>(`/voice/api/mobile/calls/${encodeURIComponent(invitation.call_uuid)}/connect/`, {
      method: 'POST',
    }).then((result) => {
      if (this.expectedMobile?.call_uuid !== invitation.call_uuid) return;
      if (!['connecting', 'answered'].includes(result.state)) {
        this.completeMobileAnswer(new Error('This incoming call is no longer available.'));
      }
    }, (error: unknown) => {
      if (this.expectedMobile?.call_uuid !== invitation.call_uuid) return;
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        this.completeMobileAnswer(new Error(error.message));
      }
    });
    return answer;
  }

  private watchCall(call: TelnyxCall) {
    call.on('telnyx.call.state', (_call: TelnyxCall, state: string) => {
      if (call !== this.currentCall && call !== this.incomingCall) return;
      switch (state) {
        case 'ringing':
          this.listener?.onCallPhase('ringing');
          break;
        case 'connecting':
          this.listener?.onCallPhase('connecting');
          break;
        case 'active':
          this.callWasActive = true;
          this.listener?.onCallPhase('active');
          break;
        case 'held':
          this.listener?.onCallPhase('held');
          break;
        case 'dropped':
          this.listener?.onCallPhase('connecting'); // may reattach on reconnect
          break;
        case 'ended': {
          // Only explain calls the remote side ended; our own hang-up is silent.
          const outcome = this.outbound && this.endReason
            ? describeCallEnd(this.endReason, this.callWasActive)
            : null;
          this.finishCall();
          this.listener?.onCallPhase('ended');
          if (outcome) this.listener?.onCallFailed?.(outcome);
          break;
        }
      }
    });
  }

  async startCall(destinationNumber: string): Promise<void> {
    const client = this.client;
    if (!client || !this.clientReady) {
      throw new Error('Phone is not connected yet. Wait for the Online status and retry.');
    }
    if (this.currentCall || this.incomingCall) {
      throw new Error('Finish the current call before starting another one.');
    }
    const target = toDialableNumber(destinationNumber);
    if (!target) throw new Error('Enter a valid telephone number.');
    await ensureMicrophonePermission();
    const auth = await authorizeOutboundCall();
    if (this.client !== client || !this.clientReady) {
      throw new Error('The phone connection changed while starting the call. Wait for Online, then try again.');
    }

    const call = await client.newCall({
      destinationNumber: target,
      audio: true,
      callerIdNumber: auth.callerId,
      customHeaders: auth.headers,
    });
    this.endReason = null;
    this.callWasActive = false;
    this.outbound = true;
    this.currentCall = call;
    this.watchCall(call);
    this.listener?.onCallPhase('dialing');
    this.startAudioSession();
  }

  async answer(): Promise<void> {
    const call = this.incomingCall;
    if (!call) throw new Error('No incoming call to answer.');
    this.stopRinging();
    await ensureMicrophonePermission();
    this.currentCall = call;
    this.incomingCall = null;
    await call.answer();
    this.startAudioSession();
  }

  decline(): void {
    this.stopRinging();
    const call = this.incomingCall;
    this.incomingCall = null;
    if (call) {
      try {
        call.hangup();
      } catch {}
    }
  }

  hangup(): void {
    const call = this.currentCall ?? this.incomingCall;
    if (call) {
      try {
        call.hangup();
      } catch {}
    }
    this.finishCall();
  }

  setMuted(muted: boolean): void {
    const call = this.currentCall;
    if (!call) return;
    try {
      if (muted) call.mute();
      else call.unmute();
    } catch {}
  }

  async setHeld(held: boolean): Promise<void> {
    const call = this.currentCall;
    if (!call) return;
    try {
      if (held) await call.hold();
      else await call.unhold();
    } catch {}
  }

  sendDtmf(digit: string): void {
    const call = this.currentCall;
    if (!call) return;
    try {
      void call.dtmf(digit);
    } catch {}
  }

  setSpeaker(on: boolean): void {
    const icm = this.getInCallManager();
    try {
      icm?.setForceSpeakerphoneOn(on);
    } catch {}
  }

  /** Phone's default ringtone + vibration while an incoming call rings. */
  private ringing = false;
  private startRinging(): void {
    if (this.ringing) return;
    // Native ringer: respects the user's ring volume and vibration mode, also
    // while the app is in the background (60s cap in case a stop is missed).
    if (keepAlive.startRinging()) {
      this.ringing = true;
      return;
    }
    const icm = this.getInCallManager();
    if (!icm) return;
    try {
      icm.startRingtone('_DEFAULT_', [0, 900, 700], 'playback', 45);
      this.ringing = true;
    } catch {}
  }

  private stopRinging(): void {
    if (!this.ringing) return;
    this.ringing = false;
    keepAlive.stopRinging();
    try {
      this.getInCallManager()?.stopRingtone();
    } catch {}
  }

  private startAudioSession(): void {
    // A foreground call lifecycle is needed during real audio, not while idle.
    if (!this.expectedMobile) keepAlive.start('CallPilot', 'Call in progress');
    const icm = this.getInCallManager();
    try {
      icm?.start({ media: 'audio' });
    } catch {}
  }

  private finishCall(): void {
    this.completeMobileAnswer(new Error('The call ended.'));
    this.stopRinging();
    this.currentCall = null;
    this.incomingCall = null;
    this.endReason = null;
    this.callWasActive = false;
    this.outbound = false;
    keepAlive.stop();
    const icm = this.getInCallManager();
    try {
      icm?.setForceSpeakerphoneOn(false);
      icm?.stop();
    } catch {}
  }
}

export const nativeVoipService = new NativeVoipService();
