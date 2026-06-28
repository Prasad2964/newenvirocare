import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Web: request browser notification permission ────────────────────────────
export async function requestWebNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

// ─── Native: request notification permission (local notifications only) ─────
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') {
    await requestWebNotificationPermission();
    return null;
  }
  if (!Device.isDevice) return null;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return null;
  }
  return null;
}

// ─── Cross-platform local notification ───────────────────────────────────────
export async function sendLocalNotification(title: string, body: string, data?: any) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico', tag: data?.type || 'aqi' });
    }
    return;
  }
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: null,
  });
}

// ─── Personalized AQI threshold based on health conditions ──────────────────
export function getPersonalizedThreshold(conditions: string[]): number {
  const c = conditions.map(s => s.toLowerCase());
  const veryHighRisk = c.some(s =>
    ['asthma', 'copd', 'lung disease', 'heart disease', 'bronchitis'].some(k => s.includes(k))
  );
  const moderateRisk = c.some(s =>
    ['diabetes', 'pregnancy', 'hypertension', 'allergies', 'allergy'].some(k => s.includes(k))
  );
  if (veryHighRisk) return 80;
  if (moderateRisk) return 100;
  return 150;
}

// ─── Condition-specific advice line ──────────────────────────────────────────
function getConditionAdvice(conditions: string[]): string {
  const c = conditions.map(s => s.toLowerCase());
  if (c.some(s => s.includes('asthma'))) return 'Keep your inhaler accessible';
  if (c.some(s => s.includes('copd'))) return 'Avoid outdoors — use supplemental oxygen if prescribed';
  if (c.some(s => s.includes('heart'))) return 'Avoid strenuous activity and stay indoors';
  if (c.some(s => s.includes('pregnancy'))) return 'Stay indoors with windows closed';
  if (c.some(s => s.includes('diabetes'))) return 'Monitor cardiovascular symptoms closely';
  if (c.some(s => s.includes('hypertension'))) return 'Monitor your blood pressure';
  if (c.some(s => s.includes('allerg') || s.includes('bronchitis') || s.includes('lung'))) return 'Wear an N95 mask if going outside';
  return 'Reduce outdoor exposure';
}

// ─── Deduplication: max one AQI alert per 30 minutes ─────────────────────────
const LAST_ALERT_KEY = 'last_aqi_alert_ts';

async function canSendAlert(): Promise<boolean> {
  try {
    const last = await AsyncStorage.getItem(LAST_ALERT_KEY);
    if (!last) return true;
    return Date.now() - parseInt(last, 10) > 1 * 60 * 1000;
  } catch {
    return true;
  }
}

async function markAlertSent() {
  try { await AsyncStorage.setItem(LAST_ALERT_KEY, String(Date.now())); } catch {}
}

// ─── Main alert — personalized by conditions ─────────────────────────────────
export async function sendAqiAlert(
  aqi: number,
  city: string,
  level: string,
  conditions: string[] = [],
) {
  const threshold = getPersonalizedThreshold(conditions);
  if (aqi < threshold) return;

  if (!(await canSendAlert())) return;

  const hasConditions = conditions.length > 0;
  const advice = hasConditions ? getConditionAdvice(conditions) : null;
  const conditionList = hasConditions ? ` (${conditions.slice(0, 2).join(', ')})` : '';

  let title: string;
  let body: string;

  if (aqi > 300) {
    title = `EMERGENCY: Hazardous Air — ${city}`;
    body = advice
      ? `AQI ${aqi}. ${advice}${conditionList}. Stay indoors immediately.`
      : `AQI ${aqi}. Stay indoors immediately. Use air purifiers.`;
  } else if (aqi > 200) {
    title = `Very Unhealthy Air — ${city}`;
    body = advice
      ? `AQI ${aqi}. ${advice}${conditionList}.`
      : `AQI ${aqi}. Wear N95 mask outdoors. Limit exposure.`;
  } else if (aqi > 150) {
    title = `Unhealthy Air Quality — ${city}`;
    body = advice
      ? `AQI ${aqi}. ${advice}${conditionList}.`
      : `AQI ${aqi}. Sensitive groups should stay indoors.`;
  } else if (aqi > 100) {
    title = `Air Quality Alert — ${city}`;
    body = advice
      ? `AQI ${aqi} — elevated risk for your health profile. ${advice}.`
      : `AQI ${aqi}. Consider wearing a mask if you are sensitive.`;
  } else {
    title = `Air Quality Notice — ${city}`;
    body = advice
      ? `AQI ${aqi}. Your conditions${conditionList} require caution. ${advice}.`
      : `AQI ${aqi}. Conditions are manageable.`;
  }

  await sendLocalNotification(title, body, { type: 'aqi_alert', aqi, city });
  await markAlertSent();

  try {
    await api.post('/api/notifications/log', { type: 'aqi_alert', title, message: body });
  } catch {}
}

// ─── Predictive alerts based on health + live environment ────────────────────
// Rate limit: each alert type fires at most once every 4 hours.
const PREDICTIVE_KEY_PREFIX = 'predictive_last_';
const PREDICTIVE_COOLDOWN_MS = 4 * 60 * 60 * 1000;

async function canFirePredictive(alertType: string): Promise<boolean> {
  try {
    const key = PREDICTIVE_KEY_PREFIX + alertType;
    const last = await AsyncStorage.getItem(key);
    if (!last) return true;
    return Date.now() - parseInt(last, 10) > PREDICTIVE_COOLDOWN_MS;
  } catch {
    return true;
  }
}

async function markPredictiveFired(alertType: string) {
  try {
    await AsyncStorage.setItem(PREDICTIVE_KEY_PREFIX + alertType, String(Date.now()));
  } catch {}
}

export interface PredictiveEnv {
  aqi: number;
  humidity?: number;
  temperature?: number;
  pm25?: number;
  no2?: number;
  city: string;
}

export interface HealthProfile {
  conditions: string[];
  medications: string[];
  allergies: string[];
  age?: number | null;
  notes?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasCond(conditions: string[], ...keys: string[]): boolean {
  const cl = conditions.map(s => s.toLowerCase());
  return keys.some(k => cl.some(c => c.includes(k)));
}

function hasMed(medications: string[], ...names: string[]): boolean {
  const ml = medications.map(m => m.toLowerCase());
  return names.some(n => ml.some(m => m.includes(n.toLowerCase())));
}

function hasAllergen(allergies: string[], ...keys: string[]): boolean {
  const al = allergies.map(a => a.toLowerCase());
  return keys.some(k => al.some(a => a.includes(k)));
}

// Extract systolic BP from raw OCR notes (e.g. "BP: 150/90" → 150)
function parseSystolicBP(notes: string): number | null {
  const m = notes.match(/\bbp[:\s]+(\d{2,3})\/\d{2,3}/i);
  return m ? parseInt(m[1], 10) : null;
}

// Extract fasting glucose/sugar from OCR notes (e.g. "Sugar: 180" → 180)
function parseGlucose(notes: string): number | null {
  const m = notes.match(/\b(?:sugar|glucose|fbs|rbs)[:\s]+([\d.]+)/i);
  return m ? parseFloat(m[1]) : null;
}

// Lower threshold for elderly (≥65) and children (≤12)
function ageThr(base: number, age?: number | null): number {
  if (!age) return base;
  if (age >= 65) return Math.round(base * 0.75);
  if (age <= 12) return Math.round(base * 0.80);
  return base;
}

// ── Main predictive engine ────────────────────────────────────────────────────

export async function checkPredictiveAlerts(
  env: PredictiveEnv,
  profile: HealthProfile,
): Promise<void> {
  const { conditions, medications, allergies, age, notes } = profile;
  if (!conditions.length && !medications.length && !allergies.length) return;

  const { aqi, humidity = 0, temperature = 25, pm25 = 0, no2 = 0, city } = env;

  // Parse OCR-extracted health indicators from prescription notes
  const systolicBP = notes ? parseSystolicBP(notes) : null;
  const glucose = notes ? parseGlucose(notes) : null;

  const pending: Array<{ type: string; title: string; body: string }> = [];

  async function consider(type: string, title: string, body: string) {
    if (await canFirePredictive(type)) pending.push({ type, title, body });
  }

  // ── Rescue inhalers (Salbutamol / Ventolin / Albuterol) ──────────────────
  if (hasMed(medications, 'salbutamol', 'ventolin', 'albuterol', 'levosalbutamol')) {
    const thr = ageThr(65, age);
    if (aqi > thr)
      await consider('med_rescue_inhaler_aqi',
        'Rescue Inhaler Advisory',
        `AQI ${aqi} in ${city} can trigger bronchospasm. Carry your rescue inhaler and use it at the first sign of wheeze or tightness.`);
    if (pm25 > ageThr(25, age))
      await consider('med_rescue_inhaler_pm25',
        'Fine Particles — Inhaler Needed',
        `PM2.5 is ${pm25} μg/m³ in ${city}. Particulate levels at this concentration often increase inhaler use. Have it on hand.`);
  }

  // ── Controller inhalers (Budesonide / Fluticasone / Seretide / Symbicort) ─
  if (hasMed(medications, 'budesonide', 'fluticasone', 'seretide', 'symbicort', 'beclomethasone')) {
    if (aqi > ageThr(80, age))
      await consider('med_controller_inhaler',
        'Controller Inhaler Reminder',
        `AQI ${aqi} in ${city} — do not skip your daily controller inhaler dose today. Skipping during poor air quality increases flare risk.`);
  }

  // ── COPD-specific inhalers (Tiotropium / Ipratropium / Theophylline) ──────
  if (hasMed(medications, 'tiotropium', 'ipratropium', 'theophylline', 'aminophylline')) {
    const thr = ageThr(60, age);
    if (aqi > thr)
      await consider('med_copd_inhaler',
        'COPD Flare Risk',
        `AQI ${aqi} in ${city} — patients on COPD maintenance therapy are at high risk. Use your prescribed inhaler and avoid going outdoors.`);
  }

  // ── Insulin (heat degrades it; extreme heat affects absorption) ───────────
  if (hasMed(medications, 'insulin')) {
    const glucoseNote = glucose ? ` Your recent glucose reading was ${glucose} mg/dL.` : '';
    if (temperature > 36)
      await consider('med_insulin_heat',
        'Insulin Storage Alert',
        `${temperature}°C in ${city} — heat above 36°C degrades insulin potency. Keep your insulin refrigerated and check vials for cloudiness.${glucoseNote}`);
    // Poorly controlled glucose + any heat = double risk
    if (glucose && glucose > 200 && temperature > 30)
      await consider('med_insulin_glucose_heat',
        'Glucose Control Risk',
        `Your recent glucose (${glucose} mg/dL) is elevated. At ${temperature}°C in ${city}, heat stress further impairs glucose control. Monitor closely today.`);
  }

  // ── Metformin (heat → lactic acidosis risk) ───────────────────────────────
  if (hasMed(medications, 'metformin')) {
    if (temperature > 35)
      await consider('med_metformin_heat',
        'Metformin Heat Advisory',
        `${temperature}°C in ${city} — dehydration on Metformin raises lactic acidosis risk. Drink water frequently and avoid outdoor exertion in this heat.`);
  }

  // ── Anticoagulants (Warfarin / Clopidogrel — pollution raises clot risk) ──
  if (hasMed(medications, 'warfarin', 'clopidogrel', 'rivaroxaban', 'apixaban', 'dabigatran')) {
    if (aqi > 120)
      await consider('med_anticoag_smog',
        'Anticoagulant Advisory',
        `Heavy smog (AQI ${aqi}) in ${city} increases platelet aggregation. Patients on blood thinners should avoid prolonged outdoor exposure and report any unusual symptoms.`);
  }

  // ── Antihypertensives (Amlodipine / Lisinopril / Metoprolol / Losartan) ──
  if (hasMed(medications, 'amlodipine', 'lisinopril', 'metoprolol', 'losartan', 'atenolol',
    'telmisartan', 'ramipril', 'enalapril', 'valsartan')) {
    // Use OCR-extracted BP to personalise the threshold and message
    const bpNote = systolicBP
      ? ` Your last recorded BP was ${systolicBP} mmHg —`
      : '';
    const thr = systolicBP && systolicBP > 140 ? ageThr(70, age) : ageThr(95, age);
    if (aqi > thr)
      await consider('med_antihypert_aqi',
        'Blood Pressure Alert',
        `AQI ${aqi} in ${city} can cause acute BP elevation.${bpNote} take your antihypertensive medication as scheduled and avoid strenuous activity.`);
    if (temperature > 38)
      await consider('med_antihypert_heat',
        'Heat Affects BP Medication',
        `${temperature}°C in ${city} — extreme heat can reduce the effectiveness of some antihypertensives. Monitor your blood pressure today.`);
  }

  // ── Montelukast (allergy + asthma controller) ────────────────────────────
  if (hasMed(medications, 'montelukast')) {
    if (humidity > 65)
      await consider('med_montelukast_humidity',
        'Allergen Levels Rising',
        `Humidity at ${humidity}% in ${city} elevates mold spores and pollen. Take your Montelukast as prescribed and keep windows closed.`);
    if (aqi > ageThr(70, age))
      await consider('med_montelukast_aqi',
        'Asthma-Allergy Dual Trigger',
        `AQI ${aqi} combined with allergen-prone air quality in ${city}. Montelukast may not provide full protection at these pollution levels — limit outdoor time.`);
  }

  // ── Antihistamines (Cetirizine / Fexofenadine / Loratadine) ─────────────
  if (hasMed(medications, 'cetirizine', 'fexofenadine', 'loratadine', 'desloratadine', 'levocetirizine')) {
    if (humidity > 70)
      await consider('med_antihistamine_humidity',
        'Take Your Antihistamine Today',
        `Humidity ${humidity}% in ${city} raises airborne allergen concentrations. Take your antihistamine at the same time daily for best effect.`);
  }

  // ── Corticosteroids (Prednisolone / Dexamethasone — immunosuppression) ────
  if (hasMed(medications, 'prednisolone', 'prednisone', 'dexamethasone', 'methylprednisolone')) {
    if (aqi > ageThr(70, age))
      await consider('med_steroid_aqi',
        'Immunosuppression Risk',
        `AQI ${aqi} in ${city} — corticosteroids suppress immune response, making respiratory infections more likely in polluted conditions. Avoid outdoor exposure.`);
  }

  // ── Levothyroxine (thyroid — heat sensitivity) ────────────────────────────
  if (hasMed(medications, 'levothyroxine', 'thyroxine', 'eltroxin')) {
    if (temperature > 38)
      await consider('med_levothyroxine_heat',
        'Thyroid Medication — Heat Advisory',
        `${temperature}°C in ${city} — extreme heat can exacerbate hyperthyroid symptoms while on Levothyroxine. Monitor your heart rate and avoid exertion.`);
  }

  // ── Allergen-specific (from actual allergen list in profile) ─────────────
  if (hasAllergen(allergies, 'pollen', 'grass pollen', 'tree pollen', 'ragweed')) {
    if (humidity > 60)
      await consider('allergen_pollen_humidity',
        'Pollen Alert — Your Allergen',
        `Humidity ${humidity}% in ${city} activates pollen dispersal. You are sensitised to pollen — take your allergy medication and minimise outdoor exposure.`);
  }

  if (hasAllergen(allergies, 'dust mite', 'dust mites')) {
    if (humidity > 70)
      await consider('allergen_dustmite_humidity',
        'Dust Mite Conditions Active',
        `Humidity ${humidity}% in ${city} — dust mites multiply rapidly above 70% humidity. Use your air purifier, wash bedding in hot water, and keep your space ventilated.`);
  }

  if (hasAllergen(allergies, 'mold', 'mold spores', 'mould')) {
    if (humidity > 75)
      await consider('allergen_mold_humidity',
        'Mold Spore Risk — Your Allergen',
        `Humidity ${humidity}% in ${city} creates high mold spore levels, a known trigger for you. Take antihistamines and keep humidity below 60% indoors.`);
  }

  // ── Condition-level fallbacks (only fire if no medication-specific alert did) ─
  if (hasCond(conditions, 'pregnan')) {
    if (aqi > ageThr(60, age))
      await consider('cond_pregnancy_aqi',
        'Pregnancy Air Quality Advisory',
        `AQI ${aqi} in ${city}. Air pollution during pregnancy is linked to low birth weight and preterm birth. Minimise outdoor exposure today.`);
  }

  if (hasCond(conditions, 'diabet') && !hasMed(medications, 'insulin', 'metformin')) {
    if (temperature > 35)
      await consider('cond_diabetes_heat',
        'Heat Advisory — Glucose Risk',
        `${temperature}°C in ${city}. Heat stress affects glucose metabolism. Monitor your blood sugar closely and stay well hydrated.`);
  }

  if (hasCond(conditions, 'heart') && !hasMed(medications, 'warfarin', 'clopidogrel', 'amlodipine', 'metoprolol')) {
    if (aqi > ageThr(80, age))
      await consider('cond_cardiac_aqi',
        'Cardiovascular Alert',
        `AQI ${aqi} in ${city} increases risk of acute cardiac events. Avoid strenuous outdoor activity and stay in air-conditioned spaces.`);
  }

  // ── Fire all pending alerts ───────────────────────────────────────────────
  for (const alert of pending) {
    await sendLocalNotification(alert.title, alert.body, {
      type: 'predictive_alert',
      alertType: alert.type,
    });
    await markPredictiveFired(alert.type);
    try {
      await api.post('/api/notifications/log', {
        type: 'predictive_alert',
        title: alert.title,
        message: alert.body,
      });
    } catch {}
  }
}

export async function sendRoutineSuggestion(activity: string, suggestion: string) {
  await sendLocalNotification(`Routine Update: ${activity}`, suggestion, { type: 'routine_suggestion' });
}

export async function sendTravelWarning(destination: string, aqi: number) {
  await sendLocalNotification(
    `Travel Alert: ${destination}`,
    `AQI at destination is ${aqi}. ${aqi > 150 ? 'Take precautions!' : 'Conditions are acceptable.'}`,
    { type: 'travel_warning' }
  );
}

export async function sendDailyUpdate(city: string, aqi: number, conditions: string[] = []) {
  const time = new Date().getHours();
  const greeting = time < 12 ? 'Good morning' : time < 17 ? 'Good afternoon' : 'Good evening';
  const advice = conditions.length > 0 ? ' ' + getConditionAdvice(conditions) + '.' : '';
  await sendLocalNotification(
    `${greeting}! Daily AQI — ${city}`,
    `AQI ${aqi} (${aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : aqi <= 150 ? 'Unhealthy for sensitive' : 'Unhealthy'}).${advice}`,
    { type: 'daily_update' }
  );
}
