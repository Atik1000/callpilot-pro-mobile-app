import {
  ensureMicrophonePermission,
  authorizeOutboundCall,
  fetchVoiceToken,
  toDialableNumber,
  CallEndReason,
  describeCallEnd,
  VoipCallPhase,
  VoipEngine,
  VoipListener,
  VoipStatus,
} from './voipService';

/**
 * Calling engine for Expo Go: drives the Telnyx browser SDK running in the
 * hidden <VoipWebBridge /> WebView. Token and caller identity are fetched
 * here (with the app's auth) and handed to the page.
 */

type BridgeCommand =
  | { type: 'connect'; token: string }
  | { type: 'disconnect' }
  | { type: 'call'; destination: string; callerNumber?: string; headers: { name: string; value: string }[] }
  | { type: 'answer' }
  | { type: 'decline' }
  | { type: 'hangup' }
  | { type: 'mute'; muted: boolean }
  | { type: 'hold'; held: boolean }
  | { type: 'dtmf'; digit: string };

type BridgeEvent =
  | { type: 'loaded' }
  | { type: 'status'; status: VoipStatus; detail?: string }
  | { type: 'incoming'; number?: string; name?: string }
  | { type: 'phase'; phase: VoipCallPhase }
  | { type: 'commandError'; command: string; message: string }
  | { type: 'callFailed'; reason: CallEndReason; wasActive: boolean }
  | { type: 'log'; message: string };

const RECONNECT_MS = 12000;
const READY_TIMEOUT_MS = 30000;
const CALL_START_TIMEOUT_MS = 15000;

class WebVoipService implements VoipEngine {
  private listener: VoipListener | null = null;
  private send: ((command: BridgeCommand) => void) | null = null;
  private pageLoaded = false;
  private queue: BridgeCommand[] = [];
  private stopped = true;
  private online = false;
  private inCall = false;
  private ringing = false;
  private connecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingStart: {
    resolve: () => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  setListener(listener: VoipListener | null) {
    this.listener = listener;
  }

  /** Called by the WebView component when it mounts/unmounts. */
  attachBridge(send: ((command: BridgeCommand) => void) | null) {
    this.send = send;
    if (!send) {
      this.pageLoaded = false;
      this.online = false;
    }
  }

  /** Every message posted by the page lands here. */
  handleBridgeMessage(raw: string) {
    let event: BridgeEvent;
    try {
      event = JSON.parse(raw) as BridgeEvent;
    } catch {
      return;
    }
    switch (event.type) {
      case 'loaded': {
        // First load, or the WebView reloaded after the OS killed it.
        const wasLoaded = this.pageLoaded;
        this.pageLoaded = true;
        this.online = false;
        if (wasLoaded && !this.stopped) {
          this.queue = [];
          void this.connect();
        } else {
          this.flush();
        }
        break;
      }
      case 'status':
        this.onStatus(event.status, event.detail);
        break;
      case 'incoming':
        this.ringing = true;
        this.listener?.onIncoming({
          phoneNumber: event.number || 'Unknown number',
          callerName: event.name || undefined,
        });
        break;
      case 'phase':
        if (event.phase === 'dialing') this.settleStart();
        if (event.phase === 'ended') {
          this.inCall = false;
          this.ringing = false;
          this.settleStart(new Error('The call ended before it connected.'));
        }
        this.listener?.onCallPhase(event.phase);
        break;
      case 'callFailed': {
        const message = describeCallEnd(event.reason, event.wasActive);
        if (message) this.listener?.onCallFailed?.(message);
        break;
      }
      case 'commandError':
        if (event.command === 'call') {
          this.inCall = false;
          this.settleStart(new Error(event.message));
        }
        break;
      case 'log':
        if (__DEV__) console.log('[voip-webview]', event.message);
        break;
    }
  }

  private post(command: BridgeCommand) {
    if (this.send && this.pageLoaded) this.send(command);
    else this.queue.push(command);
  }

  private flush() {
    if (!this.send || !this.pageLoaded) return;
    const pending = this.queue;
    this.queue = [];
    pending.forEach((command) => this.send?.(command));
  }

  private onStatus(status: VoipStatus, detail?: string) {
    if (status === 'online') {
      this.online = true;
      this.clearReadyTimer();
    } else if (status === 'offline') {
      this.online = false;
      this.clearReadyTimer();
      if (!this.inCall) this.scheduleReconnect();
    }
    this.listener?.onStatus(status, detail);
  }

  async connect(): Promise<void> {
    if (this.connecting) return;
    this.stopped = false;
    this.connecting = true;
    this.clearReconnectTimer();
    this.listener?.onStatus('connecting', 'Connecting phone…');
    try {
      const token = await fetchVoiceToken();
      if (this.stopped) return;
      this.online = false;
      this.post({ type: 'connect', token });
      this.clearReadyTimer();
      this.readyTimer = setTimeout(() => {
        if (this.online || this.stopped) return;
        this.listener?.onStatus('offline', 'Phone registration timed out. Retrying…');
        this.scheduleReconnect();
      }, READY_TIMEOUT_MS);
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

  async disconnect(): Promise<void> {
    this.stopped = true;
    this.online = false;
    this.inCall = false;
    this.ringing = false;
    this.clearReconnectTimer();
    this.clearReadyTimer();
    this.settleStart(new Error('Phone disconnected.'));
    this.queue = [];
    if (this.send && this.pageLoaded) this.send({ type: 'disconnect' });
    this.listener?.onStatus('offline');
  }

  get isOnline(): boolean {
    return this.online;
  }

  async startCall(destinationNumber: string): Promise<void> {
    if (!this.online) {
      throw new Error('Phone is not connected yet. Wait for the Online status and retry.');
    }
    if (this.inCall || this.ringing) {
      throw new Error('Finish the current call before starting another one.');
    }
    const target = toDialableNumber(destinationNumber);
    if (!target) throw new Error('Enter a valid telephone number.');
    await ensureMicrophonePermission();
    const auth = await authorizeOutboundCall();
    this.inCall = true;
    const started = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => this.settleStart(new Error('The phone did not start the call. Try again.')),
        CALL_START_TIMEOUT_MS,
      );
      this.pendingStart = { resolve, reject, timer };
    });
    this.post({
      type: 'call',
      destination: target,
      callerNumber: auth.callerId,
      headers: auth.headers,
    });
    try {
      await started;
    } catch (error) {
      this.inCall = false;
      this.post({ type: 'hangup' });
      throw error;
    }
  }

  private settleStart(error?: Error) {
    const pending = this.pendingStart;
    if (!pending) return;
    this.pendingStart = null;
    clearTimeout(pending.timer);
    if (error) pending.reject(error);
    else pending.resolve();
  }

  async answer(): Promise<void> {
    if (!this.ringing) throw new Error('No incoming call to answer.');
    await ensureMicrophonePermission();
    this.ringing = false;
    this.inCall = true;
    this.post({ type: 'answer' });
  }

  decline(): void {
    this.ringing = false;
    this.post({ type: 'decline' });
  }

  hangup(): void {
    this.inCall = false;
    this.ringing = false;
    this.settleStart(new Error('Call cancelled.'));
    this.post({ type: 'hangup' });
  }

  setMuted(muted: boolean): void {
    this.post({ type: 'mute', muted });
  }

  async setHeld(held: boolean): Promise<void> {
    this.post({ type: 'hold', held });
  }

  sendDtmf(digit: string): void {
    this.post({ type: 'dtmf', digit });
  }

  /** WebView audio routing is controlled by the OS; speaker is UI-only here. */
  setSpeaker(): void {}

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, RECONNECT_MS);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearReadyTimer() {
    if (this.readyTimer) {
      clearTimeout(this.readyTimer);
      this.readyTimer = null;
    }
  }
}

export const webVoipService = new WebVoipService();
export type { BridgeCommand };
