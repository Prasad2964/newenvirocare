import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, FlatList, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../src/utils/api';
import { getAqiTheme, getRiskColor } from '../../src/utils/theme';
import GlassCard from '../../src/components/GlassCard';

// ── Cities — same list as city-compare ───────────────────────────────────────
const INDIAN_CITIES = [
  'Agra', 'Agra - Manoharpur', 'Agra - Rohta', 'Agra - Sanjay Palace',
  'Agra - Shahjahan Garden', 'Agra - Shastripuram',
  'Ahmedabad', 'Ahmedabad - Airport Hansol', 'Ahmedabad - Bopal',
  'Ahmedabad - Chandkheda', 'Ahmedabad - Gyaspur', 'Ahmedabad - Maninagar',
  'Ahmedabad - Phase-4 GIDC', 'Ahmedabad - SAC ISRO Satellite',
  'Ajmer', 'Aligarh', 'Allahabad', 'Amravati',
  'Amritsar', 'Amritsar - Golden Temple',
  'Asansol', 'Aurangabad',
  'Bangalore', 'Bangalore - BTM Layout', 'Bangalore - Hebbal', 'Bangalore - Silk Board',
  'Bareilly', 'Belgaum', 'Bhavnagar', 'Bhilai', 'Bhiwandi',
  'Bhopal', 'Bhopal - Paryavaran Parisar', 'Bhopal - T T Nagar',
  'Bhubaneswar', 'Bikaner',
  'Chandigarh', 'Chandigarh - Sector 22', 'Chandigarh - Sector-25',
  'Chandigarh - Sector-53', 'Chandigarh - Sector 6 Panchkula',
  'Chennai', 'Chennai - Arumbakkam', 'Chennai - Kodungaiyur', 'Chennai - Manali',
  'Chennai - Manali Village', 'Chennai - Perungudi', 'Chennai - Royapuram',
  'Chennai - Velachery',
  'Coimbatore', 'Coimbatore - SIDCO Kurichi',
  'Cuttack', 'Davanagere',
  'Dehradun', 'Dehradun - Doon University',
  'Delhi', 'Delhi - Anand Vihar', 'Delhi - Dwarka', 'Delhi - Okhla',
  'Delhi - Punjabi Bagh', 'Delhi - RK Puram', 'Delhi - Rohini',
  'Dhanbad', 'Durgapur', 'Erode',
  'Faridabad', 'Faridabad - Dr Karni Singh Range', 'Faridabad - New Industrial Town',
  'Faridabad - Sector 11', 'Faridabad - Sector 30',
  'Gaya',
  'Ghaziabad', 'Ghaziabad - Indirapuram', 'Ghaziabad - Sanjay Nagar',
  'Ghaziabad - Sector-62', 'Ghaziabad - Vasundhara',
  'Gorakhpur', 'Gulbarga', 'Guntur',
  'Gurgaon', 'Gurgaon - Aya Nagar', 'Gurgaon - Gwal Pahari',
  'Gurgaon - Sector-51', 'Gurgaon - Teri Gram', 'Gurgaon - Vikas Sadan',
  'Guwahati', 'Guwahati - Pan Bazaar', 'Guwahati - Railway Colony',
  'Gwalior',
  'Hyderabad', 'Hyderabad - Central University', 'Hyderabad - ECIL Kapra',
  'Hyderabad - Kokapet', 'Hyderabad - Kompally', 'Hyderabad - Nacharam',
  'Hyderabad - New Malakpet', 'Hyderabad - Sanathnagar', 'Hyderabad - Somajiguda',
  'Hyderabad - Zoo Park',
  'Hubballi-Dharwad', 'Indore', 'Jabalpur',
  'Jaipur', 'Jaipur - Adarsh Nagar', 'Jaipur - Police Commissionerate',
  'Jalandhar', 'Jalgaon', 'Jamnagar', 'Jammu', 'Jamshedpur', 'Jhansi',
  'Jodhpur', 'Jodhpur - Collectorate',
  'Kanpur', 'Kanpur - Kidwai Nagar', 'Kanpur - Nehru Nagar', 'Kanpur - NSI Kalyanpur',
  'Kochi', 'Kolhapur',
  'Kolkata', 'Kolkata - Ballygunge', 'Kolkata - Belur Math', 'Kolkata - Bidhannagar',
  'Kolkata - Fort William', 'Kolkata - Ghusuri', 'Kolkata - Jadavpur',
  'Kolkata - Padmapukur', 'Kolkata - Rabindra Bharati University',
  'Kolkata - Rabindra Sarobar', 'Kolkata - Victoria',
  'Kota', 'Kozhikode',
  'Lucknow', 'Lucknow - Ambedkar University', 'Lucknow - Central School',
  'Lucknow - Gomti Nagar', 'Lucknow - Kukrail', 'Lucknow - Lalbagh',
  'Lucknow - Talkatora',
  'Ludhiana', 'Ludhiana - PAU',
  'Madurai', 'Maheshtala', 'Malegaon', 'Mangalore', 'Meerut', 'Moradabad',
  'Mumbai', 'Mumbai - Airport', 'Mumbai - Andheri', 'Mumbai - Bandra Kurla Complex',
  'Mumbai - Bhandup', 'Mumbai - Borivali', 'Mumbai - Colaba', 'Mumbai - Deonar',
  'Mumbai - Kurla', 'Mumbai - Malad', 'Mumbai - Mazgaon', 'Mumbai - Mulund',
  'Mumbai - Navy Nagar Colaba', 'Mumbai - Powai', 'Mumbai - Siddharth Nagar Worli',
  'Mumbai - Sion', 'Mumbai - Worli',
  'Mysore',
  'Nagpur', 'Nagpur - Civil Lines',
  'Nanded', 'Nashik', 'Nashik - Gangapur Road', 'Nellore',
  'Noida', 'Noida - Indirapuram', 'Noida - Knowledge Park-V',
  'Noida - Mother Dairy Plant', 'Noida - Sector-1', 'Noida - Sector-62',
  'Noida - Sector-116', 'Noida - Sector-125',
  'Patna', 'Patna - IGSC Planetarium', 'Patna - Industrial Area',
  'Patna - Muradpur', 'Patna - Rajbansi Nagar', 'Patna - Samanpura', 'Patna - Shikarpur',
  'Pimpri-Chinchwad', 'Pune', 'Raipur', 'Rajkot', 'Ranchi',
  'Saharanpur', 'Salem', 'Sangli', 'Siliguri', 'Solapur', 'Srinagar', 'Surat',
  'Thane',
  'Thiruvananthapuram', 'Thiruvananthapuram - Kariavattom', 'Thiruvananthapuram - Plammoodu',
  'Tiruchirappalli', 'Tirunelveli',
  'Udaipur', 'Ujjain', 'Ulhasnagar', 'Vadodara',
  'Varanasi', 'Varanasi - Ardhali Bazar', 'Varanasi - Banaras Hindu University',
  'Varanasi - Bhelupur', 'Varanasi - Maldahiya',
  'Vijayawada',
  'Visakhapatnam', 'Visakhapatnam - GVM Corporation',
  'Warangal',
];

// ── Inline searchable city dropdown (same as city-compare) ────────────────────
function CityDropdown({
  value, onChange, placeholder, accentColor,
}: {
  value: string; onChange: (c: string) => void; placeholder: string; accentColor: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => query.trim()
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

      {open && (
        <View style={[styles.dropdownList, { borderColor: accentColor + '40' }]}>
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
                style={[styles.dropdownItem, item === value && { backgroundColor: accentColor + '20' }]}
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

// ── Travel modes ──────────────────────────────────────────────────────────────
const TRAVEL_MODES = [
  { key: 'car',   icon: 'car',   label: 'Car' },
  { key: 'bus',   icon: 'bus',   label: 'Bus' },
  { key: 'train', icon: 'train', label: 'Train' },
  { key: 'walk',  icon: 'walk',  label: 'Walk' },
];

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function TravelScreen() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [mode, setMode] = useState('car');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [hotspots, setHotspots] = useState<any>(null);

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
    <View testID="travel-screen" style={styles.container}>
      <LinearGradient colors={['#0B1D2B', '#000']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Smart Travel</Text>
            <Text style={styles.subtitle}>Check air quality along your route</Text>

            <GlassCard style={styles.formCard}>
              <CityDropdown
                value={origin}
                onChange={v => { setOrigin(v); setResult(null); }}
                placeholder="From — select city"
                accentColor="#4ADE80"
              />
              <View style={styles.divider} />
              <CityDropdown
                value={destination}
                onChange={v => { setDestination(v); setResult(null); }}
                placeholder="To — select city"
                accentColor="#F87171"
              />
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
                            <View style={styles.hotspotNameRow}>
                              <Ionicons name="location" size={13} color="rgba(255,255,255,0.4)" />
                              <Text style={styles.hotspotName}>{h.name}</Text>
                            </View>
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

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#000' },
  flex:         { flex: 1 },
  scroll:       { padding: 20, paddingBottom: 40 },
  title:        { fontSize: 32, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  subtitle:     { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginBottom: 24 },
  formCard:     { marginBottom: 16 },
  divider:      { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 2, marginLeft: 24 },

  // Dropdown — identical to city-compare
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  dropdownDot:         { width: 11, height: 11, borderRadius: 6 },
  dropdownValue:       { flex: 1, color: '#FFF', fontSize: 15, fontWeight: '500' },
  dropdownPlaceholder: { color: 'rgba(255,255,255,0.3)', fontWeight: '400' },
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
  dropdownFlatList:    { maxHeight: 210 },
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

  modeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 8 },
  modeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modeBtnActive:   { backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.3)' },
  modeLabel:       { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: '600' },
  modeLabelActive: { color: '#4ADE80' },
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
  hotspotNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hotspotName:    { fontSize: 14, fontWeight: '600', color: '#FFF' },
  hotspotDesc:    { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  hotspotAqi:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  hotspotAqiText: { fontSize: 14, fontWeight: '700' },
});
