// ═══════════════════════════════════════════════════════════
// EnviroCare AI — Premium Design System v4
// Deep space dark theme with dynamic AQI accents
// ═══════════════════════════════════════════════════════════

export const COLORS = {
  // Backgrounds
  bg: '#0A0E1A',
  bgCard: '#0F1524',
  bgElevated: '#141929',
  bgInput: '#111627',
  bgOverlay: 'rgba(10,14,26,0.92)',

  // Borders
  border: 'rgba(255,255,255,0.06)',
  borderLight: 'rgba(255,255,255,0.10)',
  borderFocus: 'rgba(0,229,160,0.4)',

  // Text
  textPrimary: '#C4CBDB',
  textSecondary: '#8892AA',
  textMuted: 'rgba(255,255,255,0.25)',
  textWhite: '#FFFFFF',

  // AQI Accents
  good: '#00E5A0',
  moderate: '#FFB347',
  unhealthy: '#FF5B5B',
  veryUnhealthy: '#FF5B5B',
  hazardous: '#9B1FFF',

  // Feature Accents
  accent: '#00E5A0',
  warning: '#FFB347',
  danger: '#FF5B5B',
  purple: '#9B79FF',
  purpleLight: '#B39DFF',
  cyan: '#00BCD4',
  pink: '#FF6B9D',

  // Glass
  glass: 'rgba(255,255,255,0.03)',
  glassBorder: 'rgba(255,255,255,0.06)',
  glassHover: 'rgba(255,255,255,0.06)',
} as const;

export const FONTS = {
  heading: 'SpaceGrotesk_700Bold',
  headingSemibold: 'SpaceGrotesk_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_600SemiBold',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const RADIUS = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 100,
} as const;

export const FONT_SIZE = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 28,
  hero: 42,
  display: 56,
} as const;

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 12,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  }),
} as const;

// AQI Theme System
export interface AqiTheme {
  primary: string;
  secondary: string;
  bgGradient: [string, string];
  level: string;
  label: string;
  orbColors: [string, string];
}

export function getAqiTheme(aqi: number): AqiTheme {
  if (aqi <= 50) return {
    primary: COLORS.good,
    secondary: '#00C98A',
    bgGradient: [COLORS.bg, '#081210'],
    level: 'good', label: 'Good',
    orbColors: ['#00E5A0', '#00BCD4'],
  };
  if (aqi <= 100) return {
    primary: COLORS.moderate,
    secondary: '#E5A030',
    bgGradient: [COLORS.bg, '#141008'],
    level: 'moderate', label: 'Moderate',
    orbColors: ['#FFB347', '#FF8C00'],
  };
  if (aqi <= 200) return {
    primary: '#FF8C42',
    secondary: '#E06B20',
    bgGradient: [COLORS.bg, '#140D08'],
    level: 'unhealthy', label: 'Unhealthy',
    orbColors: ['#FF8C42', '#FF5B5B'],
  };
  if (aqi <= 300) return {
    primary: COLORS.unhealthy,
    secondary: '#CC3333',
    bgGradient: [COLORS.bg, '#140808'],
    level: 'very_unhealthy', label: 'Very Unhealthy',
    orbColors: ['#FF5B5B', '#CC2020'],
  };
  return {
    primary: COLORS.hazardous,
    secondary: '#7B15CC',
    bgGradient: [COLORS.bg, '#0D0814'],
    level: 'hazardous', label: 'Hazardous',
    orbColors: ['#9B1FFF', '#6B0FBB'],
  };
}

export function getRiskColor(level: string): string {
  switch (level) {
    case 'low': return COLORS.good;
    case 'medium': return COLORS.moderate;
    case 'high': return '#FF8C42';
    case 'dangerous': return COLORS.unhealthy;
    default: return COLORS.textSecondary;
  }
}

export function getOrbPulseDuration(aqi: number): number {
  if (aqi <= 50) return 4000;
  if (aqi <= 100) return 3000;
  if (aqi <= 200) return 2000;
  if (aqi <= 300) return 1500;
  return 1000;
}

export function getMaskRecommendation(aqi: number) {
  if (aqi <= 50) return { type: 'none', label: 'No mask needed', icon: 'checkmark-circle' };
  if (aqi <= 100) return { type: 'optional', label: 'Mask optional', icon: 'medical' };
  if (aqi <= 200) return { type: 'surgical', label: 'Surgical mask recommended', icon: 'medical' };
  return { type: 'n95', label: 'N95 mask essential', icon: 'warning' };
}

export function getOrbGradient(aqi: number): [string, string] {
  if (aqi <= 50) return ['#00E5A0', '#00BCD4'];
  if (aqi <= 100) return ['#FFB347', '#FF8C00'];
  if (aqi <= 200) return ['#FF8C42', '#FF5B5B'];
  if (aqi <= 300) return ['#FF5B5B', '#CC2020'];
  return ['#9B1FFF', '#6B0FBB'];
}
