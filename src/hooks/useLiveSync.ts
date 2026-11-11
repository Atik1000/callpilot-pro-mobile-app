import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { notificationService } from '../services/notificationService';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';
import { useMessageStore } from '../store/messageStore';
import { Message } from '../types';

const POLL_MS = 25_000;

function messagePreview(message: Message): string {
  if (message.content) return message.content;
  if (message.attachmentName) return `Attachment · ${message.attachmentName}`;
  return 'New message';
}

/**
 * While signed in, keeps calls and messages fresh (poll + refresh on
 * returning to the foreground) and raises local notifications for new
 * inbound messages and missed calls when the app is not in the foreground.
 */
export function useLiveSync() {
  const signedIn = useAuthStore((s) => s.stage === 'signedIn');
  const messages = useMessageStore((s) => s.messages);
  const conversationContacts = useMessageStore((s) => s.conversationContacts);
  const calls = useCallStore((s) => s.calls);
  const callContacts = useCallStore((s) => s.callContacts);

  const seenMessageIds = useRef<Set<string> | null>(null);
  const seenCallIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!signedIn) {
      seenMessageIds.current = null;
      seenCallIds.current = null;
      return;
    }
    void notificationService.ensureReady();
    const refresh = () => {
      void useMessageStore.getState().load();
      void useCallStore.getState().load();
    };
    const interval = setInterval(refresh, POLL_MS);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(interval);
      appState.remove();
    };
  }, [signedIn]);

  // New inbound messages → one notification per conversation.
  useEffect(() => {
    if (!signedIn) return;
    const inbound = Object.values(messages)
      .flat()
      .filter((m) => m.sender === 'contact');
    if (!seenMessageIds.current) {
      // First load after sign-in: everything already in the inbox is old.
      seenMessageIds.current = new Set(inbound.map((m) => m.id));
      return;
    }
    const seen = seenMessageIds.current;
    const fresh = inbound.filter((m) => !seen.has(m.id));
    for (const m of fresh) seen.add(m.id);
    if (fresh.length === 0 || AppState.currentState === 'active') return;
    const latestByConversation = new Map<string, Message>();
    for (const m of fresh) {
      const current = latestByConversation.get(m.conversationId);
      if (!current || m.timestamp > current.timestamp) {
        latestByConversation.set(m.conversationId, m);
      }
    }
    for (const [conversation, message] of latestByConversation) {
      const contactId = conversation.split('__')[0];
      const title =
        conversationContacts[contactId]?.name ??
        (contactId.startsWith('+') ? contactId : 'New message');
      void notificationService.notify(
        title,
        messagePreview(message),
        `/chat/${conversation}`,
      );
    }
  }, [signedIn, messages, conversationContacts]);

  // New missed calls → notification pointing at the Calls tab.
  useEffect(() => {
    if (!signedIn) return;
    if (!seenCallIds.current) {
      seenCallIds.current = new Set(calls.map((c) => c.id));
      return;
    }
    const seen = seenCallIds.current;
    const fresh = calls.filter((c) => !seen.has(c.id));
    for (const c of fresh) seen.add(c.id);
    if (AppState.currentState === 'active') return;
    for (const call of fresh) {
      if (call.direction !== 'missed') continue;
      const name =
        (call.contactId ? callContacts[call.contactId]?.name : undefined) ??
        call.phoneNumber;
      void notificationService.notify('Missed call', name, '/(tabs)/calls');
    }
  }, [signedIn, calls, callContacts]);
}
