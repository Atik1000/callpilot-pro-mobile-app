import { useRouter } from 'expo-router';
import { Phone } from 'lucide-react-native';
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
import { StatusBadge } from '../../components/ui/StatusBadge';
import { listEnter, popIn, PressableScale } from '../../components/ui/motion';
import { useCommunications } from '../../hooks/useCommunications';
import { findContactByPhone, useContacts } from '../../hooks/useContacts';
import { useAuthStore } from '../../store/authStore';
import { useCallStore } from '../../store/callStore';
import { useSettingsStore } from '../../store/settingsStore';
import { colors, radius, spacing } from '../../theme';
import { Call } from '../../types';

type CallsTab = 'recent' | 'missed' | 'voicemail';

const TABS = [
  { key: 'recent' as const, label: 'Recent' },
  { key: 'missed' as const, label: 'Missed' },
  { key: 'voicemail' as const, label: 'Voicemail' },
];

export default function CallsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<CallsTab>('recent');
  const [search, setSearch] = useState('');
  const [expandedVoicemailId, setExpandedVoicemailId] = useState<string | null>(null);
  const [addNumber, setAddNumber] = useState<string | null>(null);

  const businessNumber = useAuthStore((s) => s.user?.businessNumber);
  const availability = useSettingsStore((s) => s.availability);
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

  const header = (
    <ScreenHeader
      title="Calls"
      subtitle={`Business line · ${businessNumber ?? ''}`}
      showSearch
      searchPlaceholder="Search ATS contacts"
      searchValue={search}
      onSearchChange={setSearch}
      rightElement={
        <StatusBadge
          label={availability === 'available' ? 'Available' : 'Do not disturb'}
          tone={availability === 'available' ? 'info' : 'warning'}
          pulse={availability === 'available'}
        />
      }
    />
  );

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
        data={filteredCalls}
        keyExtractor={(c) => c.id}
        contentContainerStyle={styles.listContent}
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
        renderItem={({ item, index }) => (
          <Animated.View entering={listEnter(index)}>
            <CallListItem
              call={item}
              contact={contactForCall(item)}
              onPress={() => openCall(item)}
              onAddUnknown={() => setAddNumber(item.phoneNumber)}
              onCallBack={() =>
                startCall(item.phoneNumber, contactForCall(item))
              }
            />
          </Animated.View>
        )}
      />
    );
  }

  return (
    <ScreenContainer header={header} padded={false}>
      <View style={styles.tabs}>
        <SegmentedTabs tabs={TABS} selected={tab} onSelect={setTab} />
      </View>
      <View style={styles.list}>{body}</View>

      {/* Floating Keypad button */}
      <Animated.View entering={popIn(175)} style={styles.fabWrap}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Open keypad"
          onPress={() => router.push('/keypad')}
          scaleTo={0.9}
          style={styles.keypadFab}
        >
          <Phone size={18} color="#FFFFFF" />
          <AppText variant="button" color="#FFFFFF">
            Keypad
          </AppText>
        </PressableScale>
      </Animated.View>

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

const styles = StyleSheet.create({
  tabs: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 120,
  },
  fabWrap: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
  },
  keypadFab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
  },
});
