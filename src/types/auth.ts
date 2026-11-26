export interface User {
  id: string;
  name: string;
  email: string;
  businessNumber: string;
  deviceUid?: string;
  organizationUid?: string;
}

export type AuthStage = 'restoring' | 'signedOut' | 'awaitingOtp' | 'signedIn';
