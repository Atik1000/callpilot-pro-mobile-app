import { Alert, AppState } from 'react-native';
import { keepAlive, NativeCallAction, NativeEndReason } from '../../modules/callpilot-keepalive/src';
import { create } from 'zustand';
import {
  ActiveCall,
  Call,
  Contact,
  Voicemail,
  contactCategoryLabel,
} from '../types';
import { tokenStore } from '../services/api';
import { callService } from '../services/callService';
import { CALL_WAKE } from '../services/config';
import { deviceService } from '../services/deviceService';
import {
  IncomingCallPush,
  isOver,
  mobileCallService,
  MobileCallState,
} from '../services/mobileCallService';
import { notificationService } from '../services/notificationService';
import {
  CallChannel,
  IncomingCallInfo,
  nativeVoipService,
  nativeVoipSupported,
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
  /** 'whatsapp': business-initiated WhatsApp call (permission required). */
  channel?: CallChannel;
}

interface IncomingCallState {
  phoneNumber: string;
  displayName: string;
  /** CallPilot server-push invitation (call_uuid); absent for direct SDK calls. */
  callUuid?: string;
  channel?: string;
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
  /** A CallPilot `incoming_call` push arrived (JSON of its data fields). */
  handleCallPush: (payloadJson: string) => void;
  /** Answer/end/mute from CallKit, Telecom or the call notification. */
  handleNativeCallAction: (action: NativeCallAction) => Promise<void>;

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

/** Shown once per launch when push wake-up can't be set up for this phone. */
let pushHintShown = false;
let voipInitialised = false;
/**
 * CallPilot server push mode: nothing runs in the background between calls.
 * There is no always-on service: without push mode, calls ring only while
 * the app is open.
 * The backend sends an `incoming_call` push (FCM data / PushKit) with only
 * call_uuid + expiry, keeps the caller waiting, and dials this device's SDK
 * leg only after the user answers and the SDK is registered (`connect`).
 */
let pushMode = false;
let appStateSub: { remove(): void } | null = null;
/** Push received before the line finished starting. */
let pendingPush: IncomingCallPush | null = null;

interface ServerCall {
  callUuid: string;
  invitationUid?: string;
  expiresAt: number;
  /** ringing -> connecting (user answered) -> connected (SDK media up). */
  phase: 'ringing' | 'connecting' | 'connected';
  /** Caller details were filled in from the call-state endpoint. */
  described: boolean;
}
let serverCall: ServerCall | null = null;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
/** call_uuids already shown: the backend may retry delivery. */
const seenCalls = new Set<string>();
/** "Answer" tapped on the native UI before the push reached JS (cold start). */
let pendingAnswer: string | null = null;
const POLL_MS = 2000;
const DEFAULT_RING_MS = 25000;

/**
 * Push wake-up needs this installation registered, which the backend only
 * allows after the emailed-code sign-in. Explain once instead of silently
 * missing calls while the app is closed.
 */
function explainPushUnavailableOnce() {
  if (pushHintShown || AppState.currentState !== 'active') return;
  pushHintShown = true;
  setTimeout(() => {
    Alert.alert(
      'Calls while CallPilot is closed',
      'Right now calls ring only while the app is open. To get calls when it is closed, sign out and sign in again with the code sent to your email.',
    );
  }, 1500);
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

  const callInProgress = () => Boolean(get().incomingCall || get().activeCall);

  /**
   * Push mode, nothing ringing or in progress: drop the call-only service,
   * and the connection too unless the app is on screen.
   */
  const settleIdle = () => {
    if (!voipInitialised || callInProgress() || serverCall) return;
    keepAlive.stop();
    if (AppState.currentState !== 'active') void voipService.disconnect();
  };

  const clearServerTimers = () => {
    if (pollTimer) clearTimeout(pollTimer);
    if (expiryTimer) clearTimeout(expiryTimer);
    pollTimer = null;
    expiryTimer = null;
  };

  /**
   * Closes the server-push call screen (cancelled, expired, declined, answered
   * elsewhere, or connect refused). Never starts or ends anything remotely.
   */
  const closeServerCall = (message?: string, reason: NativeEndReason = 'remoteEnded') => {
    const call = serverCall;
    if (!call) return;
    serverCall = null;
    clearServerTimers();
    nativeVoipService.expectInvite(null);
    keepAlive.endCall(call.callUuid, reason);
    keepAlive.stopRinging();
    keepAlive.clearIncomingCall();
    if (get().incomingCall?.callUuid === call.callUuid) set({ incomingCall: null });
    // Answered here but the SDK leg never connected: leave the call screen.
    if (call.phase !== 'connected' && !nativeVoipService.hasCall && get().activeCall) {
      set({ activeCall: null, callPhase: null, isLiveCall: false });
    }
    if (message && AppState.currentState === 'active') Alert.alert('Call ended', message);
    settleIdle();
  };

  /** Fills the caller in once the authenticated call state is known. */
  const describe = (state: MobileCallState) => {
    const call = serverCall;
    if (!call || call.described) return;
    call.described = true;
    call.invitationUid = state.invitation_uid || call.invitationUid;
    const number = state.caller?.number || '';
    const known = state.caller?.contact_uid ? get().callContacts[state.caller.contact_uid] : undefined;
    const displayName =
      known?.name || state.caller?.name || (number ? formatPhone(number) : 'Incoming call');
    // CallKit / Telecom / the call notification show the real caller now.
    keepAlive.updateCall(call.callUuid, displayName, number, state.channel === 'whatsapp');
    const incoming = get().incomingCall;
    if (incoming?.callUuid === call.callUuid) {
      set({ incomingCall: { ...incoming, phoneNumber: number, displayName, channel: state.channel } });
    } else if (get().activeCall && call.phase !== 'ringing') {
      const active = get().activeCall!;
      set({ activeCall: { ...active, phoneNumber: number || active.phoneNumber, displayName } });
    }
  };

  /**
   * Polls this invitation while it is pending/connecting: the backend sends no
   * cancellation push, so this (plus the local expiry) is how the screen
   * learns the caller hung up or another device answered.
   */
  const poll = async () => {
    pollTimer = null;
    const call = serverCall;
    if (!call || call.phase === 'connected') return;
    try {
      const state = await mobileCallService.get(call.callUuid);
      if (serverCall !== call) return;
      describe(state);
      if (state.invitation_uid) {
        call.invitationUid = state.invitation_uid;
        if (call.phase === 'connecting') {
          nativeVoipService.expectInvite({ callUuid: call.callUuid, invitationUid: call.invitationUid });
        }
      }
      if (isOver(state)) {
        closeServerCall(
          call.phase === 'connecting' ? 'The caller is no longer on the line.' : undefined,
          state.state === 'expired' ? 'unanswered' : state.state === 'declined' ? 'declinedElsewhere' : 'remoteEnded',
        );
        return;
      }
      // Our invitation shows answered while we never pressed Answer: not ours.
      if (state.state === 'answered' && call.phase === 'ringing') {
        closeServerCall(undefined, 'answeredElsewhere');
        return;
      }
    } catch {
      // Network blip: the local expiry still closes the screen on time.
    }
    // phase may have changed while the request was in flight (SDK went active).
    if (serverCall === call && (call.phase as ServerCall['phase']) !== 'connected') {
      pollTimer = setTimeout(() => void poll(), POLL_MS);
    }
  };

  /** Shows the call at once (push data has no caller), then refreshes its state. */
  const receiveServerPush = (push: IncomingCallPush) => {
    const uuid = push.call_uuid;
    if (!uuid || seenCalls.has(uuid) || serverCall?.callUuid === uuid) return;
    seenCalls.add(uuid);
    const org = tokenStore.organizationUid();
    if (org && push.organization_uid && push.organization_uid !== org) return;
    const expiresAt = Date.parse(push.expires_at ?? '') || Date.now() + DEFAULT_RING_MS;
    if (expiresAt <= Date.now() || callInProgress()) {
      // Expired, or busy on another call here (let it ring other devices).
      keepAlive.stopRinging();
      keepAlive.clearIncomingCall();
      keepAlive.endCall(uuid, expiresAt <= Date.now() ? 'unanswered' : 'failed');
      return;
    }
    serverCall = { callUuid: uuid, expiresAt, phase: 'ringing', described: false };
    set({ incomingCall: { phoneNumber: '', displayName: 'Incoming call', callUuid: uuid } });
    keepAlive.startRinging(); // no-op when the push service already rings
    // Local deadline: closes an unanswered/connecting invitation even offline.
    expiryTimer = setTimeout(() => {
      if (serverCall?.callUuid === uuid && serverCall.phase !== 'connected') {
        closeServerCall(
          serverCall.phase === 'connecting' ? 'The call could not be connected in time.' : undefined,
          'unanswered',
        );
      }
    }, expiresAt - Date.now());
    void poll();
    if (pendingAnswer?.toLowerCase() === uuid.toLowerCase()) {
      pendingAnswer = null;
      void get().answerIncoming().catch((e: unknown) =>
        Alert.alert('Call ended', e instanceof Error ? e.message : 'The call could not be connected.'),
      );
      return;
    }
    // Warm the SDK up so Answer connects fast.
    void nativeVoipService.waitUntilReady(15000, true);
  };

  /** Picks up invitations whose push was lost (opening the app after a ring). */
  const checkPendingInvitations = async () => {
    if (!pushMode || callInProgress() || serverCall) return;
    try {
      const calls = await mobileCallService.list();
      const ringing = calls.find((c) => c.state === 'pending' && !isOver(c));
      if (ringing && !serverCall && !callInProgress()) {
        receiveServerPush({
          call_uuid: ringing.call_uuid,
          organization_uid: ringing.organization_uid,
          expires_at: ringing.expires_at,
        });
      }
    } catch {}
  };

  /** Decides between push wake-up and the always-on service, then connects. */
  const startLine = async () => {
    const token =
      CALL_WAKE === 'push' && nativeVoipSupported ? await keepAlive.getPushToken() : null;
    if (!voipInitialised) return; // signed out meanwhile
    // Server push needs this installation bound to the session (device JWT).
    pushMode = Boolean(token && tokenStore.deviceUid());
    keepAlive.setPushMode(pushMode);
    // Never keep an always-on service (also clears one left by older builds).
    if (!serverCall && !callInProgress() && !pendingPush) keepAlive.stop();
    console.log(
      `[line] mode=${pushMode ? 'push' : 'service'} wake=${CALL_WAKE} fcmToken=${token ? 'yes' : 'no'} device=${tokenStore.deviceUid() ? 'bound' : 'unbound'}`,
    );

    // Online while the app is on screen; offline (nothing running) otherwise.
    appStateSub ??= AppState.addEventListener('change', (state) => {
      if (state === 'background') settleIdle();
      else if (state === 'active') {
        if (pushMode) {
          void deviceService.registerPush();
          void checkPendingInvitations();
        }
        if (!callInProgress() && !voipService.isOnline) void voipService.connect();
      }
    });

    if (!pushMode) {
      if (CALL_WAKE === 'push' && nativeVoipSupported) explainPushUnavailableOnce();
      if (AppState.currentState === 'active') void voipService.connect();
      return;
    }

    void deviceService.registerPush();
    const push = pendingPush;
    pendingPush = null;
    if (push) {
      receiveServerPush(push);
    } else if (AppState.currentState === 'active') {
      // The incoming-call alert needs notification permission (Android 13+).
      void notificationService.ensureReady();
      void voipService.connect();
      void checkPendingInvitations();
    }
  };

  const voipListener = {
    onStatus: (status: VoipStatus, detail?: string) =>
      set({ voipStatus: status, voipDetail: detail }),

    onIncoming: (info: IncomingCallInfo) => {
      // Use the ATS contact name when the caller is already known.
      const known = Object.values(get().callContacts).find(
        (c) => c.phone && info.phoneNumber.replace(/\D/g, '').endsWith(c.phone.replace(/\D/g, '').slice(-9)),
      );
      const displayName = known?.name || info.callerName || formatPhone(info.phoneNumber);
      set({ incomingCall: { phoneNumber: info.phoneNumber, displayName } });
      // Ringing in the background: surface it (full-screen / heads-up alert).
      if (AppState.currentState !== 'active') {
        keepAlive.showIncomingCall(displayName, 'Incoming call · Business line');
      }
    },

    onCallFailed: (message: string) => {
      Alert.alert('Call ended', message);
    },

    onCallPhase: (phase: VoipCallPhase) => {
      if (phase !== 'ringing') keepAlive.clearIncomingCall();
      if (phase === 'active' && serverCall) {
        // Media is up on this handset: the ringing deadline no longer applies.
        serverCall.phase = 'connected';
        clearServerTimers();
        keepAlive.callConnected(serverCall.callUuid);
      }
      if (phase === 'ended') {
        if (serverCall) {
          // SDK remote hangup (caller left, voicemail, another device won…).
          const call = serverCall;
          if (call.phase === 'connected' && get().activeCall) finalizeCall('incoming');
          serverCall = null;
          clearServerTimers();
          keepAlive.endCall(call.callUuid, 'remoteEnded');
          if (call.phase !== 'connected') {
            set({ activeCall: null, callPhase: null, isLiveCall: false });
          }
          settleIdle();
          return;
        }
        const { activeCall, incomingCall } = get();
        if (incomingCall) {
          // Caller hung up before we answered.
          set({ incomingCall: null });
          settleIdle();
          return;
        }
        if (activeCall) finalizeCall();
        settleIdle();
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
      // Already registered (e.g. started in the background, then the app was
      // opened): don't reconnect, it would drop a call that is ringing.
      if (voipInitialised) {
        if (!callInProgress() && !serverCall && !voipService.isOnline) {
          void voipService.connect();
        }
        return;
      }
      voipInitialised = true;
      voipService.setListener(voipListener);
      void startLine();
    },

    handleCallPush: (payloadJson) => {
      let push: IncomingCallPush;
      try {
        push = JSON.parse(payloadJson) as IncomingCallPush;
      } catch {
        return;
      }
      if (typeof push?.call_uuid !== 'string' || !push.call_uuid) return;
      if (!voipInitialised) {
        pendingPush = push;
        get().initVoip();
      } else {
        receiveServerPush(push);
      }
    },

    handleNativeCallAction: async ({ action, call_uuid, muted, digits }) => {
      const uuid = call_uuid?.toLowerCase();
      const server = serverCall;
      if ((!server || server.callUuid.toLowerCase() !== uuid) && action === 'answer' && uuid) {
        // App launched from the notification's Answer button: the push may
        // still be on its way to JS. Answer as soon as it arrives.
        if (!seenCalls.has(call_uuid)) {
          pendingAnswer = call_uuid;
          get().handleCallPush(JSON.stringify({ call_uuid }));
          return;
        }
      }
      if (!server || server.callUuid.toLowerCase() !== uuid) {
        // Not (or no longer) our call: make sure its native screen is gone.
        if (uuid && action !== 'mute' && action !== 'dtmf') keepAlive.endCall(call_uuid, 'failed');
        return;
      }
      switch (action) {
        case 'answer':
          if (server.phase === 'ringing') await get().answerIncoming();
          return;
        case 'end':
          if (server.phase === 'ringing') get().declineIncoming();
          else get().endCall();
          return;
        case 'timeout':
          closeServerCall(undefined, 'unanswered');
          return;
        case 'mute':
          if (typeof muted === 'boolean' && muted !== get().isMuted) get().toggleMute();
          return;
        case 'dtmf':
          for (const digit of digits ?? '') get().sendDtmf(digit);
          return;
      }
    },

    shutdownVoip: () => {
      voipInitialised = false;
      pushMode = false;
      pendingPush = null;
      pendingAnswer = null;
      serverCall = null;
      clearServerTimers();
      seenCalls.clear();
      nativeVoipService.expectInvite(null);
      appStateSub?.remove();
      appStateSub = null;
      keepAlive.setPushMode(false);
      keepAlive.stop();
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

    startCall: async ({ phoneNumber, contact, channel = 'phone' }) => {
      if (channel === 'whatsapp' && !voipService.isOnline) {
        throw new Error(get().voipDetail || 'Phone is still connecting. Wait for "Phone online" and retry.');
      }
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
        // Keeps the call alive if the app is minimised mid-call (call only).
        keepAlive.startForCall('CallPilot', 'Call in progress');
        try {
          await voipService.startCall(phoneNumber, channel);
        } catch (error) {
          set({ activeCall: null, callPhase: null, isLiveCall: false });
          settleIdle();
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
      const server = serverCall;
      if (server && get().incomingCall?.callUuid === server.callUuid) {
        const incoming = get().incomingCall!;
        server.phase = 'connecting';
        keepAlive.answerCall(server.callUuid);
        keepAlive.stopRinging();
        keepAlive.clearIncomingCall();
        set({
          incomingCall: null,
          activeCall: buildActiveCall(incoming.phoneNumber, null, incoming.displayName),
          callPhase: 'connecting',
          isLiveCall: true,
          isMuted: false,
          isOnHold: false,
          isSpeakerOn: false,
          callNotes: [],
        });
        keepAlive.startForCall('CallPilot', 'Connecting call…');
        // Connect only once the SDK is registered, or the leg has nowhere to go.
        const ready = await nativeVoipService.waitUntilReady(15000);
        if (serverCall !== server) throw new Error('The caller hung up.');
        if (!ready) {
          closeServerCall(undefined, 'failed');
          throw new Error('The phone could not connect. Check your internet connection.');
        }
        nativeVoipService.expectInvite({ callUuid: server.callUuid, invitationUid: server.invitationUid });
        const outcome = await mobileCallService.connect(server.callUuid);
        if (serverCall !== server) return;
        if (outcome.kind === 'gone') {
          closeServerCall(undefined, 'failed');
          throw new Error(outcome.message);
        }
        if (outcome.kind === 'ok' && outcome.state.invitation_uid) {
          server.invitationUid = outcome.state.invitation_uid;
          nativeVoipService.expectInvite({ callUuid: server.callUuid, invitationUid: server.invitationUid });
        }
        // 'uncertain' (502/network): keep polling and wait for the SDK INVITE.
        if (!pollTimer) void poll();
        keepAlive.startForCall('CallPilot', 'Call in progress');
        return;
      }
      const incoming = get().incomingCall;
      if (!incoming) return;
      keepAlive.clearIncomingCall();
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
      // Replaces the ringing-only service (and its timeout) for the call itself.
      keepAlive.startForCall('CallPilot', 'Call in progress');
      try {
        await voipService.answer();
      } catch (error) {
        set({ activeCall: null, callPhase: null, isLiveCall: false });
        settleIdle();
        throw error;
      }
    },

    declineIncoming: () => {
      keepAlive.clearIncomingCall();
      const server = serverCall;
      if (server && get().incomingCall?.callUuid === server.callUuid) {
        void mobileCallService.decline(server.callUuid);
        closeServerCall(undefined, 'local');
        return;
      }
      voipService.decline();
      set({ incomingCall: null });
      settleIdle();
    },

    endCall: () => {
      const server = serverCall;
      if (server) {
        serverCall = null;
        clearServerTimers();
        nativeVoipService.expectInvite(null);
        keepAlive.endCall(server.callUuid, 'local');
        void mobileCallService.end(server.callUuid);
      }
      if (get().isLiveCall) voipService.hangup();
      finalizeCall(server ? 'incoming' : 'outgoing');
      settleIdle();
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
