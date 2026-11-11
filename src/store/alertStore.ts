import { create } from 'zustand';
import { AppAlert } from '../types';
import { alertService } from '../services/alertService';

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface AlertState {
  status: LoadStatus;
  alerts: AppAlert[];

  load: () => Promise<void>;
  actionAlert: (id: string) => void;
  dismissAlert: (id: string) => void;
  /** Marks read but keeps the alert in the list (web "Mark read"). */
  markAlertRead: (id: string) => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  status: 'idle',
  alerts: [],

  load: async () => {
    if (get().status === 'loading') return;
    set({ status: get().status === 'ready' ? 'ready' : 'loading' });
    try {
      const alerts = await alertService.getAlerts();
      set({ alerts, status: 'ready' });
    } catch {
      if (get().status !== 'ready') set({ status: 'error' });
    }
  },

  actionAlert: (id) => {
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, status: 'actioned' } : a)),
    }));
    void alertService.approveAlert(id).catch(() => undefined);
  },

  dismissAlert: (id) => {
    set((s) => ({ alerts: s.alerts.filter((a) => a.id !== id) }));
    void alertService.dismissAlert(id).catch(() => undefined);
  },

  markAlertRead: (id) => {
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, isRead: true } : a)),
    }));
    void alertService.dismissAlert(id).catch(() => undefined);
  },
}));
