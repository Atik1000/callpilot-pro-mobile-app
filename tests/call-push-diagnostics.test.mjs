import assert from 'node:assert/strict';
import test from 'node:test';
import { describeCallPush } from '../src/services/callPushDiagnostics.ts';

const diagnostic = { session_configured: true, notifications_enabled: true, full_screen_intent_allowed: true, native_push_version: 2 };

test('an old native build cannot falsely report that no push was received', () => {
  assert.match(describeCallPush({ ...diagnostic, native_push_version: undefined }), /updated native APK/);
  assert.match(describeCallPush(null), /receiver is unavailable/);
});

test('native receipt, rejection and notification submission are distinguished', () => {
  assert.match(describeCallPush({ ...diagnostic, last_call_push_stage: 'not_received' }), /No incoming call push/);
  assert.match(describeCallPush({ ...diagnostic, last_call_push_stage: 'missing_session' }), /saved mobile sign-in/);
  assert.match(describeCallPush({ ...diagnostic, last_call_push_stage: 'invalid_or_expired' }), /invalid or expired/);
  assert.match(describeCallPush({ ...diagnostic, last_call_push_stage: 'notification_channel_blocked' }), /channel was disabled/);
  assert.match(describeCallPush({ ...diagnostic, last_call_push_stage: 'notification_posted' }), /does not prove it was visible/);
});

test('unknown native values are never echoed as provider details', () => {
  assert.doesNotMatch(describeCallPush({ ...diagnostic, last_call_push_stage: 'token-secret-from-provider' }), /token-secret/);
});
