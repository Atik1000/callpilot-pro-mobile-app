export const colors = {
  primary: '#000000',
  secondary: '#2563EB',

  background: '#F5F6F8',
  surface: '#FFFFFF',

  textPrimary: '#000000',
  textSecondary: '#666666',
  textMuted: '#999999',

  border: '#E5E7EB',
  divider: '#EEEEEE',

  headerBackground: '#000000',
  headerText: '#FFFFFF',
  headerTextSecondary: '#D4D4D8',

  blueLight: '#EFF6FF',

  success: '#16A34A',
  warning: '#F59E0B',
  error: '#EF4444',

  disabled: '#BDBDBD',

  // Dark-surface helpers (active call screen, dark controls)
  darkControl: '#1F1F23',
  darkControlActive: '#3F3F46',
  inputDark: '#1A1A1F',
  borderDark: '#44444C',
} as const;

export type AppColor = keyof typeof colors;
