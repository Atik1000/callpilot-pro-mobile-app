const { withAndroidManifest } = require('expo/config-plugins');

const EXPO_FCM_SERVICE = 'expo.modules.notifications.service.ExpoFirebaseMessagingService';

/**
 * Select one FCM service. CallPilot subclasses Expo's receiver and delegates
 * ordinary notifications/token changes, avoiding duplicate call dispatch.
 * This config plugin is intentionally confined to the Expo receiver entry.
 */
function withCallPilotNativePush(config) {
  return withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const app = manifest.application && manifest.application[0];
    if (!app) throw new Error('Android application manifest is missing.');
    app.service = app.service || [];
    const existing = app.service.find((service) => service.$ && service.$['android:name'] === EXPO_FCM_SERVICE);
    if (existing) {
      existing.$['tools:node'] = 'remove';
      delete existing['intent-filter'];
    } else {
      app.service.push({ $: { 'android:name': EXPO_FCM_SERVICE, 'tools:node': 'remove' } });
    }
    return result;
  });
}

module.exports = withCallPilotNativePush;
