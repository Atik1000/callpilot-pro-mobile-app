import { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const typography: Record<string, TextStyle> = {
  screenTitle: { fontFamily: fontFamily.bold, fontSize: 25, lineHeight: 30 },
  sectionTitle: {
    fontFamily: fontFamily.bold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  cardTitle: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20 },
  bodyMedium: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 20 },
  supporting: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamily.regular, fontSize: 12, lineHeight: 16 },
  tabLabel: { fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 14 },
  button: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 20 },
  inputLabel: { fontFamily: fontFamily.semibold, fontSize: 13, lineHeight: 18 },
};

export type TypographyVariant = keyof typeof typography;
