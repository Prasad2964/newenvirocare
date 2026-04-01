import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import api from '../src/utils/api';
import { getAqiTheme, getRiskColor } from '../src/utils/theme';
import GlassCard from '../src/components/GlassCard';

export default function CityCompareScreen() {
  const router = useRouter();
  const [city1, setCity1] = useState('');
  const [city2, setCity2] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function compare() {
    if (!city1.trim() || !city2.trim()) return;
    setLoading(true);
    try {
      const data = await api.post('/api/aqi/compare', { city1: city1.trim(), city2: city2.trim() });
      setResult(data);
    } catch (e) {
      console.log('Compare error:', e);
    } finally {
      setLoading(false);
    }
  }

  const theme1 = result ? getAqiTheme(result.city1.aqi) : null;
  const theme2 = result ? getAqiTheme(result.city2.aqi) : null;

  return (
    <View testID="city-compare-screen" style={styles.container}>
      <LinearGradient colors={['#0B1D2B', '#000']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Back Button */}
            <TouchableOpacity testID="back-btn" style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>

            <Text style={styles.title}>City Comparison</Text>
            <Text style={styles.subtitle}>Compare air quality between two cities</Text>

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
                {/* AQI Side by Side */}
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

                {/* Detailed Comparison */}
                <GlassCard testID="detailed-comparison">
                  <Text style={styles.cardTitle}>Detailed Comparison</Text>
                  {[
                    { label: 'Temperature', v1: `${result.city1.weather.temperature}°C`, v2: `${result.city2.weather.temperature}°C`, icon: 'thermometer' },
                    { label: 'Humidity', v1: `${result.city1.weather.humidity}%`, v2: `${result.city2.weather.humidity}%`, icon: 'water' },
                    { label: 'Wind', v1: `${result.city1.weather.wind_speed} km/h`, v2: `${result.city2.weather.wind_speed} km/h`, icon: 'speedometer' },
                    { label: 'PM2.5', v1: String(result.city1.pollutants.pm25), v2: String(result.city2.pollutants.pm25), icon: 'cloudy' },
                    { label: 'PM10', v1: String(result.city1.pollutants.pm10), v2: String(result.city2.pollutants.pm10), icon: 'cloud' },
                    { label: 'Primary', v1: result.city1.primary_pollutant, v2: result.city2.primary_pollutant, icon: 'warning' },
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

                {/* Mask Comparison */}
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

                {/* Winner */}
                <GlassCard testID="winner-card" style={styles.winnerCard}>
                  <Ionicons name="trophy" size={28} color="#FACC15" />
                  <Text style={styles.winnerText}>
                    {result.city1.aqi <= result.city2.aqi ? result.city1.city : result.city2.city} has better air quality
                  </Text>
                  <Text style={styles.winnerDiff}>
                    {Math.abs(result.city1.aqi - result.city2.aqi)} AQI difference
                  </Text>
                </GlassCard>
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
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
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
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  detailValue: { fontSize: 15, fontWeight: '600', color: '#FFF', width: 80, textAlign: 'center' },
  detailCenter: { alignItems: 'center', gap: 4 },
  detailLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 },
  maskCompare: { flexDirection: 'row', gap: 12, marginTop: 16 },
  maskCard: { flex: 1, alignItems: 'center', padding: 16, gap: 8 },
  maskType: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' },
  winnerCard: { alignItems: 'center', gap: 8, marginTop: 16, borderColor: 'rgba(250,204,21,0.3)' },
  winnerText: { fontSize: 16, fontWeight: '700', color: '#FACC15', textAlign: 'center' },
  winnerDiff: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
});
