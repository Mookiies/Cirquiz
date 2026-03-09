export const colors = {
  // Brand
  primary: '#3498DB',
  success: '#2ECC71',
  error: '#E74C3C',
  difficulty: '#9B59B6',
  white: '#fff',

  // Surfaces
  background: '#fff',
  surface: '#f8f8f8',
  surfaceFaint: '#fafafa',

  // Text
  text: '#222',
  textSecondary: '#555',
  textTertiary: '#888',
  textMuted: '#aaa',

  // UI
  border: '#ddd',
  selectionRing: '#000',
  primaryFaint: '#EBF5FB',

  // Player palette
  playerPalette: [
    '#E74C3C',
    '#3498DB',
    '#2ECC71',
    '#F39C12',
    '#9B59B6',
    '#1ABC9C',
    '#E91E63',
    '#F1C40F',
    '#FF5722',
    '#00BCD4',
  ] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  // Intermediate values
  2: 2,
  6: 6,
  10: 10,
  14: 14,
  18: 18,
  20: 20,
} as const;

export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 36,
} as const;

export const fontWeight = {
  semibold: '600' as const,
  bold: '700' as const,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  pill: 20,
} as const;

export const opacity = {
  disabled: 0.3,
  inactive: 0.5,
} as const;
