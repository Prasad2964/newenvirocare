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

// ─── Native: register for push notifications ────────────────────────────────
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') {
    await requestWebNotificationPermission();
    return null;
  }
  if (!Device.isDevice) return null;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;
  const token = await Notifications.getExpoPushTokenAsync();
  return token.data;
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
    return Date.now() - parseInt(last, 10) > 30 * 60 * 1000;
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
