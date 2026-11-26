const test = require('node:test');
const assert = require('node:assert/strict');
const withCallPilotNativePush = require('../with-callpilot-native-push');

function runner() {
  const config = withCallPilotNativePush({ name: 'CallPilot', slug: 'callpilot' });
  return async (manifest) => config.mods.android.manifest({
    ...config,
    modResults: { manifest },
    modRequest: { platform: 'android', projectRoot: process.cwd(), introspect: true },
  });
}

const expoService = 'expo.modules.notifications.service.ExpoFirebaseMessagingService';

test('merged manifest selects CallPilot receiver while retaining unrelated app services', async () => {
  const run = runner();
  const manifest = { $: {}, application: [{ service: [
    { $: { 'android:name': expoService }, 'intent-filter': [{ action: [{ $: { 'android:name': 'com.google.firebase.MESSAGING_EVENT' } }] }] },
    { $: { 'android:name': 'example.UnrelatedService', 'android:exported': 'false' } },
  ] }] };
  const result = await run(manifest);
  const services = result.modResults.manifest.application[0].service;
  assert.equal(services[0].$['tools:node'], 'remove');
  assert.equal(services[0]['intent-filter'], undefined);
  assert.deepEqual(services[1].$, { 'android:name': 'example.UnrelatedService', 'android:exported': 'false' });
  assert.equal(result.modResults.manifest.$['xmlns:tools'], 'http://schemas.android.com/tools');
});

test('CNG repeated runs retain one removal marker without duplicating receiver declarations', async () => {
  const run = runner();
  const manifest = { $: {}, application: [{ service: [{ $: { 'android:name': 'expo.modules.callpilotkeepalive.CallPilotMessagingService' } }] }] };
  const once = await run(manifest);
  const twice = await run(once.modResults.manifest);
  const services = twice.modResults.manifest.application[0].service;
  assert.equal(services.length, 2);
  assert.equal(services.filter((service) => service.$['android:name'] === expoService).length, 1);
  assert.equal(services.filter((service) => service.$['android:name'] === 'expo.modules.callpilotkeepalive.CallPilotMessagingService').length, 1);
});
