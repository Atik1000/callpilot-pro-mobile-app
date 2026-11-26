import { User } from '../types';
import { BUSINESS_NUMBER, CONSULTANT_NAME, MOCK_OTP } from '../data/constants';
import { ApiError, apiRequest, tokenStore } from './api';
import { SERVICE_MODE, mockDelay } from './config';
import { createMobileSession, usesNativeAndroidPush } from './mobileSession';
import { notificationService } from './notificationService';

export interface LoginResult { otpRequired: boolean; }
interface TokenResponse { otp_required?: boolean; otp_challenge?: string; access?: string; refresh?: string; }
interface MeResponse { first_name?: string; last_name?: string; email: string; is_otp_required?: boolean; }
interface PhoneNumbersResponse { results?: { phone_number?: string }[]; }

// The challenge identifies the server's exact login attempt. It is not persisted.
let pendingChallenge: { email: string; uid: string } | null = null;
let verifiedEmail: string | null = null;

const liveAuthService = {
  async login(email: string, password: string): Promise<LoginResult> {
    pendingChallenge = null;
    verifiedEmail = null;
    const data = await apiRequest<TokenResponse>('/token', {
      method: 'POST', auth: false, body: { email, password, remember_me: true },
    });
    if (data.otp_required) {
      if (!data.otp_challenge) throw new Error('The server did not return a verification challenge. Start sign-in again.');
      pendingChallenge = { email, uid: data.otp_challenge };
      return { otpRequired: true };
    }
    if (data.access) {
      notificationService.stopRemotePush();
      await tokenStore.beginSession(data.access, data.refresh);
      return { otpRequired: false };
    }
    throw new Error('Unexpected sign-in response.');
  },

  async verifyOtp(email: string, code: string): Promise<void> {
    // If device setup failed after the OTP succeeded, retry that setup without
    // submitting the already-consumed OTP for a second time.
    if (verifiedEmail !== email || !tokenStore.hasSession()) {
      if (!pendingChallenge || pendingChallenge.email !== email) throw new Error('Start sign-in again to request a fresh verification code.');
      const data = await apiRequest<TokenResponse>('/token/verify-otp', {
        method: 'POST', auth: false, body: { otp_challenge: pendingChallenge.uid, otp_code: code },
      });
      if (!data.access) throw new Error('The server did not issue a verified session.');
      notificationService.stopRemotePush();
      await tokenStore.beginSession(data.access, data.refresh);
      verifiedEmail = email;
      pendingChallenge = null;
    }
    if (usesNativeAndroidPush) await createMobileSession();
  },

  async fetchSessionUser(): Promise<User> {
    const [me, numbers] = await Promise.all([
      apiRequest<MeResponse>('/me/'),
      apiRequest<PhoneNumbersResponse>('/phone_number/').catch(() => ({ results: [] }) as PhoneNumbersResponse),
    ]);
    if (!tokenStore.hasSession()) throw new ApiError(401, null, 'Sign in again to renew this session.');
    const binding = tokenStore.getSession();
    const user: User = {
      id: me.email, name: [me.first_name, me.last_name].filter(Boolean).join(' ') || me.email,
      email: me.email, businessNumber: numbers.results?.[0]?.phone_number ?? '',
      deviceUid: binding.deviceUid ?? undefined, organizationUid: binding.organizationUid ?? undefined,
    };
    await tokenStore.setUser(user);
    verifiedEmail = null;
    return user;
  },

  async restoreSession(): Promise<User | null> {
    if (!(await tokenStore.load())) return null;
    try { return await liveAuthService.fetchSessionUser(); }
    catch (error) {
      if (!tokenStore.hasSession() || error instanceof ApiError && error.status === 401) {
        notificationService.stopRemotePush();
        await tokenStore.clear();
        return null;
      }
      // Losing connectivity must not erase the handset's authenticated binding.
      const cached = tokenStore.getCachedUser();
      if (cached) return cached;
      throw error;
    }
  },

  async logout(): Promise<void> {
    pendingChallenge = null;
    verifiedEmail = null;
    const { deviceUid } = tokenStore.getSession();
    notificationService.stopRemotePush();
    try {
      if (deviceUid && tokenStore.hasSession()) {
        await apiRequest(`/jigsaw/devices/${encodeURIComponent(deviceUid)}/native-push/`, { method: 'DELETE' }).catch(() => undefined);
        await apiRequest(`/jigsaw/devices/${encodeURIComponent(deviceUid)}/revoke/`, { method: 'POST' }).catch(() => undefined);
      }
    } finally {
      await tokenStore.clear();
    }
  },

  async signOutOtherDevices(): Promise<void> {
    // The existing UI does not promise a server-wide revoke not exposed by this API.
    await mockDelay(600);
  },
};

const mockUser: User = { id: 'user-1', name: CONSULTANT_NAME, email: '', businessNumber: BUSINESS_NUMBER };
const mockAuthService: typeof liveAuthService = {
  async login(email, _password) { await mockDelay(700); if (!email.includes('@')) throw new Error('Enter a valid work email'); return { otpRequired: true }; },
  async verifyOtp(_email, code) { await mockDelay(600); if (code !== MOCK_OTP) throw new Error(`That code is not right. Use ${MOCK_OTP} in mock mode.`); },
  async fetchSessionUser() { await mockDelay(200); return mockUser; },
  async restoreSession() { return null; },
  async logout() {},
  async signOutOtherDevices() { await mockDelay(800); },
};

export const authService = SERVICE_MODE === 'live' ? liveAuthService : mockAuthService;
