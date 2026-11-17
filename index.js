// App entry: expo-router, plus the Android background task that keeps the
// business line registered when the app screen is closed.
import { AppRegistry } from 'react-native';
import 'expo-router/entry';

AppRegistry.registerHeadlessTask('CallPilotLineTask', () =>
  require('./src/services/lineTask').default,
);
