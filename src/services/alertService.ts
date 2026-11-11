import { AppAlert } from '../types';
import { mockAlerts } from '../data/mockAlerts';
import { jigsaw } from './api';
import { SERVICE_MODE, mockDelay } from './config';
import { ApiAlert, mapAlert } from './mappers';

const liveAlertService = {
  async getAlerts(): Promise<AppAlert[]> {
    // Read alerts are kept: the screen filters All vs Unread like the web.
    const data = await jigsaw<{ results: ApiAlert[] }>('alerts/?limit=100');
    return (data.results ?? [])
      .map(mapAlert)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },

  /** Approve an AI suggestion ("Send"). */
  async approveAlert(id: string): Promise<void> {
    await jigsaw('alerts/', 'PATCH', { uid: id, decision: 'approve' });
  },

  /** Dismiss / mark read. */
  async dismissAlert(id: string): Promise<void> {
    await jigsaw('alerts/', 'PATCH', { uid: id, read: true });
  },
};

const mockAlertService: typeof liveAlertService = {
  async getAlerts() {
    await mockDelay();
    return mockAlerts;
  },
  async approveAlert() {
    await mockDelay(250);
  },
  async dismissAlert() {
    await mockDelay(250);
  },
};

export const alertService = SERVICE_MODE === 'live' ? liveAlertService : mockAlertService;
