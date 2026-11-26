import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { keepAlive } from '../../modules/callpilot-keepalive/src';
import { apiRequest, tokenStore } from './api';
import { notificationService } from './notificationService';

/**
 * Installation registration for CallPilot server push mode
 * (see docs/whatsapp-calling-and-mobile.md, "Sign in and register the installation"):
 *
 * 1. POST /jigsaw/auth/device/ {name, platform} with the OTP-verified JWT
 *    -> {device:{uid}, access, refresh}: tokens bound to this installation.
 * 2. POST /jigsaw/devices/{uid}/native-push/ with that device's own JWT:
 *    Android {fcm_token}; iOS {apns_token, voip_token, environment}.
 * 3. On sign-out: DELETE native-push, then POST /jigsaw/devices/{uid}/revoke/.
 *
 * Web never binds a device (the dashboard is the browser phone).
 */
const nativePlatform = Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : null;

interface DeviceAuthResponse {
  device?: { uid?: string };
  access?: string;
  refresh?: string;
}

type IdPayload = Record<string, unknown> & { data?: Record<string, unknown> };
const pickId = (payload: IdPayload | null): string | null => {
  for (const key of ['uid', 'uuid', 'id']) {
    const value = payload?.[key] ?? payload?.data?.[key];
    if (typeof value === 'string' && value) return value;
  }
  return null;
};

function deviceName(): string {
  const name = Device.deviceName || Device.modelName;
  if (name) return name.slice(0, 100);
  return Platform.OS === 'ios' ? 'iPhone' : 'Android phone';
}

/** Last token set sent to the backend this run, to skip identical re-posts. */
let registeredPushToken: string | null = null;

export const deviceService = {
  /** Remembers the business this session acts for (X-Organization-Id). */
  async loadOrganization(): Promise<void> {
    if (tokenStore.organizationUid()) return;
    const org = await apiRequest<IdPayload>('/organizations/me').catch(() => null);
    const uid = pickId(org);
    if (uid) await tokenStore.saveOrganization(uid);
  },

  /**
   * Binds the signed-in session to this installation. Must run right after
   * the OTP sign-in; a password-only session is rejected by the backend.
   * Returns false (keeping the current session) when binding is not possible.
   */
  async bind(): Promise<boolean> {
    if (!nativePlatform) return false;
    if (tokenStore.deviceUid()) return true;
    try {
      const data = await apiRequest<DeviceAuthResponse>('/jigsaw/auth/device/', {
        method: 'POST',
        body: { name: deviceName(), platform: nativePlatform },
      });
      const uid = data.device?.uid;
      if (!uid || !data.access || !data.refresh) {
        console.warn('[device] bind: unexpected response keys', Object.keys(data ?? {}).join(','));
        return false;
      }
      console.log('[device] bound');
      await tokenStore.saveDevice(uid, data.access, data.refresh);
      return true;
    } catch (error) {
      console.warn('[device] bind failed:', error instanceof Error ? error.message : error);
      return false;
    }
  },

  /**
   * Registers this installation's current native push tokens. Safe to call on
   * every launch: the platform may have rotated the token since last time.
   */
  async registerPush(): Promise<void> {
    const uid = tokenStore.deviceUid();
    if (!uid || !nativePlatform) return;
    let body: Record<string, string> | null = null;
    if (nativePlatform === 'android') {
      const token = await keepAlive.getPushToken();
      if (token) body = { fcm_token: token };
    } else {
      // Calls ring through the PushKit VoIP token; message/alert banners use
      // the ordinary APNs token (needs notification permission).
      const voip = await keepAlive.getPushToken();
      let apns: string | null = null;
      if (await notificationService.ensureReady()) {
        apns = await Notifications.getDevicePushTokenAsync()
          .then((t) => (typeof t.data === 'string' ? t.data : null))
          .catch(() => null);
      }
      if (voip || apns) {
        body = { environment: keepAlive.getApnsEnvironment() };
        if (voip) body.voip_token = voip;
        if (apns) body.apns_token = apns;
      }
    }
    const key = body && JSON.stringify(body);
    if (!body || key === registeredPushToken) return;
    try {
      await apiRequest(`/jigsaw/devices/${uid}/native-push/`, { method: 'POST', body });
      registeredPushToken = key;
    } catch (error) {
      console.warn('[device] push registration failed:', error instanceof Error ? error.message : error);
    }
  },

  /** Stops pushes and revokes the installation while the bound session is still valid. */
  async unregister(): Promise<void> {
    const uid = tokenStore.deviceUid();
    registeredPushToken = null;
    if (!uid) return;
    await apiRequest(`/jigsaw/devices/${uid}/native-push/`, { method: 'DELETE' }).catch(() => undefined);
    await apiRequest(`/jigsaw/devices/${uid}/revoke/`, { method: 'POST', body: {} }).catch(() => undefined);
  },
};
