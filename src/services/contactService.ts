import { ATSActivity, ATSDocument, Contact } from '../types';
import { mockContacts } from '../data/mockContacts';
import { mockActivity, mockDocuments } from '../data/mockATS';
import { ApiError, apiRequest, jigsaw } from './api';
import { SERVICE_MODE, mockDelay } from './config';
import {
  ApiContact,
  ApiOrgContact,
  mapActivity,
  mapOrgContact,
  mapContact,
  mapDocument,
} from './mappers';

export interface ContactRecord {
  contact: Contact;
  documents: ATSDocument[];
  activity: ATSActivity[];
}

interface ContactListResponse {
  results: ApiContact[];
  count: number;
}

/** ATS contact sync job, as returned by GET/POST /jigsaw/contacts/sync/. */
export interface ContactSyncJob {
  status: string;
  stage?: string;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  error?: string;
  finished_at?: string | null;
}

const CONTACTS_PAGE_SIZE = 300;

/** Production has no /jigsaw/* routes (dev-only); they answer 404 there. */
function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** Production contacts, same request as the dashboard's phone page. */
async function getOrgContacts(q?: string): Promise<Contact[]> {
  const params = new URLSearchParams({ page: '1', page_size: '100' });
  if (q && q.length >= 2) params.set('search', q);
  const data = await apiRequest<unknown>(`/contacts/?${params.toString()}`);
  const list = Array.isArray(data)
    ? data
    : ((data as { results?: unknown[]; contacts?: unknown[] } | null)?.results ??
      (data as { contacts?: unknown[] } | null)?.contacts ??
      []);
  return (list as ApiOrgContact[]).map(mapOrgContact);
}

const liveContactService = {
  /** Lists ATS contacts; `query` searches server-side (name/number/email). */
  async getContacts(query?: string): Promise<Contact[]> {
    const q = query?.trim();
    const params = q && q.length >= 2 ? `&q=${encodeURIComponent(q)}` : '';
    try {
      const data = await jigsaw<ContactListResponse>(
        `contacts/?limit=${CONTACTS_PAGE_SIZE}${params}`,
      );
      return (data.results ?? []).map(mapContact);
    } catch (error) {
      if (!isNotFound(error)) throw error;
      return getOrgContacts(q);
    }
  },

  async getContactById(id: string): Promise<Contact | undefined> {
    try {
      const data = await jigsaw<ApiContact>(`contacts/${encodeURIComponent(id)}/`);
      return mapContact(data);
    } catch (error) {
      if (!isNotFound(error)) return undefined;
      return apiRequest<ApiOrgContact>(`/contacts/${encodeURIComponent(id)}/`)
        .then(mapOrgContact)
        .catch(() => undefined);
    }
  },

  /** Full record: contact + ATS documents + ATS activity in one request. */
  async getContactRecord(id: string): Promise<ContactRecord | undefined> {
    try {
      const data = await jigsaw<ApiContact>(`contacts/${encodeURIComponent(id)}/`);
      return {
        contact: mapContact(data),
        documents: (data.documents ?? []).map(mapDocument),
        activity: (data.activity ?? [])
          .map((a) => mapActivity(a, id))
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
      };
    } catch {
      return undefined;
    }
  },

  /** Toggle the ATS favourite star (web parity). */
  async setFavourite(id: string, favourite: boolean): Promise<void> {
    await jigsaw(`contacts/${encodeURIComponent(id)}/`, 'PATCH', { favourite });
  },

  /** Remove the contact from the CallPilot cache (web parity). */
  async deleteContact(id: string): Promise<void> {
    await jigsaw(`contacts/${encodeURIComponent(id)}/`, 'DELETE');
  },

  /** Kick off a full ATS contact sync; returns the job snapshot. */
  async syncContacts(): Promise<ContactSyncJob | undefined> {
    const data = await jigsaw<{ job?: ContactSyncJob }>('contacts/sync/', 'POST', {});
    return data.job;
  },

  /** Last/current sync job, for the status banner. */
  async getSyncStatus(): Promise<ContactSyncJob | undefined> {
    try {
      const data = await jigsaw<{ job?: ContactSyncJob }>('contacts/sync/');
      return data.job;
    } catch {
      return undefined;
    }
  },
};

const mockContactService: typeof liveContactService = {
  async getContacts(query?: string) {
    await mockDelay();
    const q = query?.trim().toLowerCase();
    if (!q) return mockContacts;
    return mockContacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q),
    );
  },
  async getContactById(id: string) {
    await mockDelay(150);
    return mockContacts.find((c) => c.id === id);
  },
  async getContactRecord(id: string) {
    await mockDelay(200);
    const contact = mockContacts.find((c) => c.id === id);
    if (!contact) return undefined;
    return {
      contact,
      documents: mockDocuments.filter((d) => d.contactId === id),
      activity: mockActivity
        .filter((a) => a.contactId === id)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    };
  },
  async setFavourite() {
    await mockDelay(150);
  },
  async deleteContact() {
    await mockDelay(200);
  },
  async syncContacts() {
    await mockDelay(400);
    return { status: 'completed', processed: 4, created: 0, updated: 4, skipped: 0 };
  },
  async getSyncStatus() {
    await mockDelay(150);
    return { status: 'completed', processed: 4, created: 0, updated: 4, skipped: 0 };
  },
};

export const contactService =
  SERVICE_MODE === 'live' ? liveContactService : mockContactService;
