export const colors = {
  /** Brand blue: buttons, active tabs, avatars, bubbles, call screens. */
  primary: '#2563EB',
  /** Deeper brand blue for full-screen backgrounds (auth, call screens). */
  primaryDark: '#1D4ED8',
  secondary: '#2563EB',

  background: '#F5F6F8',
  surface: '#FFFFFF',

  /** Body text stays near-black (navy) for legibility. */
  textPrimary: '#0F172A',
  textSecondary: '#666666',
  textMuted: '#999999',

  border: '#E5E7EB',
  divider: '#EEEEEE',

  headerBackground: '#1D4ED8',
  headerText: '#FFFFFF',
  headerTextSecondary: '#DBEAFE',
  /** Icon-button fill on the blue header. */
  headerControl: 'rgba(255,255,255,0.18)',

  blueLight: '#EFF6FF',

  success: '#16A34A',
  warning: '#F59E0B',
  error: '#EF4444',

  disabled: '#BDBDBD',

  // On-blue helpers (auth + call screens sit on the brand blue)
  darkControl: 'rgba(255,255,255,0.16)',
  darkControlActive: 'rgba(255,255,255,0.34)',
  inputDark: 'rgba(255,255,255,0.12)',
  borderDark: 'rgba(255,255,255,0.32)',
} as const;

export type AppColor = keyof typeof colors;
