import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import { Contact, MessageChannel } from '../types';
import { whatsappCallService } from '../services/whatsappCallService';
import { CallChannel, WhatsAppPermissionError } from '../services/voipService';
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
    (phoneNumber: string, contact?: Contact | null, channel: CallChannel = 'phone') => {
      const callFromDevice = () => {
        Linking.openURL(`tel:${phoneNumber.replace(/[^\d+]/g, '')}`).catch(() =>
          Alert.alert('Could not call', 'This device cannot place phone calls.'),
        );
      };

      /** Meta permission is per recipient and expires; ask only when allowed. */
      const requestWhatsAppPermission = () => {
        whatsappCallService
          .requestPermission(phoneNumber)
          .then((result) =>
            Alert.alert(
              'Request sent',
              result.detail ||
                'They will be asked on WhatsApp to allow calls. Try again once they accept.',
            ),
          )
          .catch((error: unknown) =>
            Alert.alert(
              'Could not ask for permission',
              error instanceof Error ? error.message : 'Try again later.',
            ),
          );
      };

      beginCall({ phoneNumber, contact, channel })
        .then(() => router.push('/active-call'))
        .catch((error: unknown) => {
          if (error instanceof WhatsAppPermissionError) {
            Alert.alert(
              'WhatsApp call not allowed yet',
              error.message,
              error.canRequest
                ? [
                    { text: 'Ask for permission', onPress: requestWhatsAppPermission },
                    { text: 'Cancel', style: 'cancel' },
                  ]
                : [{ text: 'OK', style: 'cancel' }],
            );
            return;
          }
          if (channel === 'whatsapp') {
            // No PSTN fallback for WhatsApp calls.
            Alert.alert(
              'WhatsApp call failed',
              error instanceof Error ? error.message : 'Could not start the call.',
            );
            return;
          }
          // Business line unavailable (e.g. still connecting): offer the SIM.
          Alert.alert(
            'Call failed',
            error instanceof Error ? error.message : 'Could not start the call.',
            [
              { text: 'Call from this phone', onPress: callFromDevice },
              { text: 'OK', style: 'cancel' },
            ],
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
