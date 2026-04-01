import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../src/utils/api';
import { getAqiTheme, getRiskColor } from '../../src/utils/theme';
import GlassCard from '../../src/components/GlassCard';

type FilterType = 'all' | 'aqi_check' | 'notification' | 'symptom';

export default function HistoryScreen() {
  const [activities, setActivities] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [symptoms, setSymptoms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');

  const fetchData = useCallback(async () => {
    try {
      const [acts, notifs, syms] = await Promise.all([
        api.get('/api/activities').catch(() => []),
        api.get('/api/notifications').catch(() => []),
        api.get('/api/symptoms').catch(() => []),
      ]);
      setActivities(acts || []);
      setNotifications(notifs || []);
      setSymptoms(syms || []);
    } catch (e) {
      console.log('History fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const allItems = [
    ...activities.map(a => ({ ...a, _type: 'activity', _time: a.timestamp })),
    ...notifications.map(n => ({ ...n, _type: 'notification', _time: n.timestamp })),
    ...symptoms.map(s => ({ ...s, _type: 'symptom', _time: s.logged_at })),
  ].sort((a, b) => new Date(b._time).getTime() - new Date(a._time).getTime());

  const filteredItems = filter === 'all' ? allItems :
    filter === 'notification' ? allItems.filter(i => i._type === 'notification') :
    filter === 'symptom' ? allItems.filter(i => i._type === 'symptom') :
    allItems.filter(i => i._type === 'activity');

  const filters: { key: FilterType; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: 'list' },
    { key: 'aqi_check', label: 'AQI', icon: 'leaf' },
    { key: 'notification', label: 'Alerts', icon: 'notifications' },
    { key: 'symptom', label: 'Symptoms', icon: 'pulse' },
  ];

  function formatTime(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  }

  function renderItem(item: any, index: number) {
    if (item._type === 'notification') {
      return (
        <GlassCard key={`n-${index}`} testID={`history-notification-${index}`} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <View style={[styles.iconBadge, { backgroundColor: 'rgba(250,204,21,0.15)' }]}>
              <Ionicons name="notifications" size={18} color="#FACC15" />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{item.title || 'Alert'}</Text>
              <Text style={styles.itemTime}>{formatTime(item._time)}</Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.itemDesc}>{item.message}</Text>
        </GlassCard>
      );
    }
    if (item._type === 'symptom') {
      return (
        <GlassCard key={`s-${index}`} testID={`history-symptom-${index}`} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <View style={[styles.iconBadge, { backgroundColor: 'rgba(248,113,113,0.15)' }]}>
              <Ionicons name="pulse" size={18} color="#F87171" />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>Symptoms Logged</Text>
              <Text style={styles.itemTime}>{formatTime(item._time)}</Text>
            </View>
          </View>
          <View style={styles.chipRow}>
            {(item.symptoms || []).map((s: string, i: number) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{s}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      );
    }
    // Activity
    const aqiTheme = getAqiTheme(item.aqi || 0);
    return (
      <GlassCard key={`a-${index}`} testID={`history-activity-${index}`} style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <View style={[styles.iconBadge, { backgroundColor: aqiTheme.primary + '20' }]}>
            <Ionicons name="leaf" size={18} color={aqiTheme.primary} />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>{item.city || 'AQI Check'}</Text>
            <Text style={styles.itemTime}>{formatTime(item._time)}</Text>
          </View>
          <View style={[styles.aqiBadge, { backgroundColor: aqiTheme.primary + '20' }]}>
            <Text style={[styles.aqiBadgeText, { color: aqiTheme.primary }]}>AQI {item.aqi}</Text>
          </View>
        </View>
        {item.description ? <Text style={styles.itemDesc}>{item.description}</Text> : null}
        <View style={[styles.riskTag, { backgroundColor: getRiskColor(item.risk_level) + '20' }]}>
          <Text style={[styles.riskTagText, { color: getRiskColor(item.risk_level) }]}>
            {item.risk_level?.toUpperCase()} RISK
          </Text>
        </View>
      </GlassCard>
    );
  }

  return (
    <View testID="history-screen" style={styles.container}>
      <LinearGradient colors={['#0A1520', '#000']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Activity History</Text>
          <Text style={styles.subtitle}>Your environmental health timeline</Text>

          {/* Filters */}
          <View style={styles.filterRow}>
            {filters.map(f => (
              <TouchableOpacity
                key={f.key}
                testID={`filter-${f.key}`}
                style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
                onPress={() => setFilter(f.key)}
              >
                <Ionicons name={f.icon as any} size={16} color={filter === f.key ? '#4ADE80' : 'rgba(255,255,255,0.4)'} />
                <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Stats Summary */}
          <View style={styles.statsRow}>
            <GlassCard style={styles.statCard}>
              <Text style={styles.statNumber}>{activities.length}</Text>
              <Text style={styles.statLabel}>AQI Checks</Text>
            </GlassCard>
            <GlassCard style={styles.statCard}>
              <Text style={styles.statNumber}>{notifications.length}</Text>
              <Text style={styles.statLabel}>Alerts</Text>
            </GlassCard>
            <GlassCard style={styles.statCard}>
              <Text style={styles.statNumber}>{symptoms.length}</Text>
              <Text style={styles.statLabel}>Symptoms</Text>
            </GlassCard>
          </View>

          {/* Items */}
          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color="#4ADE80" />
            </View>
          ) : filteredItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={48} color="rgba(255,255,255,0.15)" />
              <Text style={styles.emptyText}>No history yet</Text>
              <Text style={styles.emptySubtext}>Your AQI checks, alerts, and symptoms will appear here</Text>
            </View>
          ) : (
            filteredItems.map((item, i) => renderItem(item, i))
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginBottom: 20 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  filterBtnActive: { backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.3)' },
  filterText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  filterTextActive: { color: '#4ADE80' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: { flex: 1, alignItems: 'center', padding: 14 },
  statNumber: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  itemCard: { marginBottom: 10, padding: 16 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  itemTime: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  itemDesc: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 10, lineHeight: 20 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(248,113,113,0.1)' },
  chipText: { fontSize: 12, color: '#F87171', fontWeight: '600' },
  aqiBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  aqiBadgeText: { fontSize: 12, fontWeight: '700' },
  riskTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 10 },
  riskTagText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  loadingState: { paddingVertical: 48, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.3)' },
  emptySubtext: { fontSize: 13, color: 'rgba(255,255,255,0.2)', textAlign: 'center', maxWidth: 250 },
});
