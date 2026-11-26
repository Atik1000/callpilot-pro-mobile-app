// Native FCM presents incoming calls before React exists. Only a notification
// Decline needs a bounded headless authenticated action; no idle SIP keep-alive.
import { AppRegistry } from 'react-native';
import 'expo-router/entry';

AppRegistry.registerHeadlessTask('CallPilotPushAction', () =>
  require('./src/services/mobileCallService').headlessPushAction,
);
