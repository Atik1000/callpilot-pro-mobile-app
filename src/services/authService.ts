import { User } from '../types';
import {
  BUSINESS_NUMBER,
  CONSULTANT_NAME,
  MOCK_OTP,
} from '../data/constants';
import { apiRequest, tokenStore } from './api';
import { SERVICE_MODE, mockDelay } from './config';
import { deviceService } from './deviceService';

export interface LoginResult {
  otpRequired: boolean;
}

interface TokenResponse {
  otp_required?: boolean;
  otp_challenge?: string;
  access?: string;
  refresh?: string;
}

/** Returned by POST /token when a code was emailed; required by verify-otp. */
let otpChallenge: string | null = null;

/** After sign-in: business context, then bind this installation (native only). */
async function completeSignIn(): Promise<void> {
  await deviceService.loadOrganization();
  await deviceService.bind();
}

interface MeResponse {
  first_name?: string;
  last_name?: string;
  email: string;
  is_otp_required?: boolean;
}

interface PhoneNumbersResponse {
  results?: { phone_number?: string }[];
}

const liveAuthService = {
  async login(email: string, password: string): Promise<LoginResult> {
    const data = await apiRequest<TokenResponse>('/token', {
      method: 'POST',
      auth: false,
      body: { email, password, remember_me: true },
    });
    if (data.otp_required) {
      otpChallenge = data.otp_challenge ?? null;
      return { otpRequired: true };
    }
    if (data.access) {
      await tokenStore.save(data.access, data.refresh);
      // Trusted device (no OTP this time): still try to bind for push mode.
      // The backend may refuse a password-only session; then calls use the
      // always-on service instead.
      await completeSignIn();
      return { otpRequired: false };
    }
    throw new Error('Unexpected sign-in response.');
  },

  async verifyOtp(_email: string, code: string): Promise<void> {
    const data = await apiRequest<TokenResponse>('/token/verify-otp', {
      method: 'POST',
      auth: false,
      body: otpChallenge ? { otp_challenge: otpChallenge, otp_code: code } : { otp_code: code },
    });
    if (!data.access) throw new Error('That code is not right.');
    otpChallenge = null;
    await tokenStore.save(data.access, data.refresh);
    await completeSignIn();
  },

  /** Loads profile + business line for the signed-in session. */
  async fetchSessionUser(): Promise<User> {
    const [me, numbers] = await Promise.all([
      apiRequest<MeResponse>('/me/'),
      apiRequest<PhoneNumbersResponse>('/phone_number/').catch(
        () => ({ results: [] }) as PhoneNumbersResponse,
      ),
    ]);
    const name = [me.first_name, me.last_name].filter(Boolean).join(' ') || me.email;
    return {
      id: me.email,
      name,
      email: me.email,
      businessNumber: numbers.results?.[0]?.phone_number ?? '',
    };
  },

  /** Restores a persisted session; returns the user or null. */
  async restoreSession(): Promise<User | null> {
    const hasTokens = await tokenStore.load();
    if (!hasTokens) return null;
    try {
      const user = await liveAuthService.fetchSessionUser();
      // Sessions from before device binding existed: bind them now if allowed.
      await completeSignIn().catch(() => undefined);
      return user;
    } catch {
      await tokenStore.clear();
      return null;
    }
  },

  async logout(): Promise<void> {
    otpChallenge = null;
    await deviceService.unregister();
    await tokenStore.clear();
  },

  async signOutOtherDevices(): Promise<void> {
    // Device revocation exists per-device in the API (jigsaw/devices/<uid>/revoke/);
    // a bulk action is not exposed yet, so this remains a visual confirmation.
    await mockDelay(600);
  },
};

const mockUser: User = {
  id: 'user-1',
  name: CONSULTANT_NAME,
  email: '',
  businessNumber: BUSINESS_NUMBER,
};

const mockAuthService: typeof liveAuthService = {
  async login(email, _password) {
    await mockDelay(700);
    if (!email.includes('@')) throw new Error('Enter a valid work email');
    return { otpRequired: true };
  },
  async verifyOtp(_email, code) {
    await mockDelay(600);
    if (code !== MOCK_OTP) {
      throw new Error(`That code is not right. Use ${MOCK_OTP} in mock mode.`);
    }
  },
  async fetchSessionUser() {
    await mockDelay(200);
    return mockUser;
  },
  async restoreSession() {
    return null;
  },
  async logout() {},
  async signOutOtherDevices() {
    await mockDelay(800);
  },
};

export const authService = SERVICE_MODE === 'live' ? liveAuthService : mockAuthService;
