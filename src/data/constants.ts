/** Shared business identity used across mock data and headers. */
export const BUSINESS_NUMBER = '020 3555 0190';
export const CONSULTANT_NAME = 'S. Carter';
export const CONSULTANT_EMAIL = 'sam.carter@brightrecruit.example';

/** Documented mock OTP — development only; no code is really sent anywhere. */
export const MOCK_OTP = '123456';

/** Returns an ISO timestamp for today at the given time. */
export function todayAt(hours: number, minutes: number): string {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

/** Returns an ISO timestamp for yesterday at the given time. */
export function yesterdayAt(hours: number, minutes: number): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}
