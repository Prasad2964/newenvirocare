export interface AqiTheme {
  primary: string;
  accent: string;
  bgGradient: string[];
  level: string;
  label: string;
}

export function getAqiTheme(aqi: number): AqiTheme {
  if (aqi <= 50) {
    return {
      primary: '#4ADE80',
      accent: '#06B6D4',
      bgGradient: ['#0A2E1A', '#0B1D2B'],
      level: 'good',
      label: 'Good',
    };
  }
  if (aqi <= 100) {
    return {
      primary: '#FACC15',
      accent: '#FB923C',
      bgGradient: ['#2D2006', '#1A1505'],
      level: 'moderate',
      label: 'Moderate',
    };
  }
  if (aqi <= 200) {
    return {
      primary: '#FB923C',
      accent: '#F97316',
      bgGradient: ['#2D1A06', '#1A0F05'],
      level: 'unhealthy',
      label: 'Unhealthy',
    };
  }
  if (aqi <= 300) {
    return {
      primary: '#F87171',
      accent: '#991B1B',
      bgGradient: ['#2D0A0A', '#1A0505'],
      level: 'very_unhealthy',
      label: 'Very Unhealthy',
    };
  }
  return {
    primary: '#DC2626',
    accent: '#000000',
    bgGradient: ['#1A0000', '#000000'],
    level: 'hazardous',
    label: 'Hazardous',
  };
}

export function getOrbPulseDuration(aqi: number): number {
  if (aqi <= 50) return 4000;
  if (aqi <= 100) return 3000;
  if (aqi <= 200) return 2000;
  if (aqi <= 300) return 1500;
  return 1000;
}

export function getRiskColor(level: string): string {
  switch (level) {
    case 'low': return '#4ADE80';
    case 'medium': return '#FACC15';
    case 'high': return '#FB923C';
    case 'dangerous': return '#DC2626';
    default: return '#FFFFFF';
  }
}
