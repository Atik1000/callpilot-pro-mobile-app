import { ATSActivity, ATSDocument } from '../types';
import { todayAt, yesterdayAt } from './constants';
import { CONTACT_IDS } from './mockContacts';
import { CONVERSATION_IDS } from './mockMessages';

export const mockDocuments: ATSDocument[] = [
  {
    id: 'doc-1',
    contactId: CONTACT_IDS.jSmith,
    name: 'Right to work',
    status: 'working',
  },
  {
    id: 'doc-2',
    contactId: CONTACT_IDS.jSmith,
    name: 'Forklift certificate',
    status: 'waiting',
  },
  {
    id: 'doc-3',
    contactId: CONTACT_IDS.kLee,
    name: 'Right to work',
    status: 'received',
  },
  {
    id: 'doc-4',
    contactId: CONTACT_IDS.kLee,
    name: 'Forklift certificate',
    status: 'received',
  },
];

export const mockActivity: ATSActivity[] = [
  {
    id: 'act-1',
    contactId: CONTACT_IDS.jSmith,
    type: 'call',
    title: 'Outgoing call 4:12',
    detail: 'Recorded · Transcript saved · 10:42',
    timestamp: todayAt(10, 42),
    relatedCallId: 'call-1',
  },
  {
    id: 'act-2',
    contactId: CONTACT_IDS.jSmith,
    type: 'message',
    title: 'WhatsApp: document request',
    detail: 'Delivered and read · 10:44',
    timestamp: todayAt(10, 44),
    relatedConversationId: CONVERSATION_IDS.jSmithWhatsApp,
  },
  {
    id: 'act-3',
    contactId: CONTACT_IDS.aBrown,
    type: 'call',
    title: 'Incoming call 2:05',
    detail: 'Business line · 09:58',
    timestamp: todayAt(9, 58),
    relatedCallId: 'call-2',
  },
  {
    id: 'act-4',
    contactId: CONTACT_IDS.kLee,
    type: 'message',
    title: 'WhatsApp: 2 documents received',
    detail: 'Saved to ATS record · 10:10',
    timestamp: todayAt(10, 10),
  },
  {
    id: 'act-5',
    contactId: CONTACT_IDS.mReid,
    type: 'voicemail',
    title: 'Voicemail 0:48',
    detail: 'Transcript saved · 08:15',
    timestamp: todayAt(8, 15),
  },
  {
    id: 'act-6',
    contactId: CONTACT_IDS.kLee,
    type: 'call',
    title: 'WhatsApp call 1:31',
    detail: 'Yesterday',
    timestamp: yesterdayAt(15, 12),
    relatedCallId: 'call-4',
  },
];
