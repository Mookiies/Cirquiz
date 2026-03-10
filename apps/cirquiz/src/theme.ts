export const colors = {
  // Brand
  primary: '#3498DB',
  success: '#2ECC71',
  error: '#E74C3C',
  difficulty: '#9B59B6',
  white: '#fff',

  // Surfaces
  background: '#fff',
  surface: '#fafafa',
  surfaceFaint: '#fafafa',

  // Text
  text: '#222',
  textSecondary: '#555',
  textTertiary: '#888',
  textMuted: '#aaa',

  // UI
  border: '#ddd',
  primaryFaint: '#EBF5FB',
  difficultyFaint: '#f3eeff',

  // Player palette
  playerPalette: {
    red: '#E74C3C',
    blue: '#3498DB',
    green: '#2ECC71',
    orange: '#F39C12',
    purple: '#9B59B6',
    teal: '#1ABC9C',
    pink: '#E91E63',
    yellow: '#F1C40F',
    coral: '#FF5722',
    cyan: '#00BCD4',
  } as const,
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
