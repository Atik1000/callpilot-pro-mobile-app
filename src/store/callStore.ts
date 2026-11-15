import { Alert } from 'react-native';
import { create } from 'zustand';
import {
  ActiveCall,
  Call,
  Contact,
  Voicemail,
  contactCategoryLabel,
} from '../types';
import { callService } from '../services/callService';
import {
  IncomingCallInfo,
  nativeVoipService,
  usesWebVoipEngine,
  VoipCallPhase,
  VoipEngine,
  VoipStatus,
  voipSupported,
} from '../services/voipService';
import { webVoipService } from '../services/webVoipService';

import { formatPhone } from '../utils/formatPhone';

/** Expo Go and web have no native WebRTC SDK, so they use the browser-SDK bridge. */
const voipService: VoipEngine = usesWebVoipEngine ? webVoipService : nativeVoipService;

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface StartCallInput {
  phoneNumber: string;
  contact?: Contact | null;
}

interface IncomingCallState {
  phoneNumber: string;
  displayName: string;
}

interface CallState {
  status: LoadStatus;
  calls: Call[];
  voicemails: Voicemail[];
  /** Contacts embedded in the live call feed, keyed by contact id. */
  callContacts: Record<string, Contact>;

  /** Telnyx registration state ('unavailable' = simulated calls only). */
  voipStatus: VoipStatus;
  voipDetail?: string;

  activeCall: ActiveCall | null;
  /** Live Telnyx call phase; null for simulated calls. */
  callPhase: VoipCallPhase | null;
  /** True when the active call runs over Telnyx (not simulated). */
  isLiveCall: boolean;
  incomingCall: IncomingCallState | null;

  isMuted: boolean;
  isOnHold: boolean;
  isSpeakerOn: boolean;
  callNotes: string[];

  dialedNumber: string;

  load: () => Promise<void>;
  markVoicemailRead: (id: string) => void;

  /** Connects the VoIP client (after sign-in). */
  initVoip: () => void;
  /** Tears the VoIP client down (on sign-out). */
  shutdownVoip: () => void;

  /** Starts a call — real when the phone is online, simulated otherwise. */
  startCall: (input: StartCallInput) => Promise<void>;
  answerIncoming: () => Promise<void>;
  declineIncoming: () => void;
  endCall: () => void;

  toggleMute: () => void;
  toggleHold: () => void;
  toggleSpeaker: () => void;
  sendDtmf: (digit: string) => void;
  addCallNote: (note: string) => void;

  appendDigit: (digit: string) => void;
  deleteDigit: () => void;
  clearDialedNumber: () => void;
}

function buildActiveCall(
  phoneNumber: string,
  contact?: Contact | null,
  displayNameOverride?: string,
): ActiveCall {
  const displayName = displayNameOverride || contact?.name || formatPhone(phoneNumber);
  const subtitleParts = contact
    ? [contact.company, contactCategoryLabel[contact.category]].filter(Boolean)
    : ['Not in ATS'];
  return {
    contactId: contact?.id,
    phoneNumber,
    displayName,
    displaySubtitle: subtitleParts.join(' · '),
    startedAt: Date.now(),
    isRecording: true,
  };
}

export const useCallStore = create<CallState>((set, get) => {
  /** Appends the finished call to local history and clears call state. */
  const finalizeCall = (direction: Call['direction'] = 'outgoing') => {
    const { activeCall, calls } = get();
    if (activeCall) {
      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - activeCall.startedAt) / 1000),
      );
      const endedCall: Call = {
        id: `call-local-${Date.now()}`,
        contactId: activeCall.contactId,
        phoneNumber: activeCall.phoneNumber,
        direction,
        channel: 'business',
        durationSeconds,
        timestamp: new Date().toISOString(),
        isRecorded: activeCall.isRecording,
        hasVoicemail: false,
      };
      set({ calls: [endedCall, ...calls] });
    }
    set({
      activeCall: null,
      callPhase: null,
      isLiveCall: false,
      isMuted: false,
      isOnHold: false,
      isSpeakerOn: false,
    });
  };

  const voipListener = {
    onStatus: (status: VoipStatus, detail?: string) =>
      set({ voipStatus: status, voipDetail: detail }),

    onIncoming: (info: IncomingCallInfo) => {
      // Use the ATS contact name when the caller is already known.
      const known = Object.values(get().callContacts).find(
        (c) => c.phone && info.phoneNumber.replace(/\D/g, '').endsWith(c.phone.replace(/\D/g, '').slice(-9)),
      );
      set({
        incomingCall: {
          phoneNumber: info.phoneNumber,
          displayName: known?.name || info.callerName || formatPhone(info.phoneNumber),
        },
      });
    },

    onCallFailed: (message: string) => {
      Alert.alert('Call ended', message);
    },

    onCallPhase: (phase: VoipCallPhase) => {
      if (phase === 'ended') {
        const { activeCall, incomingCall } = get();
        if (incomingCall) {
          // Caller hung up before we answered.
          set({ incomingCall: null });
          return;
        }
        if (activeCall) finalizeCall();
        return;
      }
      const prevPhase = get().callPhase;
      set({ callPhase: phase, isOnHold: phase === 'held' });
      // Restart the timer the moment the call first connects (not on unhold).
      if (phase === 'active' && prevPhase !== 'active' && prevPhase !== 'held') {
        const { activeCall } = get();
        if (activeCall) {
          set({ activeCall: { ...activeCall, startedAt: Date.now() } });
        }
      }
    },
  };

  return {
    status: 'idle',
    calls: [],
    voicemails: [],
    callContacts: {},

    voipStatus: voipSupported ? 'offline' : 'unavailable',
    voipDetail: undefined,

    activeCall: null,
    callPhase: null,
    isLiveCall: false,
    incomingCall: null,

    isMuted: false,
    isOnHold: false,
    isSpeakerOn: false,
    callNotes: [],

    dialedNumber: '',

    load: async () => {
      if (get().status === 'loading') return;
      set({ status: get().status === 'ready' ? 'ready' : 'loading' });
      // Calls and voicemails load independently: one failing endpoint must
      // not blank the whole screen.
      const [history, voicemails] = await Promise.allSettled([
        callService.getCalls(),
        callService.getVoicemails(),
      ]);
      if (history.status === 'rejected') console.warn('[calls] history failed:', history.reason);
      if (voicemails.status === 'rejected') console.warn('[calls] voicemails failed:', voicemails.reason);
      if (history.status === 'rejected' && voicemails.status === 'rejected') {
        if (get().status !== 'ready') set({ status: 'error' });
        return;
      }
      set({
        ...(history.status === 'fulfilled'
          ? { calls: history.value.calls, callContacts: history.value.contacts }
          : {}),
        ...(voicemails.status === 'fulfilled' ? { voicemails: voicemails.value } : {}),
        status: 'ready',
      });
    },

    markVoicemailRead: (id) => {
      void callService.markVoicemailRead(id);
      set((s) => ({
        voicemails: s.voicemails.map((v) =>
          v.id === id ? { ...v, consultantNotified: true } : v,
        ),
      }));
    },

    initVoip: () => {
      voipService.setListener(voipListener);
      void voipService.connect();
    },

    shutdownVoip: () => {
      void voipService.disconnect();
      voipService.setListener(null);
      set({
        incomingCall: null,
        activeCall: null,
        callPhase: null,
        isLiveCall: false,
        isMuted: false,
        isOnHold: false,
        isSpeakerOn: false,
      });
    },

    startCall: async ({ phoneNumber, contact }) => {
      if (voipService.isOnline) {
        set({
          activeCall: buildActiveCall(phoneNumber, contact),
          callPhase: 'dialing',
          isLiveCall: true,
          isMuted: false,
          isOnHold: false,
          isSpeakerOn: false,
          callNotes: [],
        });
        try {
          await voipService.startCall(phoneNumber);
        } catch (error) {
          set({ activeCall: null, callPhase: null, isLiveCall: false });
          throw error;
        }
        return;
      }
      if (voipSupported) {
        throw new Error(
          get().voipDetail || 'Phone is still connecting. Wait for "Phone online" and retry.',
        );
      }
      // Simulated call (web or mock mode — no phone line).
      set({
        activeCall: buildActiveCall(phoneNumber, contact),
        callPhase: null,
        isLiveCall: false,
        isMuted: false,
        isOnHold: false,
        isSpeakerOn: false,
        callNotes: [],
      });
    },

    answerIncoming: async () => {
      const incoming = get().incomingCall;
      if (!incoming) return;
      const contact = Object.values(get().callContacts).find(
        (c) => c.name === incoming.displayName,
      );
      set({
        incomingCall: null,
        activeCall: buildActiveCall(incoming.phoneNumber, contact, incoming.displayName),
        callPhase: 'connecting',
        isLiveCall: true,
        isMuted: false,
        isOnHold: false,
        isSpeakerOn: false,
        callNotes: [],
      });
      try {
        await voipService.answer();
      } catch (error) {
        set({ activeCall: null, callPhase: null, isLiveCall: false });
        throw error;
      }
    },

    declineIncoming: () => {
      voipService.decline();
      set({ incomingCall: null });
    },

    endCall: () => {
      if (get().isLiveCall) voipService.hangup();
      finalizeCall();
    },

    toggleMute: () => {
      const next = !get().isMuted;
      if (get().isLiveCall) voipService.setMuted(next);
      set({ isMuted: next });
    },

    toggleHold: () => {
      const next = !get().isOnHold;
      if (get().isLiveCall) void voipService.setHeld(next);
      set({ isOnHold: next });
    },

    toggleSpeaker: () => {
      const next = !get().isSpeakerOn;
      if (get().isLiveCall) voipService.setSpeaker(next);
      set({ isSpeakerOn: next });
    },

    sendDtmf: (digit) => {
      if (get().isLiveCall) voipService.sendDtmf(digit);
    },

    addCallNote: (note) => set((s) => ({ callNotes: [...s.callNotes, note] })),

    appendDigit: (digit) =>
      set((s) => ({
        dialedNumber:
          s.dialedNumber.length < 16 ? s.dialedNumber + digit : s.dialedNumber,
      })),
    deleteDigit: () => set((s) => ({ dialedNumber: s.dialedNumber.slice(0, -1) })),
    clearDialedNumber: () => set({ dialedNumber: '' }),
  };
});
