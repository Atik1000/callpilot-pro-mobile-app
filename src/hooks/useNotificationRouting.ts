import { Href, router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { keepAlive, OpenedNotification } from '../../modules/callpilot-keepalive/src';
import { jigsaw } from '../services/api';
import { ApiMessage, mapMessage } from '../services/mappers';
import { useAuthStore } from '../store/authStore';
import { useMessageStore } from '../store/messageStore';

/**
 * Opens the screen for a tapped CallPilot message/alert push. The push only
 * carries ids; content is fetched with normal authentication:
 *   GET /jigsaw/messages/{message_uid}/ -> {message, conversation_number}
 */
async function routeFor(n: OpenedNotification): Promise<Href | null> {
  if (n.kind === 'callpilot_alert') return '/alerts';
  if (n.kind !== 'callpilot_message' || !n.message_uid) return null;
  try {
    const data = await jigsaw<{ message?: ApiMessage }>(`messages/${encodeURIComponent(n.message_uid)}/`);
    const message = data.message ? mapMessage(data.message) : null;
    void useMessageStore.getState().load();
    return message
      ? { pathname: '/chat/[id]', params: { id: message.conversationId } }
      : '/messages';
  } catch {
    return '/messages';
  }
}

/** A tap that arrived before sign-in finished; opened once signed in. */
let pending: OpenedNotification | null = null;

/** Opens a tapped CallPilot message/alert push (also used for iOS APNs taps). */
export function openCallPilotNotification(data: unknown): boolean {
  const n = data as Partial<OpenedNotification> | null;
  if (n?.kind !== 'callpilot_message' && n?.kind !== 'callpilot_alert') return false;
  if (useAuthStore.getState().stage === 'signedIn') open(n as OpenedNotification);
  else pending = n as OpenedNotification;
  return true;
}

function open(n: OpenedNotification) {
  void routeFor(n).then((href) => {
    if (href) router.push(href);
  });
}

/** Handles taps (cold start and while running) once the user is signed in. */
export function useNotificationRouting(signedIn: boolean) {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    pending = keepAlive.getLaunchNotification();
    const sub = keepAlive.addNotificationOpenedListener((n) => {
      if (useAuthStore.getState().stage === 'signedIn') open(n);
      else pending = n;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!signedIn || !pending) return;
    const n = pending;
    pending = null;
    open(n);
  }, [signedIn]);
}
