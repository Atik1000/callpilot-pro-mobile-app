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
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://devapi.callpilot.pro/api/v1';

const ACCESS_KEY = 'callpilot.access';
const REFRESH_KEY = 'callpilot.refresh';

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

export const tokenStore = {
  async load(): Promise<boolean> {
    accessToken = await secureStorage.get(ACCESS_KEY);
    refreshToken = await secureStorage.get(REFRESH_KEY);
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
  async clear(): Promise<void> {
    accessToken = null;
    refreshToken = null;
    await secureStorage.remove(ACCESS_KEY);
    await secureStorage.remove(REFRESH_KEY);
  },
  hasSession(): boolean {
    return Boolean(accessToken);
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

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const response = await fetch(`${API_BASE_URL}/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { access?: string; refresh?: string };
    if (!data.access) return false;
    await tokenStore.save(data.access, data.refresh);
    return true;
  } catch {
    return false;
  }
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
