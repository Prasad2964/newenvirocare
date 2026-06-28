// Risk scoring engine — maps real environmental data to user health conditions.
// Every value comes from live WAQI / Open-Meteo data. No generated or random data.

export interface RiskEnv {
  aqi: number;
  pollutants?: {
    pm25?: number; pm10?: number;
    no2?: number;  so2?: number;
    co?: number;   o3?: number;
  };
  weather?: {
    temperature?: number;
    humidity?: number;
  };
}

export interface RiskProfile {
  conditions: string[];
  medications?: string[];
  age?: number | null;
}

export interface ConditionRisk {
  condition: string;
  score: number;
  drivers: string[];        // which pollutants are driving this score
}

export interface RiskResult {
  score: number;            // 0–100
  level: 'low' | 'moderate' | 'high' | 'critical';
  color: string;
  worstCondition: string;   // which condition set the score
  primaryDriver: string;    // which pollutant/factor is the main cause
  breakdown: ConditionRisk[];
}

// ── Internal flat env structure ───────────────────────────────────────────────

interface FlatEnv {
  aqi: number;
  pm25: number; pm10: number;
  no2: number;  so2: number;
  co: number;   o3: number;
  temperature: number;
  humidity: number;
}

function flatten(env: RiskEnv): FlatEnv {
  return {
    aqi:         env.aqi ?? 0,
    pm25:        env.pollutants?.pm25 ?? 0,
    pm10:        env.pollutants?.pm10 ?? 0,
    no2:         env.pollutants?.no2  ?? 0,
    so2:         env.pollutants?.so2  ?? 0,
    co:          env.pollutants?.co   ?? 0,
    o3:          env.pollutants?.o3   ?? 0,
    temperature: env.weather?.temperature ?? 25,
    humidity:    env.weather?.humidity    ?? 50,
  };
}

// ── Pollutant sensitivity weights per condition ───────────────────────────────
// safe: below this value contributes 0% to score
// danger: at this value contributes 100% (linear interpolation between)
// w: relative weight within the condition's score (must sum to 1.0)
// skipZero: if true, a 0 value means "not reported" — skip rather than penalise

interface PW {
  key: keyof FlatEnv;
  safe: number;
  danger: number;
  w: number;
  skipZero?: boolean; // default true for pollutants, false for aqi/temp/humidity
}

const CONDITION_WEIGHTS: Array<{ kw: string; pw: PW[] }> = [
  {
    kw: 'asthma',
    pw: [
      { key: 'pm25', safe: 12,  danger: 55,  w: 0.35, skipZero: true },
      { key: 'o3',   safe: 50,  danger: 100, w: 0.28, skipZero: true },
      { key: 'aqi',  safe: 50,  danger: 200, w: 0.22 },
      { key: 'humidity', safe: 60, danger: 90, w: 0.15 },
    ],
  },
  {
    kw: 'copd',
    pw: [
      { key: 'pm25', safe: 10,  danger: 35,  w: 0.30, skipZero: true },
      { key: 'so2',  safe: 15,  danger: 75,  w: 0.25, skipZero: true },
      { key: 'co',   safe: 2,   danger: 9,   w: 0.25, skipZero: true },
      { key: 'aqi',  safe: 50,  danger: 150, w: 0.20 },
    ],
  },
  {
    kw: 'heart',
    pw: [
      { key: 'pm25', safe: 8,   danger: 35,  w: 0.35, skipZero: true },
      { key: 'no2',  safe: 25,  danger: 100, w: 0.25, skipZero: true },
      { key: 'co',   safe: 1,   danger: 9,   w: 0.22, skipZero: true },
      { key: 'temperature', safe: 28, danger: 42, w: 0.10 },
      { key: 'aqi',  safe: 50,  danger: 200, w: 0.08 },
    ],
  },
  {
    kw: 'hypertens',
    pw: [
      { key: 'no2',  safe: 25,  danger: 100, w: 0.38, skipZero: true },
      { key: 'pm25', safe: 12,  danger: 55,  w: 0.35, skipZero: true },
      { key: 'aqi',  safe: 75,  danger: 200, w: 0.27 },
    ],
  },
  {
    kw: 'diabet',
    pw: [
      { key: 'temperature', safe: 28, danger: 42,  w: 0.40 },
      { key: 'pm25', safe: 25,  danger: 75,  w: 0.33, skipZero: true },
      { key: 'aqi',  safe: 75,  danger: 200, w: 0.27 },
    ],
  },
  {
    kw: 'lung',
    pw: [
      { key: 'pm25', safe: 10,  danger: 35,  w: 0.30, skipZero: true },
      { key: 'so2',  safe: 10,  danger: 75,  w: 0.28, skipZero: true },
      { key: 'o3',   safe: 50,  danger: 100, w: 0.22, skipZero: true },
      { key: 'aqi',  safe: 50,  danger: 150, w: 0.20 },
    ],
  },
  {
    kw: 'bronchitis',
    pw: [
      { key: 'pm25',    safe: 15, danger: 55, w: 0.35, skipZero: true },
      { key: 'humidity',safe: 65, danger: 90, w: 0.25 },
      { key: 'so2',     safe: 15, danger: 75, w: 0.20, skipZero: true },
      { key: 'aqi',     safe: 50, danger: 200,w: 0.20 },
    ],
  },
  {
    kw: 'allerg',
    pw: [
      { key: 'pm10',    safe: 30, danger: 150, w: 0.35, skipZero: true },
      { key: 'o3',      safe: 50, danger: 100, w: 0.28, skipZero: true },
      { key: 'humidity',safe: 55, danger: 85,  w: 0.22 },
      { key: 'aqi',     safe: 75, danger: 200, w: 0.15 },
    ],
  },
  {
    kw: 'pregnan',
    pw: [
      { key: 'pm25', safe: 8,  danger: 35,  w: 0.35, skipZero: true },
      { key: 'no2',  safe: 20, danger: 75,  w: 0.30, skipZero: true },
      { key: 'co',   safe: 1,  danger: 5,   w: 0.20, skipZero: true },
      { key: 'aqi',  safe: 50, danger: 150, w: 0.15 },
    ],
  },
  {
    kw: 'sinus',
    pw: [
      { key: 'pm10',    safe: 30, danger: 100, w: 0.35, skipZero: true },
      { key: 'humidity',safe: 60, danger: 90,  w: 0.30 },
      { key: 'aqi',     safe: 75, danger: 200, w: 0.35 },
    ],
  },
  {
    kw: 'rhinitis',
    pw: [
      { key: 'pm10',    safe: 30, danger: 100, w: 0.40, skipZero: true },
      { key: 'o3',      safe: 50, danger: 100, w: 0.25, skipZero: true },
      { key: 'humidity',safe: 55, danger: 85,  w: 0.20 },
      { key: 'aqi',     safe: 75, danger: 200, w: 0.15 },
    ],
  },
  {
    kw: 'thyroid',
    pw: [
      { key: 'temperature', safe: 30, danger: 42, w: 0.50 },
      { key: 'aqi',         safe: 75, danger: 200,w: 0.50 },
    ],
  },
  {
    kw: 'anemia',
    pw: [
      { key: 'co',   safe: 1,  danger: 9,   w: 0.40, skipZero: true },
      { key: 'pm25', safe: 12, danger: 55,  w: 0.35, skipZero: true },
      { key: 'aqi',  safe: 75, danger: 200, w: 0.25 },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function pollutantLabel(key: keyof FlatEnv): string {
  const labels: Partial<Record<keyof FlatEnv, string>> = {
    pm25: 'PM2.5', pm10: 'PM10', no2: 'NO₂', so2: 'SO₂',
    co: 'CO', o3: 'O₃', temperature: 'Heat', humidity: 'Humidity', aqi: 'AQI',
  };
  return labels[key] ?? String(key).toUpperCase();
}

function ageMultiplier(age?: number | null): number {
  if (!age) return 1.0;
  if (age >= 75) return 1.40;
  if (age >= 65) return 1.25;
  if (age <= 6)  return 1.25;
  if (age <= 12) return 1.15;
  return 1.0;
}

function toLevel(score: number): RiskResult['level'] {
  if (score <= 25) return 'low';
  if (score <= 50) return 'moderate';
  if (score <= 75) return 'high';
  return 'critical';
}

function toColor(score: number): string {
  if (score <= 25) return '#4ADE80';
  if (score <= 50) return '#FACC15';
  if (score <= 75) return '#FB923C';
  return '#F87171';
}

function scoreCondition(conditionLower: string, env: FlatEnv): { score: number; drivers: string[] } {
  const def = CONDITION_WEIGHTS.find(c => conditionLower.includes(c.kw));

  if (!def) {
    // Generic fallback: AQI-only
    return {
      score: Math.min(100, Math.round((env.aqi / 300) * 100)),
      drivers: ['AQI'],
    };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  const drivers: string[] = [];

  for (const pw of def.pw) {
    const val = env[pw.key] as number;
    const skip = pw.skipZero !== false; // default true for pollutant fields
    if (skip && val === 0) continue;    // 0 → not reported by station, skip

    const normalized = Math.max(0, Math.min(1, (val - pw.safe) / (pw.danger - pw.safe)));
    weightedSum += normalized * pw.w;
    totalWeight += pw.w;

    if (normalized > 0.25) {
      drivers.push(pollutantLabel(pw.key));
    }
  }

  // If all pollutants were skipped (all 0), fall back to AQI-only score
  if (totalWeight === 0) {
    return {
      score: Math.min(100, Math.round((env.aqi / 300) * 100)),
      drivers: ['AQI'],
    };
  }

  const score = Math.min(100, Math.round((weightedSum / totalWeight) * 100));
  return { score, drivers: drivers.length > 0 ? drivers : ['AQI'] };
}

// ── Public API ────────────────────────────────────────────────────────────────

export function calculatePersonalizedRisk(env: RiskEnv, profile: RiskProfile): RiskResult {
  const flat = flatten(env);
  const ageMult = ageMultiplier(profile.age);
  const conditions = profile.conditions ?? [];

  if (conditions.length === 0) {
    const score = Math.min(100, Math.round((flat.aqi / 300) * 100 * ageMult));
    return {
      score,
      level: toLevel(score),
      color: toColor(score),
      worstCondition: 'General Population',
      primaryDriver: 'AQI',
      breakdown: [],
    };
  }

  const breakdown: ConditionRisk[] = conditions.map(c => {
    const { score: raw, drivers } = scoreCondition(c.toLowerCase().trim(), flat);
    const score = Math.min(100, Math.round(raw * ageMult));
    return { condition: c, score, drivers };
  });

  const worst = breakdown.reduce((a, b) => (a.score >= b.score ? a : b));

  return {
    score: worst.score,
    level: toLevel(worst.score),
    color: toColor(worst.score),
    worstCondition: worst.condition,
    primaryDriver: worst.drivers[0] ?? 'AQI',
    breakdown,
  };
}
