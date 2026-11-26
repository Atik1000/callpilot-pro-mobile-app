import type { NativePushDiagnostics } from '../../modules/callpilot-keepalive/src';

const STAGES: Record<string, string> = {
  not_received: 'No incoming call push has been recorded on this phone yet.',
  fcm_call_received: 'Firebase reached this phone; native call handling started.',
  missing_session: 'The last push was rejected because this phone had no saved mobile sign-in binding.',
  invalid_or_expired: 'The last push reached this phone but its invitation was invalid or expired.',
  dedup: 'A duplicate incoming call push was ignored.',
  busy: 'The last push was ignored while another call or invitation was active.',
  capacity: 'The last push was rejected because the recent-invitation limit was reached.',
  accepted: 'The last incoming call push passed the native invitation checks.',
  notification_posted: 'The incoming call notification was submitted to Android. This does not prove it was visible.',
  active_notification_posted: 'The connected call notification was submitted to Android.',
  notification_permission_blocked: 'The app notification setting was disabled when the push arrived. Call notifications may have system exemptions; check the Incoming calls channel too.',
  notification_channel_blocked: 'The Incoming calls notification channel was disabled when the push arrived.',
  notification_post_failed: 'The phone received the push, but Android rejected the call notification.',
};

/** Only fixed, nonsecret status text is shown; no raw push/provider content. */
export function describeCallPush(diagnostics: NativePushDiagnostics | null): string {
  if (!diagnostics) return 'The native call receiver is unavailable. Install the native CallPilot APK.';
  if (diagnostics.native_push_version !== 2) return 'Install the updated native APK to see incoming push reception diagnostics.';
  const stage = diagnostics.last_call_push_stage || 'not_received';
  return STAGES[stage] || 'The native call receiver has no recognised result for this build.';
}
