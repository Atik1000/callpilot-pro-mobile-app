export type ATSDocumentStatus = 'working' | 'waiting' | 'received';

export interface ATSDocument {
  id: string;
  contactId: string;
  name: string;
  status: ATSDocumentStatus;
}

export type ATSActivityType = 'call' | 'message' | 'voicemail' | 'note';

export interface ATSActivity {
  id: string;
  contactId: string;
  type: ATSActivityType;
  title: string;
  detail: string;
  timestamp: string;
  relatedCallId?: string;
  relatedConversationId?: string;
}

export const atsDocumentStatusLabel: Record<ATSDocumentStatus, string> = {
  working: 'Working',
  waiting: 'Waiting on candidate',
  received: 'Received',
};
