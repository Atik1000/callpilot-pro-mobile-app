import { useAuthStore } from '../store/authStore';
import { useCallStore } from '../store/callStore';

/**
 * Headless task run by Android without opening the app (after a reboot, an
 * app update, or the system restarting the background service). Restores the
 * saved session and registers the business line so incoming calls ring.
 */
export default async function lineTask(): Promise<void> {
  const auth = useAuthStore.getState();
  if (auth.stage === 'restoring') await auth.restore();
  if (useAuthStore.getState().stage === 'signedIn') {
    useCallStore.getState().initVoip();
  }
}
