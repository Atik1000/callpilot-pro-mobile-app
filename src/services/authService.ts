import { User } from '../types';
import {
  BUSINESS_NUMBER,
  CONSULTANT_NAME,
  MOCK_OTP,
} from '../data/constants';
import { apiRequest, tokenStore } from './api';
import { SERVICE_MODE, mockDelay } from './config';

export interface LoginResult {
  otpRequired: boolean;
}

interface TokenResponse {
  otp_required?: boolean;
  access?: string;
  refresh?: string;
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
    if (data.otp_required) return { otpRequired: true };
    if (data.access) {
      await tokenStore.save(data.access, data.refresh);
      return { otpRequired: false };
    }
    throw new Error('Unexpected sign-in response.');
  },

  async verifyOtp(_email: string, code: string): Promise<void> {
    const data = await apiRequest<TokenResponse>('/token/verify-otp', {
      method: 'POST',
      auth: false,
      body: { otp_code: code },
    });
    if (!data.access) throw new Error('That code is not right.');
    await tokenStore.save(data.access, data.refresh);
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
      return await liveAuthService.fetchSessionUser();
    } catch {
      await tokenStore.clear();
      return null;
    }
  },

  async logout(): Promise<void> {
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
