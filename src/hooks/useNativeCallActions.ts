import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { keepAlive, NativeCallAction } from '../../modules/callpilot-keepalive/src';
import lineTask from '../services/lineTask';
import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';

/** Answer/Decline/mute from CallKit, Telecom or the call notification. */
async function onAction(action: NativeCallAction) {
  const auth = useAuthStore.getState();
  if (auth.stage === 'restoring') await auth.restore();
  if (useAuthStore.getState().stage !== 'signedIn') {
    keepAlive.endCall(action.call_uuid, 'failed');
    return;
  }
  try {
    await useCallStore.getState().handleNativeCallAction(action);
  } catch (error) {
    Alert.alert('Call ended', error instanceof Error ? error.message : 'The call could not be connected.');
  }
  // Answered outside the in-app incoming screen: show the call.
  if (action.action === 'answer' && useCallStore.getState().activeCall) {
    router.navigate('/active-call');
  }
}

/**
 * Bridges the native call UI to the call store for the app's lifetime.
 * iOS VoIP pushes arrive here (already reported to CallKit); Android pushes
 * go through the headless line task instead.
 */
export function useNativeCallActions() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const actions = keepAlive.addCallActionListener((a) => void onAction(a));
    const pushes = keepAlive.addCallPushListener((push) => void lineTask({ push }));
    const launch = keepAlive.getLaunchCallAction();
    if (launch) void onAction(launch);
    return () => {
      actions.remove();
      pushes.remove();
    };
  }, []);
}
