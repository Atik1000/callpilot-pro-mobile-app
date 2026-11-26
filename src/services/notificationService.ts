import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { nativeCallPush } from '../../modules/callpilot-keepalive/src';
import { ApiError, apiRequest, tokenStore } from './api';
import { usesNativeAndroidPush } from './mobileSession';
import { SERVICE_MODE } from './config';

const supported = Platform.OS !== 'web';
if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

let prepared: Promise<boolean> | null = null;
let tokenListener: { remove(): void } | null = null;
let registrationPromise: Promise<RemotePushStatus> | null = null;
let generation = 0;
let currentStatus: RemotePushStatus = { ready: false, detail: 'Mobile push has not been registered.' };

export interface RemotePushStatus { ready: boolean; detail?: string; }

async function prepareChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('communications', {
      name: 'Calls & messages', importance: AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250],
    });
    // Must match CallPilot's ordinary message/alert FCM notification payload.
    await Notifications.setNotificationChannelAsync('business-alerts', {
      name: 'Business messages & alerts', importance: AndroidImportance.HIGH, sound: 'default',
    });
  }
}

async function prepare(): Promise<boolean> {
  if (!supported) return false;
  await prepareChannels();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (current.status === 'denied' || !current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

function sameSession(binding: { deviceUid: string | null; organizationUid: string | null }): boolean {
  const current = tokenStore.getSession();
  return tokenStore.hasSession() && current.deviceUid === binding.deviceUid && current.organizationUid === binding.organizationUid;
}

async function registerToken(token: string, expectedGeneration: number): Promise<RemotePushStatus> {
  const binding = tokenStore.getSession();
  if (!binding.deviceUid || !binding.organizationUid) {
    return { ready: false, detail: 'Sign out and sign in with your emailed verification code to enable calls while CallPilot is closed.' };
  }
  if (!nativeCallPush.available) {
    return { ready: false, detail: 'Install the updated native CallPilot build to enable incoming call push.' };
  }
  // Establish nonsecret native identity before the server can target this phone.
  nativeCallPush.configureSession(binding.deviceUid, binding.organizationUid);
  try {
    const result = await apiRequest<{ fcm_registered?: boolean }>(`/jigsaw/devices/${encodeURIComponent(binding.deviceUid)}/native-push/`, {
      method: 'POST', body: { fcm_token: token },
    });
    if (generation !== expectedGeneration || !sameSession(binding)) return { ready: false, detail: 'The mobile session changed during push registration.' };
    if (!result.fcm_registered) throw new Error('The server did not confirm this phone\'s Firebase registration.');
    return { ready: true };
  } catch (error) {
    if (generation === expectedGeneration && (!tokenStore.hasSession() || error instanceof ApiError && [401, 403].includes(error.status))) nativeCallPush.clearSession();
    return { ready: false, detail: error instanceof Error ? error.message : 'Could not register this phone for incoming call push.' };
  }
}

export const notificationService = {
  ensureReady(): Promise<boolean> {
    prepared ??= prepare().catch(() => false);
    return prepared;
  },

  getRemotePushStatus(): RemotePushStatus { return currentStatus; },

  /** Native FCM token, not an ExponentPushToken. Call again after sign-in/resume. */
  registerRemotePush(): Promise<RemotePushStatus> {
    if (!usesNativeAndroidPush || SERVICE_MODE !== 'live') return Promise.resolve({ ready: false, detail: 'Android native push requires an installed native build.' });
    if (registrationPromise) return registrationPromise;
    const expectedGeneration = generation;
    const pending = (async () => {
      if (!tokenStore.isDeviceBound()) return { ready: false, detail: 'Sign out and sign in with your emailed verification code to enable calls while CallPilot is closed.' };
      await prepareChannels();
      const permission = await Notifications.getPermissionsAsync();
      // Settings can change while the app is closed. Recheck the OS instead of
      // trusting a cached denied result, and never repeatedly prompt on resume.
      if (!permission.granted && (permission.status === 'denied' || !(await notificationService.ensureReady()))) return { ready: false, detail: 'Allow CallPilot notifications in Android settings to receive incoming call alerts.' };
      try {
        if (!tokenListener) {
          tokenListener = Notifications.addPushTokenListener((value) => {
            if (value.type !== 'android' || typeof value.data !== 'string' || !tokenStore.isDeviceBound()) return;
            const rotationGeneration = generation;
            void registerToken(value.data, rotationGeneration).then((status) => {
              if (generation === rotationGeneration) currentStatus = status;
            });
          });
        }
        const token = await Notifications.getDevicePushTokenAsync();
        if (token.type !== 'android' || typeof token.data !== 'string' || !token.data) throw new Error('Firebase did not return an Android device token. Check this build\'s Firebase configuration.');
        if (generation !== expectedGeneration) return { ready: false, detail: 'The mobile session changed.' };
        return await registerToken(token.data, expectedGeneration);
      } catch (error) {
        return { ready: false, detail: error instanceof Error ? error.message : 'Firebase registration failed.' };
      }
    })().catch((error): RemotePushStatus => ({ ready: false, detail: error instanceof Error ? error.message : 'Could not prepare Android notifications.' })).then((status) => {
      if (generation === expectedGeneration) currentStatus = status;
      return status;
    }).finally(() => { if (registrationPromise === pending) registrationPromise = null; });
    registrationPromise = pending;
    return pending;
  },

  /** Clear local eligibility immediately; remote revocation is handled at logout. */
  stopRemotePush(): void {
    generation += 1;
    registrationPromise = null;
    tokenListener?.remove();
    tokenListener = null;
    nativeCallPush.clearSession();
    currentStatus = { ready: false, detail: 'This phone is signed out of incoming call push.' };
  },

  async notify(title: string, body: string, url: string): Promise<void> {
    if (!(await notificationService.ensureReady())) return;
    try {
      await Notifications.scheduleNotificationAsync({ content: { title, body, data: { url } }, trigger: null });
    } catch { /* Local notifications must not break synchronization. */ }
  },
};
