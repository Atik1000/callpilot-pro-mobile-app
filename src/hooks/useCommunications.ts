import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { Contact, MessageChannel } from '../types';
import { useCallStore } from '../store/callStore';
import { useMessageStore } from '../store/messageStore';

/**
 * Shared navigation actions for starting calls, opening conversations
 * and composing emails — used by Contacts, Contact Record, Chat, Keypad
 * and Voicemail so every screen behaves identically.
 */
export function useCommunications() {
  const router = useRouter();
  const beginCall = useCallStore((s) => s.startCall);
  const ensureConversation = useMessageStore((s) => s.ensureConversation);

  const startCall = useCallback(
    (phoneNumber: string, contact?: Contact | null) => {
      router.push('/active-call');
      beginCall({ phoneNumber, contact }).catch((error: unknown) => {
        Alert.alert(
          'Call failed',
          error instanceof Error ? error.message : 'Could not start the call.',
        );
      });
    },
    [router, beginCall],
  );

  const openConversation = useCallback(
    (contact: Contact, channel: MessageChannel) => {
      const conversationId = ensureConversation(contact.id, channel);
      router.push({ pathname: '/chat/[id]', params: { id: conversationId } });
    },
    [ensureConversation, router],
  );

  const composeEmail = useCallback(async (contact: Contact) => {
    if (!contact.email) {
      Alert.alert('No email address', `${contact.name} has no email on record.`);
      return;
    }
    try {
      await Linking.openURL(`mailto:${contact.email}`);
    } catch {
      Alert.alert('Could not open email', 'No email app is available on this device.');
    }
  }, []);

  return { startCall, openConversation, composeEmail };
}
