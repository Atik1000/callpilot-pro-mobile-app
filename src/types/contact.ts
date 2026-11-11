import type { ATSDocument } from './ats';

export type ContactCategory = 'candidate' | 'client' | 'supplier';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;

  category: ContactCategory;
  company?: string;
  jobTitle?: string;
  location?: string;

  isFavourite: boolean;

  atsId?: string;
  atsStatus?: string;
  atsStatusDetail?: string;
  openJobs?: number;
  lastContact?: string;
  documents?: ATSDocument[];
}

export const contactCategoryLabel: Record<ContactCategory, string> = {
  candidate: 'Candidate',
  client: 'Client contact',
  supplier: 'Supplier',
};
