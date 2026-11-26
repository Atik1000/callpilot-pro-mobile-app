import { create } from 'zustand';
import { AuthStage, User } from '../types';
import { authService } from '../services/authService';

interface AuthState {
  stage: AuthStage;
  user: User | null;
  pendingEmail: string | null;
  isLoading: boolean;
  error: string | null;

  /** Restores a persisted session on app start. */
  restore: () => Promise<void>;
  /** Returns 'signedIn', 'otp' (verification needed) or null on failure. */
  login: (email: string, password: string) => Promise<'signedIn' | 'otp' | null>;
  verifyOtp: (code: string) => Promise<boolean>;
  resendOtp: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

// Kept in memory only (never persisted) so "Resend code" can re-trigger login.
let pendingPassword: string | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  stage: 'restoring',
  user: null,
  pendingEmail: null,
  isLoading: false,
  error: null,

  restore: async () => {
    try {
      const user = await authService.restoreSession();
      set(user ? { stage: 'signedIn', user } : { stage: 'signedOut' });
    } catch {
      set({ stage: 'signedOut' });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await authService.login(email, password);
      if (result.otpRequired) {
        pendingPassword = password;
        set({ stage: 'awaitingOtp', pendingEmail: email, isLoading: false });
        return 'otp';
      }
      const user = await authService.fetchSessionUser();
      pendingPassword = null;
      set({ stage: 'signedIn', user, isLoading: false, pendingEmail: null });
      return 'signedIn';
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Sign in failed' });
      return null;
    }
  },

  verifyOtp: async (code) => {
    const email = get().pendingEmail;
    if (!email) {
      set({ error: 'Start again from the sign-in screen.' });
      return false;
    }
    set({ isLoading: true, error: null });
    try {
      await authService.verifyOtp(email, code);
      const user = await authService.fetchSessionUser();
      pendingPassword = null;
      set({ stage: 'signedIn', user, isLoading: false, pendingEmail: null });
      return true;
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Verification failed' });
      return false;
    }
  },

  resendOtp: async () => {
    const email = get().pendingEmail;
    if (!email || !pendingPassword) return;
    // A fresh login triggers the server to issue a new code.
    await authService.login(email, pendingPassword).catch(() => undefined);
  },

  logout: async () => {
    pendingPassword = null;
    set({ isLoading: true });
    try { await authService.logout(); }
    finally { set({ stage: 'signedOut', user: null, pendingEmail: null, error: null, isLoading: false }); }
  },

  clearError: () => set({ error: null }),
}));
