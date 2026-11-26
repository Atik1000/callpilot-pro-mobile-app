import { keepAlive } from '../../modules/callpilot-keepalive/src';
import { useAuthStore } from '../store/authStore';
import { deviceService } from './deviceService';
import { useCallStore } from '../store/callStore';

/**
 * Headless task run by Android without opening the app:
 * - a CallPilot `incoming_call` push woke the app (`push` = its data as JSON):
 *   show the call and fetch its state; the SDK leg is created after Answer;
 * - a native call action (`action` + `call_uuid`) arrived while JS was idle;
 * - FCM rotated the push token (`tokenRefresh`): register the new one;
 * - otherwise (reboot, app update, the system restarting the always-on
 *   service): restore the session and register the business line.
 */
export default async function lineTask(
  data?: { push?: string; action?: string; call_uuid?: string; tokenRefresh?: boolean },
): Promise<void> {
  const auth = useAuthStore.getState();
  if (auth.stage === 'restoring') await auth.restore();
  const signedIn = useAuthStore.getState().stage === 'signedIn';
  if (data?.action && data.call_uuid) {
    // Notification "Decline" (or headset) while the app's JS was not listening.
    if (signedIn) {
      await useCallStore
        .getState()
        .handleNativeCallAction({ action: data.action as 'end', call_uuid: data.call_uuid })
        .catch(() => undefined);
    }
    return;
  }
  if (data?.tokenRefresh) {
    if (signedIn) await deviceService.registerPush();
    return;
  }
  if (data?.push) {
    if (signedIn) useCallStore.getState().handleCallPush(data.push);
    else keepAlive.stop(); // session expired: stop the ring the push started
    return;
  }
  if (signedIn) useCallStore.getState().initVoip();
}
