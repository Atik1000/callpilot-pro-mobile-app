import { ATSActivity, ATSDocument } from '../types';
import { contactService } from './contactService';

/**
 * ATS data rides on the contact record endpoint
 * (GET /jigsaw/contacts/{uid}/ returns documents + activity inline).
 * Prefer contactService.getContactRecord when you need all three at once.
 */
export const atsService = {
  async getDocuments(contactId: string): Promise<ATSDocument[]> {
    const record = await contactService.getContactRecord(contactId);
    return record?.documents ?? [];
  },

  async getActivity(contactId: string): Promise<ATSActivity[]> {
    const record = await contactService.getContactRecord(contactId);
    return record?.activity ?? [];
  },
};
