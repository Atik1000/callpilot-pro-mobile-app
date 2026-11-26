/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const test = require('node:test');
const root = path.resolve(__dirname, '../src/services');
const tick = () => new Promise(r => setImmediate(r));
function runtime() {
  const cache = new Map(), storage = new Map(), calls = [], nativeCalls = [];
  let fetcher = async () => { throw new Error('No test response'); }, tokenListener;
  let permission = { granted: true, status: 'granted', canAskAgain: false }, permissionRequests = 0;
  const notifications = {
    AndroidImportance: { MAX: 5, HIGH: 4 }, setNotificationHandler() {},
    async setNotificationChannelAsync() {}, async getPermissionsAsync() { return permission; },
    async requestPermissionsAsync() { permissionRequests++; return permission; },
    async getDevicePushTokenAsync() { return { type: 'android', data: 'native-fcm-test-device-token' }; },
    addPushTokenListener(cb) { tokenListener = cb; return { remove() { tokenListener = null; } }; },
    async scheduleNotificationAsync() {},
  };
  const native = { available: true, configureSession: (...args) => nativeCalls.push(['configure', ...args]), clearSession: () => nativeCalls.push(['clear']) };
  function load(file) {
    file = path.resolve(root, file);
    if (!file.endsWith('.ts')) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const customRequire = name => {
      if (name === '@react-native-async-storage/async-storage' || name === 'expo-secure-store') return { __esModule: true, default: {
        getItem: async k => storage.get(k) ?? null, setItem: async (k,v) => storage.set(k,v), removeItem: async k => storage.delete(k),
      }, getItemAsync: async k => storage.get(k) ?? null, setItemAsync: async (k,v) => storage.set(k,v), deleteItemAsync: async k => storage.delete(k) };
      if (name === 'react-native') return { Platform: { OS: 'android' } };
      if (name === 'expo-constants') return { __esModule: true, default: { executionEnvironment: 'standalone' }, ExecutionEnvironment: { StoreClient: 'storeClient' } };
      if (name === 'expo-notifications') return notifications;
      if (name.includes('modules/callpilot-keepalive')) return { nativeCallPush: native };
      if (name === './config') return { SERVICE_MODE: 'live', mockDelay: async () => {} };
      if (name === '../data/constants') return { BUSINESS_NUMBER: '', CONSULTANT_NAME: 'Mock', MOCK_OTP: '123456' };
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      throw new Error(`Unexpected import ${name}`);
    };
    const wrapper = vm.runInThisContext(`(function(require,module,exports,fetch,setTimeout,clearTimeout,AbortController,process){${code}\n})`, { filename: file });
    wrapper(customRequire, module, module.exports, async (url, opts) => { const request = { url, path: new URL(url).pathname.replace('/api/v1',''), ...opts, body: opts.body ? JSON.parse(opts.body) : undefined }; calls.push(request); return fetcher(request); }, setTimeout, clearTimeout, AbortController, { env: {} });
    return module.exports;
  }
  return { load, calls, nativeCalls, storage, onFetch: fn => { fetcher = fn; }, rotate: value => tokenListener?.({ type: 'android', data: value }), setPermission: value => { permission = value; }, permissionRequests: () => permissionRequests };
}
const response = (status, data) => ({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(data), json: async () => data });
test('OTP-bound mobile sessions, Firebase registration, offline restore and account isolation', async () => {
  const r = runtime(), api = r.load('api'), auth = r.load('authService').authService;
  r.onFetch(q => {
    if (q.path === '/token') return response(200, { otp_required: true, otp_challenge: 'challenge-uid' });
    if (q.path === '/token/verify-otp') { assert.deepEqual(q.body, { otp_challenge: 'challenge-uid', otp_code: '123456' }); return response(200, { access: 'otp-access', refresh: 'otp-refresh' }); }
    if (q.path === '/jigsaw/overview/') return response(200, { organization: { uid: 'business-uid' } });
    if (q.path === '/jigsaw/auth/device/') { assert.equal(q.headers['X-Organization-Id'], 'business-uid'); assert.equal(q.body.platform, 'android'); return response(201, { device: { uid: 'handset-uid' }, access: 'bound-access', refresh: 'bound-refresh' }); }
    if (q.path === '/me/') return response(200, { email: 'owner@example.test', first_name: 'Test', last_name: 'Owner' });
    if (q.path === '/phone_number/') return response(200, { results: [{ phone_number: '+447700900123' }] });
    throw new Error(q.path);
  });
  assert.equal((await auth.login('owner@example.test', 'fixture')).otpRequired, true);
  await auth.verifyOtp('owner@example.test', '123456');
  assert.deepEqual(api.tokenStore.getSession(), { deviceUid: 'handset-uid', organizationUid: 'business-uid' });
  const user = await auth.fetchSessionUser(); assert.equal(user.deviceUid, 'handset-uid');
  let refreshCount = 0;
  r.onFetch(q => {
    if (q.path === '/jigsaw/auth/refresh/') { refreshCount++; assert.equal(q.body.refresh, 'bound-refresh'); return response(200, { access: 'new-access', refresh: 'new-refresh' }); }
    if (q.headers.Authorization === 'Bearer bound-access') return response(401, {});
    assert.equal(q.headers.Authorization, 'Bearer new-access'); assert.equal(q.headers['X-Organization-Id'], 'business-uid'); return response(200, { ok: true });
  });
  await Promise.all([api.apiRequest('/a'), api.apiRequest('/b')]); assert.equal(refreshCount, 1);
  r.onFetch(() => { throw new Error('Network offline'); });
  assert.equal((await auth.restoreSession()).email, user.email); assert.equal(api.tokenStore.isDeviceBound(), true);
  const push = r.load('notificationService').notificationService;
  r.onFetch(q => { assert.equal(q.path, '/jigsaw/devices/handset-uid/native-push/'); assert.equal(q.body.fcm_token, 'native-fcm-test-device-token'); return response(200, { fcm_registered: true }); });
  assert.equal((await push.registerRemotePush()).ready, true); assert.deepEqual(r.nativeCalls.at(-1), ['configure','handset-uid','business-uid']);
  r.onFetch(q => { assert.equal(q.body.fcm_token, 'rotated-native-token'); return response(200, { fcm_registered: true }); });
  r.rotate('rotated-native-token'); await tick(); await tick();
  r.onFetch(q => response(200, {})); await auth.logout(); assert.equal(api.tokenStore.hasSession(), false); assert.equal(r.nativeCalls.at(-1)[0], 'clear');
  assert.ok(r.calls.some(q => q.path === '/jigsaw/devices/handset-uid/native-push/' && q.method === 'DELETE'));
  assert.ok(r.calls.some(q => q.path === '/jigsaw/devices/handset-uid/revoke/' && q.method === 'POST'));
  const second = runtime(), secondApi = second.load('api');
  await secondApi.tokenStore.beginSession('fixture-access','fixture-refresh');
  let release;
  second.onFetch(() => new Promise(resolve => { release = resolve; }));
  const oldRequest = secondApi.apiRequest('/slow'); await tick(); await secondApi.tokenStore.clear(); release(response(200, { private: 'old account' }));
  await assert.rejects(oldRequest, e => e.status === 409); assert.equal(secondApi.tokenStore.hasSession(), false);

});


test('notification permission changes recover without repeated denied prompts', async () => {
  const r = runtime(), { tokenStore } = r.load('api');
  await tokenStore.beginSession('bound-access', 'bound-refresh');
  await tokenStore.saveBoundSession('bound-access', 'bound-refresh', { deviceUid: 'handset', organizationUid: 'business' });
  const push = r.load('notificationService').notificationService;
  r.setPermission({ granted: false, status: 'denied', canAskAgain: true });
  assert.equal(await push.ensureReady(), false);
  assert.equal((await push.registerRemotePush()).ready, false);
  assert.equal(r.permissionRequests(), 0);
  r.setPermission({ granted: true, status: 'granted', canAskAgain: false });
  r.onFetch(() => response(200, { fcm_registered: true }));
  assert.equal((await push.registerRemotePush()).ready, true);
  assert.equal(r.permissionRequests(), 0);
});


test('password-only legacy sign-in never silently creates native device access', async () => {
  const r = runtime(), api = r.load('api'), auth = r.load('authService').authService;
  r.onFetch(q => {
    assert.equal(q.path, '/token');
    return response(200, { otp_required: false, access: 'password-access', refresh: 'password-refresh' });
  });
  assert.equal((await auth.login('owner@example.test', 'fixture')).otpRequired, false);
  assert.equal(api.tokenStore.isDeviceBound(), false);
  assert.equal((await r.load('notificationService').notificationService.registerRemotePush()).ready, false);
  assert.equal(r.calls.length, 1);
});
