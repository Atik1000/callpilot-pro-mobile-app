import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { AlertCard } from '../../components/alerts/AlertCard';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { ScreenHeader } from '../../components/layout/ScreenHeader';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { AppText } from '../../components/ui/AppText';
import { listLayout } from '../../components/ui/motion';
import { useAlertStore } from '../../store/alertStore';
import { spacing } from '../../theme';
import { AppAlert } from '../../types';

type AlertRow =
  | { kind: 'header'; key: string; label: string }
  | { kind: 'alert'; key: string; alert: AppAlert };

export default function AlertsScreen() {
  const router = useRouter();
  const { status, alerts, load, actionAlert, dismissAlert, markAlertRead } =
    useAlertStore();
  const [confirmingAlert, setConfirmingAlert] = useState<AppAlert | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // UI kit layout: NEW (unread) first, then EARLIER.
  const rows = useMemo<AlertRow[]>(() => {
    const fresh = alerts.filter((a) => !a.isRead);
    const earlier = alerts.filter((a) => a.isRead);
    const out: AlertRow[] = [];
    if (fresh.length) {
      out.push({ kind: 'header', key: 'h-new', label: 'New' });
      fresh.forEach((a) => out.push({ kind: 'alert', key: a.id, alert: a }));
    }
    if (earlier.length) {
      out.push({ kind: 'header', key: 'h-earlier', label: 'Earlier' });
      earlier.forEach((a) => out.push({ kind: 'alert', key: a.id, alert: a }));
    }
    return out;
  }, [alerts]);

  const openRelated = (alert: AppAlert) => {
    if (alert.relatedConversationId) {
      router.push({ pathname: '/chat/[id]', params: { id: alert.relatedConversationId } });
    } else if (alert.relatedContactId) {
      router.push({ pathname: '/contact/[id]', params: { id: alert.relatedContactId } });
    }
  };

  const header = <ScreenHeader title="Alerts" />;

  return (
    <ScreenContainer header={header} padded={false}>
      {status === 'loading' || status === 'idle' ? (
        <LoadingState label="Loading alerts…" />
      ) : status === 'error' ? (
        <ErrorState description="Could not load alerts." onRetry={() => void load()} />
      ) : (
        <Animated.FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          itemLayoutAnimation={listLayout}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              title="All caught up"
              description="New alerts and AI suggestions will appear here."
            />
          }
          renderItem={({ item: row }) =>
            row.kind === 'header' ? (
              <AppText variant="sectionTitle" style={styles.sectionLabel}>
                {row.label}
              </AppText>
            ) : (
              <AlertCard
                alert={row.alert}
                onPress={() => openRelated(row.alert)}
                onSend={() => setConfirmingAlert(row.alert)}
                onDismiss={() => dismissAlert(row.alert.id)}
                onMarkRead={() => markAlertRead(row.alert.id)}
              />
            )
          }
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
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: spacing.xl,
  },
  sectionLabel: {
    paddingTop: 12,
    paddingBottom: 10,
  },
});
