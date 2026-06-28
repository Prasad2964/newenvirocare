import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import api from '../src/utils/api';
import { getAqiTheme } from '../src/utils/theme';
import GlassCard from '../src/components/GlassCard';

// ── Risk engine (mirrors backend calculate_risk_score) ──────────────────────
const CONDITION_MULTIPLIERS: Record<string, number> = {
  asthma: 2.0, copd: 2.5, 'heart disease': 1.8,
  diabetes: 1.3, hypertension: 1.4, 'lung disease': 2.2,
  bronchitis: 1.9, allergies: 1.5, pregnancy: 1.6,
  elderly: 1.5, child: 1.4,
};

function calcRisk(aqi: number, conditions: string[]) {
  const base = Math.min(100, (aqi / 500) * 100);
  let mult = 1.0;
  const triggered: string[] = [];
  for (const c of conditions) {
    const cl = c.toLowerCase().trim();
    for (const [key, m] of Object.entries(CONDITION_MULTIPLIERS)) {
      if (cl.includes(key)) {
        if (m > mult) mult = m;
        if (!triggered.includes(c)) triggered.push(c);
      }
    }
  }
  const score = Math.min(100, Math.round(base * mult));
  let level: string, color: string;
  if (score <= 25)      { level = 'Low Risk';     color = '#00E400'; }
  else if (score <= 50) { level = 'Moderate Risk'; color = '#FFFF00'; }
  else if (score <= 75) { level = 'High Risk';     color = '#FF7E00'; }
  else                  { level = 'Dangerous';     color = '#FF0000'; }
  return { score, level, color, triggered };
}
// ────────────────────────────────────────────────────────────────────────────

export default function CityCompareScreen() {
  const router = useRouter();
  const [city1, setCity1] = useState('');
  const [city2, setCity2] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [conditions, setConditions] = useState<string[]>([]);

  useEffect(() => {
    api.get('/api/health-profile')
      .then((data: any) => {
        if (Array.isArray(data?.conditions)) setConditions(data.conditions);
      })
      .catch(() => {});
  }, []);

  async function compare() {
    if (!city1.trim() || !city2.trim()) return;
    setLoading(true);
    try {
      const data = await api.post('/api/aqi/compare', { city1: city1.trim(), city2: city2.trim() });
      setResult(data);
    } catch {
      // handled silently
    } finally {
      setLoading(false);
    }
  }

  const theme1 = result ? getAqiTheme(result.city1.aqi) : null;
  const theme2 = result ? getAqiTheme(result.city2.aqi) : null;
  const risk1 = result && conditions.length > 0 ? calcRisk(result.city1.aqi, conditions) : null;
  const risk2 = result && conditions.length > 0 ? calcRisk(result.city2.aqi, conditions) : null;

  const betterForHealth =
    risk1 && risk2
      ? risk1.score <= risk2.score
        ? result.city1.city
        : result.city2.city
      : null;

  return (
    <View testID="city-compare-screen" style={styles.container}>
      <LinearGradient colors={['#0B1D2B', '#000']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back */}
            <TouchableOpacity
              testID="back-btn"
              style={styles.backBtn}
              onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/home')}
            >
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>

            <Text style={styles.title}>City Comparison</Text>
            <Text style={styles.subtitle}>Compare air quality between two cities</Text>

            {/* City inputs */}
            <GlassCard style={styles.inputCard}>
              <View style={styles.inputRow}>
                <View style={[styles.dot, { backgroundColor: '#4ADE80' }]} />
                <TextInput
                  testID="compare-city1-input"
                  style={styles.input}
                  placeholder="First City (e.g. Delhi)"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={city1}
                  onChangeText={setCity1}
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.inputRow}>
                <View style={[styles.dot, { backgroundColor: '#06B6D4' }]} />
                <TextInput
                  testID="compare-city2-input"
                  style={styles.input}
                  placeholder="Second City (e.g. Bangalore)"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={city2}
                  onChangeText={setCity2}
                />
              </View>
            </GlassCard>

            <TouchableOpacity
              testID="compare-btn"
              style={[styles.compareBtn, loading && { opacity: 0.6 }]}
              onPress={compare}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#000" /> : (
                <>
                  <Ionicons name="git-compare" size={20} color="#000" />
                  <Text style={styles.compareBtnText}>Compare</Text>
                </>
              )}
            </TouchableOpacity>

            {result && (
              <>
                {/* AQI side by side */}
                <View style={styles.compareRow}>
                  <GlassCard style={styles.compareCard}>
                    <Text style={styles.compareCity}>{result.city1.city}</Text>
                    <Text style={[styles.compareAqi, { color: theme1?.primary }]}>{result.city1.aqi}</Text>
                    <Text style={[styles.compareLevel, { color: theme1?.primary }]}>{result.city1.level}</Text>
                  </GlassCard>
                  <View style={styles.vsContainer}>
                    <Text style={styles.vsText}>VS</Text>
                  </View>
                  <GlassCard style={styles.compareCard}>
                    <Text style={styles.compareCity}>{result.city2.city}</Text>
                    <Text style={[styles.compareAqi, { color: theme2?.primary }]}>{result.city2.aqi}</Text>
                    <Text style={[styles.compareLevel, { color: theme2?.primary }]}>{result.city2.level}</Text>
                  </GlassCard>
                </View>

                {/* Detailed metrics */}
                <GlassCard testID="detailed-comparison">
                  <Text style={styles.cardTitle}>Detailed Comparison</Text>
                  {[
                    { label: 'Temperature', v1: `${result.city1.weather.temperature}°C`, v2: `${result.city2.weather.temperature}°C`, icon: 'thermometer' },
                    { label: 'Humidity',    v1: `${result.city1.weather.humidity}%`,     v2: `${result.city2.weather.humidity}%`,     icon: 'water' },
                    { label: 'Wind',        v1: `${result.city1.weather.wind_speed} km/h`, v2: `${result.city2.weather.wind_speed} km/h`, icon: 'speedometer' },
                    { label: 'PM2.5',       v1: String(result.city1.pollutants.pm25),   v2: String(result.city2.pollutants.pm25),   icon: 'cloudy' },
                    { label: 'PM10',        v1: String(result.city1.pollutants.pm10),   v2: String(result.city2.pollutants.pm10),   icon: 'cloud' },
                    { label: 'Primary',     v1: result.city1.primary_pollutant,         v2: result.city2.primary_pollutant,         icon: 'warning' },
                  ].map((item, i) => (
                    <View key={i} style={styles.detailRow}>
                      <Text style={styles.detailValue}>{item.v1}</Text>
                      <View style={styles.detailCenter}>
                        <Ionicons name={item.icon as any} size={16} color="rgba(255,255,255,0.4)" />
                        <Text style={styles.detailLabel}>{item.label}</Text>
                      </View>
                      <Text style={styles.detailValue}>{item.v2}</Text>
                    </View>
                  ))}
                </GlassCard>

                {/* Mask recommendation */}
                <View style={styles.maskCompare}>
                  <GlassCard style={styles.maskCard}>
                    <Ionicons name={result.city1.mask.icon} size={24} color={theme1?.primary} />
                    <Text style={styles.maskType}>{result.city1.mask.type}</Text>
                  </GlassCard>
                  <GlassCard style={styles.maskCard}>
                    <Ionicons name={result.city2.mask.icon} size={24} color={theme2?.primary} />
                    <Text style={styles.maskType}>{result.city2.mask.type}</Text>
                  </GlassCard>
                </View>

                {/* Winner (AQI only) */}
                <GlassCard testID="winner-card" style={styles.winnerCard}>
                  <Ionicons name="trophy" size={28} color="#FACC15" />
                  <Text style={styles.winnerText}>
                    {result.city1.aqi <= result.city2.aqi ? result.city1.city : result.city2.city} has better air quality
                  </Text>
                  <Text style={styles.winnerDiff}>
                    {Math.abs(result.city1.aqi - result.city2.aqi)} AQI difference
                  </Text>
                </GlassCard>

                {/* ── Personalised risk section ─────────────────────────── */}
                {risk1 && risk2 ? (
                  <GlassCard style={styles.riskCard}>
                    {/* Header */}
                    <View style={styles.riskHeader}>
                      <Ionicons name="fitness" size={20} color="#A78BFA" />
                      <Text style={styles.riskTitle}>Your Personal Risk</Text>
                    </View>
                    <Text style={styles.riskConditions} numberOfLines={2}>
                      Based on: {conditions.join(', ')}
                    </Text>

                    {/* Two-column risk scores */}
                    <View style={styles.riskCols}>
                      {[
                        { city: result.city1.city, risk: risk1 },
                        { city: result.city2.city, risk: risk2 },
                      ].map(({ city, risk }, i) => (
                        <View key={i} style={styles.riskCol}>
                          <Text style={styles.riskCityName} numberOfLines={1}>{city}</Text>
                          <Text style={[styles.riskScore, { color: risk.color }]}>
                            {risk.score}<Text style={styles.riskPct}>%</Text>
                          </Text>
                          <Text style={[styles.riskLevel, { color: risk.color }]}>{risk.level}</Text>
                          {/* Progress bar */}
                          <View style={styles.barBg}>
                            <View
                              style={[
                                styles.barFill,
                                { width: `${risk.score}%` as any, backgroundColor: risk.color },
                              ]}
                            />
                          </View>
                          {/* Which conditions are triggered */}
                          {risk.triggered.length > 0 && (
                            <View style={styles.triggeredList}>
                              {risk.triggered.map((c, j) => (
                                <View key={j} style={[styles.chip, { borderColor: risk.color + '60' }]}>
                                  <Text style={[styles.chipText, { color: risk.color }]}>{c}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      ))}
                    </View>

                    {/* Personalised recommendation */}
                    <View style={styles.riskRec}>
                      <Ionicons name="shield-checkmark" size={15} color="#A78BFA" />
                      <Text style={styles.riskRecText}>
                        {risk1.score === risk2.score
                          ? `Both cities carry equal risk for your conditions.`
                          : `${betterForHealth} is safer for your health — ${Math.abs(risk1.score - risk2.score)}% less personal risk.`}
                      </Text>
                    </View>

                    {/* Condition-specific tips */}
                    {(risk1.triggered.length > 0 || risk2.triggered.length > 0) && (
                      <View style={styles.tipsBox}>
                        {conditions.map((c, i) => {
                          const cl = c.toLowerCase();
                          let tip = '';
                          if (cl.includes('asthma') || cl.includes('copd') || cl.includes('lung'))
                            tip = 'Keep rescue inhaler handy and avoid peak-traffic hours outdoors.';
                          else if (cl.includes('heart') || cl.includes('hypertension'))
                            tip = 'Limit strenuous outdoor exercise; monitor blood pressure closely.';
                          else if (cl.includes('allerg'))
                            tip = 'Wear an N95 mask outside and keep windows closed on high-AQI days.';
                          else if (cl.includes('pregnan'))
                            tip = 'Minimise outdoor exposure — PM2.5 can cross the placental barrier.';
                          else if (cl.includes('diabet'))
                            tip = 'High AQI can raise inflammation markers; stay hydrated indoors.';
                          if (!tip) return null;
                          return (
                            <View key={i} style={styles.tipRow}>
                              <Ionicons name="alert-circle-outline" size={13} color="rgba(167,139,250,0.6)" />
                              <Text style={styles.tipText}><Text style={styles.tipCond}>{c}: </Text>{tip}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </GlassCard>
                ) : (
                  // Nudge when no health profile
                  <TouchableOpacity
                    style={styles.nudgeRow}
                    onPress={() => router.push('/settings')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="person-circle-outline" size={18} color="#A78BFA" />
                    <Text style={styles.nudgeText}>
                      Add your health profile for personalised risk analysis
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(167,139,250,0.5)" />
                  </TouchableOpacity>
                )}
                {/* ── end personalised section ─────────────────────────── */}
              </>
            )}

            <View style={{ height: 32 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 32, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginBottom: 24 },
  inputCard: { marginBottom: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  input: { flex: 1, color: '#FFF', fontSize: 16, height: 44 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8, marginLeft: 24 },
  compareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 28, backgroundColor: '#06B6D4', gap: 8, marginBottom: 24,
  },
  compareBtnText: { fontSize: 16, fontWeight: '700', color: '#000', letterSpacing: 0.5 },
  compareRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 4 },
  compareCard: { flex: 1, alignItems: 'center', padding: 20 },
  compareCity: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  compareAqi: { fontSize: 44, fontWeight: '800', marginVertical: 4 },
  compareLevel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  vsContainer: { paddingHorizontal: 8 },
  vsText: { fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.3)', letterSpacing: 2 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 16 },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  detailValue: { fontSize: 15, fontWeight: '600', color: '#FFF', width: 80, textAlign: 'center' },
  detailCenter: { alignItems: 'center', gap: 4 },
  detailLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 },
  maskCompare: { flexDirection: 'row', gap: 12, marginTop: 16 },
  maskCard: { flex: 1, alignItems: 'center', padding: 16, gap: 8 },
  maskType: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' },
  winnerCard: { alignItems: 'center', gap: 8, marginTop: 16, borderColor: 'rgba(250,204,21,0.3)' },
  winnerText: { fontSize: 16, fontWeight: '700', color: '#FACC15', textAlign: 'center' },
  winnerDiff: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },

  // ── Personalised risk ─────────────────────────────────────────────────────
  riskCard: { marginTop: 16, borderColor: 'rgba(167,139,250,0.2)' },
  riskHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  riskTitle: { fontSize: 16, fontWeight: '700', color: '#A78BFA' },
  riskConditions: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 },
  riskCols: { flexDirection: 'row', gap: 12 },
  riskCol: { flex: 1 },
  riskCityName: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: 6 },
  riskScore: { fontSize: 36, fontWeight: '800', lineHeight: 40 },
  riskPct: { fontSize: 18, fontWeight: '600' },
  riskLevel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2, marginBottom: 8 },
  barBg: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  triggeredList: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  chip: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipText: { fontSize: 10, fontWeight: '600' },
  riskRec: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 16, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: 'rgba(167,139,250,0.15)',
  },
  riskRecText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 18 },
  tipsBox: { marginTop: 12, gap: 8 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  tipText: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 17 },
  tipCond: { color: 'rgba(167,139,250,0.7)', fontWeight: '600' },

  // No-profile nudge
  nudgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 16, padding: 14,
    backgroundColor: 'rgba(167,139,250,0.06)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.15)',
  },
  nudgeText: { flex: 1, fontSize: 13, color: 'rgba(167,139,250,0.75)' },
});
