import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Modal, TextInput, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../src/utils/api';
import { getAqiTheme, getRiskColor } from '../../src/utils/theme';
import GlassCard from '../../src/components/GlassCard';

const CITIES = [
  'Agra', 'Ahmedabad', 'Aligarh', 'Allahabad', 'Amritsar',
  'Aurangabad', 'Bangalore', 'Bareilly', 'Bhopal', 'Chandigarh',
  'Chennai', 'Coimbatore', 'Delhi', 'Dhanbad', 'Faridabad',
  'Ghaziabad', 'Guwahati', 'Howrah', 'Hyderabad', 'Indore',
  'Jaipur', 'Jodhpur', 'Kalyan', 'Kanpur', 'Kolkata',
  'Kota', 'Lucknow', 'Madurai', 'Meerut', 'Moradabad',
  'Mumbai', 'Mysore', 'Nagpur', 'Nashik', 'Navi Mumbai',
  'Noida', 'Patna', 'Pune', 'Raipur', 'Rajkot',
  'Ranchi', 'Srinagar', 'Surat', 'Thane', 'Tiruchirappalli',
  'Vadodara', 'Varanasi', 'Vasai', 'Visakhapatnam',
];

const TRAVEL_MODES = [
  { key: 'car',   icon: 'car',   label: 'Car' },
  { key: 'bus',   icon: 'bus',   label: 'Bus' },
  { key: 'train', icon: 'train', label: 'Train' },
  { key: 'walk',  icon: 'walk',  label: 'Walk' },
];

// ── City Picker Modal ─────────────────────────────────────────────────────────

interface CityPickerProps {
  visible: boolean;
  title: string;
  selected: string;
  onSelect: (city: string) => void;
  onClose: () => void;
}

function CityPicker({ visible, title, selected, onSelect, onClose }: CityPickerProps) {
  const [query, setQuery] = useState('');
  const filtered = CITIES.filter(c => c.toLowerCase().includes(query.toLowerCase()));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={picker.overlay}>
        <View style={picker.sheet}>
          <View style={picker.header}>
            <Text style={picker.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={picker.closeBtn}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <View style={picker.searchRow}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={picker.searchInput}
              placeholder="Search city..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = item === selected;
              return (
                <TouchableOpacity
                  style={[picker.cityRow, isSelected && picker.cityRowActive]}
                  onPress={() => { onSelect(item); onClose(); setQuery(''); }}
                >
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={isSelected ? '#4ADE80' : 'rgba(255,255,255,0.25)'}
                  />
                  <Text style={[picker.cityName, isSelected && picker.cityNameActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={picker.empty}>No cities match "{query}"</Text>
            }
            style={picker.list}
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Dropdown Button ───────────────────────────────────────────────────────────

interface DropdownBtnProps {
  value: string;
  placeholder: string;
  dotColor: string;
  onPress: () => void;
}

function DropdownBtn({ value, placeholder, dotColor, onPress }: DropdownBtnProps) {
  return (
    <TouchableOpacity style={styles.inputRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
        {value || placeholder}
      </Text>
      <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.3)" />
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function TravelScreen() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState('car');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [hotspots, setHotspots] = useState<any>(null);
  const [pickerFor, setPickerFor] = useState<'origin' | 'destination' | null>(null);

  async function planTravel() {
    if (!origin || !destination) return;
    setLoading(true);
    try {
      const [data, spots] = await Promise.all([
        api.post('/api/travel/plan', { origin, destination, mode }),
        api.post('/api/travel/hotspots', { origin, destination }).catch(() => null),
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
    <View style={styles.container}>
      <LinearGradient colors={['#0B1D2B', '#000']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Smart Travel</Text>
          <Text style={styles.subtitle}>Check air quality along your route</Text>

          <GlassCard style={styles.formCard}>
            <DropdownBtn
              value={origin}
              placeholder="From — select city"
              dotColor="#4ADE80"
              onPress={() => setPickerFor('origin')}
            />
            <View style={styles.divider} />
            <DropdownBtn
              value={destination}
              placeholder="To — select city"
              dotColor="#F87171"
              onPress={() => setPickerFor('destination')}
            />
          </GlassCard>

          <View style={styles.modeRow}>
            {TRAVEL_MODES.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.modeBtn, mode === m.key && styles.modeBtnActive]}
                onPress={() => setMode(m.key)}
              >
                <Ionicons name={m.icon as any} size={22} color={mode === m.key ? '#4ADE80' : 'rgba(255,255,255,0.4)'} />
                <Text style={[styles.modeLabel, mode === m.key && styles.modeLabelActive]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.planBtn, (!origin || !destination || loading) && { opacity: 0.5 }]}
            onPress={planTravel}
            disabled={!origin || !destination || loading}
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

              <GlassCard>
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

              <GlassCard style={{ marginTop: 16 }}>
                <View style={styles.rowGap}>
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

              {result.travel_advice && (
                <GlassCard style={{ marginTop: 16, borderColor: 'rgba(250,204,21,0.3)' }}>
                  <View style={styles.rowGap}>
                    <Ionicons name="sparkles" size={18} color="#FACC15" />
                    <Text style={[styles.cardTitle, { color: '#FACC15' }]}>AI Travel Advice</Text>
                  </View>
                  <Text style={styles.adviceText}>{result.travel_advice}</Text>
                </GlassCard>
              )}

              {hotspots?.hotspots?.length > 0 && (
                <GlassCard style={{ marginTop: 16 }}>
                  <View style={styles.rowGap}>
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
      </SafeAreaView>

      <CityPicker
        visible={pickerFor === 'origin'}
        title="Select Origin"
        selected={origin}
        onSelect={setOrigin}
        onClose={() => setPickerFor(null)}
      />
      <CityPicker
        visible={pickerFor === 'destination'}
        title="Select Destination"
        selected={destination}
        onSelect={setDestination}
        onClose={() => setPickerFor(null)}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#000' },
  flex:           { flex: 1 },
  scroll:         { padding: 20, paddingBottom: 40 },
  title:          { fontSize: 32, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  subtitle:       { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginBottom: 24 },
  formCard:       { marginBottom: 16 },
  inputRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  dot:            { width: 12, height: 12, borderRadius: 6 },
  dropdownText:   { flex: 1, color: '#FFF', fontSize: 16 },
  dropdownPlaceholder: { color: 'rgba(255,255,255,0.3)' },
  divider:        { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginLeft: 24 },
  modeRow:        { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 8 },
  modeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modeBtnActive:  { backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.3)' },
  modeLabel:      { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: '600' },
  modeLabelActive:{ color: '#4ADE80' },
  planBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 56, borderRadius: 28, backgroundColor: '#4ADE80', gap: 8, marginBottom: 24,
  },
  planBtnText:    { fontSize: 16, fontWeight: '700', color: '#000', letterSpacing: 0.5 },
  routeCompare:   { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  routeCard:      { flex: 1, alignItems: 'center', padding: 16 },
  routeCity:      { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 4, textAlign: 'center' },
  routeAqi:       { fontSize: 36, fontWeight: '800' },
  routeLevel:     { fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 },
  routeTemp:      { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  routeArrow:     { alignItems: 'center', gap: 4 },
  routeMode:      { fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' },
  cardTitle:      { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 12 },
  rowGap:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  riskCompareRow: { flexDirection: 'row', alignItems: 'center' },
  riskItem:       { flex: 1, alignItems: 'center' },
  riskCity:       { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
  riskScore:      { fontSize: 32, fontWeight: '800' },
  riskLevel:      { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  riskDivider:    { width: 1, height: 50, backgroundColor: 'rgba(255,255,255,0.1)' },
  precautionRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  precautionText: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  adviceText:     { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 22 },
  hotspotSummary: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12 },
  hotspotItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  hotspotDot:     { width: 10, height: 10, borderRadius: 5 },
  hotspotInfo:    { flex: 1 },
  hotspotName:    { fontSize: 14, fontWeight: '600', color: '#FFF' },
  hotspotDesc:    { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  hotspotAqi:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  hotspotAqiText: { fontSize: 14, fontWeight: '700' },
});

const picker = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F1E2E',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 32, maxHeight: '75%',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title:   { fontSize: 18, fontWeight: '700', color: '#FFF' },
  closeBtn:{ padding: 4 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15 },
  list:    { paddingHorizontal: 16 },
  cityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  cityRowActive:  { },
  cityName:       { fontSize: 16, color: 'rgba(255,255,255,0.75)' },
  cityNameActive: { color: '#4ADE80', fontWeight: '600' },
  empty:   { textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: 32, fontSize: 14 },
});
