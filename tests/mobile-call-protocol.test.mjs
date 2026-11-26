import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesMobileCall, parseMobilePush, readCallPilotHeaders } from '../src/services/mobileCallProtocol.ts';

const CALL = '407369bc-49c6-4f4d-a48f-2ced31af6b55';
const INVITATION = '93ea2d5a-6b70-4226-99a8-14851be978b2';
const ORGANIZATION = '26cb412b-6c6e-4235-a15b-e4c62a6469ad';
const OTHER = '1da062ad-b58e-413b-8dde-b1c0e6e5aebd';
const NOW = Date.parse('2026-11-25T12:00:00Z');
const push = {
  kind: 'incoming_call', v: '1', call_uuid: CALL, organization_uid: ORGANIZATION,
  expires_at: '2026-11-25T12:00:25+00:00',
};
const headers = [
  { name: 'X-CallPilot-Call-UUID', value: CALL },
  { name: 'X-CallPilot-Invitation-UUID', value: INVITATION },
];
const event = (values = headers) => ({ params: { dialogParams: { custom_headers: values } } });
const expected = { call_uuid: CALL, invitation_uid: INVITATION };

test('FCM data and persisted native events validate without requiring the UI', () => {
  assert.deepEqual(parseMobilePush(push, NOW), {
    call_uuid: CALL, organization_uid: ORGANIZATION, expires_at: push.expires_at, action: 'open',
  });
  const { kind: _kind, v: _version, ...nativeEvent } = push;
  assert.equal(parseMobilePush({ ...nativeEvent, action: 'answer' }, NOW)?.action, 'answer');
  assert.equal(parseMobilePush({ ...nativeEvent, action: 'decline' }, NOW)?.action, 'decline');
});

test('invalid, expired, implausibly future and wrong-kind pushes never create an invite', () => {
  for (const value of [null, [], {}, { ...push, kind: 'callpilot_message' }, { ...push, v: '2' },
    { ...push, call_uuid: 'provider-call-id' }, { ...push, organization_uid: '' },
    { ...push, expires_at: 'yesterday' }, { ...push, expires_at: '2026-11-25T12:00:00Z' },
    { ...push, expires_at: '2026-11-25T12:02:00Z' }, { ...push, action: 'auto_accept' }]) {
    assert.equal(parseMobilePush(value, NOW), null);
  }
  assert.equal(parseMobilePush(push, Number.NaN), null);
});

test('Telecom disconnect can be processed after the original ringing deadline', () => {
  const endedRinging = { ...push, expires_at: '2026-11-25T10:00:00Z' };
  assert.equal(parseMobilePush({ ...endedRinging, action: 'decline' }, NOW)?.action, 'decline');
  assert.equal(parseMobilePush({ ...endedRinging, action: 'answer' }, NOW), null);
  assert.equal(parseMobilePush({ ...endedRinging, action: 'open' }, NOW), null);
  assert.equal(parseMobilePush({ ...endedRinging, expires_at: 'invalid', action: 'decline' }, NOW), null);
  assert.equal(parseMobilePush({ ...push, expires_at: '2026-11-25T12:02:00Z', action: 'decline' }, NOW), null);
});

test('only the SDK raw invite and public Call header representations are read', () => {
  assert.deepEqual(readCallPilotHeaders(event()), expected);
  assert.deepEqual(readCallPilotHeaders({}, { inviteCustomHeaders: headers }), expected);
  assert.deepEqual(readCallPilotHeaders({ inviteCustomHeaders: headers }), expected);
  assert.deepEqual(readCallPilotHeaders(event(), { inviteCustomHeaders: headers }), expected);
  assert.equal(readCallPilotHeaders({ headers }), null);
  assert.equal(readCallPilotHeaders({ params: { headers } }), null);
  assert.equal(readCallPilotHeaders({ callId: CALL, invitation_uid: INVITATION }), null);
});

test('header names and canonical UUID casing are case-insensitive', () => {
  const upper = headers.map(({ name, value }) => ({ name: name.toLowerCase(), value: value.toUpperCase() }));
  assert.equal(matchesMobileCall(event(upper), expected), true);
  assert.equal(matchesMobileCall(event(), { call_uuid: CALL.toUpperCase(), invitation_uid: INVITATION.toUpperCase() }), true);
});

test('both backend identifiers are required and unrelated next calls are rejected', () => {
  assert.equal(matchesMobileCall(event(), expected), true);
  assert.equal(matchesMobileCall(event(), { ...expected, call_uuid: OTHER }), false);
  assert.equal(matchesMobileCall(event(), { ...expected, invitation_uid: OTHER }), false);
  assert.equal(matchesMobileCall(event([headers[0]]), expected), false);
  assert.equal(matchesMobileCall(event([headers[1]]), expected), false);
  assert.equal(matchesMobileCall(event(), { call_uuid: 'sdk-call-id', invitation_uid: INVITATION }), false);
  assert.equal(matchesMobileCall({}, expected), false);
});

test('conflicting duplicates and raw-Call disagreement fail closed', () => {
  assert.equal(matchesMobileCall(event([...headers, headers[0]]), expected), true);
  assert.equal(matchesMobileCall(event([...headers, { name: headers[0].name, value: OTHER }]), expected), false);
  assert.equal(matchesMobileCall(event(), expected, { inviteCustomHeaders: [
    { name: headers[0].name, value: OTHER }, headers[1],
  ] }), false);
});

test('malformed header representations cannot fall back to the next SIP call', () => {
  for (const value of [event([{ name: headers[0].name, value: '\n' + CALL }, headers[1]]),
    event([{ name: headers[0].name, value: 3 }, headers[1]]), event([null]),
    { params: { dialogParams: { custom_headers: { 'X-CallPilot-Call-UUID': CALL } } } }]) {
    assert.equal(matchesMobileCall(value, expected, { inviteCustomHeaders: headers }), false);
  }
});
