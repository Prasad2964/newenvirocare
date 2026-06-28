import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, AppState, Platform, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/utils/api';
import { getAqiTheme, getRiskColor } from '../../src/utils/theme';
import { sendAqiAlert, getPersonalizedThreshold, registerForPushNotifications, requestWebNotificationPermission, checkPredictiveAlerts } from '../../src/services/notifications';
import { showToast } from '../../src/components/Toast';
import BreathingOrb from '../../src/components/BreathingOrb';
import GlassCard from '../../src/components/GlassCard';
import RiskGauge from '../../src/components/RiskGauge';
import PressableScale from '../../src/components/PressableScale';
import { SkeletonDashboard } from '../../src/components/Skeleton';
import { COLORS, FONTS, FONT_SIZE, SPACING, RADIUS, getAqiTheme as getTokenTheme } from '../../src/utils/tokens';

// GPS first, IP geo as fallback. Returns coords when GPS succeeds so the
// caller can hit WAQI's geo endpoint for the nearest station.
async function resolveLocation(): Promise<{
  city: string | null;
  denied: boolean;
  coords: { lat: number; lon: number } | null;
}> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { city: null, denied: true, coords: null };
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = loc.coords;
    const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
    const gpsCity = geo?.city || geo?.subregion || geo?.region;
    if (gpsCity) {
      console.log('[Location] GPS city:', gpsCity, latitude, longitude);
      return { city: gpsCity, denied: false, coords: { lat: latitude, lon: longitude } };
    }
  } catch (e) {
    console.log('[Location] GPS failed:', e);
  }
  // IP geo fallback — no precise coords available
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    if (data.city) {
      console.log('[Location] IP geo city:', data.city);
      return { city: data.city, denied: false, coords: null };
    }
  } catch (e) {
    console.log('[Location] IP geo failed:', e);
  }
  return { city: null, denied: false, coords: null };
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [aqiData, setAqiData] = useState<any>(null);
  const [riskData, setRiskData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [gamification, setGamification] = useState<any>(null);
  const [exposure, setExposure] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [city, setCity] = useState('');
  const [error, setError] = useState(false);
  const [cityInputMode, setCityInputMode] = useState(false);
  const [cityInputValue, setCityInputValue] = useState('');
  const [locationPrompt, setLocationPrompt] = useState<string | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);
  const conditionsRef = useRef<string[]>([]);
  const healthProfileRef = useRef<{ conditions: string[]; medications: string[]; allergies: string[]; age?: number | null; notes?: string | null }>({
    conditions: [], medications: [], allergies: [],
  });
  const savedSettingsRef = useRef<any>(null);

  // Merges default_city into existing settings to avoid resetting user's other prefs.
  async function saveCity(newCity: string) {
    try {
      const existing = savedSettingsRef.current || {};
      await api.post('/api/settings', {
        safe_aqi_threshold: existing.safe_aqi_threshold ?? 50,
        risky_aqi_threshold: existing.risky_aqi_threshold ?? 150,
        dangerous_aqi_threshold: existing.dangerous_aqi_threshold ?? 300,
        notify_daily_updates: existing.notify_daily_updates ?? true,
        notify_high_risk: existing.notify_high_risk ?? true,
        notify_travel: existing.notify_travel ?? true,
        notify_routine: existing.notify_routine ?? true,
        default_city: newCity,
      });
      if (savedSettingsRef.current) {
        savedSettingsRef.current = { ...savedSettingsRef.current, default_city: newCity };
      }
    } catch (e) {
      console.log('[City] Failed to save city to settings:', e);
    }
  }

  const fetchData = useCallback(async () => {
    try {
      setError(false);

      // Load saved settings first
      const settings = await api.get('/api/settings').catch(() => null);
      savedSettingsRef.current = settings;
      const savedCity = settings?.default_city?.trim();

      let activeCity: string;

      if (savedCity) {
        // Use saved city immediately so the dashboard loads without waiting for GPS
        activeCity = savedCity;
        setCity(savedCity);
        setCityInputMode(false);

        // Background: check if user's location has changed since last save
        setDetectingLocation(true);
        resolveLocation()
          .then(({ city: detected, coords }) => {
            setDetectingLocation(false);
            if (coords) coordsRef.current = coords;
            if (detected && detected.toLowerCase() !== savedCity.toLowerCase()) {
              setLocationPrompt(detected);
            }
          })
          .catch(() => setDetectingLocation(false));
      } else {
        // First launch or no saved city — foreground GPS detection
        setDetectingLocation(true);
        const { city: detected, denied, coords } = await resolveLocation();
        setDetectingLocation(false);
        if (coords) coordsRef.current = coords;

        if (detected) {
          activeCity = detected;
          setCity(detected);
          setCityInputMode(false);
          saveCity(detected);
        } else {
          // Permission denied or all detection methods failed — ask user to type
          setCityInputMode(true);
          setLoading(false);
          return;
        }
      }

      // Use GPS coords for nearest-station lookup when available;
      // fall back to city-name search when coords are absent (IP geo / manual entry).
      const c = coordsRef.current;
      const aqiEndpoint = c
        ? `/api/aqi/geo?lat=${c.lat}&lon=${c.lon}`
        : `/api/aqi/${encodeURIComponent(activeCity)}`;
      const [aqi, risk, profile] = await Promise.all([
        api.get(aqiEndpoint),
        api.post('/api/risk-assessment', { city: activeCity }).catch(() => null),
        api.get('/api/health-profile').catch(() => null),
      ]);
      setAqiData(aqi);
      if (risk) setRiskData(risk);
      if (profile) {
        conditionsRef.current = profile.conditions || [];
        healthProfileRef.current = {
          conditions: profile.conditions || [],
          medications: profile.medications || [],
          allergies: profile.allergies || [],
          age: profile.age ?? null,
          notes: profile.notes ?? null,
        };
      }

      api.post('/api/activity', {
        type: 'aqi_check', city: activeCity,
        aqi: aqi?.aqi, risk_level: risk?.risk?.level || 'low',
        description: `AQI ${aqi?.aqi} - ${aqi?.level}`,
      }).catch(() => {});

      const [gam, exp] = await Promise.all([
        api.get('/api/gamification').catch(() => null),
        api.get('/api/exposure/summary').catch(() => null),
      ]);
      if (gam) setGamification(gam);
      if (exp) setExposure(exp);

      // Predictive alerts — prescription-specific, rate-limited per alert type
      if (aqi) {
        const hp = healthProfileRef.current;
        const hasProfile = hp.conditions.length > 0 || hp.medications.length > 0 || hp.allergies.length > 0;
        if (hasProfile) {
          checkPredictiveAlerts(
            {
              aqi: aqi.aqi,
              humidity: aqi.weather?.humidity,
              temperature: aqi.weather?.temperature,
              pm25: aqi.pollutants?.pm25,
              no2: aqi.pollutants?.no2,
              city: aqi.city || activeCity,
            },
            hp,
          ).catch(() => {});
        }
      }

      const threshold = getPersonalizedThreshold(conditionsRef.current);
      if (aqi?.aqi >= threshold) {
        sendAqiAlert(aqi.aqi, activeCity, aqi.level, conditionsRef.current).catch(() => {});
      }
    } catch (e) {
      setError(true);
      console.log('Fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // User submits a manually typed city (from picker screen or inline edit)
  async function handleManualCitySubmit() {
    const newCity = cityInputValue.trim();
    if (!newCity) return;
    await saveCity(newCity);
    setCity(newCity);
    setCityInputMode(false);
    setCityInputValue('');
    setLocationPrompt(null);
    if (aqiData) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    fetchData();
  }

  // User accepts the "you're now in X" location update prompt
  async function handleAcceptLocationUpdate() {
    if (!locationPrompt) return;
    const newCity = locationPrompt;
    setLocationPrompt(null);
    await saveCity(newCity);
    setCity(newCity);
    setRefreshing(true);
    fetchData();
  }

  useEffect(() => {
    if (Platform.OS === 'web') {
      requestWebNotificationPermission();
    } else {
      registerForPushNotifications();
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (appState.current === 'active') {
        api.get(`/api/aqi/${city}`).then(aqi => {
          setAqiData(aqi);
          const threshold = getPersonalizedThreshold(conditionsRef.current);
          if (aqi?.aqi >= threshold) {
            sendAqiAlert(aqi.aqi, city, aqi.level, conditionsRef.current).catch(() => {});
            if (aqi.aqi > 200) showToast(`AQI Alert: ${city} is ${aqi.aqi}!`, 'warning');
          }
        }).catch(() => {});
      }
    }, 30 * 60 * 1000);

    const sub = AppState.addEventListener('change', (state) => {
      if (appState.current.match(/inactive|background/) && state === 'active') {
        fetchData();
      }
      appState.current = state;
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, [city]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  if (loading) {
    return (
      <View testID="home-loading" style={styles.container}>
        <LinearGradient colors={[COLORS.bg, '#081210']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.flex} edges={['top']}>
          <SkeletonDashboard />
        </SafeAreaView>
      </View>
    );
  }

  // Full-screen city picker — shown when no data yet and location was unavailable
  if (cityInputMode && !aqiData) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[COLORS.bg, '#081210']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.flex} edges={['top']}>
          <View style={styles.cityPickerContainer}>
            <View style={styles.cityPickerIconWrap}>
              <Ionicons name="location-outline" size={36} color={COLORS.accent} />
            </View>
            <Text style={styles.cityPickerTitle}>Where are you?</Text>
            <Text style={styles.cityPickerSub}>
              Location access was denied. Enter your city to get live air quality data.
            </Text>
            <TextInput
              style={styles.cityPickerInput}
              value={cityInputValue}
              onChangeText={setCityInputValue}
              placeholder="e.g. Mumbai, Delhi, Bengaluru"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
              returnKeyType="done"
              autoCapitalize="words"
              onSubmitEditing={handleManualCitySubmit}
            />
            <TouchableOpacity
              style={[styles.cityPickerBtn, !cityInputValue.trim() && styles.cityPickerBtnDisabled]}
              onPress={handleManualCitySubmit}
              disabled={!cityInputValue.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.cityPickerBtnText}>Get Air Quality</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error && !aqiData) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[COLORS.bg, '#140808']} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.flex} edges={['top']}>
          <View style={styles.errorContainer}>
            <Ionicons name="cloud-offline-outline" size={56} color={COLORS.textMuted} />
            <Text style={styles.errorTitle}>Connection Error</Text>
            <Text style={styles.errorText}>Could not load environment data. Check your connection.</Text>
            <TouchableOpacity testID="retry-btn" style={styles.retryBtn} onPress={() => { setLoading(true); fetchData(); }}>
              <Ionicons name="refresh" size={20} color={COLORS.accent} />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const aqi = aqiData?.aqi || 50;
  const theme = getAqiTheme(aqi);
  const tokenTheme = getTokenTheme(aqi);
  const riskScore = riskData?.risk?.score || (aqi / 5);
  const riskLevel = riskData?.risk?.level || 'low';

  return (
    <View testID="home-screen" style={styles.container}>
      <LinearGradient colors={tokenTheme.bgGradient as [string, string]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textWhite} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Location update prompt — shown when GPS detects a different city than saved */}
          {locationPrompt && (
            <View style={styles.locationPrompt}>
              <Ionicons name="navigate" size={13} color={COLORS.accent} />
              <Text style={styles.locationPromptText}>
                You're in{' '}
                <Text style={styles.locationPromptCity}>{locationPrompt}</Text>
              </Text>
              <TouchableOpacity onPress={handleAcceptLocationUpdate} style={styles.locationPromptUpdateBtn}>
                <Text style={styles.locationPromptUpdateText}>Update</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLocationPrompt(null)} style={styles.locationPromptClose}>
                <Ionicons name="close" size={14} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>Hello, {user?.name || 'User'}</Text>
              {/* City row — edit mode vs display mode */}
              {cityInputMode ? (
                <View style={styles.cityEditRow}>
                  <Ionicons name="location" size={14} color={tokenTheme.primary} />
                  <TextInput
                    style={[styles.cityInlineInput, { color: tokenTheme.primary }]}
                    value={cityInputValue}
                    onChangeText={setCityInputValue}
                    placeholder={city || 'Enter city'}
                    placeholderTextColor={COLORS.textMuted}
                    autoFocus
                    returnKeyType="done"
                    autoCapitalize="words"
                    onSubmitEditing={handleManualCitySubmit}
                  />
                  <TouchableOpacity onPress={handleManualCitySubmit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="checkmark" size={16} color={COLORS.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setCityInputMode(false); setCityInputValue(''); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={16} color={COLORS.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.cityRow}>
                  <Ionicons name="location" size={14} color={tokenTheme.primary} />
                  <Text style={[styles.cityLabel, { color: tokenTheme.primary }]}>{city}</Text>
                  {detectingLocation ? (
                    <ActivityIndicator size="small" color={COLORS.textMuted} style={styles.detectingSpinner} />
                  ) : (
                    <TouchableOpacity
                      onPress={() => { setCityInputMode(true); setCityInputValue(''); }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.cityEditBtn}
                    >
                      <Ionicons name="pencil-outline" size={12} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity testID="settings-btn" style={styles.iconBtn} onPress={() => router.push('/settings')}>
                <Ionicons name="settings-outline" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <View style={[styles.aqiBadge, { backgroundColor: tokenTheme.primary + '20', borderColor: tokenTheme.primary + '30' }]}>
                <Text style={[styles.aqiBadgeText, { color: tokenTheme.primary }]}>AQI {aqi}</Text>
              </View>
            </View>
          </View>

          {/* Breathing Orb — tap to open live AQI map */}
          <TouchableOpacity
            style={styles.orbSection}
            onPress={() => router.push(`/aqi-map?city=${encodeURIComponent(city)}`)}
            activeOpacity={0.85}
          >
            <BreathingOrb aqi={aqi} color={tokenTheme.primary} showValue={true} />
            <Text style={[styles.aqiLabel, { color: tokenTheme.primary }]}>{tokenTheme.label} Air Quality</Text>
            <View style={[styles.mapHint, { borderColor: tokenTheme.primary + '40' }]}>
              <Ionicons name="map-outline" size={13} color={tokenTheme.primary} />
              <Text style={[styles.mapHintText, { color: tokenTheme.primary }]}>Tap for live map</Text>
            </View>
          </TouchableOpacity>

          {/* Risk Gauge */}
          <GlassCard testID="risk-gauge-card" style={styles.gaugeCard}>
            <Text style={styles.cardTitle}>Your Risk Level</Text>
            <RiskGauge score={riskScore} color={getRiskColor(riskLevel)} label={riskLevel} />
          </GlassCard>

          {/* Risk Bar */}
          <GlassCard testID="risk-bar-card">
            <Text style={styles.cardTitle}>Risk Status</Text>
            <View style={styles.riskBar}>
              <View style={styles.riskBarTrack}>
                <View style={[styles.riskBarFill, { width: `${Math.min(riskScore, 100)}%`, backgroundColor: getRiskColor(riskLevel) }]} />
              </View>
              <View style={styles.riskLabels}>
                <Text style={styles.riskLabel}>Low</Text>
                <Text style={styles.riskLabel}>Med</Text>
                <Text style={styles.riskLabel}>High</Text>
                <Text style={styles.riskLabel}>Danger</Text>
              </View>
            </View>
          </GlassCard>

          {/* Weather Card */}
          <GlassCard testID="weather-card">
            <Text style={styles.cardTitle}>Weather</Text>
            <View style={styles.weatherRow}>
              <View style={styles.weatherItem}>
                <Ionicons name="thermometer-outline" size={22} color={COLORS.warning} />
                <Text style={styles.weatherValue}>{aqiData?.weather?.temperature}°C</Text>
                <Text style={styles.weatherLabel}>Temp</Text>
              </View>
              <View style={styles.weatherItem}>
                <Ionicons name="water-outline" size={22} color={COLORS.cyan} />
                <Text style={styles.weatherValue}>{aqiData?.weather?.humidity}%</Text>
                <Text style={styles.weatherLabel}>Humidity</Text>
              </View>
              <View style={styles.weatherItem}>
                <Ionicons name="speedometer-outline" size={22} color={COLORS.purpleLight} />
                <Text style={styles.weatherValue}>{aqiData?.weather?.wind_speed} km/h</Text>
                <Text style={styles.weatherLabel}>Wind</Text>
              </View>
            </View>
          </GlassCard>

          {/* Pollutants Card */}
          <GlassCard testID="pollutants-card">
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Pollutants</Text>
              <View style={[styles.primaryBadge, { backgroundColor: tokenTheme.primary + '20' }]}>
                <Text style={[styles.primaryBadgeText, { color: tokenTheme.primary }]}>{aqiData?.primary_pollutant}</Text>
              </View>
            </View>
            <View style={styles.pollutantGrid}>
              {aqiData?.pollutants && Object.entries(aqiData.pollutants).map(([key, val]) => (
                <View key={key} style={styles.pollutantItem}>
                  <Text style={styles.pollutantKey}>{key.toUpperCase()}</Text>
                  <Text style={styles.pollutantVal}>{String(val)}</Text>
                </View>
              ))}
            </View>
          </GlassCard>

          {/* Mask Recommendation */}
          <GlassCard testID="mask-card">
            <View style={styles.maskRow}>
              <View style={[styles.maskIcon, { backgroundColor: tokenTheme.primary + '15' }]}>
                <Ionicons name={(aqiData?.mask?.icon || 'medical') as any} size={28} color={tokenTheme.primary} />
              </View>
              <View style={styles.maskInfo}>
                <Text style={styles.maskTitle}>Mask Recommendation</Text>
                <Text style={styles.maskLabel}>{aqiData?.mask?.label}</Text>
              </View>
            </View>
          </GlassCard>

          {/* AI Advice */}
          {riskData?.advice && (
            <GlassCard testID="ai-advice-card" style={styles.adviceCard}>
              <View style={styles.adviceHeader}>
                <Ionicons name="sparkles" size={18} color={COLORS.warning} />
                <Text style={styles.adviceTitle}>AI Health Advice</Text>
              </View>
              <Text style={styles.adviceText}>{riskData.advice}</Text>
            </GlassCard>
          )}

          {/* Emergency Alert */}
          {aqiData?.is_emergency && (
            <View testID="emergency-alert" style={styles.emergencyCard}>
              <Ionicons name="warning" size={32} color={COLORS.textWhite} />
              <Text style={styles.emergencyTitle}>EMERGENCY ALERT</Text>
              <Text style={styles.emergencyText}>
                AQI has crossed dangerous levels! Stay indoors, close windows, use air purifiers.
              </Text>
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <PressableScale
              testID="compare-cities-btn"
              style={[styles.actionBtn, { backgroundColor: tokenTheme.primary + '10', borderColor: tokenTheme.primary + '25' }]}
              onPress={() => router.push('/city-compare')}
            >
              <Ionicons name="git-compare-outline" size={20} color={tokenTheme.primary} />
              <Text style={[styles.actionText, { color: tokenTheme.primary }]}>Compare Cities</Text>
            </PressableScale>
          </View>

          {/* Exposure Tracker */}
          {exposure && (
            <GlassCard testID="exposure-card" glowColor={tokenTheme.primary}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Air Exposure</Text>
                <Ionicons name="timer-outline" size={18} color={COLORS.textMuted} />
              </View>
              <View style={styles.exposureRow}>
                <View style={styles.exposureItem}>
                  <Text style={[styles.exposureBig, { color: exposure.today.unhealthy_minutes > 60 ? COLORS.danger : COLORS.accent }]}>
                    {exposure.today.unhealthy_minutes || 0}m
                  </Text>
                  <Text style={styles.exposureLabel}>Unhealthy Air Today</Text>
                </View>
                <View style={styles.exposureDivider} />
                <View style={styles.exposureItem}>
                  <Text style={styles.exposureBig}>{exposure.week.entries || 0}</Text>
                  <Text style={styles.exposureLabel}>Checks This Week</Text>
                </View>
              </View>
            </GlassCard>
          )}

          {/* Gamification */}
          {gamification && (
            <GlassCard testID="gamification-card" glowColor={COLORS.warning}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Your Progress</Text>
                <View style={styles.streakBadge}>
                  <Ionicons name="flame" size={14} color={COLORS.warning} />
                  <Text style={styles.streakText}>{gamification.streak} day streak</Text>
                </View>
              </View>
              <View style={styles.badgeRow}>
                {gamification.badges?.slice(0, 4).map((b: any) => (
                  <View key={b.id} style={[styles.badge, !b.earned && styles.badgeLocked]}>
                    <Ionicons name={b.icon as any} size={20} color={b.earned ? COLORS.warning : COLORS.textMuted} />
                    <Text style={[styles.badgeName, !b.earned && styles.badgeNameLocked]}>{b.name}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.scoreBar}>
                <View style={[styles.scoreBarFill, { width: `${Math.min(gamification.score || 0, 100)}%` }]} />
              </View>
              <Text style={styles.scoreLabel}>Score: {gamification.score || 0}/100</Text>
            </GlassCard>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  errorTitle: { fontSize: FONT_SIZE.xl + 2, fontFamily: FONTS.heading, color: COLORS.textWhite },
  errorText: { fontSize: FONT_SIZE.md, fontFamily: FONTS.body, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.lg,
    backgroundColor: COLORS.accent + '10', borderWidth: 1, borderColor: COLORS.accent + '30',
  },
  retryText: { fontSize: FONT_SIZE.md + 1, fontFamily: FONTS.bodySemibold, color: COLORS.accent },
  scroll: { padding: SPACING.xl, paddingBottom: 40 },

  // Location update prompt
  locationPrompt: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.accent + '12', borderWidth: 1, borderColor: COLORS.accent + '25',
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: SPACING.lg,
  },
  locationPromptText: { flex: 1, fontSize: FONT_SIZE.sm, fontFamily: FONTS.body, color: COLORS.textSecondary },
  locationPromptCity: { fontFamily: FONTS.bodySemibold, color: COLORS.textWhite },
  locationPromptUpdateBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.accent, marginLeft: 4,
  },
  locationPromptUpdateText: { fontSize: FONT_SIZE.xs + 1, fontFamily: FONTS.bodySemibold, color: COLORS.bg },
  locationPromptClose: { padding: 2 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xxl },
  headerLeft: { flex: 1, paddingRight: 8 },
  greeting: { fontSize: FONT_SIZE.xl + 4, fontFamily: FONTS.heading, color: COLORS.textWhite },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cityLabel: { fontSize: FONT_SIZE.md, fontFamily: FONTS.bodyMedium },
  cityEditBtn: { marginLeft: 4 },
  detectingSpinner: { marginLeft: 4 },

  // Inline city edit in header
  cityEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  cityInlineInput: {
    flex: 1, fontSize: FONT_SIZE.md, fontFamily: FONTS.bodyMedium,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 2,
    minWidth: 80,
  },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  aqiBadge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  aqiBadgeText: { fontSize: FONT_SIZE.sm, fontFamily: FONTS.monoBold },

  // Full-screen city picker
  cityPickerContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16,
  },
  cityPickerIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.accent + '15', borderWidth: 1, borderColor: COLORS.accent + '30',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  cityPickerTitle: { fontSize: FONT_SIZE.xxl, fontFamily: FONTS.heading, color: COLORS.textWhite, textAlign: 'center' },
  cityPickerSub: {
    fontSize: FONT_SIZE.md, fontFamily: FONTS.body, color: COLORS.textSecondary,
    textAlign: 'center', lineHeight: 22,
  },
  cityPickerInput: {
    width: '100%', height: 54, borderRadius: RADIUS.md,
    backgroundColor: COLORS.glass, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 16, fontSize: FONT_SIZE.md + 1, fontFamily: FONTS.bodyMedium,
    color: COLORS.textWhite, marginTop: 8,
  },
  cityPickerBtn: {
    width: '100%', height: 54, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
  },
  cityPickerBtnDisabled: { opacity: 0.4 },
  cityPickerBtnText: { fontSize: FONT_SIZE.lg, fontFamily: FONTS.heading, color: COLORS.bg, letterSpacing: 0.5 },

  // Dashboard cards
  orbSection: { alignItems: 'center', marginBottom: SPACING.xxxl, paddingVertical: SPACING.lg },
  aqiLabel: { fontSize: FONT_SIZE.lg, fontFamily: FONTS.bodyMedium, marginTop: SPACING.sm },
  mapHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  mapHintText: { fontSize: 12, fontWeight: '600' },
  gaugeCard: { marginBottom: SPACING.lg, alignItems: 'center' },
  cardTitle: { fontSize: FONT_SIZE.lg, fontFamily: FONTS.headingSemibold, color: COLORS.textWhite, marginBottom: SPACING.lg, letterSpacing: 0.3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  riskBar: { marginTop: 4 },
  riskBarTrack: { height: 10, backgroundColor: COLORS.glass, borderRadius: 5, overflow: 'hidden' },
  riskBarFill: { height: '100%', borderRadius: 5 },
  riskLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm },
  riskLabel: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bodyMedium, color: COLORS.textMuted },
  weatherRow: { flexDirection: 'row', justifyContent: 'space-around' },
  weatherItem: { alignItems: 'center', gap: 6 },
  weatherValue: { fontSize: FONT_SIZE.lg + 2, fontFamily: FONTS.monoBold, color: COLORS.textWhite },
  weatherLabel: { fontSize: FONT_SIZE.xs + 1, fontFamily: FONTS.body, color: COLORS.textSecondary },
  primaryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm },
  primaryBadgeText: { fontSize: FONT_SIZE.xs + 1, fontFamily: FONTS.monoBold },
  pollutantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pollutantItem: {
    width: '30%', backgroundColor: COLORS.glass, borderRadius: RADIUS.md,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  pollutantKey: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.mono, color: COLORS.textSecondary, letterSpacing: 1 },
  pollutantVal: { fontSize: FONT_SIZE.lg, fontFamily: FONTS.monoBold, color: COLORS.textWhite, marginTop: 4 },
  maskRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  maskIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  maskInfo: { flex: 1 },
  maskTitle: { fontSize: FONT_SIZE.md, fontFamily: FONTS.bodySemibold, color: COLORS.textWhite },
  maskLabel: { fontSize: FONT_SIZE.sm + 1, fontFamily: FONTS.body, color: COLORS.textSecondary, marginTop: 4 },
  adviceCard: { borderColor: COLORS.warning + '20' },
  adviceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  adviceTitle: { fontSize: FONT_SIZE.md, fontFamily: FONTS.bodySemibold, color: COLORS.warning },
  adviceText: { fontSize: FONT_SIZE.md, fontFamily: FONTS.body, color: COLORS.textPrimary, lineHeight: 22 },
  emergencyCard: {
    backgroundColor: 'rgba(220,38,38,0.2)', borderRadius: RADIUS.lg,
    borderWidth: 2, borderColor: COLORS.danger, padding: SPACING.xxl,
    alignItems: 'center', marginBottom: SPACING.lg,
  },
  emergencyTitle: { fontSize: FONT_SIZE.xl, fontFamily: FONTS.heading, color: COLORS.textWhite, marginTop: 8, letterSpacing: 2 },
  emergencyText: { fontSize: FONT_SIZE.md, fontFamily: FONTS.body, color: COLORS.textPrimary, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  quickActions: { marginTop: SPACING.sm },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.lg, borderRadius: RADIUS.md, gap: 10, borderWidth: 1,
  },
  actionText: { fontSize: FONT_SIZE.md + 1, fontFamily: FONTS.bodySemibold },
  exposureRow: { flexDirection: 'row', alignItems: 'center' },
  exposureItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  exposureBig: { fontSize: FONT_SIZE.xxl, fontFamily: FONTS.monoBold, color: COLORS.textWhite },
  exposureLabel: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bodyMedium, color: COLORS.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  exposureDivider: { width: 1, height: 40, backgroundColor: COLORS.border },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm, backgroundColor: COLORS.warning + '10' },
  streakText: { fontSize: FONT_SIZE.xs + 1, fontFamily: FONTS.monoBold, color: COLORS.warning },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: SPACING.lg },
  badge: { alignItems: 'center', gap: 6, width: 72 },
  badgeLocked: { opacity: 0.3 },
  badgeName: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.bodySemibold, color: COLORS.warning, textAlign: 'center' },
  badgeNameLocked: { color: COLORS.textMuted },
  scoreBar: { height: 6, backgroundColor: COLORS.glass, borderRadius: 3, overflow: 'hidden' },
  scoreBarFill: { height: '100%', backgroundColor: COLORS.warning, borderRadius: 3 },
  scoreLabel: { fontSize: FONT_SIZE.xs + 1, fontFamily: FONTS.mono, color: COLORS.textMuted, marginTop: 8, textAlign: 'center' },
});
