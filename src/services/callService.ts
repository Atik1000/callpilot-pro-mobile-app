import { Call, Contact, Voicemail } from '../types';
import { mockCalls, mockVoicemails } from '../data/mockCalls';
import { apiRequest } from './api';
import { SERVICE_MODE, mockDelay } from './config';
import { ApiCall, ApiVoicemail, mapCall, mapContact, mapVoicemail } from './mappers';

export interface CallHistory {
  calls: Call[];
  /** Contacts embedded in the call payloads, keyed by id. */
  contacts: Record<string, Contact>;
}

/** Accepts `{ <key>: [...] }`, DRF `{ results: [...] }` or a bare array. */
function listFrom<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>;
    for (const k of [key, 'results', 'data']) {
      if (Array.isArray(data[k])) return data[k] as T[];
    }
  }
  return [];
}

const liveCallService = {
  async getCalls(): Promise<CallHistory> {
    const [all, missed] = await Promise.all([
      apiRequest<unknown>('/voice/api/calls/'),
      apiRequest<unknown>('/voice/api/calls/?filter=missed').catch(() => null),
    ]);
    const missedIds = new Set(listFrom<ApiCall>(missed, 'calls').map((c) => c.uid));
    const contacts: Record<string, Contact> = {};
    const calls = listFrom<ApiCall>(all, 'calls').map((apiCall) => {
      if (apiCall.contact?.uid) {
        contacts[apiCall.contact.uid] = mapContact(apiCall.contact);
      }
      return mapCall(apiCall, missedIds.has(apiCall.uid));
    });
    calls.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return { calls, contacts };
  },

  async getVoicemails(): Promise<Voicemail[]> {
    const data = await apiRequest<unknown>('/voice/api/voicemails/');
    return listFrom<ApiVoicemail>(data, 'voicemails')
      .map(mapVoicemail)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },

  async markVoicemailRead(uid: string): Promise<void> {
    await apiRequest(`/voice/api/voicemails/${uid}/read/`, { method: 'POST' }).catch(
      () => undefined,
    );
  },

  /** Transfers the active call to an outside number (dashboard parity). */
  async transferToNumber(number: string): Promise<void> {
    await apiRequest('/voice/api/transfer/', { method: 'POST', body: { number } });
  },
};

const mockCallService: typeof liveCallService = {
  async getCalls() {
    await mockDelay();
    return { calls: mockCalls, contacts: {} };
  },
  async getVoicemails() {
    await mockDelay();
    return mockVoicemails;
  },
  async markVoicemailRead() {},
  async transferToNumber() {
    await mockDelay(300);
  },
};

export const callService = SERVICE_MODE === 'live' ? liveCallService : mockCallService;
