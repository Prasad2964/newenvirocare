import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/utils/api';
import { getAqiTheme, getRiskColor } from '../../src/utils/theme';
import { sendAqiAlert } from '../../src/services/notifications';
import { showToast } from '../../src/components/Toast';
import BreathingOrb from '../../src/components/BreathingOrb';
import GlassCard from '../../src/components/GlassCard';
import RiskGauge from '../../src/components/RiskGauge';
import PressableScale from '../../src/components/PressableScale';
import { SkeletonDashboard } from '../../src/components/Skeleton';
import { COLORS, FONTS, FONT_SIZE, SPACING, RADIUS, getAqiTheme as getTokenTheme } from '../../src/utils/tokens';

async function detectUserCity(fallback: string): Promise<string> {
  // Try IP geolocation first — works on web without any permission
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    console.log('[Location] IP geo city:', data.city);
    if (data.city) return data.city;
  } catch (e) {
    console.log('[Location] IP geo failed:', e);
  }

  // Fallback: GPS via expo-location
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      const gpsCity = geo?.city || geo?.subregion || geo?.region;
      console.log('[Location] GPS city:', gpsCity);
      if (gpsCity) return gpsCity;
    }
  } catch (e) {
    console.log('[Location] GPS failed:', e);
  }

  console.log('[Location] Using fallback:', fallback);
  return fallback;
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
  const [city, setCity] = useState('Mumbai');
  const [error, setError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef(AppState.currentState);

  const fetchData = useCallback(async () => {
    try {
      setError(false);
      const settings = await api.get('/api/settings').catch(() => null);
      const detectedCity = await detectUserCity(settings?.default_city || 'Mumbai');
      setCity(detectedCity);

      const [aqi, risk] = await Promise.all([
        api.get(`/api/aqi/${detectedCity}`),
        api.post('/api/risk-assessment', { city: detectedCity }).catch(() => null),
      ]);
      setAqiData(aqi);
      if (risk) setRiskData(risk);

      api.post('/api/activity', {
        type: 'aqi_check', city: detectedCity,
        aqi: aqi?.aqi, risk_level: risk?.risk?.level || 'low',
        description: `AQI ${aqi?.aqi} - ${aqi?.level}`,
      }).catch(() => {});

      const [gam, exp] = await Promise.all([
        api.get('/api/gamification').catch(() => null),
        api.get('/api/exposure/summary').catch(() => null),
      ]);
      if (gam) setGamification(gam);
      if (exp) setExposure(exp);

      if (aqi?.aqi > 150) {
        sendAqiAlert(aqi.aqi, detectedCity, aqi.level).catch(() => {});
      }
    } catch (e) {
      setError(true);
      console.log('Fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (appState.current === 'active') {
        api.get(`/api/aqi/${city}`).then(aqi => {
          setAqiData(aqi);
          if (aqi?.aqi > 200) {
            showToast(`AQI Alert: ${city} AQI is ${aqi.aqi}!`, 'warning');
          }
        }).catch(() => {});
      }
    }, 5 * 60 * 1000);

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
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hello, {user?.name || 'User'}</Text>
              <View style={styles.cityRow}>
                <Ionicons name="location" size={14} color={tokenTheme.primary} />
                <Text style={[styles.cityLabel, { color: tokenTheme.primary }]}>{city}</Text>
              </View>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xxl },
  greeting: { fontSize: FONT_SIZE.xl + 4, fontFamily: FONTS.heading, color: COLORS.textWhite },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cityLabel: { fontSize: FONT_SIZE.md, fontFamily: FONTS.bodyMedium },
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
  orbSection: { alignItems: 'center', marginBottom: SPACING.xxxl, paddingVertical: SPACING.lg },
  aqiLabel: { fontSize: FONT_SIZE.lg, fontFamily: FONTS.bodyMedium, marginTop: SPACING.sm },
  mapHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
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
    paddingVertical: SPACING.lg, borderRadius: RADIUS.md, gap: 10,
    borderWidth: 1,
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
