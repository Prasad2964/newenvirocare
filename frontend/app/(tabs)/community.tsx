import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import api from '../../src/utils/api';
import { COLORS, FONTS, FONT_SIZE, SPACING, RADIUS } from '../../src/utils/tokens';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AqiData {
  city: string;
  aqi: number;
  level: string;
  pollutants: { pm25: number; pm10: number; no2: number; so2: number; co: number; o3: number };
  weather: { temperature: number; humidity: number; wind_speed: number };
}

type SafetyLevel = 'safe' | 'caution' | 'limit' | 'avoid' | 'indoors';

interface GroupStatus {
  label: string;
  icon: string;
  status: SafetyLevel;
  detail: string;
}

interface ActivityStatus {
  label: string;
  icon: string;
  status: SafetyLevel;
}

interface PollutantInfo {
  key: keyof AqiData['pollutants'];
  label: string;
  unit: string;
  affects: string;
  thresholds: [number, number, number]; // [caution, limit, avoid]
}

// ── Safety helpers ────────────────────────────────────────────────────────────

const SAFETY_COLORS: Record<SafetyLevel, string> = {
  safe: '#4ADE80',
  caution: '#FACC15',
  limit: '#FB923C',
  avoid: '#F87171',
  indoors: '#C084FC',
};

const SAFETY_LABELS: Record<SafetyLevel, string> = {
  safe: 'Safe',
  caution: 'Caution',
  limit: 'Limit',
  avoid: 'Avoid',
  indoors: 'Stay Indoors',
};

function aqiColor(aqi: number): string {
  if (aqi <= 50) return '#4ADE80';
  if (aqi <= 100) return '#FACC15';
  if (aqi <= 150) return '#FB923C';
  if (aqi <= 200) return '#F87171';
  if (aqi <= 300) return '#C084FC';
  return '#7F1D1D';
}

function getGroupStatuses(aqi: number): GroupStatus[] {
  const pick = (thrs: [number, number, number, number]): SafetyLevel => {
    if (aqi <= thrs[0]) return 'safe';
    if (aqi <= thrs[1]) return 'caution';
    if (aqi <= thrs[2]) return 'limit';
    if (aqi <= thrs[3]) return 'avoid';
    return 'indoors';
  };

  return [
    {
      label: 'Children', icon: 'happy-outline',
      status: pick([100, 130, 160, 200]),
      detail: aqi <= 100 ? 'Normal outdoor play is fine'
        : aqi <= 130 ? 'Limit strenuous outdoor activity'
        : aqi <= 160 ? 'Avoid prolonged outdoor play'
        : 'Keep indoors',
    },
    {
      label: 'Elderly', icon: 'accessibility-outline',
      status: pick([50, 80, 130, 180]),
      detail: aqi <= 50 ? 'Safe for outdoor walks'
        : aqi <= 80 ? 'Limit strenuous exertion'
        : aqi <= 130 ? 'Avoid outdoor activity'
        : 'Stay indoors',
    },
    {
      label: 'Respiratory', icon: 'fitness-outline',
      status: pick([50, 80, 120, 160]),
      detail: aqi <= 50 ? 'Safe for normal activity'
        : aqi <= 80 ? 'Carry inhaler, limit exertion'
        : aqi <= 120 ? 'Avoid outdoor activity'
        : 'Stay indoors, use prescribed meds',
    },
    {
      label: 'Cardiac', icon: 'heart-outline',
      status: pick([50, 80, 130, 180]),
      detail: aqi <= 50 ? 'Safe for outdoor activity'
        : aqi <= 80 ? 'Limit strenuous outdoor exertion'
        : aqi <= 130 ? 'Avoid outdoor exercise'
        : 'Stay indoors, monitor symptoms',
    },
    {
      label: 'Pregnant', icon: 'body-outline',
      status: pick([60, 90, 120, 160]),
      detail: aqi <= 60 ? 'Safe for short walks'
        : aqi <= 90 ? 'Limit prolonged outdoor time'
        : aqi <= 120 ? 'Avoid outdoor exposure'
        : 'Stay indoors — fetal risk',
    },
    {
      label: 'General', icon: 'people-outline',
      status: pick([100, 150, 200, 300]),
      detail: aqi <= 100 ? 'Good air — enjoy outdoor activities'
        : aqi <= 150 ? 'Reduce prolonged outdoor exertion'
        : aqi <= 200 ? 'Limit outdoor time, wear mask'
        : aqi <= 300 ? 'Avoid outdoor activity'
        : 'Emergency — stay indoors',
    },
  ];
}

function getActivities(aqi: number): ActivityStatus[] {
  const s = (thrs: [number, number, number]): SafetyLevel =>
    aqi <= thrs[0] ? 'safe' : aqi <= thrs[1] ? 'caution' : aqi <= thrs[2] ? 'limit' : 'avoid';

  return [
    { label: 'Running / Jogging', icon: 'walk-outline', status: s([50, 100, 150]) },
    { label: 'Brisk Walking', icon: 'footsteps-outline', status: s([100, 150, 200]) },
    { label: 'Cycling', icon: 'bicycle-outline', status: s([50, 100, 150]) },
    { label: 'Children Playing', icon: 'balloon-outline', status: s([100, 130, 160]) },
    { label: 'Outdoor Sports', icon: 'basketball-outline', status: s([50, 100, 150]) },
    { label: 'Indoor Exercise', icon: 'barbell-outline', status: 'safe' },
  ];
}

const POLLUTANTS: PollutantInfo[] = [
  { key: 'pm25', label: 'PM2.5', unit: 'μg/m³', affects: 'Lungs, heart, blood vessels', thresholds: [12, 35, 55] },
  { key: 'pm10', label: 'PM10', unit: 'μg/m³', affects: 'Nose, throat, lungs', thresholds: [50, 100, 150] },
  { key: 'no2', label: 'NO₂', unit: 'ppb', affects: 'Airways, blood pressure, heart', thresholds: [40, 70, 100] },
  { key: 'so2', label: 'SO₂', unit: 'ppb', affects: 'Respiratory lining, COPD', thresholds: [20, 50, 75] },
  { key: 'o3', label: 'O₃ Ozone', unit: 'ppb', affects: 'Airways, asthma, lung tissue', thresholds: [60, 85, 105] },
  { key: 'co', label: 'CO', unit: 'ppm', affects: 'Blood oxygen, heart, brain', thresholds: [2, 5, 9] },
];

function pollutantLevel(val: number, thrs: [number, number, number]): SafetyLevel {
  if (val <= thrs[0]) return 'safe';
  if (val <= thrs[1]) return 'caution';
  if (val <= thrs[2]) return 'limit';
  return 'avoid';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SafeBadge({ status }: { status: SafetyLevel }) {
  return (
    <View style={[styles.badge, { backgroundColor: SAFETY_COLORS[status] + '22', borderColor: SAFETY_COLORS[status] + '55' }]}>
      <Text style={[styles.badgeText, { color: SAFETY_COLORS[status] }]}>{SAFETY_LABELS[status]}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CommunityScreen() {
  const [aqiData, setAqiData] = useState<AqiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(false);
      // Reuse saved city from settings; fall back to GPS city
      const settings = await api.get('/api/settings').catch(() => null);
      let city = settings?.default_city;

      if (!city) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          const [geo] = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude, longitude: loc.coords.longitude,
          });
          city = geo?.city || geo?.subregion || geo?.region || 'Delhi';
        } else {
          city = 'Delhi';
        }
      }

      const data = await api.get(`/api/aqi/${encodeURIComponent(city)}`);
      setAqiData(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  function onRefresh() {
    setRefreshing(true);
    fetchData();
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading community data…</Text>
      </View>
    );
  }

  if (error || !aqiData) {
    return (
      <View style={styles.centered}>
        <Ionicons name="cloud-offline-outline" size={48} color={COLORS.textMuted} />
        <Text style={styles.errorText}>Could not load air quality data</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={fetchData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const color = aqiColor(aqiData.aqi);
  const groups = getGroupStatuses(aqiData.aqi);
  const activities = getActivities(aqiData.aqi);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Community Air Watch</Text>
          <Text style={styles.headerSub}>{aqiData.city}</Text>
        </View>

        {/* AQI Hero */}
        <View style={[styles.aqiHero, { borderColor: color + '40' }]}>
          <View style={[styles.aqiOrb, { backgroundColor: color + '18', borderColor: color + '50' }]}>
            <Text style={[styles.aqiNumber, { color }]}>{aqiData.aqi}</Text>
            <Text style={styles.aqiUnit}>AQI</Text>
          </View>
          <View style={styles.aqiRight}>
            <Text style={[styles.aqiLevel, { color }]}>{aqiData.level}</Text>
            <Text style={styles.aqiCity}>{aqiData.city}</Text>
            <View style={styles.aqiMeta}>
              <Text style={styles.aqiMetaText}>{aqiData.weather?.temperature}°C</Text>
              <Text style={styles.aqiMetaDot}>·</Text>
              <Text style={styles.aqiMetaText}>{aqiData.weather?.humidity}% RH</Text>
              <Text style={styles.aqiMetaDot}>·</Text>
              <Text style={styles.aqiMetaText}>{aqiData.weather?.wind_speed} km/h</Text>
            </View>
          </View>
        </View>

        {/* Community notice */}
        <View style={styles.noticeBox}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.accent} />
          <Text style={styles.noticeText}>
            These advisories are based on current environmental data. No personal medical data is used.
            Add your health profile in the Profile tab for personalised alerts.
          </Text>
        </View>

        {/* Who should be cautious */}
        <SectionHeader title="Who Should Be Cautious Today" />
        <View style={styles.groupGrid}>
          {groups.map(g => (
            <View key={g.label} style={[styles.groupCard, { borderColor: SAFETY_COLORS[g.status] + '30' }]}>
              <View style={[styles.groupIconWrap, { backgroundColor: SAFETY_COLORS[g.status] + '18' }]}>
                <Ionicons name={g.icon as any} size={20} color={SAFETY_COLORS[g.status]} />
              </View>
              <Text style={styles.groupLabel}>{g.label}</Text>
              <SafeBadge status={g.status} />
              <Text style={styles.groupDetail}>{g.detail}</Text>
            </View>
          ))}
        </View>

        {/* Activity guide */}
        <SectionHeader title="Activities Today" />
        <View style={styles.card}>
          {activities.map((a, i) => (
            <View key={a.label} style={[styles.activityRow, i < activities.length - 1 && styles.activityDivider]}>
              <View style={styles.activityLeft}>
                <Ionicons name={a.icon as any} size={18} color={COLORS.textSecondary} />
                <Text style={styles.activityLabel}>{a.label}</Text>
              </View>
              <SafeBadge status={a.status} />
            </View>
          ))}
        </View>

        {/* Pollutant breakdown */}
        <SectionHeader title="Pollutant Breakdown" />
        <View style={styles.card}>
          {POLLUTANTS.map((p, i) => {
            const val = (aqiData.pollutants as any)[p.key] ?? 0;
            const lvl = pollutantLevel(val, p.thresholds);
            const pColor = SAFETY_COLORS[lvl];
            const pct = Math.min(100, (val / (p.thresholds[2] * 1.5)) * 100);
            return (
              <View key={p.key} style={[styles.pollRow, i < POLLUTANTS.length - 1 && styles.activityDivider]}>
                <View style={styles.pollTop}>
                  <Text style={styles.pollLabel}>{p.label}</Text>
                  <View style={styles.pollRight}>
                    <Text style={[styles.pollVal, { color: pColor }]}>{val} {p.unit}</Text>
                    <SafeBadge status={lvl} />
                  </View>
                </View>
                <View style={styles.pollBar}>
                  <View style={[styles.pollBarFill, { width: `${pct}%`, backgroundColor: pColor }]} />
                </View>
                <Text style={styles.pollAffects}>Affects: {p.affects}</Text>
              </View>
            );
          })}
        </View>

        {/* What to expect from community alerts */}
        <SectionHeader title="Community Alerts You'll Receive" />
        <View style={styles.card}>
          {[
            { icon: 'notifications-outline', color: '#FACC15', label: 'AQI > 100', desc: 'Sensitive groups advisory' },
            { icon: 'warning-outline', color: '#FB923C', label: 'AQI > 150', desc: 'General public advisory — reduce outdoor time' },
            { icon: 'alert-circle-outline', color: '#F87171', label: 'AQI > 200', desc: 'All residents — avoid outdoor activity' },
            { icon: 'nuclear-outline', color: '#C084FC', label: 'AQI > 300', desc: 'HAZARDOUS — stay indoors immediately' },
            { icon: 'cloud-outline', color: '#60A5FA', label: 'PM2.5 > 55 μg/m³', desc: 'Fine particle spike — wear N95 mask' },
            { icon: 'sunny-outline', color: '#34D399', label: 'Ozone > 100 ppb', desc: 'Ozone peak — avoid 12–6 PM outdoors' },
          ].map((item, i, arr) => (
            <View key={item.label} style={[styles.alertRow, i < arr.length - 1 && styles.activityDivider]}>
              <View style={[styles.alertIconWrap, { backgroundColor: item.color + '18' }]}>
                <Ionicons name={item.icon as any} size={16} color={item.color} />
              </View>
              <View style={styles.alertTextWrap}>
                <Text style={styles.alertCondition}>{item.label}</Text>
                <Text style={styles.alertDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: SPACING.xl, paddingBottom: 32 },
  centered: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: FONT_SIZE.md, fontFamily: FONTS.body, color: COLORS.textSecondary },
  errorText: { fontSize: FONT_SIZE.md, fontFamily: FONTS.body, color: COLORS.textSecondary },
  retryBtn: {
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.accent,
  },
  retryText: { fontSize: FONT_SIZE.md, fontFamily: FONTS.bodySemibold, color: COLORS.accent },

  header: { paddingTop: SPACING.xl, paddingBottom: SPACING.lg },
  headerTitle: { fontSize: FONT_SIZE.xxl, fontFamily: FONTS.heading, color: COLORS.textWhite },
  headerSub: { fontSize: FONT_SIZE.md, fontFamily: FONTS.body, color: COLORS.textSecondary, marginTop: 2 },

  aqiHero: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.xl,
    backgroundColor: COLORS.glass, borderRadius: RADIUS.xl,
    borderWidth: 1, padding: SPACING.xl, marginBottom: SPACING.lg,
  },
  aqiOrb: {
    width: 88, height: 88, borderRadius: 44, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  aqiNumber: { fontSize: 28, fontFamily: FONTS.heading, lineHeight: 32 },
  aqiUnit: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.body, color: COLORS.textMuted },
  aqiRight: { flex: 1 },
  aqiLevel: { fontSize: FONT_SIZE.lg, fontFamily: FONTS.bodySemibold },
  aqiCity: { fontSize: FONT_SIZE.sm, fontFamily: FONTS.body, color: COLORS.textSecondary, marginTop: 2 },
  aqiMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  aqiMetaText: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.body, color: COLORS.textMuted },
  aqiMetaDot: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },

  noticeBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.accent + '10', borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.accent + '25',
    padding: SPACING.md, marginBottom: SPACING.xl,
  },
  noticeText: { flex: 1, fontSize: FONT_SIZE.xs, fontFamily: FONTS.body, color: COLORS.textSecondary, lineHeight: 18 },

  sectionHeader: {
    fontSize: FONT_SIZE.xs, fontFamily: FONTS.bodySemibold,
    color: COLORS.textSecondary, letterSpacing: 1.2,
    marginBottom: SPACING.md, marginTop: SPACING.sm,
  },

  groupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  groupCard: {
    width: '47%', backgroundColor: COLORS.glass,
    borderRadius: RADIUS.lg, borderWidth: 1,
    padding: SPACING.md, gap: 6,
  },
  groupIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  groupLabel: { fontSize: FONT_SIZE.sm, fontFamily: FONTS.bodySemibold, color: COLORS.textWhite },
  groupDetail: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.body, color: COLORS.textMuted, lineHeight: 16 },

  card: {
    backgroundColor: COLORS.glass, borderRadius: RADIUS.xl,
    borderWidth: 1, borderColor: COLORS.glassBorder,
    marginBottom: SPACING.lg, overflow: 'hidden',
  },
  activityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.lg },
  activityDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.glassBorder },
  activityLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activityLabel: { fontSize: FONT_SIZE.sm, fontFamily: FONTS.body, color: COLORS.textWhite },

  pollRow: { padding: SPACING.lg, gap: 6 },
  pollTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pollLabel: { fontSize: FONT_SIZE.sm, fontFamily: FONTS.bodySemibold, color: COLORS.textWhite },
  pollRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pollVal: { fontSize: FONT_SIZE.sm, fontFamily: FONTS.body },
  pollBar: { height: 4, borderRadius: 2, backgroundColor: COLORS.glassBorder, overflow: 'hidden' },
  pollBarFill: { height: 4, borderRadius: 2 },
  pollAffects: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.body, color: COLORS.textMuted },

  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: SPACING.lg },
  alertIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  alertTextWrap: { flex: 1 },
  alertCondition: { fontSize: FONT_SIZE.sm, fontFamily: FONTS.bodySemibold, color: COLORS.textWhite },
  alertDesc: { fontSize: FONT_SIZE.xs, fontFamily: FONTS.body, color: COLORS.textSecondary, marginTop: 2 },

  badge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.pill, borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontFamily: FONTS.bodySemibold, letterSpacing: 0.5 },
});
