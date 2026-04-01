import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../src/utils/api';
import { getAqiTheme, getRiskColor } from '../../src/utils/theme';
import GlassCard from '../../src/components/GlassCard';

const TRAVEL_MODES = [
  { key: 'car', icon: 'car', label: 'Car' },
  { key: 'bus', icon: 'bus', label: 'Bus' },
  { key: 'train', icon: 'train', label: 'Train' },
  { key: 'walk', icon: 'walk', label: 'Walk' },
];

export default function TravelScreen() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState('car');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [hotspots, setHotspots] = useState<any>(null);

  async function planTravel() {
    if (!origin.trim() || !destination.trim()) return;
    setLoading(true);
    try {
      const [data, spots] = await Promise.all([
        api.post('/api/travel/plan', { origin: origin.trim(), destination: destination.trim(), mode }),
        api.post('/api/travel/hotspots', { origin: origin.trim(), destination: destination.trim() }).catch(() => null),
      ]);
      setResult(data);
      setHotspots(spots);
    } catch (e) {
      console.log('Travel error:', e);
    } finally {
      setLoading(false);
    }
  }

  const destTheme = result ? getAqiTheme(result.destination.aqi) : null;

  return (
    <View testID="travel-screen" style={styles.container}>
      <LinearGradient colors={['#0B1D2B', '#000']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Smart Travel</Text>
            <Text style={styles.subtitle}>Check air quality along your route</Text>

            <GlassCard style={styles.formCard}>
              <View style={styles.inputRow}>
                <View style={styles.dotGreen} />
                <TextInput
                  testID="travel-origin-input"
                  style={styles.input}
                  placeholder="From (e.g. Pune)"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={origin}
                  onChangeText={setOrigin}
                />
              </View>
              <View style={styles.divider} />
              <View style={styles.inputRow}>
                <View style={styles.dotRed} />
                <TextInput
                  testID="travel-dest-input"
                  style={styles.input}
                  placeholder="To (e.g. Gujarat)"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={destination}
                  onChangeText={setDestination}
                />
              </View>
            </GlassCard>

            <View style={styles.modeRow}>
              {TRAVEL_MODES.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  testID={`travel-mode-${m.key}`}
                  style={[styles.modeBtn, mode === m.key && styles.modeBtnActive]}
                  onPress={() => setMode(m.key)}
                >
                  <Ionicons name={m.icon as any} size={22} color={mode === m.key ? '#4ADE80' : 'rgba(255,255,255,0.4)'} />
                  <Text style={[styles.modeLabel, mode === m.key && styles.modeLabelActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              testID="travel-plan-btn"
              style={[styles.planBtn, loading && { opacity: 0.6 }]}
              onPress={planTravel}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#000" /> : (
                <>
                  <Ionicons name="navigate" size={20} color="#000" />
                  <Text style={styles.planBtnText}>Analyze Route</Text>
                </>
              )}
            </TouchableOpacity>

            {result && (
              <>
                {/* Route AQI Comparison */}
                <View style={styles.routeCompare}>
                  <GlassCard style={styles.routeCard}>
                    <Text style={styles.routeCity}>{result.origin.city}</Text>
                    <Text style={[styles.routeAqi, { color: getAqiTheme(result.origin.aqi).primary }]}>
                      {result.origin.aqi}
                    </Text>
                    <Text style={styles.routeLevel}>{result.origin.level}</Text>
                    <Text style={styles.routeTemp}>{result.origin.weather.temperature}°C</Text>
                  </GlassCard>
                  <View style={styles.routeArrow}>
                    <Ionicons name="arrow-forward" size={24} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.routeMode}>{mode}</Text>
                  </View>
                  <GlassCard style={styles.routeCard}>
                    <Text style={styles.routeCity}>{result.destination.city}</Text>
                    <Text style={[styles.routeAqi, { color: destTheme?.primary }]}>
                      {result.destination.aqi}
                    </Text>
                    <Text style={styles.routeLevel}>{result.destination.level}</Text>
                    <Text style={styles.routeTemp}>{result.destination.weather.temperature}°C</Text>
                  </GlassCard>
                </View>

                {/* Risk Comparison */}
                <GlassCard testID="travel-risk-card">
                  <Text style={styles.cardTitle}>Risk Analysis</Text>
                  <View style={styles.riskCompareRow}>
                    <View style={styles.riskItem}>
                      <Text style={styles.riskCity}>Origin</Text>
                      <Text style={[styles.riskScore, { color: getRiskColor(result.origin_risk.level) }]}>
                        {Math.round(result.origin_risk.score)}
                      </Text>
                      <Text style={[styles.riskLevel, { color: getRiskColor(result.origin_risk.level) }]}>
                        {result.origin_risk.level}
                      </Text>
                    </View>
                    <View style={styles.riskDivider} />
                    <View style={styles.riskItem}>
                      <Text style={styles.riskCity}>Destination</Text>
                      <Text style={[styles.riskScore, { color: getRiskColor(result.destination_risk.level) }]}>
                        {Math.round(result.destination_risk.score)}
                      </Text>
                      <Text style={[styles.riskLevel, { color: getRiskColor(result.destination_risk.level) }]}>
                        {result.destination_risk.level}
                      </Text>
                    </View>
                  </View>
                </GlassCard>

                {/* Precautions */}
                <GlassCard testID="travel-precautions-card">
                  <View style={styles.precautionHeader}>
                    <Ionicons name="shield-checkmark" size={20} color="#4ADE80" />
                    <Text style={styles.cardTitle}>Precautions</Text>
                  </View>
                  {result.precautions.map((p: string, i: number) => (
                    <View key={i} style={styles.precautionRow}>
                      <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                      <Text style={styles.precautionText}>{p}</Text>
                    </View>
                  ))}
                </GlassCard>

                {/* AI Advice */}
                {result.travel_advice && (
                  <GlassCard testID="travel-ai-advice" style={{ borderColor: 'rgba(250,204,21,0.3)' }}>
                    <View style={styles.adviceHeader}>
                      <Ionicons name="sparkles" size={18} color="#FACC15" />
                      <Text style={styles.adviceLabel}>AI Travel Advice</Text>
                    </View>
                    <Text style={styles.adviceText}>{result.travel_advice}</Text>
                  </GlassCard>
                )}

                {/* Hotspots */}
                {hotspots?.hotspots && hotspots.hotspots.length > 0 && (
                  <GlassCard testID="travel-hotspots-card">
                    <View style={styles.precautionHeader}>
                      <Ionicons name="flame" size={20} color="#F87171" />
                      <Text style={styles.cardTitle}>Route Hotspots</Text>
                    </View>
                    <Text style={styles.hotspotSummary}>
                      {hotspots.high_risk_count} pollution hotspot{hotspots.high_risk_count !== 1 ? 's' : ''} detected
                    </Text>
                    {hotspots.hotspots.map((h: any, i: number) => {
                      const spotTheme = getAqiTheme(h.aqi);
                      return (
                        <View key={i} style={styles.hotspotItem}>
                          <View style={[styles.hotspotDot, { backgroundColor: h.is_hotspot ? '#F87171' : '#4ADE80' }]} />
                          <View style={styles.hotspotInfo}>
                            <Text style={styles.hotspotName}>{h.name}</Text>
                            <Text style={styles.hotspotDesc}>{h.precaution}</Text>
                          </View>
                          <View style={[styles.hotspotAqi, { backgroundColor: spotTheme.primary + '20' }]}>
                            <Text style={[styles.hotspotAqiText, { color: spotTheme.primary }]}>{h.aqi}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </GlassCard>
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
  title: { fontSize: 32, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginBottom: 24 },
  formCard: { marginBottom: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#4ADE80' },
  dotRed: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F87171' },
  input: { flex: 1, color: '#FFF', fontSize: 16, height: 44 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8, marginLeft: 24 },
  modeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 8 },
  modeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modeBtnActive: { backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.3)' },
  modeLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: '600' },
  modeLabelActive: { color: '#4ADE80' },
  planBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 28, backgroundColor: '#4ADE80', gap: 8, marginBottom: 24,
  },
  planBtnText: { fontSize: 16, fontWeight: '700', color: '#000', letterSpacing: 0.5 },
  routeCompare: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  routeCard: { flex: 1, alignItems: 'center', padding: 16 },
  routeCity: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  routeAqi: { fontSize: 36, fontWeight: '800' },
  routeLevel: { fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 },
  routeTemp: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  routeArrow: { alignItems: 'center', gap: 4 },
  routeMode: { fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 12 },
  riskCompareRow: { flexDirection: 'row', alignItems: 'center' },
  riskItem: { flex: 1, alignItems: 'center' },
  riskCity: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  riskScore: { fontSize: 32, fontWeight: '800' },
  riskLevel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  riskDivider: { width: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.1)' },
  precautionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  precautionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  precautionText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  adviceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  adviceLabel: { fontSize: 14, fontWeight: '700', color: '#FACC15' },
  adviceText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 22 },
  hotspotSummary: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12 },
  hotspotItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  hotspotDot: { width: 10, height: 10, borderRadius: 5 },
  hotspotInfo: { flex: 1 },
  hotspotName: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  hotspotDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  hotspotAqi: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  hotspotAqiText: { fontSize: 14, fontWeight: '700' },
});
