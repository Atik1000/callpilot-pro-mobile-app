export type CallDirection = 'incoming' | 'outgoing' | 'missed';

export type CallChannel = 'business' | 'whatsapp';

export interface Call {
  id: string;
  contactId?: string;
  /** Caller name sent with the call record, when the API knows it. */
  contactName?: string;
  phoneNumber: string;

  direction: CallDirection;
  channel: CallChannel;

  durationSeconds: number;
  /** ISO timestamp */
  timestamp: string;

  isRecorded: boolean;
  hasVoicemail: boolean;
  autoReplySent?: boolean;
}

export interface Voicemail {
  id: string;
  callId?: string;
  contactId?: string;
  phoneNumber: string;

  durationSeconds: number;
  timestamp: string;

  transcript: string;
  savedToATS: boolean;
  consultantNotified: boolean;
}

export interface ActiveCall {
  contactId?: string;
  phoneNumber: string;
  displayName: string;
  displaySubtitle: string;
  startedAt: number;
  isRecording: boolean;
}
