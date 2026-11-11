import { PermissionsAndroid, Platform } from 'react-native';
import { apiRequest } from './api';
import { SERVICE_MODE } from './config';

/**
 * Telnyx VoIP calling, ported from the CallPilot web dashboard:
 * - POST /voice/api/token/  -> Telnyx WebRTC login token (JWT)
 * - GET  /organizations/me  -> organization phone number (outbound caller ID)
 * - GET  /me/               -> profile uid (sent as the X-Voice-Ext header)
 *
 * Uses @telnyx/react-native-voice-sdk (react-native-webrtc under the hood),
 * so it only works in a development/production build — not Expo Go or web.
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
}

/** VoIP needs native WebRTC; web and mock mode fall back to simulated calls. */
export const voipSupported = Platform.OS !== 'web' && SERVICE_MODE === 'live';

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
  connect(): Promise<void>;
  disconnect(): void | Promise<void>;
  newCall(options: {
    destinationNumber: string;
    audio?: boolean;
    callerIdNumber?: string;
    customHeaders?: { name: string; value: string }[];
  }): Promise<TelnyxCall>;
}

interface TelnyxModule {
  TelnyxRTC: new (options: { login_token: string }) => TelnyxClient;
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

async function fetchVoiceToken(): Promise<string> {
  const payload = await apiRequest<unknown>('/voice/api/token/', { method: 'POST' });
  const token = normalizeVoiceToken(payload);
  if (!token || token.split('.').length !== 3 || /[\s<>]/.test(token)) {
    throw new Error('The phone service did not return a valid token.');
  }
  return token;
}

async function ensureMicrophonePermission(): Promise<void> {
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

class VoipService {
  private sdk: TelnyxModule | null = null;
  private inCallManager: any = null;
  private client: TelnyxClient | null = null;
  private clientReady = false;
  private currentCall: TelnyxCall | null = null;
  private incomingCall: TelnyxCall | null = null;
  private listener: VoipListener | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connecting = false;
  private stopped = true;

  setListener(listener: VoipListener | null) {
    this.listener = listener;
  }

  /** Loads the native SDK; returns null when unavailable (Expo Go / web). */
  private loadSdk(): TelnyxModule | null {
    if (this.sdk) return this.sdk;
    if (!voipSupported) return null;
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

      client.on('telnyx.call.incoming', (call: TelnyxCall, msg: any) => {
        if (this.client !== client) return;
        // A second call while busy is declined, matching the dashboard.
        if (this.currentCall || this.incomingCall) {
          try {
            call.hangup();
          } catch {}
          return;
        }
        this.incomingCall = call;
        this.watchCall(call);
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
    this.stopped = true;
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
          this.listener?.onCallPhase('active');
          break;
        case 'held':
          this.listener?.onCallPhase('held');
          break;
        case 'dropped':
          this.listener?.onCallPhase('connecting'); // may reattach on reconnect
          break;
        case 'ended':
          this.finishCall();
          this.listener?.onCallPhase('ended');
          break;
      }
    });
  }

  /**
   * Caller ID + extension, fetched like the dashboard does (organization
   * number and profile uid). Failures are non-fatal: Telnyx falls back to
   * the connection's default caller ID.
   */
  private async fetchCallIdentity(): Promise<{ callerId?: string; extensionUid?: string }> {
    const [org, me] = await Promise.all([
      apiRequest<{ phone_number?: string }>('/organizations/me').catch(() => null),
      apiRequest<{ uid?: string }>('/me/').catch(() => null),
    ]);
    return {
      callerId: org?.phone_number || undefined,
      extensionUid: me?.uid || undefined,
    };
  }

  async startCall(destinationNumber: string): Promise<void> {
    const client = this.client;
    if (!client || !this.clientReady) {
      throw new Error('Phone is not connected yet. Wait for the Online status and retry.');
    }
    if (this.currentCall || this.incomingCall) {
      throw new Error('Finish the current call before starting another one.');
    }
    await ensureMicrophonePermission();
    const identity = await this.fetchCallIdentity();

    const call = await client.newCall({
      destinationNumber,
      audio: true,
      callerIdNumber: identity.callerId,
      customHeaders: identity.extensionUid
        ? [{ name: 'X-Voice-Ext', value: identity.extensionUid }]
        : undefined,
    });
    this.currentCall = call;
    this.watchCall(call);
    this.listener?.onCallPhase('dialing');
    this.startAudioSession();
  }

  async answer(): Promise<void> {
    const call = this.incomingCall;
    if (!call) throw new Error('No incoming call to answer.');
    await ensureMicrophonePermission();
    this.currentCall = call;
    this.incomingCall = null;
    await call.answer();
    this.startAudioSession();
  }

  decline(): void {
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

  private startAudioSession(): void {
    const icm = this.getInCallManager();
    try {
      icm?.start({ media: 'audio' });
    } catch {}
  }

  private finishCall(): void {
    this.currentCall = null;
    this.incomingCall = null;
    const icm = this.getInCallManager();
    try {
      icm?.setForceSpeakerphoneOn(false);
      icm?.stop();
    } catch {}
  }
}

export const voipService = new VoipService();
