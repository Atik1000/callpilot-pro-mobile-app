/**
 * Service mode switch.
 * - 'live': talks to the CallPilot API (EXPO_PUBLIC_API_URL or the dev API).
 * - 'mock': fully local mock data, no network — useful for offline UI work.
 */
export const SERVICE_MODE: 'mock' | 'live' =
  process.env.EXPO_PUBLIC_SERVICE_MODE === 'mock' ? 'mock' : 'live';

/** Simulated network latency so loading states are visible in mock mode. */
export function mockDelay(ms = 350): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * How incoming calls reach the phone while the app is closed (Android):
 * - 'push' (default): CallPilot server push mode — the backend sends an FCM
 *   push per call and dials this device after Answer. Needs Firebase in the
 *   build (google-services.json) and a device-bound session; otherwise the app
 *   falls back to 'service' automatically.
 * - 'service': the always-on foreground service keeps the line connected.
 */
export const CALL_WAKE: 'push' | 'service' =
  process.env.EXPO_PUBLIC_CALL_WAKE === 'service' ? 'service' : 'push';
