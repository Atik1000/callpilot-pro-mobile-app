import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * CallPilot backend (discovered from the production dashboard):
 * - POST /token {email,password,remember_me} -> {otp_required} | {access,refresh}
 * - POST /token/verify-otp {otp_code}        -> {access,refresh}
 * - POST /token/refresh {refresh}            -> {access}
 * - GET  /me/, /phone_number/
 * - GET/POST/PATCH /jigsaw/* (contacts, messages, alerts, settings, documents)
 * - GET  /voice/api/calls/, /voice/api/voicemails/
 */
/**
 * Same backend as devfront.callpilot.pro (the Jigsaw workspace). Production
 * (api.callpilot.pro) has no /jigsaw/* routes yet; set
 * EXPO_PUBLIC_API_URL=https://api.callpilot.pro/api/v1 to target it anyway.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://devapi.callpilot.pro/api/v1';

const ACCESS_KEY = 'callpilot.access';
const REFRESH_KEY = 'callpilot.refresh';
/** Set once the session is bound to this installation (POST /jigsaw/auth/device/). */
const DEVICE_KEY = 'callpilot.device';
/** Business the session acts for; sent as X-Organization-Id on every request. */
const ORG_KEY = 'callpilot.organization';

/** SecureStore on device; AsyncStorage on web where SecureStore is unavailable. */
const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);
    return SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.removeItem(key);
    return SecureStore.deleteItemAsync(key);
  },
};

let accessToken: string | null = null;
let refreshToken: string | null = null;
let deviceUid: string | null = null;
let organizationUid: string | null = null;

/** Called when a device-bound session can no longer be refreshed (revoked). */
let onSessionLost: (() => void) | null = null;
export function setSessionLostHandler(handler: (() => void) | null) {
  onSessionLost = handler;
}

export const tokenStore = {
  async load(): Promise<boolean> {
    accessToken = await secureStorage.get(ACCESS_KEY);
    refreshToken = await secureStorage.get(REFRESH_KEY);
    deviceUid = await secureStorage.get(DEVICE_KEY);
    organizationUid = await secureStorage.get(ORG_KEY);
    return Boolean(accessToken);
  },
  async save(access: string, refresh?: string): Promise<void> {
    accessToken = access;
    await secureStorage.set(ACCESS_KEY, access);
    if (refresh) {
      refreshToken = refresh;
      await secureStorage.set(REFRESH_KEY, refresh);
    }
  },
  /** Replaces the unbound sign-in tokens with this installation's bound ones. */
  async saveDevice(uid: string, access: string, refresh: string): Promise<void> {
    deviceUid = uid;
    await secureStorage.set(DEVICE_KEY, uid);
    await tokenStore.save(access, refresh);
  },
  async saveOrganization(uid: string | null): Promise<void> {
    organizationUid = uid;
    if (uid) await secureStorage.set(ORG_KEY, uid);
    else await secureStorage.remove(ORG_KEY);
  },
  async clear(): Promise<void> {
    accessToken = null;
    refreshToken = null;
    deviceUid = null;
    organizationUid = null;
    await secureStorage.remove(ACCESS_KEY);
    await secureStorage.remove(REFRESH_KEY);
    await secureStorage.remove(DEVICE_KEY);
    await secureStorage.remove(ORG_KEY);
  },
  hasSession(): boolean {
    return Boolean(accessToken);
  },
  deviceUid(): string | null {
    return deviceUid;
  },
  organizationUid(): string | null {
    return organizationUid;
  },
};

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

function errorMessageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const parts = Object.entries(body as Record<string, unknown>).map(
      ([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`,
    );
    if (parts.length) return parts.join('\n');
  }
  if (typeof body === 'string' && body) return body;
  return fallback;
}

let refreshing: Promise<boolean> | null = null;

/**
 * Device-bound sessions refresh through /jigsaw/auth/refresh/ and never fall
 * back to an unbound session: a rejected refresh means the device was revoked
 * and the user must sign in again.
 */
async function doRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  const bound = Boolean(deviceUid);
  try {
    const response = await fetch(`${API_BASE_URL}${bound ? '/jigsaw/auth/refresh/' : '/token/refresh'}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (!response.ok) {
      if (bound && (response.status === 400 || response.status === 401 || response.status === 403)) {
        await tokenStore.clear();
        onSessionLost?.();
      }
      return false;
    }
    const data = (await response.json()) as { access?: string; refresh?: string };
    if (!data.access) return false;
    await tokenStore.save(data.access, data.refresh);
    return true;
  } catch {
    return false;
  }
}

/** One refresh at a time: parallel 401s share the same attempt. */
export function refreshAccessToken(): Promise<boolean> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
}

/** JSON request against the CallPilot API with one automatic token refresh. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const doFetch = () =>
    fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(auth && organizationUid ? { 'X-Organization-Id': organizationUid } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let response = await doFetch();
  if (response.status === 401 && auth && (await refreshAccessToken())) {
    response = await doFetch();
  }

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      parsed,
      errorMessageFrom(parsed, `Request failed (${response.status})`),
    );
  }
  return parsed as T;
}

/** Jigsaw namespace helper mirroring the dashboard's `jigsaw()` client. */
export function jigsaw<T>(
  path: string,
  method: RequestOptions['method'] = 'GET',
  body?: unknown,
): Promise<T> {
  return apiRequest<T>(`/jigsaw/${path}`, { method, body });
}
