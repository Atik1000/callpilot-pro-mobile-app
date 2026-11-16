import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { AlertCircle, Check } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ContactListItem } from '../../components/contacts/ContactListItem';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { useCommunications } from '../../hooks/useCommunications';
import { useContacts, useDebouncedValue } from '../../hooks/useContacts';
import { contactService } from '../../services/contactService';
import { colors, fontFamily, spacing } from '../../theme';
import { Contact, ContactCategory } from '../../types';

type ContactsTab = 'all' | ContactCategory;

const TABS = [
  { key: 'all' as const, label: 'All' },
  { key: 'candidate' as const, label: 'Candidates' },
  { key: 'client' as const, label: 'Clients' },
  { key: 'supplier' as const, label: 'Suppliers' },
];

interface LetterGroup {
  letter: string;
  contacts: Contact[];
}

function groupByLetter(contacts: Contact[]): LetterGroup[] {
  const groups = new Map<string, Contact[]>();
  for (const contact of contacts) {
    const words = contact.name.trim().split(/\s+/);
    const surname = words[words.length - 1] ?? contact.name;
    const letter = (surname[0] ?? '#').toUpperCase();
    const existing = groups.get(letter);
    if (existing) existing.push(contact);
    else groups.set(letter, [contact]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, list]) => ({
      letter,
      contacts: list.sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

export default function ContactsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<ContactsTab>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  // Search runs server-side against the full ATS book (20k+ contacts).
  const { data: contacts, isLoading, isError, refetch } = useContacts(debouncedSearch);
  const { startCall, openConversation } = useCommunications();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  // Last/current ATS sync job for the status banner (web parity).
  const { data: syncJob, refetch: refetchSync } = useQuery({
    queryKey: ['contact-sync'],
    queryFn: () => contactService.getSyncStatus(),
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 5000 : false),
  });

  const startSync = () => {
    if (syncing || syncJob?.status === 'running') return;
    setSyncing(true);
    void contactService
      .syncContacts()
      .then(() => refetchSync())
      .then(() => queryClient.invalidateQueries({ queryKey: ['contacts'] }))
      .finally(() => setSyncing(false));
  };

  const filtered = useMemo(() => {
    let list = contacts ?? [];
    if (tab !== 'all') list = list.filter((c) => c.category === tab);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')) ||
        c.email?.toLowerCase().includes(q) ||
        c.company?.toLowerCase().includes(q),
    );
  }, [contacts, tab, search]);

  const groups = useMemo(() => groupByLetter(filtered), [filtered]);

  const openContact = (contact: Contact) =>
    router.push({ pathname: '/contact/[id]', params: { id: contact.id } });

  const header = (
    <ScreenHeader
      title="Contacts"
      showSearch
      searchPlaceholder="Search name, number or company"
      searchValue={search}
      onSearchChange={setSearch}
    />
  );

  const syncRunning = syncing || syncJob?.status === 'running';
  const syncText = syncRunning
    ? `Syncing with your ATS · ${syncJob?.processed ?? 0} processed`
    : syncJob?.error
      ? `ATS sync failed: ${syncJob.error}`
      : syncJob?.finished_at
        ? `Synced with your ATS · ${new Date(syncJob.finished_at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
        : 'Synced with your ATS';

  return (
    <ScreenContainer header={header} padded={false}>
      {isLoading ? (
        <LoadingState label="Loading contacts…" />
      ) : isError ? (
        <ErrorState description="Could not load your ATS contacts." onRetry={() => void refetch()} />
      ) : (
        <Animated.FlatList
          data={groups}
          keyExtractor={(g) => g.letter}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filters}
              >
                {TABS.map((t) => {
                  const active = t.key === tab;
                  return (
                    <Pressable
                      key={t.key}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      onPress={() => setTab(t.key)}
                      style={[styles.filter, active && styles.filterActive]}
                    >
                      <AppText
                        style={styles.filterText}
                        color={active ? colors.white : colors.black}
                      >
                        {t.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={styles.syncRow}>
                {syncJob?.error ? (
                  <AlertCircle size={14} color={colors.red} />
                ) : (
                  <Check size={14} color={colors.mint} strokeWidth={2.6} />
                )}
                <AppText variant="caption" numberOfLines={1} style={styles.syncText}>
                  {syncText}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  onPress={startSync}
                  disabled={syncRunning}
                  hitSlop={8}
                >
                  <AppText style={styles.syncAction} color={colors.aiBlue}>
                    {syncRunning ? 'Syncing…' : 'Sync now'}
                  </AppText>
                </Pressable>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title="No contacts found"
              description={
                search ? `Nothing in your ATS matches “${search}”.` : 'Contacts from your ATS will appear here.'
              }
            />
          }
          renderItem={({ item }) => (
            <View>
              <AppText variant="sectionTitle" style={styles.groupLetter}>
                {item.letter}
              </AppText>
              {item.contacts.map((contact) => (
                <ContactListItem
                  key={contact.id}
                  contact={contact}
                  onPress={() => openContact(contact)}
                  onCall={() => startCall(contact.phone, contact)}
                  onMessage={() => openConversation(contact, 'whatsapp')}
                />
              ))}
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing.xl,
  },
  filters: {
    gap: spacing.sm,
    paddingHorizontal: 20,
    paddingTop: spacing.xs,
  },
  filter: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  filterText: {
    fontFamily: fontFamily.bold,
    fontSize: 13,
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  syncText: {
    flex: 1,
  },
  syncAction: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
  },
  groupLetter: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
});
