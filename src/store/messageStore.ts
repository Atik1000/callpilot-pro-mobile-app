import { create } from 'zustand';
import { Contact, Conversation, Message, MessageChannel } from '../types';
import { messageService } from '../services/messageService';
import { buildConversations, conversationId } from '../services/mappers';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface MessageState {
  status: LoadStatus;
  conversations: Conversation[];
  /** keyed by conversation id */
  messages: Record<string, Message[]>;
  /** Contacts for conversations, keyed by contact id (from the live feed). */
  conversationContacts: Record<string, Contact>;
  /** Conversation ids the user has opened in this session. */
  readConversationIds: Record<string, true>;

  load: () => Promise<void>;
  markConversationRead: (conversationId: string) => void;
  sendMessage: (conversationId: string, content: string) => void;
  /** Sends the approved document-request template (web parity). */
  sendDocumentRequest: (conversationId: string) => void;
  addAttachment: (conversationId: string, name: string, uri?: string) => void;
  /** Returns the conversation id for the contact/channel, creating it if new. */
  ensureConversation: (contactId: string, channel: MessageChannel) => string;
}

function applyReadState(
  conversations: Conversation[],
  readIds: Record<string, true>,
): Conversation[] {
  return conversations.map((c) =>
    readIds[c.id] ? { ...c, unreadCount: 0 } : c,
  );
}

export const useMessageStore = create<MessageState>((set, get) => ({
  status: 'idle',
  conversations: [],
  messages: {},
  conversationContacts: {},
  readConversationIds: {},

  load: async () => {
    if (get().status === 'loading') return;
    set({ status: get().status === 'ready' ? 'ready' : 'loading' });
    try {
      const inbox = await messageService.getInbox();
      const messages: Record<string, Message[]> = {};
      for (const m of inbox.messages) {
        (messages[m.conversationId] ??= []).push(m);
      }
      set((s) => ({
        conversations: applyReadState(
          buildConversations(inbox.messages),
          s.readConversationIds,
        ),
        messages,
        conversationContacts: { ...s.conversationContacts, ...inbox.contacts },
        status: 'ready',
      }));
    } catch {
      if (get().status !== 'ready') set({ status: 'error' });
    }
  },

  markConversationRead: (id) =>
    set((s) => ({
      readConversationIds: { ...s.readConversationIds, [id]: true },
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, unreadCount: 0 } : c,
      ),
    })),

  sendMessage: (id, content) => {
    const body = content.trim();
    if (!body) return;
    const conversation = get().conversations.find((c) => c.id === id);
    const channel: MessageChannel = conversation?.channel ?? 'whatsapp';
    const message: Message = {
      id: `msg-local-${Date.now()}`,
      conversationId: id,
      sender: 'user',
      channel,
      type: 'text',
      content: body,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    set((s) => ({
      messages: { ...s.messages, [id]: [...(s.messages[id] ?? []), message] },
      conversations: upsertConversationPreview(s.conversations, id, body, message, channel),
    }));
    void messageService
      .sendMessage({ conversationId: id, body })
      .then((status) => {
        set((s) => ({
          messages: {
            ...s.messages,
            [id]: (s.messages[id] ?? []).map((m) =>
              m.id === message.id ? { ...m, status } : m,
            ),
          },
        }));
      })
      .catch(() => {
        set((s) => ({
          messages: {
            ...s.messages,
            [id]: (s.messages[id] ?? []).map((m) =>
              m.id === message.id ? { ...m, status: 'failed' } : m,
            ),
          },
        }));
      });
  },

  sendDocumentRequest: (id) => {
    const conversation = get().conversations.find((c) => c.id === id);
    const channel: MessageChannel = conversation?.channel ?? 'whatsapp';
    const message: Message = {
      id: `msg-local-${Date.now()}`,
      conversationId: id,
      sender: 'user',
      channel,
      type: 'text',
      title: 'Document request',
      content: 'Document request template sent.',
      timestamp: new Date().toISOString(),
      status: 'pending',
      isTemplate: true,
    };
    set((s) => ({
      messages: { ...s.messages, [id]: [...(s.messages[id] ?? []), message] },
      conversations: upsertConversationPreview(
        s.conversations,
        id,
        'Document request',
        message,
        channel,
      ),
    }));
    void messageService
      .sendMessage({ conversationId: id, body: '', template: 'document_request' })
      .then((status) => {
        set((s) => ({
          messages: {
            ...s.messages,
            [id]: (s.messages[id] ?? []).map((m) =>
              m.id === message.id ? { ...m, status } : m,
            ),
          },
        }));
      })
      .catch(() => {
        set((s) => ({
          messages: {
            ...s.messages,
            [id]: (s.messages[id] ?? []).map((m) =>
              m.id === message.id ? { ...m, status: 'failed' } : m,
            ),
          },
        }));
      });
  },

  addAttachment: (id, name, uri) => {
    const conversation = get().conversations.find((c) => c.id === id);
    const message: Message = {
      id: `msg-local-${Date.now()}`,
      conversationId: id,
      sender: 'user',
      channel: conversation?.channel ?? 'whatsapp',
      type: 'image',
      attachmentName: name,
      attachmentUri: uri,
      attachmentKind: 'photo',
      timestamp: new Date().toISOString(),
      status: 'sent',
    };
    set((s) => ({
      messages: { ...s.messages, [id]: [...(s.messages[id] ?? []), message] },
      conversations: upsertConversationPreview(
        s.conversations,
        id,
        `Photo · ${name}`,
        message,
        message.channel,
      ),
    }));
  },

  ensureConversation: (contactId, channel) => {
    const id = conversationId(contactId, channel);
    const existing = get().conversations.find((c) => c.id === id);
    if (existing) return id;
    const conversation: Conversation = {
      id,
      contactId,
      channel,
      lastMessagePreview: 'New conversation',
      lastMessageAt: new Date().toISOString(),
      unreadCount: 0,
    };
    set((s) => ({
      conversations: [conversation, ...s.conversations],
      messages: { ...s.messages, [id]: s.messages[id] ?? [] },
    }));
    return id;
  },
}));

function upsertConversationPreview(
  conversations: Conversation[],
  id: string,
  preview: string,
  message: Message,
  channel: MessageChannel,
): Conversation[] {
  const exists = conversations.some((c) => c.id === id);
  if (!exists) {
    const contactId = id.split('__')[0];
    return [
      {
        id,
        contactId,
        channel,
        lastMessagePreview: preview,
        lastMessageAt: message.timestamp,
        unreadCount: 0,
      },
      ...conversations,
    ];
  }
  return conversations.map((c) =>
    c.id === id
      ? { ...c, lastMessagePreview: preview, lastMessageAt: message.timestamp }
      : c,
  );
}
