import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { parseMobilePush } from '../src/services/mobileCallProtocol.ts';

const CALL = '407369bc-49c6-4f4d-a48f-2ced31af6b55';
const INVITATION = '93ea2d5a-6b70-4226-99a8-14851be978b2';
const ORGANIZATION = '26cb412b-6c6e-4235-a15b-e4c62a6469ad';
const OTHER = '1da062ad-b58e-413b-8dde-b1c0e6e5aebd';
const NOW = Date.parse('2026-11-25T12:00:00Z');
const EXPIRY = '2026-11-25T12:00:25+00:00';
const CALL_PATH = `/voice/api/mobile/calls/${CALL}/`;

const sourcePath = path.resolve(import.meta.dirname, '../src/services/mobileCallService.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

async function flush() {
  for (let index = 0; index < 15; index += 1) await Promise.resolve();
}

function createHarness() {
  const clock = { now: NOW };
  let nextTimer = 1;
  const timers = new Map();
  const calls = [];
  const nativeClears = [];
  const nativeActive = [];
  const events = { invitations: [], dismissals: [], errors: [], answers: 0, ends: 0 };
  let inviteReceiver;
  let appStateReceiver;
  let pending = null;
  let requestOverride = null;
  let currentServer = {
    call_uuid: CALL, invitation_uid: INVITATION, organization_uid: ORGANIZATION,
    state: 'pending', expires_at: EXPIRY, channel: 'phone',
    caller: { number: '+447700900123', name: 'Fixture caller' }, can_connect: true,
  };
  const listener = {
    onInvitation: (value) => events.invitations.push(value),
    onDismiss: (uid) => events.dismissals.push(uid),
    onAnswerRequested: async () => { events.answers += 1; await Promise.resolve(); },
    onEndRequested: () => { events.ends += 1; },
    onError: (message) => events.errors.push(message),
  };
  const session = { deviceUid: 'device-fixture', organizationUid: ORGANIZATION };
  const tokenStore = { isDeviceBound: () => true, getSession: () => session, load: async () => true };
  class ApiError extends Error {
    constructor(status) { super('Fixture API error'); this.status = status; }
  }
  const apiRequest = async (url, options) => {
    calls.push({ url, options });
    if (requestOverride) return requestOverride(url, options);
    return url === '/voice/api/mobile/calls/' ? { calls: [] } : { ...currentServer };
  };
  const nativeCallPush = {
    available: true,
    addInviteListener: (receive) => {
      inviteReceiver = receive;
      return { remove: () => { inviteReceiver = undefined; } };
    },
    getPendingInvitation: () => pending,
    clearInvitation: (uid) => nativeClears.push(uid),
    endCall: (uid) => nativeClears.push(uid),
    markCallActive: (uid) => nativeActive.push(uid),
  };
  function setTimer(callback, delay, interval = false) {
    const id = nextTimer++;
    timers.set(id, { callback, at: clock.now + delay, delay, interval });
    return id;
  }
  class ClockDate extends Date { static now() { return clock.now; } }
  const dependencies = {
    'react-native': {
      Platform: { OS: 'android' },
      AppState: { addEventListener: (_event, receive) => {
        appStateReceiver = receive;
        return { remove: () => { appStateReceiver = undefined; } };
      } },
    },
    '../../modules/callpilot-keepalive/src': { nativeCallPush },
    './api': { apiRequest, ApiError, tokenStore },
    './mobileCallProtocol': { parseMobilePush: (value) => parseMobilePush(value, clock.now) },
  };
  const module = { exports: {} };
  const context = vm.createContext({
    exports: module.exports, module, Date: ClockDate, console,
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
    setTimeout: (callback, delay) => setTimer(callback, delay),
    setInterval: (callback, delay) => setTimer(callback, delay, true),
    clearTimeout: (id) => timers.delete(id), clearInterval: (id) => timers.delete(id),
  });
  new vm.Script(compiled, { filename: sourcePath }).runInContext(context);
  const service = module.exports.mobileCallService;
  return {
    service, calls, events, nativeClears, nativeActive, timers, clock, session,
    headless: module.exports.headlessPushAction,
    setPending: (value) => { pending = value; },
    setServer: (value) => { currentServer = { ...currentServer, ...value }; },
    setRequest: (callback) => { requestOverride = callback; },
    async start() { service.start(listener); await flush(); calls.length = 0; },
    async emit(value) { inviteReceiver?.(value); await flush(); },
    async foreground() { appStateReceiver?.('active'); await flush(); },
    async advance(ms) {
      const target = clock.now + ms;
      while (true) {
        const due = [...timers.entries()].filter(([, timer]) => timer.at <= target)
          .sort((left, right) => left[1].at - right[1].at)[0];
        if (!due) break;
        const [id, timer] = due;
        clock.now = timer.at;
        if (timer.interval) timer.at += timer.delay;
        else timers.delete(id);
        timer.callback();
        await flush();
      }
      clock.now = target;
      await flush();
    },
  };
}

const push = (action = 'open', values = {}) => ({
  call_uuid: CALL, organization_uid: ORGANIZATION, expires_at: EXPIRY, action, ...values,
});

test('a push for a previous business cannot request or present a call', async () => {
  const app = createHarness();
  await app.start();
  await app.emit(push('answer', { organization_uid: OTHER }));
  assert.equal(app.calls.length, 0);
  assert.equal(app.events.invitations.length, 0);
  assert.equal(app.events.answers, 0);
  assert.equal(app.service.invitation, null);
  app.service.stop();
});

test('a valid native invitation fetches authenticated state before showing caller information', async () => {
  const app = createHarness();
  await app.start();
  await app.emit(push());
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].url, CALL_PATH);
  assert.equal(app.events.invitations.length, 1);
  assert.equal(app.events.invitations[0].caller.name, 'Fixture caller');
  assert.equal(app.service.invitation.invitation_uid, INVITATION);
  assert.equal(app.events.answers, 0);
  app.service.stop();
});

test('concurrent duplicate Answer events initiate at most one answer request', async () => {
  const app = createHarness();
  await app.start();
  const resolveRequests = [];
  app.setRequest((url) => url === CALL_PATH ? new Promise((resolve) => resolveRequests.push(resolve)) : { calls: [] });
  // Both events are delivered before either authenticated GET has returned.
  const first = app.emit(push('answer'));
  const second = app.emit(push('answer'));
  await Promise.all([first, second]);
  for (const resolve of resolveRequests) resolve({
    call_uuid: CALL, invitation_uid: INVITATION, organization_uid: ORGANIZATION,
    state: 'pending', expires_at: EXPIRY, caller: { number: '+447700900123' }, can_connect: true,
  });
  await flush();
  assert.equal(app.events.answers, 1);
  app.service.stop();
});

test('expired authenticated call state dismisses the native screen without answering', async () => {
  const app = createHarness();
  await app.start();
  app.setServer({ state: 'expired', can_connect: false });
  await app.emit(push('answer'));
  assert.equal(app.service.invitation, null);
  assert.deepEqual(app.nativeClears, [CALL]);
  assert.equal(app.events.invitations.length, 0);
  assert.equal(app.events.answers, 0);
  app.service.stop();
});

test('confirmed media cancels the ringing deadline without ending an established call', async () => {
  const app = createHarness();
  await app.start();
  await app.emit(push());
  assert.equal([...app.timers.values()].filter((timer) => !timer.interval).length, 1);
  app.service.markMediaActive();
  app.setServer({ state: 'answered', can_connect: false });
  assert.equal([...app.timers.values()].filter((timer) => !timer.interval).length, 0);
  await app.advance(30_000);
  assert.equal(app.service.invitation.call_uuid, CALL);
  assert.deepEqual(app.nativeActive, [CALL]);
  assert.equal(app.events.dismissals.length, 0);
  assert.equal(app.nativeClears.length, 0);
  app.service.stop();
});

test('network loss still clears an unanswered call at its local deadline', async () => {
  const app = createHarness();
  await app.start();
  await app.emit(push());
  app.setRequest(() => Promise.reject(new Error('Device is offline')));
  await app.advance(26_000);
  assert.equal(app.service.invitation, null);
  assert.deepEqual(app.events.dismissals, [CALL]);
  assert.deepEqual(app.nativeClears, [CALL]);
  app.service.stop();
});

test('a duplicate Open during the Answer-to-media race does not end our answered leg', async () => {
  const app = createHarness();
  await app.start();
  await app.emit(push('answer'));
  app.setServer({ state: 'answered', can_connect: false });
  await app.emit(push('open'));
  assert.equal(app.service.invitation.state, 'answered');
  assert.equal(app.events.dismissals.length, 0);
  assert.equal(app.nativeClears.length, 0);
  app.service.markMediaActive();
  await app.advance(30_000);
  assert.equal(app.events.dismissals.length, 0);
  app.service.stop();
});

test('headless decline checks server state and ends an answered call after its ringing deadline', async () => {
  const app = createHarness();
  app.setServer({ state: 'answered', expires_at: '2026-11-25T10:00:00Z' });
  await app.headless(push('decline', { expires_at: '2026-11-25T10:00:00Z' }));
  assert.equal(app.calls[0].url, CALL_PATH);
  assert.equal(app.calls[1].url, `${CALL_PATH}end/`);
  assert.equal(app.calls[1].options.method, 'POST');
  assert.deepEqual(app.nativeClears, [CALL]);
});
