import { Conversation, Message } from '../types';
import { todayAt, yesterdayAt } from './constants';
import { CONTACT_IDS } from './mockContacts';

export const CONVERSATION_IDS = {
  jSmithWhatsApp: 'conv-j-smith-wa',
  kLeeSms: 'conv-k-lee-sms',
  aBrownWhatsApp: 'conv-a-brown-wa',
  mReidWhatsApp: 'conv-m-reid-wa',
} as const;

export const mockConversations: Conversation[] = [
  {
    id: CONVERSATION_IDS.jSmithWhatsApp,
    contactId: CONTACT_IDS.jSmith,
    channel: 'whatsapp',
    lastMessagePreview: 'Photo · saved to record',
    lastMessageAt: todayAt(10, 51),
    unreadCount: 1,
  },
  {
    id: CONVERSATION_IDS.kLeeSms,
    contactId: CONTACT_IDS.kLee,
    channel: 'sms',
    lastMessagePreview: 'Yes, I can do Monday',
    lastMessageAt: todayAt(10, 20),
    unreadCount: 1,
  },
  {
    id: CONVERSATION_IDS.aBrownWhatsApp,
    contactId: CONTACT_IDS.aBrown,
    channel: 'whatsapp',
    lastMessagePreview: 'Thanks, terms received',
    lastMessageAt: todayAt(9, 12),
    unreadCount: 0,
  },
  {
    id: CONVERSATION_IDS.mReidWhatsApp,
    contactId: CONTACT_IDS.mReid,
    channel: 'whatsapp',
    lastMessagePreview: 'Confirmed for the morning run',
    lastMessageAt: yesterdayAt(16, 48),
    unreadCount: 0,
  },
];

export const mockMessages: Message[] = [
  // J. Smith — WhatsApp (matches the Chat Details design page)
  {
    id: 'msg-js-1',
    conversationId: CONVERSATION_IDS.jSmithWhatsApp,
    sender: 'user',
    channel: 'whatsapp',
    type: 'text',
    title: 'Document request',
    content:
      'Please reply with a photo of your right to work and forklift certificate.',
    timestamp: todayAt(10, 44),
    status: 'read',
    isTemplate: true,
  },
  {
    id: 'msg-js-2',
    conversationId: CONVERSATION_IDS.jSmithWhatsApp,
    sender: 'contact',
    channel: 'whatsapp',
    type: 'image',
    attachmentName: 'IMG_0412.jpg',
    attachmentKind: 'photo',
    timestamp: todayAt(10, 51),
  },
  {
    id: 'msg-js-3',
    conversationId: CONVERSATION_IDS.jSmithWhatsApp,
    sender: 'system',
    channel: 'whatsapp',
    type: 'system',
    content: 'Saved to ATS record as Right to work',
    timestamp: todayAt(10, 52),
    systemTone: 'success',
    savedToATS: true,
  },
  {
    id: 'msg-js-4',
    conversationId: CONVERSATION_IDS.jSmithWhatsApp,
    sender: 'user',
    channel: 'whatsapp',
    type: 'text',
    content: "Thanks, got it. We'll call you shortly.",
    timestamp: todayAt(10, 53),
    status: 'delivered',
  },
  {
    id: 'msg-js-5',
    conversationId: CONVERSATION_IDS.jSmithWhatsApp,
    sender: 'system',
    channel: 'sms',
    type: 'system',
    content: 'Sent by SMS: WhatsApp not delivered',
    timestamp: todayAt(10, 53),
    systemTone: 'warning',
  },

  // K. Lee — SMS
  {
    id: 'msg-kl-1',
    conversationId: CONVERSATION_IDS.kLeeSms,
    sender: 'user',
    channel: 'sms',
    type: 'text',
    content: 'Hi Kay, can you cover the Monday early shift at Northgate?',
    timestamp: todayAt(10, 5),
    status: 'delivered',
  },
  {
    id: 'msg-kl-2',
    conversationId: CONVERSATION_IDS.kLeeSms,
    sender: 'contact',
    channel: 'sms',
    type: 'text',
    content: 'Yes, I can do Monday',
    timestamp: todayAt(10, 20),
  },

  // A. Brown — WhatsApp
  {
    id: 'msg-ab-1',
    conversationId: CONVERSATION_IDS.aBrownWhatsApp,
    sender: 'user',
    channel: 'whatsapp',
    type: 'text',
    content: 'Morning Alex — terms of business attached for the two new roles.',
    timestamp: todayAt(8, 55),
    status: 'read',
  },
  {
    id: 'msg-ab-2',
    conversationId: CONVERSATION_IDS.aBrownWhatsApp,
    sender: 'contact',
    channel: 'whatsapp',
    type: 'text',
    content: 'Thanks, terms received',
    timestamp: todayAt(9, 12),
  },

  // M. Reid — WhatsApp
  {
    id: 'msg-mr-1',
    conversationId: CONVERSATION_IDS.mReidWhatsApp,
    sender: 'contact',
    channel: 'whatsapp',
    type: 'text',
    content: 'Confirmed for the morning run',
    timestamp: yesterdayAt(16, 48),
  },
];
