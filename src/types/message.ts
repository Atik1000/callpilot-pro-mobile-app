export type MessageChannel = 'whatsapp' | 'sms';

export type MessageType = 'text' | 'image' | 'file' | 'system';

export type MessageDeliveryStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export interface Message {
  id: string;
  conversationId: string;

  sender: 'user' | 'contact' | 'system';

  channel: MessageChannel;
  type: MessageType;

  /** Bold heading inside a bubble (e.g. "Document request") */
  title?: string;
  content?: string;
  attachmentUri?: string;
  attachmentName?: string;
  attachmentKind?: 'photo' | 'document';

  timestamp: string;

  status?: MessageDeliveryStatus;
  isTemplate?: boolean;
  savedToATS?: boolean;
  /** Dot colour for system notices */
  systemTone?: 'success' | 'warning';
}

export interface Conversation {
  id: string;
  contactId: string;
  channel: MessageChannel;
  lastMessagePreview: string;
  lastMessageAt: string;
  unreadCount: number;
}
