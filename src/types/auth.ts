export interface User {
  id: string;
  name: string;
  email: string;
  businessNumber: string;
}

export type AuthStage = 'restoring' | 'signedOut' | 'awaitingOtp' | 'signedIn';
