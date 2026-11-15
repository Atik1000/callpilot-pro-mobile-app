import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Mail, MessageCircle, MessageSquare, Phone, Star } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { rise } from '../../components/ui/motion';
import { ActivityListItem } from '../../components/contacts/ActivityListItem';
import { ATSStatusCard } from '../../components/contacts/ATSStatusCard';
import { ContactActionButton } from '../../components/contacts/ContactActionButton';
import { DocumentListItem } from '../../components/contacts/DocumentListItem';
import { StandaloneTabBar } from '../../components/layout/BottomTabBar';
import { DetailHeader } from '../../components/layout/DetailHeader';
import { ScreenContainer } from '../../components/layout/ScreenContainer';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { Divider } from '../../components/ui/Divider';
import { EmptyState } from '../../components/ui/EmptyState';
import { IconButton } from '../../components/ui/IconButton';
import { LoadingState } from '../../components/ui/LoadingState';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { useCommunications } from '../../hooks/useCommunications';
import { contactService } from '../../services/contactService';
import { colors, spacing } from '../../theme';
import { atsDocumentStatusLabel, contactCategoryLabel } from '../../types';

export default function ContactRecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { startCall, openConversation, composeEmail } = useCommunications();
  // Optimistic favourite state; null = follow the loaded record.
  const [favouriteOverride, setFavouriteOverride] = useState<boolean | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // One request returns the contact plus its ATS documents and activity.
  const { data: record, isLoading: recordLoading } = useQuery({
    queryKey: ['contact-record', id],
    queryFn: () => contactService.getContactRecord(id ?? ''),
    enabled: Boolean(id),
  });
  const contact = record?.contact;
  const documents = record?.documents;
  const activity = record?.activity;
  const docsLoading = recordLoading;
  const activityLoading = recordLoading;

  if (recordLoading) {
    return (
      <ScreenContainer header={<DetailHeader title="Record" />} footer={<StandaloneTabBar activeName="contacts" />}>
        <LoadingState label="Loading record…" />
      </ScreenContainer>
    );
  }

  if (!contact) {
    return (
      <ScreenContainer header={<DetailHeader title="Record" />} footer={<StandaloneTabBar activeName="contacts" />}>
        <EmptyState
          title="Contact not found"
          description="This record is not in your ATS."
          actionLabel="Back to contacts"
          onAction={() => router.replace('/(tabs)/contacts')}
        />
      </ScreenContainer>
    );
  }

  const isFavourite = favouriteOverride ?? contact.isFavourite;
  const toggleFavourite = () => {
    const next = !isFavourite;
    setFavouriteOverride(next);
    void contactService
      .setFavourite(contact.id, next)
      .then(() => queryClient.invalidateQueries({ queryKey: ['contacts'] }))
      .catch(() => setFavouriteOverride(!next));
  };

  const deleteContact = () => {
    setConfirmingDelete(false);
    void contactService
      .deleteContact(contact.id)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['contacts'] });
        router.replace('/(tabs)/contacts');
      })
      .catch(() => Alert.alert('Delete contact', 'Could not delete this contact.'));
  };

  const subtitleParts = [contactCategoryLabel[contact.category]];
  if (contact.jobTitle) subtitleParts.push(contact.jobTitle);
  if (contact.category === 'candidate' && contact.location) {
    subtitleParts.push(contact.location);
  } else if (contact.company) {
    subtitleParts.push(contact.company);
  }

  const header = (
    <DetailHeader
      title="Record"
      rightElement={
        <IconButton
          icon={
            <Star
              size={19}
              color="#FFFFFF"
              fill={isFavourite ? '#FFFFFF' : 'transparent'}
            />
          }
          onPress={toggleFavourite}
          accessibilityLabel={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          size={44}
          backgroundColor={colors.headerControl}
        />
      }
    >
      <View style={styles.identity}>
        <Avatar name={contact.name} size={56} backgroundColor="#FFFFFF" textColor={colors.textPrimary} />
        <View style={styles.identityTexts}>
          <AppText variant="screenTitle" color={colors.headerText} align="center" style={styles.name}>
            {contact.name}
          </AppText>
          <AppText variant="supporting" color={colors.headerTextSecondary} align="center" numberOfLines={2}>
            {subtitleParts.join(' · ')}
          </AppText>
        </View>
      </View>
      <View style={styles.actionsRow}>
        <ContactActionButton
          icon={<Phone size={20} color={colors.secondary} />}
          label="Call"
          onPress={() => startCall(contact.phone, contact)}
        />
        <ContactActionButton
          icon={<MessageCircle size={20} color={colors.secondary} />}
          label="WhatsApp"
          onPress={() => openConversation(contact, 'whatsapp')}
        />
        <ContactActionButton
          icon={<MessageSquare size={20} color={colors.secondary} />}
          label="SMS"
          onPress={() => openConversation(contact, 'sms')}
        />
        <ContactActionButton
          icon={<Mail size={20} color={colors.secondary} />}
          label="Email"
          onPress={() => void composeEmail(contact)}
        />
      </View>
    </DetailHeader>
  );

  return (
    <ScreenContainer
      header={header}
      footer={<StandaloneTabBar activeName="contacts" />}
      scrollable
    >
      {contact.atsStatus ? (
        <Animated.View entering={rise(30)}>
          <SectionHeader title="ATS status" />
          <ATSStatusCard
            status={contact.atsStatus}
            detail={contact.atsStatusDetail}
            tone={contact.atsStatusDetail?.startsWith('Waiting') ? 'warning' : 'success'}
          />
        </Animated.View>
      ) : null}

      <Animated.View entering={rise(75)}>
      <SectionHeader title="Documents" />
      {docsLoading ? (
        <LoadingState label="Loading documents…" />
      ) : documents && documents.length > 0 ? (
        <Card padded={false}>
          <AppText variant="bodyMedium" style={styles.documentsCaption}>
            Saved to the ATS record
          </AppText>
          <Divider />
          <View style={styles.documents}>
            {documents.map((document, index) => (
              <View key={document.id}>
                {index > 0 ? <Divider /> : null}
                <DocumentListItem
                  document={document}
                  onPress={() =>
                    Alert.alert(
                      document.name,
                      `Status: ${atsDocumentStatusLabel[document.status]}\n\nStored on the ATS record (mock detail view).`,
                    )
                  }
                />
              </View>
            ))}
          </View>
        </Card>
      ) : (
        <Card>
          <AppText variant="supporting" color={colors.textSecondary}>
            No documents on this record yet.
          </AppText>
        </Card>
      )}
      </Animated.View>

      <Animated.View entering={rise(120)}>
      <SectionHeader title="Activity" />
      {activityLoading ? (
        <LoadingState label="Loading activity…" />
      ) : activity && activity.length > 0 ? (
        activity.map((item) => (
          <ActivityListItem
            key={item.id}
            activity={item}
            onPress={
              item.relatedConversationId
                ? () =>
                    router.push({
                      pathname: '/chat/[id]',
                      params: { id: item.relatedConversationId as string },
                    })
                : () => Alert.alert(item.title, item.detail)
            }
          />
        ))
      ) : (
        <Card>
          <AppText variant="supporting" color={colors.textSecondary}>
            No activity recorded yet.
          </AppText>
        </Card>
      )}
      </Animated.View>

      <Animated.View entering={rise(160)}>
        <View style={styles.deleteWrap}>
          <AppButton
            label="Delete contact"
            variant="danger"
            onPress={() => setConfirmingDelete(true)}
            fullWidth
          />
        </View>
      </Animated.View>

      <ConfirmationModal
        visible={confirmingDelete}
        title="Delete contact?"
        message={`${contact.name} will be removed from your CallPilot contact cache. The next ATS sync can bring them back.`}
        confirmLabel="Delete"
        onConfirm={deleteContact}
        onCancel={() => setConfirmingDelete(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  identity: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  identityTexts: {
    alignItems: 'center',
    gap: 2,
  },
  name: {
    fontSize: 23,
    lineHeight: 28,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  documentsCaption: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  documents: {
    paddingHorizontal: spacing.lg,
  },
  deleteWrap: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
});
