import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import api from '../utils/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }
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

export async function sendLocalNotification(title: string, body: string, data?: any) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data, sound: true },
    trigger: null,
  });
}

export async function sendAqiAlert(aqi: number, city: string, level: string) {
  let title = '';
  let body = '';

  if (aqi > 300) {
    title = 'EMERGENCY: Hazardous Air Quality';
    body = `AQI in ${city} is ${aqi}! Stay indoors immediately. Use air purifiers.`;
  } else if (aqi > 200) {
    title = 'High Risk: Very Unhealthy Air';
    body = `AQI in ${city} is ${aqi}. Wear N95 mask outdoors. Limit exposure.`;
  } else if (aqi > 150) {
    title = 'Alert: Unhealthy Air Quality';
    body = `AQI in ${city} is ${aqi}. Sensitive groups should stay indoors.`;
  } else if (aqi > 100) {
    title = 'Moderate Air Quality';
    body = `AQI in ${city} is ${aqi}. Consider wearing a mask if sensitive.`;
  } else {
    title = 'Good Air Quality';
    body = `AQI in ${city} is ${aqi}. Great day for outdoor activities!`;
  }

  await sendLocalNotification(title, body, { type: 'aqi_alert', aqi, city });
  try {
    await api.post('/api/notifications/log', { type: 'aqi_alert', title, message: body });
  } catch (e) {
    // silent - notification logging is non-critical
  }
}

export async function sendRoutineSuggestion(activity: string, suggestion: string) {
  await sendLocalNotification(
    `Routine Update: ${activity}`,
    suggestion,
    { type: 'routine_suggestion' }
  );
}

export async function sendTravelWarning(destination: string, aqi: number) {
  await sendLocalNotification(
    `Travel Alert: ${destination}`,
    `AQI at destination is ${aqi}. ${aqi > 150 ? 'Take precautions!' : 'Conditions are acceptable.'}`,
    { type: 'travel_warning' }
  );
}

export async function sendDailyUpdate(city: string, aqi: number) {
  const time = new Date().getHours();
  const greeting = time < 12 ? 'Good morning' : time < 17 ? 'Good afternoon' : 'Good evening';
  await sendLocalNotification(
    `${greeting}! Daily AQI Update`,
    `${city}: AQI ${aqi}. ${aqi <= 50 ? 'Perfect day for outdoor activities!' : aqi <= 100 ? 'Moderate conditions today.' : 'Consider staying indoors.'}`,
    { type: 'daily_update' }
  );
}
