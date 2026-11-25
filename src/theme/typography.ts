import { TextStyle } from 'react-native';

/** Plus Jakarta Sans, as on callpilot.pro (see the CallPilot mobile UI kit). */
export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/** Type scale from the UI kit tokens (size / weight). */
export const typography: Record<string, TextStyle> = {
  /** 30 / 800, tight tracking — screen titles ("Calls"). */
  screenTitle: { fontFamily: fontFamily.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  /** 22 / 800 — section headings, names on call screens. */
  heading: { fontFamily: fontFamily.extrabold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  /** 12 / 800 uppercase — list section labels ("TODAY"). */
  sectionTitle: {
    fontFamily: fontFamily.extrabold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.96,
    textTransform: 'uppercase',
  },
  /** 15 / 700 — names in lists. */
  cardTitle: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20 },
  /** 15 / 500 — body copy. */
  body: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 21 },
  bodyMedium: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 20 },
  /** 12.5 / 600 — secondary lines under names. */
  supporting: { fontFamily: fontFamily.semibold, fontSize: 12.5, lineHeight: 17 },
  caption: { fontFamily: fontFamily.semibold, fontSize: 12, lineHeight: 16 },
  /** 11 / 600 — bottom tab labels (800 when active). */
  tabLabel: { fontFamily: fontFamily.semibold, fontSize: 11, lineHeight: 14 },
  button: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 20 },
  inputLabel: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 18 },
};

export type TypographyVariant = keyof typeof typography;
