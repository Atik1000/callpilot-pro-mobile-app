import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { SlideOutRight } from 'react-native-reanimated';
import { AlertCard } from '../../components/alerts/AlertCard';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { SegmentedTabs } from '../../components/ui/SegmentedTabs';
import { listEnter, listLayout } from '../../components/ui/motion';
import { useAlertStore } from '../../store/alertStore';
import { spacing } from '../../theme';
import { AppAlert } from '../../types';

type AlertsTab = 'all' | 'unread';

const TABS = [
  { key: 'all' as const, label: 'All alerts' },
  { key: 'unread' as const, label: 'Unread' },
];

export default function AlertsScreen() {
  const router = useRouter();
  const { status, alerts, load, actionAlert, dismissAlert, markAlertRead } =
    useAlertStore();
  const [confirmingAlert, setConfirmingAlert] = useState<AppAlert | null>(null);
  const [tab, setTab] = useState<AlertsTab>('all');

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => (tab === 'unread' ? alerts.filter((a) => !a.isRead) : alerts),
    [alerts, tab],
  );

  const openRelated = (alert: AppAlert) => {
    if (alert.relatedConversationId) {
      router.push({ pathname: '/chat/[id]', params: { id: alert.relatedConversationId } });
    } else if (alert.relatedContactId) {
      router.push({ pathname: '/contact/[id]', params: { id: alert.relatedContactId } });
    }
  };

  const header = <ScreenHeader title="Alerts" subtitle="Today" />;

  return (
    <ScreenContainer header={header} padded={false}>
      <View style={styles.tabs}>
        <SegmentedTabs tabs={TABS} selected={tab} onSelect={setTab} />
      </View>
      {status === 'loading' || status === 'idle' ? (
        <LoadingState label="Loading alerts…" />
      ) : status === 'error' ? (
        <ErrorState description="Could not load alerts." onRetry={() => void load()} />
      ) : (
        <Animated.FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          itemLayoutAnimation={listLayout}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              title={tab === 'unread' ? 'Nothing unread' : 'All caught up'}
              description="New alerts and AI suggestions will appear here."
            />
          }
          renderItem={({ item, index }) => (
            <Animated.View
              entering={listEnter(index)}
              exiting={SlideOutRight.duration(220)}
            >
              <AlertCard
                alert={item}
                onPress={() => openRelated(item)}
                onSend={() => setConfirmingAlert(item)}
                onDismiss={() => dismissAlert(item.id)}
                onMarkRead={() => markAlertRead(item.id)}
              />
            </Animated.View>
          )}
        />
      )}

      {/* AI suggestions require explicit confirmation before they run. */}
      <ConfirmationModal
        visible={confirmingAlert !== null}
        title="Approve this action?"
        message={
          confirmingAlert
            ? `CallPilot will carry out "${confirmingAlert.title}". WhatsApp is tried first with automatic SMS fallback.`
            : ''
        }
        confirmLabel="Send"
        onConfirm={() => {
          if (confirmingAlert) actionAlert(confirmingAlert.id);
          setConfirmingAlert(null);
        }}
        onCancel={() => setConfirmingAlert(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabs: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
});
