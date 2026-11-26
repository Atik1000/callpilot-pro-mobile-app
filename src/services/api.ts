import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { User } from '../types/auth';

export const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL || 'https://devapi.callpilot.pro/api/v1').replace(/\/$/, '');

const SESSION_KEY = 'callpilot.session.v2';
const ACCESS_KEY = 'callpilot.access';
const REFRESH_KEY = 'callpilot.refresh';

interface StoredSession {
  access: string;
  refresh: string | null;
  deviceUid: string | null;
  organizationUid: string | null;
  user: User | null;
}

const secureStorage = {
  get: (key: string) => Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key),
  set: (key: string, value: string) => Platform.OS === 'web' ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  remove: (key: string) => Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key),
};

let session: StoredSession | null = null;
let sessionGeneration = 0;
let refreshPromise: Promise<boolean> | null = null;
let refreshGeneration = -1;
let loading: Promise<boolean> | null = null;
let storageWrite: Promise<void> = Promise.resolve();
const emptySession = (access: string, refresh: string | null): StoredSession => ({
  access, refresh, deviceUid: null, organizationUid: null, user: null,
});

async function persist(next: StoredSession) {
  const generation = sessionGeneration;
  const write = storageWrite.catch(() => undefined).then(async () => {
    if (generation !== sessionGeneration) return;
    // One encrypted record keeps tokens and their handset/business binding together.
    await secureStorage.set(SESSION_KEY, JSON.stringify(next));
    if (generation === sessionGeneration) session = next;
  });
  storageWrite = write;
  await write;
}

export const tokenStore = {
  async load(): Promise<boolean> {
    if (session?.access) return true;
    if (loading) return loading;
    loading = (async () => {
      const generation = sessionGeneration;
      const serialized = await secureStorage.get(SESSION_KEY);
      if (generation !== sessionGeneration) return Boolean(session?.access);
      if (serialized) {
        try {
          const value = JSON.parse(serialized) as Partial<StoredSession>;
          if (typeof value.access === 'string' && value.access) {
            session = { ...emptySession(value.access, typeof value.refresh === 'string' ? value.refresh : null),
              deviceUid: typeof value.deviceUid === 'string' ? value.deviceUid : null,
              organizationUid: typeof value.organizationUid === 'string' ? value.organizationUid : null,
              user: value.user && typeof value.user.email === 'string' ? value.user as User : null };
            return true;
          }
        } catch { /* Invalid local session requires a normal sign-in. */ }
      }
      // Preserve an older desktop-style session for existing calling. It never
      // acquires native push access without a fresh emailed-OTP sign-in.
      const [access, refresh] = await Promise.all([secureStorage.get(ACCESS_KEY), secureStorage.get(REFRESH_KEY)]);
      if (generation !== sessionGeneration) return Boolean(session?.access);
      if (!access) return false;
      session = emptySession(access, refresh);
      return true;
    })().finally(() => { loading = null; });
    return loading;
  },
  async beginSession(access: string, refresh?: string): Promise<void> {
    sessionGeneration += 1;
    await persist(emptySession(access, refresh ?? null));
    await Promise.all([secureStorage.remove(ACCESS_KEY), secureStorage.remove(REFRESH_KEY)]);
  },
  async save(access: string, refresh?: string): Promise<void> {
    await persist({ ...(session ?? emptySession(access, null)), access, refresh: refresh ?? session?.refresh ?? null });
  },
  async saveBoundSession(access: string, refresh: string, binding: { deviceUid: string; organizationUid: string }): Promise<void> {
    if (!binding.deviceUid || !binding.organizationUid) throw new Error('The mobile session has no business or handset identity.');
    sessionGeneration += 1;
    await persist({ ...(session ?? emptySession(access, refresh)), access, refresh, ...binding });
  },
  async setOrganization(organizationUid: string): Promise<void> {
    if (!session) throw new Error('Sign in before selecting a business.');
    await persist({ ...session, organizationUid });
  },
  async setUser(user: User): Promise<void> {
    if (session) await persist({ ...session, user });
  },
  getCachedUser(): User | null { return session?.user ?? null; },
  getSession(): { deviceUid: string | null; organizationUid: string | null } {
    return { deviceUid: session?.deviceUid ?? null, organizationUid: session?.organizationUid ?? null };
  },
  isDeviceBound(): boolean { return Boolean(session?.deviceUid && session.organizationUid); },
  async clear(): Promise<void> {
    sessionGeneration += 1;
    session = null;
    const clear = storageWrite.catch(() => undefined).then(() => Promise.all([secureStorage.remove(SESSION_KEY), secureStorage.remove(ACCESS_KEY), secureStorage.remove(REFRESH_KEY)]).then(() => undefined));
    storageWrite = clear;
    await clear;
  },
  hasSession(): boolean { return Boolean(session?.access); },
};

export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message: string) { super(message); }
}

function errorMessageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const parts = Object.entries(body as Record<string, unknown>).map(
      ([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`,
    );
    if (parts.length) return parts.join('\n');
  }
  return typeof body === 'string' && body ? body : fallback;
}

async function timedFetch(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timeout); }
}

async function refreshAccessToken(): Promise<boolean> {
  const original = session;
  const generation = sessionGeneration;
  if (refreshPromise && refreshGeneration === generation) return refreshPromise;
  if (!original?.refresh) return false;
  const pending = (async () => {
    const response = await timedFetch(`${API_BASE_URL}${original.deviceUid ? '/jigsaw/auth/refresh/' : '/token/refresh'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: original.refresh }),
    });
    if (generation !== sessionGeneration) return false;
    if (!response.ok) {
      if ([400, 401, 403].includes(response.status)) await tokenStore.clear();
      else throw new ApiError(response.status, null, 'Session renewal is temporarily unavailable. Try again when connected.');
      return false;
    }
    const data = await response.json() as { access?: string; refresh?: string };
    if (generation !== sessionGeneration) return false;
    if (!data.access) throw new Error('The server returned an incomplete session renewal.');
    await tokenStore.save(data.access, data.refresh);
    return true;
  })().finally(() => { if (refreshPromise === pending) refreshPromise = null; });
  refreshGeneration = generation;
  refreshPromise = pending;
  return pending;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const doFetch = () => timedFetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    method, headers: { 'Content-Type': 'application/json',
      ...(auth && session?.access ? { Authorization: `Bearer ${session.access}` } : {}),
      ...(auth && session?.organizationUid ? { 'X-Organization-Id': session.organizationUid } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const generation = sessionGeneration;
  let response = await doFetch();
  if (response.status === 401 && auth && generation === sessionGeneration) {
    if (await refreshAccessToken()) response = await doFetch();
    if (response.status === 401 && generation === sessionGeneration) await tokenStore.clear();
  }
  if (auth && generation !== sessionGeneration) throw new ApiError(409, null, 'The mobile session changed. Retry using the current account.');
  const text = await response.text();
  let parsed: unknown;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!response.ok) throw new ApiError(response.status, parsed, errorMessageFrom(parsed, `Request failed (${response.status})`));
  return parsed as T;
}

export function jigsaw<T>(path: string, method: RequestOptions['method'] = 'GET', body?: unknown): Promise<T> {
  return apiRequest<T>(`/jigsaw/${path}`, { method, body });
}
