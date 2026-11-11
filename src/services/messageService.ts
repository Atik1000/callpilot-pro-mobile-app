import { Contact, Message, MessageChannel } from '../types';
import { mockConversations, mockMessages } from '../data/mockMessages';
import { jigsaw } from './api';
import { contactService } from './contactService';
import { SERVICE_MODE, mockDelay } from './config';
import {
  ApiMessage,
  isPhoneConversationKey,
  mapMessage,
  MESSAGE_STATUS_PUBLIC,
  parseConversationId,
} from './mappers';

export interface Inbox {
  /** All messages, oldest first. */
  messages: Message[];
  /** Contacts for every conversation, keyed by id. */
  contacts: Record<string, Contact>;
}

export interface SendMessageInput {
  conversationId: string;
  body: string;
  /** Approved template slug (e.g. "document_request"), like the web picker. */
  template?: string;
}

const liveMessageService = {
  async getInbox(): Promise<Inbox> {
    const data = await jigsaw<{ results: ApiMessage[] }>('messages/?limit=500');
    const messages = (data.results ?? [])
      .map(mapMessage)
      .filter((m): m is Message => m !== null)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Resolve the (few) conversation contacts so names render even when the
    // contact book page does not include them.
    const contactIds = [
      ...new Set(messages.map((m) => parseConversationId(m.conversationId).contactId)),
    ]
      // Number-only conversations have no ATS record to resolve.
      .filter((id) => !isPhoneConversationKey(id))
      .slice(0, 25);
    const resolved = await Promise.all(
      contactIds.map((id) => contactService.getContactById(id)),
    );
    const contacts: Record<string, Contact> = {};
    for (const contact of resolved) {
      if (contact) contacts[contact.id] = contact;
    }
    return { messages, contacts };
  },

  /**
   * Sends through the CallPilot pipeline (WhatsApp with SMS fallback is
   * decided server-side). Returns the delivery status the API reports.
   */
  async sendMessage({ conversationId, body, template }: SendMessageInput): Promise<Message['status']> {
    const { contactId } = parseConversationId(conversationId);
    const target = isPhoneConversationKey(contactId)
      ? { to_number: contactId }
      : { contact: contactId };
    const response = await jigsaw<{ status?: string; uid?: string }>('messages/', 'POST', {
      ...target,
      body,
      ...(template ? { template } : {}),
    });
    return MESSAGE_STATUS_PUBLIC[response.status ?? 'queued'] ?? 'sent';
  },

  /** AI reply suggestion for a conversation (web "Suggest reply"). */
  async suggestReply(contactId: string): Promise<string | undefined> {
    const response = await jigsaw<{ reply?: string }>('messages/suggest-reply/', 'POST', {
      contact_uid: contactId,
    });
    return response.reply || undefined;
  },
};

const mockMessageService: typeof liveMessageService = {
  async getInbox() {
    await mockDelay();
    void mockConversations;
    return { messages: mockMessages, contacts: {} };
  },
  async sendMessage() {
    await mockDelay(300);
    return 'delivered';
  },
  async suggestReply() {
    await mockDelay(400);
    return 'Thanks for sending these over — I will review them and get back to you shortly.';
  },
};

export const messageService =
  SERVICE_MODE === 'live' ? liveMessageService : mockMessageService;

export type { MessageChannel };
