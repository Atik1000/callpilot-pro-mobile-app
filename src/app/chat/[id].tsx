import { useLocalSearchParams } from 'expo-router';
import { FileText, Phone, Sparkles } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DetailHeader } from '../../components/layout/DetailHeader';
import { AttachmentCard } from '../../components/messages/AttachmentCard';
import { ChatSystemNotice } from '../../components/messages/ChatSystemNotice';
import { MessageBubble } from '../../components/messages/MessageBubble';
import { MessageComposer } from '../../components/messages/MessageComposer';
import { AppText } from '../../components/ui/AppText';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { EmptyState } from '../../components/ui/EmptyState';
import { IconButton } from '../../components/ui/IconButton';
import { listEnter, PressableScale } from '../../components/ui/motion';
import { useCommunications } from '../../hooks/useCommunications';
import { messageService } from '../../services/messageService';
import { useContact } from '../../hooks/useContacts';
import { useMessageStore } from '../../store/messageStore';
import { colors, radius, spacing } from '../../theme';
import { contactCategoryLabel, Message } from '../../types';
import { formatPhone } from '../../utils/formatPhone';
import { formatDaySeparator } from '../../utils/formatTime';

type ChatRow =
  | { kind: 'separator'; id: string; label: string }
  | { kind: 'message'; id: string; message: Message };

function buildRows(messages: Message[]): ChatRow[] {
  const rows: ChatRow[] = [];
  let lastDay = '';
  for (const message of messages) {
    const day = formatDaySeparator(message.timestamp);
    if (day !== lastDay) {
      rows.push({ kind: 'separator', id: `sep-${message.id}`, label: day });
      lastDay = day;
    }
    rows.push({ kind: 'message', id: message.id, message });
  }
  return rows;
}

export default function ChatDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatRow>>(null);

  const load = useMessageStore((s) => s.load);
  const conversation = useMessageStore((s) =>
    s.conversations.find((c) => c.id === id),
  );
  const messages = useMessageStore((s) => (id ? s.messages[id] : undefined));
  const markConversationRead = useMessageStore((s) => s.markConversationRead);
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const sendDocumentRequest = useMessageStore((s) => s.sendDocumentRequest);
  const addAttachment = useMessageStore((s) => s.addAttachment);

  const [draft, setDraft] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [confirmingTemplate, setConfirmingTemplate] = useState(false);

  const contactKey = conversation?.contactId ?? (id ? id.split('__')[0] : undefined);
  // Number-only conversations (key starts with "+") have no ATS record.
  const isPhoneConversation = Boolean(contactKey?.startsWith('+'));
  const contact = useContact(isPhoneConversation ? undefined : contactKey);
  const { startCall } = useCommunications();

  useEffect(() => {
    void load();
  }, [load]);

  // Opening an unread conversation marks it read.
  useEffect(() => {
    if (id && conversation && conversation.unreadCount > 0) {
      markConversationRead(id);
    }
  }, [id, conversation, markConversationRead]);

  const rows = useMemo(() => buildRows(messages ?? []), [messages]);

  const channelLabel = conversation?.channel === 'sms' ? 'SMS' : 'WhatsApp';
  const subtitle = contact
    ? `${contactCategoryLabel[contact.category]} · ${channelLabel}`
    : channelLabel;

  // Web parity: "Suggest reply" asks the AI for a draft you can edit.
  const handleSuggestReply = async () => {
    if (!contactKey || isPhoneConversation || suggesting) return;
    setSuggesting(true);
    try {
      const reply = await messageService.suggestReply(contactKey);
      if (reply) setDraft(reply);
      else Alert.alert('Suggest reply', 'No suggestion available for this conversation yet.');
    } catch {
      Alert.alert('Suggest reply', 'Could not fetch a suggestion. Try again.');
    } finally {
      setSuggesting(false);
    }
  };

  const handleAttach = () => {
    if (!id) return;
    // Mock attachment picker — a real image picker plugs in here later.
    Alert.alert('Add attachment', 'Mock picker: choose what to attach.', [
      {
        text: 'Photo',
        onPress: () =>
          addAttachment(id, `IMG_${Math.floor(1000 + Math.random() * 9000)}.jpg`),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const header = (
    <DetailHeader
      title={
        contact?.name ??
        (isPhoneConversation && contactKey ? formatPhone(contactKey) : 'Conversation')
      }
      subtitle={subtitle}
      rightElement={
        contact ? (
          <IconButton
            icon={<Phone size={19} color={colors.black} />}
            onPress={() => startCall(contact.phone, contact)}
            accessibilityLabel={`Call ${contact.name}`}
            size={44}
            backgroundColor={colors.headerControl}
          />
        ) : undefined
      }
    />
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.flex}>
        {header}
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(row) => row.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <EmptyState
              title="No messages yet"
              description={`Start the conversation on ${channelLabel}.`}
            />
          }
          renderItem={({ item, index }) => {
            if (item.kind === 'separator') {
              return (
                <Animated.View entering={FadeIn.duration(200)} style={styles.separatorRow}>
                  <View style={styles.separatorPill}>
                    <AppText variant="caption" color={colors.textSecondary}>
                      {item.label}
                    </AppText>
                  </View>
                </Animated.View>
              );
            }
            const { message } = item;
            let content: React.ReactElement;
            if (message.type === 'system') {
              content = <ChatSystemNotice message={message} />;
            } else if (message.type === 'image' || message.type === 'file') {
              content = <AttachmentCard message={message} />;
            } else {
              content = <MessageBubble message={message} />;
            }
            return (
              <Animated.View
                entering={listEnter(index)}
              >
                {content}
              </Animated.View>
            );
          }}
        />
        <View style={{ paddingBottom: insets.bottom + spacing.sm }}>
          {/* Web parity: AI suggestion + approved template, above the composer. */}
          <View style={styles.toolsRow}>
            {!isPhoneConversation ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Suggest a reply"
                onPress={() => void handleSuggestReply()}
                style={[styles.toolChip, suggesting && styles.toolChipBusy]}
              >
                <Sparkles size={14} color={colors.secondary} />
                <AppText variant="caption" color={colors.textPrimary}>
                  {suggesting ? 'Suggesting…' : 'Suggest reply'}
                </AppText>
              </PressableScale>
            ) : null}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Send document request template"
              onPress={() => setConfirmingTemplate(true)}
              style={styles.toolChip}
            >
              <FileText size={14} color={colors.secondary} />
              <AppText variant="caption" color={colors.textPrimary}>
                Doc request
              </AppText>
            </PressableScale>
          </View>
          <MessageComposer
            value={draft}
            onChangeText={setDraft}
            onSend={(text) => id && sendMessage(id, text)}
            onAttach={handleAttach}
          />
        </View>
      </View>

      <ConfirmationModal
        visible={confirmingTemplate}
        title="Send document request?"
        message="CallPilot sends the approved document request template in this conversation. WhatsApp is tried first with automatic SMS fallback."
        confirmLabel="Send template"
        onConfirm={() => {
          setConfirmingTemplate(false);
          if (id) sendDocumentRequest(id);
        }}
        onCancel={() => setConfirmingTemplate(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  separatorRow: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  separatorPill: {
    backgroundColor: colors.lightGrey,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  toolsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  toolChipBusy: {
    opacity: 0.6,
  },
});
