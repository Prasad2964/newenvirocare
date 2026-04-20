import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Alert, Platform, Linking, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import api from '../src/utils/api';
import GlassCard from '../src/components/GlassCard';
import { getPersonalizedThreshold } from '../src/services/notifications';

const CONDITION_MULTIPLIERS: Record<string, number> = {
  'asthma': 2.0, 'copd': 2.5, 'heart disease': 1.8,
  'diabetes': 1.3, 'hypertension': 1.4, 'lung disease': 2.2,
  'bronchitis': 1.9, 'allergies': 1.5, 'pregnancy': 1.6,
  'kidney disease': 1.4, 'anxiety': 1.2, 'rhinitis': 1.3, 'sinusitis': 1.2,
};

const WORLD_CITIES = [
  // India
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad',
  'Jaipur', 'Surat', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Bhopal', 'Patna',
  'Vadodara', 'Ludhiana', 'Agra', 'Nashik', 'Meerut', 'Rajkot', 'Varanasi', 'Srinagar',
  'Amritsar', 'Coimbatore', 'Madurai', 'Chandigarh', 'Kochi', 'Guwahati',
  // USA
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio',
  'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville', 'San Francisco', 'Seattle',
  'Denver', 'Nashville', 'Portland', 'Las Vegas', 'Boston', 'Atlanta',
  // Europe
  'London', 'Paris', 'Berlin', 'Madrid', 'Rome', 'Amsterdam', 'Brussels', 'Vienna',
  'Warsaw', 'Prague', 'Budapest', 'Bucharest', 'Stockholm', 'Oslo', 'Copenhagen',
  'Helsinki', 'Zurich', 'Lisbon', 'Athens', 'Dublin', 'Munich', 'Barcelona', 'Milan',
  // Asia
  'Tokyo', 'Shanghai', 'Beijing', 'Seoul', 'Osaka', 'Chengdu', 'Guangzhou', 'Shenzhen',
  'Bangkok', 'Jakarta', 'Manila', 'Kuala Lumpur', 'Singapore', 'Dhaka', 'Karachi',
  'Lahore', 'Colombo', 'Kathmandu', 'Yangon', 'Ho Chi Minh City', 'Hanoi', 'Taipei',
  'Hong Kong', 'Macau', 'Riyadh', 'Dubai', 'Abu Dhabi', 'Doha', 'Kuwait City',
  'Tehran', 'Baghdad', 'Islamabad', 'Kabul', 'Tashkent', 'Almaty',
  // Africa
  'Cairo', 'Lagos', 'Kinshasa', 'Johannesburg', 'Nairobi', 'Dar es Salaam', 'Addis Ababa',
  'Casablanca', 'Accra', 'Abidjan', 'Khartoum', 'Cape Town', 'Tunis', 'Algiers',
  // Americas
  'São Paulo', 'Mexico City', 'Buenos Aires', 'Rio de Janeiro', 'Lima', 'Bogotá',
  'Santiago', 'Caracas', 'Quito', 'Montevideo', 'Toronto', 'Vancouver', 'Montreal',
  // Oceania
  'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Auckland', 'Wellington',
];

export default function SettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [healthConditions, setHealthConditions] = useState<string[]>([]);
  const [settings, setSettings] = useState({
    notify_daily_updates: true,
    notify_high_risk: true,
    notify_travel: true,
    notify_routine: true,
    default_city: '',
  });
  const [cityMode, setCityMode] = useState<'location' | 'manual'>('manual');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [permStatus, setPermStatus] = useState({
    location: 'unknown',
    notifications: 'unknown',
    camera: 'unknown',
  });

  const fetchSettings = useCallback(async () => {
    try {
      const [data, profile] = await Promise.all([
        api.get('/api/settings'),
        api.get('/api/health-profile').catch(() => null),
      ]);
      setSettings(s => ({ ...s, ...data }));
      if (profile?.conditions) setHealthConditions(profile.conditions);
    } catch (e) {
      console.log('Settings fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkPermissions = useCallback(async () => {
    try {
      if (Platform.OS !== 'web') {
        const loc = await Location.getForegroundPermissionsAsync();
        const notif = await Notifications.getPermissionsAsync();
        const cam = await ImagePicker.getCameraPermissionsAsync();
        setPermStatus({
          location: loc.status,
          notifications: notif.status,
          camera: cam.status,
        });
      } else {
        setPermStatus({ location: 'granted', notifications: 'granted', camera: 'granted' });
      }
    } catch {
      // Permissions check failed silently
    }
  }, []);

  useEffect(() => { fetchSettings(); checkPermissions(); }, [fetchSettings, checkPermissions]);

  async function detectCityFromLocation() {
    setDetectingLocation(true);
    try {
      if (Platform.OS === 'web') {
        // Use IP geolocation on web — reverseGeocodeAsync needs a Google key on web
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
        clearTimeout(timer);
        const data = await res.json();
        if (data.city) {
          setSettings(s => ({ ...s, default_city: data.city }));
        } else {
          throw new Error('Could not detect city from IP');
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location access is needed to detect your city.', [
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
            { text: 'Cancel' },
          ]);
          setCityMode('manual');
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const [place] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        const city = place?.city || place?.subregion || place?.region || '';
        if (city) {
          setSettings(s => ({ ...s, default_city: city }));
        } else {
          throw new Error('Could not resolve city from coordinates');
        }
      }
    } catch (e: any) {
      Alert.alert('Location Error', e.message || 'Could not detect location. Try entering manually.');
      setCityMode('manual');
    } finally {
      setDetectingLocation(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await api.post('/api/settings', settings);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      Alert.alert('Error', e.message);
      setSaving(false);
    }
  }

  async function requestPermission(type: string) {
    try {
      if (type === 'location') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermStatus(p => ({ ...p, location: status }));
      } else if (type === 'notifications') {
        const { status } = await Notifications.requestPermissionsAsync();
        setPermStatus(p => ({ ...p, notifications: status }));
      } else if (type === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        setPermStatus(p => ({ ...p, camera: status }));
      }
    } catch {
      Alert.alert('Permission Error', 'Please enable in device Settings', [
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
        { text: 'Cancel' },
      ]);
    }
  }

  function PermissionRow({ label, icon, status, type }: any) {
    const granted = status === 'granted';
    return (
      <View style={styles.permRow}>
        <Ionicons name={icon} size={22} color={granted ? '#4ADE80' : '#FB923C'} />
        <View style={styles.permInfo}>
          <Text style={styles.permLabel}>{label}</Text>
          <Text style={[styles.permStatus, { color: granted ? '#4ADE80' : '#FB923C' }]}>
            {granted ? 'Granted' : 'Not Granted'}
          </Text>
        </View>
        {!granted && (
          <TouchableOpacity testID={`enable-${type}-btn`} style={styles.enableBtn} onPress={() => requestPermission(type)}>
            <Text style={styles.enableText}>Enable</Text>
          </TouchableOpacity>
        )}
        {granted && <Ionicons name="checkmark-circle" size={22} color="#4ADE80" />}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ADE80" />
      </View>
    );
  }

  return (
    <View testID="settings-screen" style={styles.container}>
      <LinearGradient colors={['#0A1520', '#000']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <TouchableOpacity testID="settings-back-btn" style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Customize your EnviroCare experience</Text>

          {/* Risk Personalization */}
          <Text style={styles.sectionTitle}>Risk Personalization</Text>
          <GlassCard testID="risk-thresholds-card">
            {healthConditions.length === 0 ? (
              <View style={styles.noConditionsRow}>
                <Ionicons name="person-outline" size={20} color="rgba(255,255,255,0.4)" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noConditionsText}>No health conditions saved</Text>
                  <Text style={styles.noConditionsSub}>Add conditions in your Profile to get personalised risk scoring</Text>
                </View>
              </View>
            ) : (
              <>
                {healthConditions.map((cond, i) => {
                  const key = Object.keys(CONDITION_MULTIPLIERS).find(k => cond.toLowerCase().includes(k));
                  const mult = key ? CONDITION_MULTIPLIERS[key] : null;
                  return (
                    <View key={cond}>
                      <View style={styles.thresholdRow}>
                        <View style={styles.thresholdInfo}>
                          <Ionicons name="medkit-outline" size={16} color="#FB923C" />
                          <Text style={styles.thresholdLabel}>{cond}</Text>
                        </View>
                        {mult && (
                          <View style={styles.multBadge}>
                            <Text style={styles.multText}>{mult}× risk</Text>
                          </View>
                        )}
                      </View>
                      {i < healthConditions.length - 1 && <View style={styles.thresholdDivider} />}
                    </View>
                  );
                })}
              </>
            )}
            <View style={styles.thresholdDivider} />
            <View style={styles.alertThresholdRow}>
              <Ionicons name="notifications-outline" size={16} color="#4ADE80" />
              <Text style={styles.alertThresholdLabel}>Alert threshold</Text>
              <View style={styles.alertThresholdBadge}>
                <Text style={styles.alertThresholdValue}>AQI {getPersonalizedThreshold(healthConditions)}+</Text>
              </View>
            </View>
            <Text style={styles.thresholdNote}>
              {healthConditions.length > 0
                ? 'Automatically adjusted based on your health conditions'
                : 'Default threshold for healthy individuals'}
            </Text>
          </GlassCard>

          {/* Default City */}
          <Text style={styles.sectionTitle}>Default City</Text>
          <GlassCard>
            {/* Mode toggle */}
            <View style={styles.cityModeRow}>
              <TouchableOpacity
                testID="city-mode-location-btn"
                style={[styles.cityModeBtn, cityMode === 'location' && styles.cityModeBtnActive]}
                onPress={() => { setCityMode('location'); detectCityFromLocation(); }}
              >
                <Ionicons name="locate" size={16} color={cityMode === 'location' ? '#4ADE80' : 'rgba(255,255,255,0.4)'} />
                <Text style={[styles.cityModeBtnText, cityMode === 'location' && styles.cityModeBtnTextActive]}>Use My Location</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="city-mode-manual-btn"
                style={[styles.cityModeBtn, cityMode === 'manual' && styles.cityModeBtnActive]}
                onPress={() => setCityMode('manual')}
              >
                <Ionicons name="create-outline" size={16} color={cityMode === 'manual' ? '#4ADE80' : 'rgba(255,255,255,0.4)'} />
                <Text style={[styles.cityModeBtnText, cityMode === 'manual' && styles.cityModeBtnTextActive]}>Enter Manually</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.thresholdDivider} />

            {cityMode === 'location' ? (
              <View style={styles.cityDetectRow}>
                {detectingLocation ? (
                  <>
                    <ActivityIndicator size="small" color="#4ADE80" />
                    <Text style={styles.cityDetectText}>Detecting your location...</Text>
                  </>
                ) : settings.default_city ? (
                  <>
                    <Ionicons name="location" size={18} color="#4ADE80" />
                    <Text style={styles.cityDetectedValue}>{settings.default_city}</Text>
                    <TouchableOpacity onPress={detectCityFromLocation} style={styles.redetectBtn}>
                      <Text style={styles.redetectText}>Re-detect</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Ionicons name="location-outline" size={18} color="rgba(255,255,255,0.3)" />
                    <Text style={styles.cityDetectText}>Tap "Use My Location" to detect</Text>
                  </>
                )}
              </View>
            ) : (
              <View>
                <View style={styles.citySearchRow}>
                  <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.35)" style={{ marginLeft: 14 }} />
                  <TextInput
                    testID="default-city-input"
                    style={styles.citySearchInput}
                    value={settings.default_city}
                    onChangeText={v => {
                      setSettings(s => ({ ...s, default_city: v }));
                      setShowCityDropdown(v.length > 0);
                    }}
                    onFocus={() => setShowCityDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCityDropdown(false), 150)}
                    placeholder="Search city..."
                    placeholderTextColor="rgba(255,255,255,0.3)"
                  />
                  {settings.default_city ? (
                    <TouchableOpacity onPress={() => { setSettings(s => ({ ...s, default_city: '' })); setShowCityDropdown(false); }} style={{ paddingRight: 12 }}>
                      <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.25)" />
                    </TouchableOpacity>
                  ) : null}
                </View>
                {showCityDropdown && (() => {
                  const q = settings.default_city.toLowerCase();
                  const filtered = WORLD_CITIES.filter(c => c.toLowerCase().includes(q)).slice(0, 8);
                  return filtered.length > 0 ? (
                    <View style={styles.cityDropdown}>
                      {filtered.map((c, i) => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.cityDropdownItem, i < filtered.length - 1 && styles.cityDropdownDivider]}
                          onPress={() => {
                            setSettings(s => ({ ...s, default_city: c }));
                            setShowCityDropdown(false);
                          }}
                        >
                          <Ionicons name="location-outline" size={14} color="rgba(74,222,128,0.6)" />
                          <Text style={styles.cityDropdownText}>{c}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null;
                })()}
              </View>
            )}
          </GlassCard>

          {/* Notification Preferences */}
          <Text style={styles.sectionTitle}>Notification Preferences</Text>
          <GlassCard testID="notification-prefs-card">
            {[
              { key: 'notify_daily_updates', label: 'Daily Safety Updates', icon: 'sunny' },
              { key: 'notify_high_risk', label: 'High Risk Alerts', icon: 'warning' },
              { key: 'notify_travel', label: 'Travel Alerts', icon: 'airplane' },
              { key: 'notify_routine', label: 'Routine Suggestions', icon: 'time' },
            ].map((item, i, arr) => (
              <View key={item.key}>
                <View style={styles.switchRow}>
                  <Ionicons name={item.icon as any} size={20} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.switchLabel}>{item.label}</Text>
                  <Switch
                    testID={`toggle-${item.key}`}
                    value={(settings as any)[item.key]}
                    onValueChange={v => setSettings({ ...settings, [item.key]: v })}
                    trackColor={{ false: 'rgba(255,255,255,0.1)', true: 'rgba(74,222,128,0.3)' }}
                    thumbColor={(settings as any)[item.key] ? '#4ADE80' : '#888'}
                  />
                </View>
                {i < arr.length - 1 && <View style={styles.thresholdDivider} />}
              </View>
            ))}
          </GlassCard>

          {/* Permissions */}
          <Text style={styles.sectionTitle}>Permissions</Text>
          <GlassCard testID="permissions-card">
            <PermissionRow label="Location" icon="location" status={permStatus.location} type="location" />
            <View style={styles.thresholdDivider} />
            <PermissionRow label="Notifications" icon="notifications" status={permStatus.notifications} type="notifications" />
            <View style={styles.thresholdDivider} />
            <PermissionRow label="Camera" icon="camera" status={permStatus.camera} type="camera" />
          </GlassCard>

          {/* Save */}
          <TouchableOpacity
            testID="save-settings-btn"
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={saveSettings}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>Save Settings</Text>}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  loadingContainer: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: 'rgba(255,255,255,0.7)', marginBottom: 10, marginTop: 16, letterSpacing: 0.5 },
  thresholdRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  thresholdInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thresholdLabel: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  thresholdDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginVertical: 6 },
  multBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(251,146,60,0.15)', borderWidth: 1, borderColor: 'rgba(251,146,60,0.25)' },
  multText: { fontSize: 12, fontWeight: '700', color: '#FB923C' },
  alertThresholdRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  alertThresholdLabel: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  alertThresholdBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)' },
  alertThresholdValue: { fontSize: 13, fontWeight: '700', color: '#4ADE80' },
  thresholdNote: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4, fontStyle: 'italic' },
  noConditionsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  noConditionsText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  noConditionsSub: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 3, lineHeight: 17 },
  cityModeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  cityModeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  cityModeBtnActive: { backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.3)' },
  cityModeBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  cityModeBtnTextActive: { color: '#4ADE80' },
  cityDetectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  cityDetectText: { fontSize: 14, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },
  cityDetectedValue: { flex: 1, fontSize: 16, fontWeight: '700', color: '#FFF' },
  redetectBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.25)',
  },
  redetectText: { fontSize: 12, fontWeight: '600', color: '#4ADE80' },
  cityInput: {
    height: 48, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16, color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginTop: 4,
  },
  citySearchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', height: 48,
  },
  citySearchInput: { flex: 1, color: '#FFF', fontSize: 15, height: '100%', paddingRight: 8 },
  cityDropdown: {
    backgroundColor: '#1A1A2E', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)', marginTop: 4, overflow: 'hidden',
  },
  cityDropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  cityDropdownDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  cityDropdownText: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  switchLabel: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  permInfo: { flex: 1 },
  permLabel: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  permStatus: { fontSize: 12, marginTop: 2 },
  enableBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12,
    backgroundColor: 'rgba(74,222,128,0.1)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
  },
  enableText: { fontSize: 13, fontWeight: '600', color: '#4ADE80' },
  saveBtn: {
    height: 56, borderRadius: 28, backgroundColor: '#4ADE80',
    alignItems: 'center', justifyContent: 'center', marginTop: 24,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#000', letterSpacing: 0.5 },
});
