import {
  ATSActivity,
  ATSDocument,
  AppAlert,
  Call,
  Contact,
  ContactCategory,
  Conversation,
  Message,
  MessageChannel,
  MessageDeliveryStatus,
  Voicemail,
} from '../types';

/* ---------- raw API shapes (as returned by the CallPilot API) ---------- */

export interface ApiContact {
  uid: string;
  name: string;
  kind: string;
  phone: string;
  email?: string;
  ats_id?: string;
  status?: string;
  favourite?: boolean;
  skills?: string[];
  metadata?: { source?: string; company?: string };
  created_at?: string;
  documents?: ApiDocument[];
  activity?: ApiActivity[];
}

export interface ApiDocument {
  uid: string;
  contact: string;
  document_type: string;
  filename?: string;
  status: string;
  received_at?: string;
  created_at?: string;
}

export interface ApiActivity {
  uid: string;
  kind: string;
  status?: string;
  payload?: {
    summary?: string;
    command?: string;
    transcript_excerpt?: string;
    [key: string]: unknown;
  };
  created_at?: string;
}

export interface ApiCall {
  uid: string;
  direction: 'inbound' | 'outbound' | string;
  number: string;
  status: string;
  started_at: string;
  duration: number;
  has_voicemail?: boolean;
  contact_uid?: string | null;
  contact?: ApiContact | null;
  /** Name the dashboard shows for the caller. */
  contact_name?: string | null;
  hangup_cause?: string;
}

export interface ApiMessage {
  uid: string;
  contact?: string | null;
  to_number?: string;
  body: string;
  channel: string;
  direction: 'inbound' | 'outbound' | string;
  status: string;
  template?: string;
  attachments?: { filename?: string; url?: string }[];
  created_at: string;
}

export interface ApiVoicemail {
  uid: string;
  contact_uid?: string | null;
  number?: string;
  from_number?: string;
  /** Field name used by the dashboard's voicemail feed. */
  from?: string;
  duration?: number;
  transcript?: string;
  read?: boolean;
  is_read?: boolean;
  created_at?: string;
}

export interface ApiAlert {
  uid: string;
  title: string;
  body: string;
  kind: string;
  read: boolean;
  action?: string;
  payload?: { contact_uid?: string; command?: string; [key: string]: unknown };
  resolved_at?: string | null;
  created_at: string;
}

/* --------------------------------- mappers -------------------------------- */

/**
 * The API returns ISO timestamps with microseconds and mixed suffixes
 * ("…41.564646+00:00" and "…48.821405Z"). Hermes (the phone's JS engine)
 * only reliably parses millisecond precision, and the mixed suffixes break
 * string-based sorting, so every timestamp is normalised here once.
 */
function toIso(value: string | null | undefined): string {
  if (!value) return new Date().toISOString();
  const date = new Date(value.replace(/\.(\d{3})\d+/, '.$1'));
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function toCategory(kind: string): ContactCategory {
  if (kind === 'candidate') return 'candidate';
  if (kind === 'supplier') return 'supplier';
  return 'client';
}

export function mapContact(api: ApiContact): Contact {
  return {
    id: api.uid,
    name: api.name,
    phone: api.phone ?? '',
    email: api.email || undefined,
    category: toCategory(api.kind),
    company: api.metadata?.company,
    jobTitle: api.skills?.[0],
    isFavourite: Boolean(api.favourite),
    atsId: api.ats_id || undefined,
    atsStatus: api.status || undefined,
    lastContact: api.created_at ? toIso(api.created_at) : undefined,
  };
}

/** Contact as returned by production `/contacts/` (dashboard phone page). */
export interface ApiOrgContact {
  id: number | string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  phone?: string | null;
  email?: string;
  company_name?: string;
  origin?: string | null;
  external_id?: string | null;
  candidate_id?: string | null;
  status?: string;
  created_at?: string;
}

export function mapOrgContact(api: ApiOrgContact): Contact {
  const name =
    api.full_name ||
    [api.first_name, api.last_name].filter(Boolean).join(' ').trim() ||
    api.email ||
    api.phone ||
    'Unknown contact';
  return {
    id: String(api.id),
    name,
    phone: api.phone ?? '',
    email: api.email || undefined,
    category: toCategory(api.origin ?? (api.candidate_id ? 'candidate' : 'contact')),
    company: api.company_name || undefined,
    isFavourite: false,
    atsId: api.candidate_id || api.external_id || undefined,
    atsStatus: api.status || undefined,
    lastContact: api.created_at ? toIso(api.created_at) : undefined,
  };
}

const DOC_STATUS: Record<string, ATSDocument['status']> = {
  received: 'received',
  received_unverified: 'received',
  verified: 'working',
  working: 'working',
  requested: 'waiting',
  waiting: 'waiting',
};

function humanize(value: string): string {
  const cleaned = value.replace(/[._-]+/g, ' ').trim();
  return cleaned ? cleaned[0].toUpperCase() + cleaned.slice(1) : value;
}

export function mapDocument(api: ApiDocument): ATSDocument {
  return {
    id: api.uid,
    contactId: api.contact,
    name:
      api.document_type && api.document_type !== 'unclassified'
        ? humanize(api.document_type)
        : (api.filename ?? 'Document'),
    status: DOC_STATUS[api.status] ?? 'waiting',
  };
}

export function mapActivity(api: ApiActivity, contactId: string): ATSActivity {
  const kind = api.kind ?? '';
  const type: ATSActivity['type'] = kind.includes('call')
    ? 'call'
    : kind.includes('voicemail')
      ? 'voicemail'
      : kind.includes('message') || kind.includes('sms') || kind.includes('whatsapp')
        ? 'message'
        : 'note';
  return {
    id: api.uid,
    contactId,
    type,
    title: humanize(kind) || 'Activity',
    detail:
      api.payload?.summary ??
      api.payload?.transcript_excerpt ??
      (api.status ? humanize(api.status) : ''),
    timestamp: toIso(api.created_at),
  };
}

export function mapCall(api: ApiCall, missed: boolean): Call {
  return {
    id: api.uid,
    contactId: api.contact?.uid ?? api.contact_uid ?? undefined,
    contactName: api.contact_name || api.contact?.name || undefined,
    phoneNumber: api.number ?? '',
    direction: missed ? 'missed' : api.direction === 'inbound' ? 'incoming' : 'outgoing',
    channel: 'business',
    durationSeconds: api.duration ?? 0,
    timestamp: toIso(api.started_at),
    isRecorded: false, // recording metadata is not exposed per call yet
    hasVoicemail: Boolean(api.has_voicemail),
  };
}

export const MESSAGE_STATUS_PUBLIC: Record<string, MessageDeliveryStatus> = {
  queued: 'pending',
  sending: 'pending',
  observed: 'sent',
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed',
  needs_review: 'failed',
};

function toChannel(channel: string): MessageChannel {
  return channel === 'whatsapp' ? 'whatsapp' : 'sms';
}

/** Conversation ids encode contact + channel so chats open with no history. */
export function conversationId(contactId: string, channel: MessageChannel): string {
  return `${contactId}__${channel}`;
}

/**
 * Messages from numbers with no ATS contact are keyed by the number itself
 * (the web dashboard shows these too). Such ids start with "+".
 */
export function isPhoneConversationKey(contactId: string): boolean {
  return contactId.startsWith('+');
}

export function parseConversationId(
  id: string,
): { contactId: string; channel: MessageChannel } {
  const [contactId, channel] = id.split('__');
  return { contactId, channel: channel === 'whatsapp' ? 'whatsapp' : 'sms' };
}

export function mapMessage(api: ApiMessage): Message | null {
  // Conversations are keyed by the ATS contact when there is one,
  // otherwise by the phone number — matching the web dashboard.
  const key = api.contact ?? api.to_number;
  if (!key) return null;
  const channel = toChannel(api.channel);
  const attachment = api.attachments?.[0];
  return {
    id: api.uid,
    conversationId: conversationId(key, channel),
    sender: api.direction === 'inbound' ? 'contact' : 'user',
    channel,
    type: attachment ? 'image' : 'text',
    title: api.template === 'document_request' ? 'Document request' : undefined,
    content: api.body,
    attachmentName: attachment?.filename,
    attachmentUri: attachment?.url,
    attachmentKind: 'photo',
    timestamp: toIso(api.created_at),
    status:
      api.direction === 'inbound' ? undefined : (MESSAGE_STATUS_PUBLIC[api.status] ?? 'sent'),
    isTemplate: Boolean(api.template),
  };
}

export function buildConversations(messages: Message[]): Conversation[] {
  const byId = new Map<string, Conversation>();
  for (const message of messages) {
    const existing = byId.get(message.conversationId);
    const preview =
      message.type === 'image'
        ? `Photo · ${message.attachmentName ?? 'attachment'}`
        : (message.content ?? '');
    if (!existing || message.timestamp > existing.lastMessageAt) {
      byId.set(message.conversationId, {
        id: message.conversationId,
        contactId: parseConversationId(message.conversationId).contactId,
        channel: message.channel,
        lastMessagePreview: preview,
        lastMessageAt: message.timestamp,
        // The API has no per-message read flag yet: treat a conversation
        // whose latest message is inbound as unread.
        unreadCount: message.sender === 'contact' ? 1 : 0,
      });
    }
  }
  return [...byId.values()].sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export function mapVoicemail(api: ApiVoicemail): Voicemail {
  return {
    id: api.uid,
    contactId: api.contact_uid ?? undefined,
    phoneNumber: api.number ?? api.from_number ?? api.from ?? '',
    durationSeconds: api.duration ?? 0,
    timestamp: toIso(api.created_at),
    transcript: api.transcript ?? 'Transcript not available yet.',
    savedToATS: Boolean(api.contact_uid),
    consultantNotified: Boolean(api.read ?? api.is_read),
  };
}

export function mapAlert(api: ApiAlert): AppAlert {
  const needsDecision =
    !api.resolved_at && (api.kind.includes('voice') || Boolean(api.payload?.command));
  return {
    id: api.uid,
    kind:
      api.kind.includes('voice') || api.kind.includes('decision')
        ? 'ai-suggestion'
        : api.kind.includes('document')
          ? 'documents'
          : api.kind.includes('missed')
            ? 'missed-call'
            : api.kind.includes('order')
              ? 'client-order'
              : 'shift-fill',
    title: api.title,
    description: api.body,
    timestamp: toIso(api.created_at),
    status: api.resolved_at ? 'actioned' : 'new',
    isRead: Boolean(api.read),
    requiresConfirmation: needsDecision,
    relatedContactId: api.payload?.contact_uid,
  };
}
