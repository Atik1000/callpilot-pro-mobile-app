import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight, LinearTransition } from 'react-native-reanimated';
import { ContactListItem } from '../../components/contacts/ContactListItem';
import { FavouriteContact } from '../../components/contacts/FavouriteContact';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { Card } from '../../components/ui/Card';
import { Divider } from '../../components/ui/Divider';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { staggerDelay } from '../../components/ui/motion';
import { useCommunications } from '../../hooks/useCommunications';
import { useContacts, useDebouncedValue } from '../../hooks/useContacts';
import { contactService } from '../../services/contactService';
import { colors, spacing } from '../../theme';
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

  const favourites = useMemo(
    () => (contacts ?? []).filter((c) => c.isFavourite),
    [contacts],
  );
  const groups = useMemo(() => groupByLetter(filtered), [filtered]);

  const openContact = (contact: Contact) =>
    router.push({ pathname: '/contact/[id]', params: { id: contact.id } });

  const header = (
    <ScreenHeader
      title="Contacts"
      subtitle="From your ATS"
      showSearch
      searchPlaceholder="Search name, number or email"
      searchValue={search}
      onSearchChange={setSearch}
    />
  );

  return (
    <ScreenContainer header={header} padded={false}>
      {isLoading ? (
        <LoadingState label="Loading contacts…" />
      ) : isError ? (
        <ErrorState
          description="Could not load your ATS contacts."
          onRetry={() => void refetch()}
        />
      ) : (
        <Animated.FlatList
          data={groups}
          keyExtractor={(g) => g.letter}
          itemLayoutAnimation={LinearTransition.springify().damping(19)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View style={styles.tabs}>
                <SegmentedTabs tabs={TABS} selected={tab} onSelect={setTab} />
              </View>
              {favourites.length > 0 && !search ? (
                <View>
                  <SectionHeader title="Favourites" />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.favourites}
                  >
                    {favourites.map((contact, index) => (
                      <Animated.View
                        key={contact.id}
                        entering={FadeInRight.delay(staggerDelay(index, 70)).springify().damping(17)}
                      >
                        <FavouriteContact
                          contact={contact}
                          onPress={() => openContact(contact)}
                        />
                      </Animated.View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              <SectionHeader
                title="All contacts"
                actionLabel={
                  syncing || syncJob?.status === 'running' ? 'Syncing…' : 'Sync ATS'
                }
                onAction={startSync}
              />
              {syncJob ? (
                <Card style={styles.syncBanner}>
                  <AppText
                    variant="caption"
                    color={syncJob.error ? colors.error : colors.success}
                  >
                    {syncJob.status === 'running'
                      ? `Contact sync running · ${syncJob.processed} processed`
                      : `Contact sync ${syncJob.status} · ${syncJob.processed} processed · ${syncJob.created} new · ${syncJob.updated} updated · ${syncJob.skipped} skipped`}
                  </AppText>
                </Card>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title="No contacts found"
              description={
                search
                  ? `Nothing in your ATS matches “${search}”.`
                  : 'Contacts from your ATS will appear here.'
              }
            />
          }
          renderItem={({ item, index: groupIndex }) => (
            <Animated.View
              entering={FadeInDown.delay(staggerDelay(groupIndex, 70)).springify().damping(19)}
            >
              <Card padded={false} style={styles.groupCard}>
                <AppText variant="bodyMedium" style={styles.groupLetter}>
                  {item.letter}
                </AppText>
                <Divider />
                {item.contacts.map((contact, index) => (
                  <View key={contact.id}>
                    {index > 0 ? <Divider /> : null}
                    <ContactListItem
                      contact={contact}
                      onPress={() => openContact(contact)}
                      onCall={() => startCall(contact.phone, contact)}
                      onMessage={() => openConversation(contact, 'whatsapp')}
                    />
                  </View>
                ))}
              </Card>
            </Animated.View>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabs: {
    marginTop: spacing.lg,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  favourites: {
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  groupCard: {
    marginBottom: spacing.md,
  },
  syncBanner: {
    marginBottom: spacing.md,
  },
  groupLetter: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
