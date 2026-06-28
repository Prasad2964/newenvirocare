import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, FlatList, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import api from '../src/utils/api';
import { getAqiTheme } from '../src/utils/theme';
import GlassCard from '../src/components/GlassCard';

// ── Indian cities + monitored sub-areas ──────────────────────────────────────
const INDIAN_CITIES = [
  'Agra', 'Ahmedabad', 'Ajmer', 'Aligarh', 'Allahabad', 'Amravati', 'Amritsar',
  'Asansol', 'Aurangabad',
  // Bangalore + monitored stations
  'Bangalore', 'Bangalore - BTM Layout', 'Bangalore - Hebbal', 'Bangalore - Silk Board',
  'Bareilly', 'Belgaum', 'Bhavnagar', 'Bhilai', 'Bhiwandi', 'Bhopal', 'Bhubaneswar',
  'Bikaner', 'Chandigarh', 'Chennai', 'Coimbatore', 'Cuttack', 'Davanagere', 'Dehradun',
  // Delhi + monitored stations
  'Delhi', 'Delhi - Anand Vihar', 'Delhi - Dwarka', 'Delhi - Okhla',
  'Delhi - Punjabi Bagh', 'Delhi - RK Puram', 'Delhi - Rohini',
  'Dhanbad', 'Durgapur', 'Erode', 'Faridabad', 'Gaya', 'Ghaziabad', 'Gorakhpur',
  'Gulbarga', 'Guntur', 'Gurgaon', 'Guwahati', 'Gwalior', 'Hubballi-Dharwad',
  'Hyderabad', 'Indore', 'Jabalpur', 'Jaipur', 'Jalandhar', 'Jalgaon',
  'Jamnagar', 'Jammu', 'Jamshedpur', 'Jhansi', 'Jodhpur', 'Kanpur', 'Kochi',
  'Kolhapur', 'Kolkata', 'Kota', 'Kozhikode', 'Lucknow', 'Ludhiana', 'Madurai',
  'Maheshtala', 'Malegaon', 'Mangalore', 'Meerut', 'Moradabad',
  // Mumbai + all 16 CPCB monitoring stations
  'Mumbai',
  'Mumbai - Airport', 'Mumbai - Andheri', 'Mumbai - Bandra Kurla Complex',
  'Mumbai - Bhandup', 'Mumbai - Borivali', 'Mumbai - Colaba', 'Mumbai - Deonar',
  'Mumbai - Kurla', 'Mumbai - Malad', 'Mumbai - Mazgaon', 'Mumbai - Mulund',
  'Mumbai - Navy Nagar Colaba', 'Mumbai - Powai', 'Mumbai - Siddharth Nagar Worli',
  'Mumbai - Sion', 'Mumbai - Worli',
  'Mysore', 'Nagpur', 'Nanded', 'Nashik', 'Nellore', 'Noida',
  'Patna', 'Pimpri-Chinchwad', 'Pune', 'Raipur', 'Rajkot', 'Ranchi',
  'Saharanpur', 'Salem', 'Sangli', 'Siliguri', 'Solapur', 'Srinagar',
  'Surat', 'Thane', 'Thiruvananthapuram', 'Tiruchirappalli', 'Tirunelveli',
  'Udaipur', 'Ujjain', 'Ulhasnagar', 'Vadodara', 'Varanasi', 'Vijayawada',
  'Visakhapatnam', 'Warangal',
];

// ── Inline searchable city dropdown ──────────────────────────────────────────
function CityDropdown({
  value,
  onChange,
  placeholder,
  accentColor,
}: {
  value: string;
  onChange: (c: string) => void;
  placeholder: string;
  accentColor: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () =>
      query.trim()
        ? INDIAN_CITIES.filter(c => c.toLowerCase().includes(query.toLowerCase()))
        : INDIAN_CITIES,
    [query],
  );

  function select(city: string) {
    onChange(city);
    setOpen(false);
    setQuery('');
  }

  return (
    <View>
      {/* Trigger row */}
      <TouchableOpacity
        style={styles.dropdownBtn}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.7}
      >
        <View style={[styles.dropdownDot, { backgroundColor: accentColor }]} />
        <Text style={[styles.dropdownValue, !value && styles.dropdownPlaceholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={open ? accentColor : 'rgba(255,255,255,0.35)'}
        />
      </TouchableOpacity>

      {/* Inline list — expands below the trigger */}
      {open && (
        <View style={[styles.dropdownList, { borderColor: accentColor + '40' }]}>
          {/* Search bar */}
          <View style={styles.dropdownSearch}>
            <Ionicons name="search" size={14} color="rgba(255,255,255,0.35)" />
            <TextInput
              style={styles.dropdownSearchInput}
              placeholder="Search city..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="words"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Ionicons name="close-circle" size={14} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.dropdownFlatList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.dropdownItem,
                  item === value && { backgroundColor: accentColor + '20' },
                ]}
                onPress={() => select(item)}
                activeOpacity={0.6}
              >
                <Ionicons
                  name={item === value ? 'location' : 'location-outline'}
                  size={14}
                  color={item === value ? accentColor : 'rgba(255,255,255,0.3)'}
                />
                <Text style={[styles.dropdownItemText, item === value && { color: accentColor, fontWeight: '700' }]}>
                  {item}
                </Text>
                {item === value && (
                  <Ionicons name="checkmark" size={14} color={accentColor} style={{ marginLeft: 'auto' }} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.dropdownEmpty}>No cities match "{query}"</Text>
            }
          />
        </View>
      )}
    </View>
  );
}

// ── Risk engine (mirrors backend calculate_risk_score) ────────────────────────
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

// ── Main screen ───────────────────────────────────────────────────────────────
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
    if (!city1 || !city2) return;
    setLoading(true);
    try {
      const data = await api.post('/api/aqi/compare', { city1, city2 });
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
      ? risk1.score <= risk2.score ? result.city1.city : result.city2.city
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
            <Text style={styles.subtitle}>Compare air quality between two Indian cities</Text>

            {/* City selectors */}
            <GlassCard style={styles.inputCard}>
              <CityDropdown
                value={city1}
                onChange={v => { setCity1(v); setResult(null); }}
                placeholder="Select first city"
                accentColor="#4ADE80"
              />
              <View style={styles.divider} />
              <CityDropdown
                value={city2}
                onChange={v => { setCity2(v); setResult(null); }}
                placeholder="Select second city"
                accentColor="#06B6D4"
              />
            </GlassCard>

            <TouchableOpacity
              testID="compare-btn"
              style={[styles.compareBtn, (!city1 || !city2 || loading) && { opacity: 0.5 }]}
              onPress={compare}
              disabled={!city1 || !city2 || loading}
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

                {/* Winner (raw AQI) */}
                <GlassCard testID="winner-card" style={styles.winnerCard}>
                  <Ionicons name="trophy" size={28} color="#FACC15" />
                  <Text style={styles.winnerText}>
                    {result.city1.aqi <= result.city2.aqi ? result.city1.city : result.city2.city} has better air quality
                  </Text>
                  <Text style={styles.winnerDiff}>
                    {Math.abs(result.city1.aqi - result.city2.aqi)} AQI difference
                  </Text>
                </GlassCard>

                {/* ── Personalised risk ─────────────────────────────────── */}
                {risk1 && risk2 ? (
                  <GlassCard style={styles.riskCard}>
                    <View style={styles.riskHeader}>
                      <Ionicons name="fitness" size={20} color="#A78BFA" />
                      <Text style={styles.riskTitle}>Your Personal Risk</Text>
                    </View>
                    <Text style={styles.riskConditions} numberOfLines={2}>
                      Based on: {conditions.join(', ')}
                    </Text>

                    <View style={styles.riskCols}>
                      {([
                        { city: result.city1.city, risk: risk1 },
                        { city: result.city2.city, risk: risk2 },
                      ] as const).map(({ city, risk }, i) => (
                        <View key={i} style={styles.riskCol}>
                          <Text style={styles.riskCityName} numberOfLines={1}>{city}</Text>
                          <Text style={[styles.riskScore, { color: risk.color }]}>
                            {risk.score}<Text style={styles.riskPct}>%</Text>
                          </Text>
                          <Text style={[styles.riskLevel, { color: risk.color }]}>{risk.level}</Text>
                          <View style={styles.barBg}>
                            <View style={[styles.barFill, { width: `${risk.score}%` as any, backgroundColor: risk.color }]} />
                          </View>
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

                    <View style={styles.riskRec}>
                      <Ionicons name="shield-checkmark" size={15} color="#A78BFA" />
                      <Text style={styles.riskRecText}>
                        {risk1.score === risk2.score
                          ? 'Both cities carry equal personal risk for your conditions.'
                          : `${betterForHealth} is safer for your health — ${Math.abs(risk1.score - risk2.score)}% less personal risk.`}
                      </Text>
                    </View>

                    {conditions.length > 0 && (
                      <View style={styles.tipsBox}>
                        {conditions.map((c, i) => {
                          const cl = c.toLowerCase();
                          let tip = '';
                          if (cl.includes('asthma') || cl.includes('copd') || cl.includes('lung'))
                            tip = 'Keep your rescue inhaler handy and avoid peak-traffic hours outdoors.';
                          else if (cl.includes('heart') || cl.includes('hypertension'))
                            tip = 'Limit strenuous outdoor exercise; monitor blood pressure closely.';
                          else if (cl.includes('allerg'))
                            tip = 'Wear an N95 mask outside and keep windows closed on high-AQI days.';
                          else if (cl.includes('pregnan'))
                            tip = 'Minimise outdoor exposure — PM2.5 can cross the placental barrier.';
                          else if (cl.includes('diabet'))
                            tip = 'High AQI raises inflammation markers; stay hydrated indoors.';
                          if (!tip) return null;
                          return (
                            <View key={i} style={styles.tipRow}>
                              <Ionicons name="alert-circle-outline" size={13} color="rgba(167,139,250,0.6)" />
                              <Text style={styles.tipText}>
                                <Text style={styles.tipCond}>{c}: </Text>{tip}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </GlassCard>
                ) : (
                  <TouchableOpacity
                    style={styles.nudgeRow}
                    onPress={() => router.push('/settings')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="person-circle-outline" size={18} color="#A78BFA" />
                    <Text style={styles.nudgeText}>Add your health profile for personalised risk analysis</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(167,139,250,0.5)" />
                  </TouchableOpacity>
                )}
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

  // ── Inline dropdown ───────────────────────────────────────────────────────
  inputCard: { marginBottom: 16 },
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  dropdownDot: { width: 11, height: 11, borderRadius: 6 },
  dropdownValue: { flex: 1, color: '#FFF', fontSize: 15, fontWeight: '500' },
  dropdownPlaceholder: { color: 'rgba(255,255,255,0.3)', fontWeight: '400' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 2, marginLeft: 24 },

  dropdownList: {
    borderWidth: 1, borderRadius: 12,
    backgroundColor: 'rgba(8,18,28,0.98)',
    marginBottom: 4, overflow: 'hidden',
  },
  dropdownSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  dropdownSearchInput: { flex: 1, color: '#FFF', fontSize: 13, paddingVertical: 0 },
  dropdownFlatList: { maxHeight: 210 },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  dropdownItemText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  dropdownEmpty: {
    textAlign: 'center', color: 'rgba(255,255,255,0.3)',
    fontSize: 13, paddingVertical: 20,
  },

  // ── Compare button ────────────────────────────────────────────────────────
  compareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 28, backgroundColor: '#06B6D4', gap: 8, marginBottom: 24,
  },
  compareBtnText: { fontSize: 16, fontWeight: '700', color: '#000', letterSpacing: 0.5 },

  // ── Results ───────────────────────────────────────────────────────────────
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
  nudgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 16, padding: 14,
    backgroundColor: 'rgba(167,139,250,0.06)',
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(167,139,250,0.15)',
  },
  nudgeText: { flex: 1, fontSize: 13, color: 'rgba(167,139,250,0.75)' },
});
