import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { ConversationListItem } from '../../components/messages/ConversationListItem';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { listEnter } from '../../components/ui/motion';
import { useContacts } from '../../hooks/useContacts';
import { useMessageStore } from '../../store/messageStore';
import { spacing } from '../../theme';

type MessagesTab = 'all' | 'whatsapp' | 'sms';

const TABS = [
  { key: 'all' as const, label: 'All' },
  { key: 'whatsapp' as const, label: 'WhatsApp' },
  { key: 'sms' as const, label: 'SMS' },
];

export default function MessagesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<MessagesTab>('all');
  const search = '';
  const { status, conversations, conversationContacts, load } = useMessageStore();
  const { data: contacts, isLoading: contactsLoading, isError, refetch } = useContacts();

  useEffect(() => {
    void load();
  }, [load]);

  const contactById = useMemo(() => {
    const map = new Map((contacts ?? []).map((c) => [c.id, c]));
    for (const [id, contact] of Object.entries(conversationContacts)) {
      if (!map.has(id)) map.set(id, contact);
    }
    return map;
  }, [contacts, conversationContacts]);

  const filtered = useMemo(() => {
    let list = [...conversations].sort((a, b) =>
      b.lastMessageAt.localeCompare(a.lastMessageAt),
    );
    if (tab !== 'all') list = list.filter((c) => c.channel === tab);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const contact = contactById.get(c.contactId);
      return (
        contact?.name.toLowerCase().includes(q) ||
        contact?.company?.toLowerCase().includes(q) ||
        c.lastMessagePreview.toLowerCase().includes(q) ||
        // Number-only conversations are searchable by their number.
        c.contactId.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
      );
    });
  }, [conversations, tab, search, contactById]);

  const isLoading = status === 'loading' || status === 'idle' || contactsLoading;
  const hasError = status === 'error' || isError;

  const header = <ScreenHeader title="Messages" />;

  return (
    <ScreenContainer header={header} padded={false}>
      <View style={styles.tabs}>
        <SegmentedTabs tabs={TABS} selected={tab} onSelect={setTab} />
      </View>
      {isLoading ? (
        <LoadingState label="Loading messages…" />
      ) : hasError ? (
        <ErrorState
          description="Could not load your conversations."
          onRetry={() => void refetch()}
        />
      ) : (
        <Animated.FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              title={
                tab === 'whatsapp' ? 'No WhatsApp messages' : tab === 'sms' ? 'No SMS messages' : 'No conversations'
              }
              description={
                search
                  ? 'No conversations match your search.'
                  : 'WhatsApp and SMS conversations will appear here.'
              }
            />
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={listEnter(index)}>
              <ConversationListItem
                conversation={item}
                contact={contactById.get(item.contactId)}
                onPress={() =>
                  router.push({ pathname: '/chat/[id]', params: { id: item.id } })
                }
              />
            </Animated.View>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabs: {
    paddingHorizontal: 20,
    paddingBottom: spacing.sm,
  },
  listContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
});
