import { Call, Voicemail } from '../types';
import { todayAt, yesterdayAt } from './constants';
import { CONTACT_IDS, UNKNOWN_NUMBER } from './mockContacts';

export const mockCalls: Call[] = [
  {
    id: 'call-1',
    contactId: CONTACT_IDS.jSmith,
    phoneNumber: '07700 900321',
    direction: 'outgoing',
    channel: 'business',
    durationSeconds: 252, // 4:12
    timestamp: todayAt(10, 42),
    isRecorded: true,
    hasVoicemail: false,
  },
  {
    id: 'call-2',
    contactId: CONTACT_IDS.aBrown,
    phoneNumber: '020 7946 0812',
    direction: 'incoming',
    channel: 'business',
    durationSeconds: 125, // 2:05
    timestamp: todayAt(9, 58),
    isRecorded: false,
    hasVoicemail: false,
  },
  {
    id: 'call-3',
    phoneNumber: UNKNOWN_NUMBER,
    direction: 'missed',
    channel: 'business',
    durationSeconds: 0,
    timestamp: todayAt(9, 21),
    isRecorded: false,
    hasVoicemail: false,
    autoReplySent: true,
  },
  {
    id: 'call-4',
    contactId: CONTACT_IDS.kLee,
    phoneNumber: '07700 900456',
    direction: 'outgoing',
    channel: 'whatsapp',
    durationSeconds: 91, // 1:31
    timestamp: yesterdayAt(15, 12),
    isRecorded: false,
    hasVoicemail: false,
  },
  {
    id: 'call-5',
    contactId: CONTACT_IDS.mReid,
    phoneNumber: '07700 900789',
    direction: 'missed',
    channel: 'business',
    durationSeconds: 0,
    timestamp: todayAt(8, 15),
    isRecorded: false,
    hasVoicemail: true,
  },
];

export const mockVoicemails: Voicemail[] = [
  {
    id: 'vm-1',
    callId: 'call-5',
    contactId: CONTACT_IDS.mReid,
    phoneNumber: '07700 900789',
    durationSeconds: 48,
    timestamp: todayAt(8, 15),
    transcript:
      "Hi, it's Mark from Northgate Logistics. We're short two drivers for Monday's early shift — can you call me back this morning? Thanks.",
    savedToATS: true,
    consultantNotified: true,
  },
  {
    id: 'vm-2',
    contactId: CONTACT_IDS.jSmith,
    phoneNumber: '07700 900321',
    durationSeconds: 22,
    timestamp: yesterdayAt(17, 40),
    transcript:
      "Hi, it's Jordan. Just checking if you got my photo — let me know if you need anything else for the record.",
    savedToATS: true,
    consultantNotified: false,
  },
];
