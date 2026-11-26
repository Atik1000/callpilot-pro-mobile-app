const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const callId = '11111111-1111-4111-8111-111111111111';
const invitationId = '22222222-2222-4222-8222-222222222222';
const expectedHeaders = [
  { name: 'X-CallPilot-Call-UUID', value: callId },
  { name: 'X-CallPilot-Invitation-UUID', value: invitationId },
];

function compile(file, mocks) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: (name) => {
    if (!(name in mocks)) throw new Error(`Unexpected dependency: ${name}`);
    return mocks[name];
  }, console, __DEV__: false, Date, setTimeout, clearTimeout, setInterval, clearInterval });
  return module.exports;
}

function fixture() {
  const clients = [];
  const requests = [];
  let onConnectRequest = async () => ({ state: 'connecting' });
  class ApiError extends Error { constructor(status) { super('Fixture provider error'); this.status = status; } }
  class Call {
    constructor(headers) { this.inviteCustomHeaders = headers; this.handlers = {}; this.answered = 0; this.ended = 0; }
    on(name, callback) { this.handlers[name] = callback; }
    async answer() { this.answered++; this.handlers['telnyx.call.state']?.(this, 'active'); }
    hangup() { this.ended++; }
  }
  class Client {
    constructor() { this.handlers = {}; clients.push(this); }
    on(name, callback) { this.handlers[name] = callback; }
    async connect() { this.handlers['telnyx.client.ready'](); }
    disconnect() {}
    async newCall(options) { this.dial = options; return new Call(); }
    invite(headers) {
      const call = new Call(headers);
      this.handlers['telnyx.call.incoming'](call, { params: { dialogParams: { custom_headers: headers } } });
      return call;
    }
  }
  const api = {
    ApiError,
    tokenStore: { isDeviceBound: () => true },
    apiRequest: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith('/connect/')) return onConnectRequest();
      if (url === '/voice/api/token/') return { token: 'fixture.jwt.value', call_session_proof: 'test-proof', extension_uid: invitationId };
      if (url === '/organizations/me') return { phone_number: '+441234567890' };
      if (url === '/me/') return { uid: invitationId };
      throw new Error(`Unexpected request ${url}`);
    },
  };
  const protocol = compile('src/services/mobileCallProtocol.ts', {});
  const exported = compile('src/services/voipService.ts', {
    'expo-constants': { __esModule: true, default: { executionEnvironment: 'standalone' }, ExecutionEnvironment: { StoreClient: 'storeClient' } },
    'react-native': { Platform: { OS: 'android' }, AppState: { addEventListener: () => ({ remove() {} }) },
      PermissionsAndroid: { request: async () => 'granted', PERMISSIONS: { RECORD_AUDIO: 'audio' }, RESULTS: { GRANTED: 'granted' } } },
    '../../modules/callpilot-keepalive/src': { keepAlive: { start() {}, stop() {}, stopRinging() {}, startRinging: () => true } },
    './api': api, './config': { SERVICE_MODE: 'live' }, './mobileCallProtocol': protocol,
    '@telnyx/react-native-voice-sdk': { TelnyxRTC: Client },
    'react-native-incall-manager': { default: { start() {}, stop() {}, setForceSpeakerphoneOn() {} } },
  });
  return { service: exported.nativeVoipService, clients, requests, ApiError,
    setConnect: (handler) => { onConnectRequest = handler; },
    invitation: { call_uuid: callId, invitation_uid: invitationId, expires_at: new Date(Date.now() + 10000).toISOString() } };
}

test('ordinary outgoing calls retain caller ID and per-call authorization', async () => {
  const f = fixture();
  try {
    await f.service.connect();
    await f.service.startCall('+44 7700 900123');
    assert.equal(f.clients[0].dial.destinationNumber, '+447700900123');
    assert.equal(f.clients[0].dial.callerIdNumber, '+441234567890');
    assert.equal(f.clients[0].dial.customHeaders[0].value, 'test-proof');
    assert.equal(f.clients[0].dial.customHeaders[1].value, invitationId);
  } finally { await f.service.disconnect(); }
});

test('push Answer rejects unrelated SIP legs and answers only both matching IDs', async () => {
  const f = fixture();
  let unrelated;
  let matched;
  try {
    await f.service.connect();
    f.setConnect(async () => {
      unrelated = f.clients[0].invite([{ name: 'X-CallPilot-Call-UUID', value: callId }]);
      matched = f.clients[0].invite(expectedHeaders);
      return { state: 'connecting' };
    });
    await f.service.answerMobileInvitation(f.invitation);
    assert.equal(unrelated.ended, 1);
    assert.equal(unrelated.answered, 0);
    assert.equal(matched.answered, 1);
    assert.equal(f.requests.filter((request) => request.url.endsWith('/connect/')).length, 1);
  } finally { await f.service.disconnect(); }
});

test('device-bound SIP invites cannot bypass an explicit push Answer', async () => {
  const f = fixture();
  try {
    await f.service.connect();
    const call = f.clients[0].invite(expectedHeaders);
    assert.equal(call.ended, 1);
    assert.equal(call.answered, 0);
  } finally { await f.service.disconnect(); }
});

test('an uncertain connect result waits for the same leg without redialing', async () => {
  const f = fixture();
  try {
    await f.service.connect();
    f.setConnect(async () => { throw new f.ApiError(502); });
    const answer = f.service.answerMobileInvitation(f.invitation);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const call = f.clients[0].invite(expectedHeaders);
    await answer;
    assert.equal(call.answered, 1);
    assert.equal(f.requests.filter((request) => request.url.endsWith('/connect/')).length, 1);
  } finally { await f.service.disconnect(); }
});
