export type AlertKind =
  | 'ai-suggestion'
  | 'shift-fill'
  | 'documents'
  | 'missed-call'
  | 'client-order';

export type AlertStatus = 'new' | 'actioned' | 'dismissed';

export interface AppAlert {
  id: string;
  kind: AlertKind;
  title: string;
  description: string;
  timestamp: string;
  status: AlertStatus;
  /** Server-side read flag (web parity: All vs Unread). */
  isRead?: boolean;
  /** AI suggestions require explicit confirmation before mock execution */
  requiresConfirmation?: boolean;
  relatedContactId?: string;
  relatedConversationId?: string;
}
