/** Server-push invitations are independent of a running React screen/SIP socket. */
import { AppState, Platform } from 'react-native';
import { nativeCallPush } from '../../modules/callpilot-keepalive/src';
import { apiRequest, ApiError, tokenStore } from './api';
import { parseMobilePush } from './mobileCallProtocol';

export interface MobileCallInvitation {
  call_uuid: string;
  invitation_uid: string;
  organization_uid: string;
  state: 'pending' | 'connecting' | 'answered' | 'cancelled' | 'expired' | 'declined';
  expires_at: string;
  channel: string;
  caller: { number: string; name?: string | null; contact_uid?: string | null };
  can_connect: boolean;
}

interface CallListener {
  onInvitation(call: MobileCallInvitation): void;
  onDismiss(callUuid: string): void;
  onAnswerRequested(): Promise<void>;
  onEndRequested(): void;
  onError(message: string): void;
}

const live = (call: MobileCallInvitation) =>
  (call.state === 'pending' || call.state === 'connecting') && Date.parse(call.expires_at) > Date.now();
const statePath = (uid: string) => `/voice/api/mobile/calls/${encodeURIComponent(uid)}/`;

class MobileCallService {
  private listener: CallListener | null = null;
  private subscription: { remove(): void } | null = null;
  private appState: { remove(): void } | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private current: MobileCallInvitation | null = null;
  private mediaActive = false;
  private refreshing = false;
  private actions = new Set<string>();
  private generation = 0;

  get invitation(): MobileCallInvitation | null { return this.current; }

  start(listener: CallListener): void {
    this.listener = listener;
    if (Platform.OS !== 'android' || !nativeCallPush.available || !tokenStore.isDeviceBound()) return;
    this.subscription ??= nativeCallPush.addInviteListener((value) => { void this.receive(value); });
    this.appState ??= AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void this.receive(nativeCallPush.getPendingInvitation());
        void this.recoverPending();
      }
    });
    void this.receive(nativeCallPush.getPendingInvitation());
    void this.recoverPending();
  }

  stop(): void {
    this.generation += 1;
    this.subscription?.remove(); this.subscription = null;
    this.appState?.remove(); this.appState = null;
    this.reset();
    this.listener = null;
    this.actions.clear();
  }

  private reset(): void {
    if (this.poll) clearInterval(this.poll);
    if (this.timeout) clearTimeout(this.timeout);
    this.poll = null; this.timeout = null;
    if (this.current) nativeCallPush.endCall(this.current.call_uuid);
    this.current = null;
    this.mediaActive = false;
  }

  private dismiss(uid: string): void {
    if (this.current?.call_uuid === uid) this.reset();
    else nativeCallPush.endCall(uid);
    this.listener?.onDismiss(uid);
  }

  private async recoverPending(): Promise<void> {
    if (!tokenStore.isDeviceBound() || !this.listener || this.current) return;
    const generation = this.generation;
    try {
      const result = await apiRequest<{ calls: MobileCallInvitation[] }>('/voice/api/mobile/calls/');
      if (generation !== this.generation || !this.listener) return;
      const call = result.calls.find((candidate) => live(candidate));
      if (call) this.adopt(call);
    } catch { /* The next push/foreground event can retry; never erase login on network failure. */ }
  }

  private adopt(call: MobileCallInvitation): void {
    const session = tokenStore.getSession();
    if (!session || call.organization_uid !== session.organizationUid) return;
    if (!live(call) && call.state !== 'answered') { this.dismiss(call.call_uuid); return; }
    if (this.current && this.current.call_uuid !== call.call_uuid) return;
    const isNew = !this.current;
    this.current = call;
    if (!this.mediaActive && live(call)) this.listener?.onInvitation(call);
    if (isNew) {
      // Stop a ringing/connecting invite even if networking disappears. The
      // timer is cancelled after this handset actually confirms media.
      this.timeout = setTimeout(() => {
        if (!this.mediaActive) this.dismiss(call.call_uuid);
      }, Math.max(0, Date.parse(call.expires_at) - Date.now()));
      this.poll = setInterval(() => { void this.refresh(); }, 1500);
    }
  }

  private async refresh(): Promise<void> {
    const current = this.current;
    if (!current || this.refreshing) return;
    this.refreshing = true;
    const generation = this.generation;
    try {
      const fresh = await apiRequest<MobileCallInvitation>(statePath(current.call_uuid));
      if (generation !== this.generation || this.current?.call_uuid !== current.call_uuid) return;
      if (live(fresh) || fresh.state === 'answered') this.adopt(fresh);
      else this.dismiss(current.call_uuid);
    } catch (error) {
      if (error instanceof ApiError && [401, 403, 404, 410].includes(error.status)) this.dismiss(current.call_uuid);
    } finally { this.refreshing = false; }
  }

  private async receive(value: unknown): Promise<void> {
    const push = parseMobilePush(value);
    const session = tokenStore.getSession();
    if (!push || !session || push.organization_uid !== session.organizationUid) return;
    const actionKey = `${push.call_uuid}:${push.action || 'open'}`;
    if (this.actions.has(actionKey)) return;
    // Native event plus cold-start pending state may arrive concurrently.
    // Reserve intent before any asynchronous lookup, not after it.
    if (push.action === 'answer' || push.action === 'decline') this.actions.add(actionKey);
    const generation = this.generation;
    try {
      const call = await apiRequest<MobileCallInvitation>(statePath(push.call_uuid));
      if (generation !== this.generation || call.organization_uid !== session.organizationUid) return;
      if (push.action === 'decline') {
        if (call.state === 'answered') this.listener?.onEndRequested();
        await endMobileInvitation(call);
        this.dismiss(call.call_uuid);
        return;
      }
      if (call.state === 'answered' && this.current?.call_uuid === call.call_uuid) {
        // A duplicate Open event can race the SDK's active event. The server
        // has already marked our leg answered; keep its media deadline/state.
        this.adopt(call);
        return;
      }
      if (!live(call)) { this.dismiss(call.call_uuid); return; }
      this.adopt(call);
      if (push.action === 'answer' && this.current?.call_uuid === call.call_uuid) {
        await this.listener?.onAnswerRequested();
      }
    } catch (error) {
      this.actions.delete(actionKey);
      if (error instanceof ApiError && [401, 403, 404, 409, 410].includes(error.status)) this.dismiss(push.call_uuid);
      if (push.action === 'answer') this.listener?.onError(error instanceof Error ? error.message : 'Could not answer this call.');
    }
  }

  async prepareAnswer(callUuid: string): Promise<MobileCallInvitation> {
    const call = await apiRequest<MobileCallInvitation>(statePath(callUuid));
    if (!live(call) || !call.can_connect) throw new Error('This incoming call is no longer available.');
    this.adopt(call);
    return call;
  }

  markMediaActive(): void {
    if (!this.current) return;
    this.mediaActive = true;
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
    nativeCallPush.markCallActive(this.current.call_uuid);
  }

  async declineOrEnd(): Promise<void> {
    const current = this.current;
    if (!current) return;
    try {
      const fresh = await apiRequest<MobileCallInvitation>(statePath(current.call_uuid));
      await endMobileInvitation(fresh);
    } finally { this.dismiss(current.call_uuid); }
  }

  finished(): void { this.reset(); }
}

async function endMobileInvitation(call: MobileCallInvitation): Promise<void> {
  if (!live(call) && call.state !== 'answered') return;
  await apiRequest(`${statePath(call.call_uuid)}${call.state === 'answered' ? 'end' : 'decline'}/`, { method: 'POST' });
}

/** Notification Decline works without mounting React screens or the SIP SDK. */
export async function headlessPushAction(value: unknown): Promise<void> {
  const push = parseMobilePush(value);
  if (!push || push.action !== 'decline') return;
  await tokenStore.load();
  const session = tokenStore.getSession();
  if (!session || session.organizationUid !== push.organization_uid) return;
  try {
    const call = await apiRequest<MobileCallInvitation>(statePath(push.call_uuid));
    await endMobileInvitation(call);
    nativeCallPush.endCall(push.call_uuid);
  } catch { /* The server invitation deadline remains authoritative. */ }
}

export const mobileCallService = new MobileCallService();
