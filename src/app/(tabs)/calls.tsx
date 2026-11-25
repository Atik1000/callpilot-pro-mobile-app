import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { CallListItem } from '../../components/calls/CallListItem';
import { VoicemailCard } from '../../components/calls/VoicemailCard';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { AppText } from '../../components/ui/AppText';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { listEnter } from '../../components/ui/motion';
import { useCommunications } from '../../hooks/useCommunications';
import { findContactByPhone, useContacts } from '../../hooks/useContacts';
import { useCallStore } from '../../store/callStore';
import { spacing } from '../../theme';
import { Call } from '../../types';

type CallsTab = 'recent' | 'missed' | 'voicemail';

const TABS = [
  { key: 'recent' as const, label: 'All' },
  { key: 'missed' as const, label: 'Missed' },
  { key: 'voicemail' as const, label: 'Voicemail' },
];

export default function CallsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<CallsTab>('recent');
  // Search lives on Contacts in the UI kit; Calls is a plain grouped log.
  const search = '';
  const [expandedVoicemailId, setExpandedVoicemailId] = useState<string | null>(null);
  const [addNumber, setAddNumber] = useState<string | null>(null);

  const { status, calls, voicemails, callContacts, load, markVoicemailRead } =
    useCallStore();
  const { data: contacts, isLoading: contactsLoading, isError, refetch } = useContacts();
  const { startCall, openConversation } = useCommunications();

  useEffect(() => {
    void load();
  }, [load]);

  // Contact book first, then contacts embedded in the live call feed.
  const contactById = useMemo(() => {
    const map = new Map((contacts ?? []).map((c) => [c.id, c]));
    for (const [id, contact] of Object.entries(callContacts)) {
      if (!map.has(id)) map.set(id, contact);
    }
    return map;
  }, [contacts, callContacts]);

  const filteredCalls = useMemo(() => {
    let list = calls;
    if (tab === 'missed') list = list.filter((c) => c.direction === 'missed');
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const contact =
        (c.contactId ? contactById.get(c.contactId) : undefined) ??
        findContactByPhone(contacts, c.phoneNumber);
      return (
        c.phoneNumber.toLowerCase().includes(q) ||
        c.contactName?.toLowerCase().includes(q) ||
        contact?.name.toLowerCase().includes(q) ||
        contact?.company?.toLowerCase().includes(q)
      );
    });
  }, [calls, tab, search, contactById, contacts]);

  const filteredVoicemails = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return voicemails;
    return voicemails.filter((v) => {
      const contact =
        (v.contactId ? contactById.get(v.contactId) : undefined) ??
        findContactByPhone(contacts, v.phoneNumber);
      return (
        v.phoneNumber.toLowerCase().includes(q) ||
        contact?.name.toLowerCase().includes(q) ||
        contact?.company?.toLowerCase().includes(q)
      );
    });
  }, [voicemails, search, contactById, contacts]);

  /** Linked contact, else a contact with the same phone number. */
  const contactForCall = (call: Call) =>
    (call.contactId ? contactById.get(call.contactId) : undefined) ??
    findContactByPhone(contacts, call.phoneNumber);

  const openCall = (call: Call) => {
    const contact = contactForCall(call);
    if (contact) {
      router.push({ pathname: '/contact/[id]', params: { id: contact.id } });
    } else {
      setAddNumber(call.phoneNumber);
    }
  };

  const isLoading = status === 'loading' || status === 'idle' || contactsLoading;
  // Contacts only enrich names here; a contacts failure must not hide call history.
  const hasError = status === 'error';
  if (isError && __DEV__) console.warn('[calls] contacts failed to load');

  const header = <ScreenHeader title="Calls" />;

  // Calls grouped under TODAY / YESTERDAY / date labels, newest first.
  const rows = useMemo(() => groupByDay(filteredCalls), [filteredCalls]);

  let body: React.ReactNode;
  if (isLoading) {
    body = <LoadingState label="Loading calls…" />;
  } else if (hasError) {
    body = (
      <ErrorState
        description="Could not load your call history."
        onRetry={() => {
          void load();
          void refetch();
        }}
      />
    );
  } else if (tab === 'voicemail') {
    body = (
      <Animated.FlatList
        data={filteredVoicemails}
        keyExtractor={(v) => v.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState title="No voicemails" description="New voicemails will appear here with a transcript." />
        }
        renderItem={({ item, index }) => {
          const contact =
            (item.contactId ? contactById.get(item.contactId) : undefined) ??
            findContactByPhone(contacts, item.phoneNumber);
          return (
            <Animated.View entering={listEnter(index)}>
              <VoicemailCard
                voicemail={item}
                contact={contact}
                expanded={expandedVoicemailId === item.id}
                onToggleExpanded={() => {
                  setExpandedVoicemailId((cur) => (cur === item.id ? null : item.id));
                  if (expandedVoicemailId !== item.id) markVoicemailRead(item.id);
                }}
                onCallBack={() => startCall(item.phoneNumber, contact)}
                onWhatsApp={
                  contact ? () => openConversation(contact, 'whatsapp') : undefined
                }
              />
            </Animated.View>
          );
        }}
      />
    );
  } else {
    body = (
      <Animated.FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={styles.callListContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            title={tab === 'missed' ? 'No missed calls' : 'No calls yet'}
            description={
              search
                ? 'No calls match your search.'
                : 'Calls on your business line will appear here.'
            }
          />
        }
        renderItem={({ item: row }) =>
          row.kind === 'header' ? (
            <AppText variant="sectionTitle" style={styles.dayLabel}>
              {row.label}
            </AppText>
          ) : (
            <CallListItem
              call={row.call}
              contact={contactForCall(row.call)}
              onPress={() => openCall(row.call)}
              onAddUnknown={() => setAddNumber(row.call.phoneNumber)}
              onCallBack={() => startCall(row.call.phoneNumber, contactForCall(row.call))}
            />
          )
        }
      />
    );
  }

  return (
    <ScreenContainer header={header} padded={false}>
      <View style={styles.tabs}>
        <SegmentedTabs tabs={TABS} selected={tab} onSelect={setTab} />
      </View>
      <View style={styles.list}>{body}</View>

      <ConfirmationModal
        visible={addNumber !== null}
        title="Add to ATS"
        message={`Create a new ATS contact for ${addNumber ?? ''}? This is a mock flow until the ATS is connected.`}
        confirmLabel="Add contact"
        onConfirm={() => setAddNumber(null)}
        onCancel={() => setAddNumber(null)}
      />
    </ScreenContainer>
  );
}

type CallRow =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'call'; key: string; call: Call };

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Earlier';
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(d)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function groupByDay(calls: Call[]): CallRow[] {
  const rows: CallRow[] = [];
  let current = '';
  for (const call of calls) {
    const label = dayLabel(call.timestamp);
    if (label !== current) {
      current = label;
      rows.push({ kind: 'header', key: `h-${label}-${call.id}`, label });
    }
    rows.push({ kind: 'call', key: call.id, call });
  }
  return rows;
}

const styles = StyleSheet.create({
  tabs: {
    paddingHorizontal: 20,
    paddingBottom: spacing.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  callListContent: {
    paddingBottom: spacing.sm,
  },
  dayLabel: {
    paddingTop: 16,
    paddingBottom: 6,
    paddingHorizontal: 20,
  },
});
