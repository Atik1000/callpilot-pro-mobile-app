import { AppAlert } from '../types';
import { todayAt } from './constants';
import { CONTACT_IDS } from './mockContacts';
import { CONVERSATION_IDS } from './mockMessages';

export const mockAlerts: AppAlert[] = [
  {
    id: 'alert-1',
    kind: 'ai-suggestion',
    title: 'Voice command: send document request?',
    description:
      'From your call with J. Smith at 10:42. Not certain enough to send automatically.',
    timestamp: todayAt(10, 45),
    status: 'new',
    requiresConfirmation: true,
    relatedContactId: CONTACT_IDS.jSmith,
    relatedConversationId: CONVERSATION_IDS.jSmithWhatsApp,
  },
  {
    id: 'alert-2',
    kind: 'shift-fill',
    title: 'Shift fill: 3 replied yes',
    description:
      'Warehouse Operative · Northgate Logistics · Monday. Listed in the order they replied.',
    timestamp: todayAt(10, 30),
    status: 'new',
    relatedContactId: CONTACT_IDS.mReid,
  },
  {
    id: 'alert-3',
    kind: 'documents',
    title: 'Documents received',
    description:
      'K. Lee sent 2 documents on WhatsApp. Saved to the ATS record, ready to check.',
    timestamp: todayAt(10, 10),
    status: 'new',
    relatedContactId: CONTACT_IDS.kLee,
  },
  {
    id: 'alert-4',
    kind: 'missed-call',
    title: 'Missed call: A. Brown',
    description:
      'Call-back task added in the ATS. Automatic WhatsApp reply sent.',
    timestamp: todayAt(9, 40),
    status: 'new',
    relatedContactId: CONTACT_IDS.aBrown,
  },
  {
    id: 'alert-5',
    kind: 'client-order',
    title: 'Client order',
    description:
      'New order email from Brightside Care in the bookings mailbox.',
    timestamp: todayAt(8, 50),
    status: 'new',
    relatedContactId: CONTACT_IDS.aBrown,
  },
];
