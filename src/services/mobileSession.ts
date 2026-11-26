import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { apiRequest, tokenStore } from './api';

export const usesNativeAndroidPush = Platform.OS === 'android'
  && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

/** Only called immediately after an emailed OTP was verified. */
export async function createMobileSession(): Promise<void> {
  if (!usesNativeAndroidPush || tokenStore.isDeviceBound()) return;
  const overview = await apiRequest<{ organization?: { uid?: string } }>('/jigsaw/overview/');
  const organizationUid = overview.organization?.uid;
  if (!organizationUid) throw new Error('Choose an active CallPilot business before enabling mobile calls.');
  await tokenStore.setOrganization(organizationUid);
  const result = await apiRequest<{ device?: { uid?: string }; access?: string; refresh?: string }>('/jigsaw/auth/device/', {
    method: 'POST', body: { name: 'CallPilot Android', platform: 'android' },
  });
  if (!result.device?.uid || !result.access || !result.refresh) throw new Error('The server did not issue a mobile handset session.');
  await tokenStore.saveBoundSession(result.access, result.refresh, { deviceUid: result.device.uid, organizationUid });
}
