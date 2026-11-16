/**
 * CallPilot mobile UI kit colours. Text is always black or white; colour
 * means the same thing everywhere:
 * - AI Blue: main actions, links, active tab, positive progress
 * - Mint: done/received, Call and Answer, Connected
 * - Amber: waiting / needs action
 * - Red: missed, unsuccessful, missing, End call, errors
 */
export const colors = {
  black: '#000000',
  white: '#FFFFFF',

  aiBlue: '#1A66E5',
  aiBlueText: '#0B4FB3',
  aiBlueTint: '#E8F0FD',
  mint: '#14C38E',
  mintText: '#12795A',
  mintTint: '#E3F6EE',
  amber: '#E59A12',
  amberText: '#8A5A00',
  amberTint: '#FDF1DC',
  red: '#D23A3A',
  redText: '#B42323',
  redTint: '#FBE5E5',
  lightGrey: '#F5F6F8',
  line: '#E6E8EC',
  callDark: '#1A1D23',

  /* ---- semantic aliases used across the app ---- */
  /** Main action colour (buttons, links, active tab). */
  primary: '#1A66E5',
  /** Full-screen dark surface (call screens, black splash). */
  primaryDark: '#000000',
  secondary: '#1A66E5',
  primaryTint: '#E8F0FD',

  background: '#FFFFFF',
  surface: '#FFFFFF',

  textPrimary: '#000000',
  /** The kit keeps text black; secondary lines differ by size/weight. */
  textSecondary: '#000000',
  /** Placeholders and disabled hints only. */
  textMuted: '#6B7280',

  border: '#E6E8EC',
  divider: '#E6E8EC',
  cardBorder: '#E6E8EC',
  segmentTrack: '#F5F6F8',

  headerBackground: '#FFFFFF',
  headerText: '#000000',
  headerTextSecondary: '#000000',
  headerControl: '#F5F6F8',

  blueLight: '#E8F0FD',

  success: '#14C38E',
  warning: '#E59A12',
  error: '#D23A3A',

  disabled: '#C9CDD4',

  // Call screens (black)
  darkControl: '#1A1D23',
  darkControlActive: '#FFFFFF',
  inputDark: '#F5F6F8',
  borderDark: '#E6E8EC',
} as const;

export type AppColor = keyof typeof colors;
