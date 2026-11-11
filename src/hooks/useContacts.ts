import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Contact } from '../types';
import { contactService } from '../services/contactService';
import { normalizePhone } from '../utils/formatPhone';

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/** ATS contacts; `search` is forwarded to the API (server-side search). */
export function useContacts(search?: string) {
  const query = search?.trim() ?? '';
  return useQuery({
    queryKey: ['contacts', query.toLowerCase()],
    queryFn: () => contactService.getContacts(query || undefined),
    placeholderData: keepPreviousData,
  });
}

export function useContact(id: string | undefined): Contact | undefined {
  const { data } = useContacts();
  const fallback = useQuery({
    queryKey: ['contact', id],
    queryFn: () => contactService.getContactById(id ?? ''),
    enabled: Boolean(id) && !data?.some((c) => c.id === id),
  });
  return useMemo(() => {
    if (!id) return undefined;
    return data?.find((c) => c.id === id) ?? fallback.data ?? undefined;
  }, [data, fallback.data, id]);
}

export function findContactByPhone(
  contacts: Contact[] | undefined,
  phoneNumber: string,
): Contact | undefined {
  const target = normalizePhone(phoneNumber);
  if (!target || target.length < 6 || !contacts) return undefined;
  return contacts.find((c) => {
    const p = normalizePhone(c.phone);
    if (!p) return false;
    return p === target || p.endsWith(target) || target.endsWith(p);
  });
}
