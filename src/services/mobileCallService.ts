import { ApiError, apiRequest } from './api';

/**
 * Mobile call control for CallPilot server push mode. All routes use the
 * device-bound JWT; POST bodies are always `{}` (the backend derives device,
 * user and business from the session).
 *
 *   GET  /voice/api/mobile/calls/                -> {calls:[...]}
 *   GET  /voice/api/mobile/calls/{uuid}/         -> one call's state
 *   POST /voice/api/mobile/calls/{uuid}/connect/ -> dial this device's SDK leg
 *   POST /voice/api/mobile/calls/{uuid}/decline/
 *   POST /voice/api/mobile/calls/{uuid}/end/
 */
export type InvitationState =
  | 'pending'
  | 'connecting'
  | 'answered'
  | 'declined'
  | 'cancelled'
  | 'expired';

export interface MobileCallState {
  call_uuid: string;
  invitation_uid: string;
  organization_uid: string;
  state: InvitationState;
  call_status?: string;
  channel?: string;
  expires_at?: string;
  started_at?: string | null;
  answered_at?: string | null;
  ended_at?: string | null;
  caller?: { number?: string; name?: string; contact_uid?: string } | null;
  can_connect?: boolean;
}

/** Push payload `kind:"incoming_call"` (FCM data values are strings). */
export interface IncomingCallPush {
  call_uuid: string;
  organization_uid?: string;
  sent_at?: string;
  expires_at?: string;
}

/** Invitation is still ringing this device. */
export const isRinging = (s: MobileCallState) => s.state === 'pending' || s.state === 'connecting';

/** Call ended or this device lost the invitation (declined, cancelled, expired, answered elsewhere). */
export function isOver(s: MobileCallState): boolean {
  if (s.state === 'declined' || s.state === 'cancelled' || s.state === 'expired') return true;
  return Boolean(s.ended_at);
}

export type ConnectOutcome =
  | { kind: 'ok'; state: MobileCallState }
  /** 409/410/403/404: stop and close the call screen. */
  | { kind: 'gone'; message: string }
  /** 502 or network: provider result unknown — keep polling, do not redial. */
  | { kind: 'uncertain' };

const base = (uuid: string) => `/voice/api/mobile/calls/${encodeURIComponent(uuid)}/`;

export const mobileCallService = {
  async list(): Promise<MobileCallState[]> {
    const data = await apiRequest<{ calls?: MobileCallState[] }>('/voice/api/mobile/calls/');
    return data.calls ?? [];
  },

  get(uuid: string): Promise<MobileCallState> {
    return apiRequest<MobileCallState>(base(uuid));
  },

  async connect(uuid: string): Promise<ConnectOutcome> {
    try {
      const state = await apiRequest<MobileCallState>(`${base(uuid)}connect/`, { method: 'POST', body: {} });
      return { kind: 'ok', state };
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 410) return { kind: 'gone', message: 'The call has expired.' };
        if (error.status === 409) return { kind: 'gone', message: 'The call is no longer available.' };
        if (error.status === 403 || error.status === 404) {
          return { kind: 'gone', message: 'This phone cannot take that call.' };
        }
      }
      return { kind: 'uncertain' };
    }
  },

  async decline(uuid: string): Promise<void> {
    await apiRequest(`${base(uuid)}decline/`, { method: 'POST', body: {} }).catch(() => undefined);
  },

  async end(uuid: string): Promise<void> {
    await apiRequest(`${base(uuid)}end/`, { method: 'POST', body: {} }).catch(() => undefined);
  },
};
