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
