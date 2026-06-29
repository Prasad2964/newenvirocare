import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Modal, RefreshControl, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../../src/components/GlassCard';
import { routineService, Routine, RoutineAssessment } from '../../src/services/routineService';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ACTIVITY_TYPES = ['outdoor', 'indoor', 'commute'] as const;
const SENSITIVITY = ['low', 'medium', 'high'] as const;

const RISK_CONFIG = {
  SAFE:    { color: '#4ADE80', bg: 'rgba(74,222,128,0.12)',   border: 'rgba(74,222,128,0.3)',   icon: 'checkmark-circle' as const },
  CAUTION: { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',   icon: 'warning'          as const },
  AVOID:   { color: '#F87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)',  icon: 'close-circle'     as const },
};

export default function RoutineScreen() {
  // ── data ───────────────────────────────────────────────────────────────────
  const [routines, setRoutines]         = useState<Routine[]>([]);
  const [assessments, setAssessments]   = useState<RoutineAssessment[]>([]);
  const [loadingAll, setLoadingAll]     = useState(true);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  // ── add-form state ─────────────────────────────────────────────────────────
  const [showForm, setShowForm]         = useState(false);
  const [adding, setAdding]             = useState(false);
  const [activity, setActivity]         = useState('');
  const [time, setTime]                 = useState('');
  const [type, setType]                 = useState<typeof ACTIVITY_TYPES[number]>('outdoor');
  const [sensitivity, setSensitivity]   = useState<typeof SENSITIVITY[number]>('medium');
  const [location, setLocation]         = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>(['Mon','Tue','Wed','Thu','Fri']);

  // ── reschedule bottom-sheet ────────────────────────────────────────────────
  const [rescheduleModal, setRescheduleModal] = useState(false);
  const [rescheduling, setRescheduling]       = useState(false);
  const [rescheduleResult, setRescheduleResult] = useState<any>(null);
  const slideAnim = useRef(new Animated.Value(400)).current;

  const openRescheduleSheet = (result: any) => {
    setRescheduleResult(result);
    setRescheduleModal(true);
    Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 180, useNativeDriver: true }).start();
  };
  const closeRescheduleSheet = () => {
    Animated.timing(slideAnim, { toValue: 400, duration: 240, useNativeDriver: true }).start(
      () => { setRescheduleModal(false); setRescheduleResult(null); }
    );
  };

  // ── fetch helpers ──────────────────────────────────────────────────────────
  const fetchRoutines = useCallback(async () => {
    try {
      const data = await routineService.getRoutines();
      setRoutines(data);
    } catch (e) { console.log('fetch routines error', e); }
    finally { setLoadingAll(false); }
  }, []);

  const fetchTodayCheck = useCallback(async () => {
    try {
      const data = await routineService.getTodayCheck();
      setAssessments(data.assessments || []);
    } catch (e) { console.log('today-check error', e); }
    finally { setLoadingCheck(false); }
  }, []);

  useEffect(() => {
    fetchRoutines();
    fetchTodayCheck();
  }, [fetchRoutines, fetchTodayCheck]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchRoutines(), fetchTodayCheck()]);
    setRefreshing(false);
  }, [fetchRoutines, fetchTodayCheck]);

  // ── add routine ────────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!activity.trim() || !time.trim()) {
      Alert.alert('Missing fields', 'Please enter activity and time.');
      return;
    }
    setAdding(true);
    try {
      await routineService.addRoutine({
        activity: activity.trim(),
        time: time.trim(),
        type,
        days: selectedDays,
        health_impact: sensitivity,
        location: location.trim(),
      });
      setActivity(''); setTime(''); setLocation('');
      setType('outdoor'); setSensitivity('medium');
      setSelectedDays(['Mon','Tue','Wed','Thu','Fri']);
      setShowForm(false);
      fetchRoutines();
      fetchTodayCheck();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not add routine.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await routineService.deleteRoutine(id);
      fetchRoutines();
      fetchTodayCheck();
    } catch (e) { console.log('delete error', e); }
  }

  async function handleReschedule(routineId: string) {
    setRescheduling(true);
    try {
      const result = await routineService.aiReschedule(routineId);
      openRescheduleSheet(result);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not get AI suggestion.');
    } finally {
      setRescheduling(false);
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  function toggleDay(day: string) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <View testID="routine-screen" style={styles.container}>
      <LinearGradient colors={['#0A1A2B', '#000']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
          >
            {/* ── Header ── */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Routine Planner</Text>
                <Text style={styles.subtitle}>AI-powered daily schedule</Text>
              </View>
              <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
                <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            {/* ════════════════════════════════════════════
                SECTION 1 — TODAY'S ROUTINE CHECK
            ════════════════════════════════════════════ */}
            <View style={styles.sectionHeader}>
              <Ionicons name="today" size={16} color="#06B6D4" />
              <Text style={styles.sectionTitle}>Today's Routine Check</Text>
            </View>

            {loadingCheck ? (
              <GlassCard style={styles.loadingCard}>
                <ActivityIndicator color="#06B6D4" />
                <Text style={styles.loadingText}>Checking today's conditions…</Text>
              </GlassCard>
            ) : assessments.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <Ionicons name="sunny-outline" size={32} color="rgba(255,255,255,0.2)" />
                <Text style={styles.emptyCardText}>No routines scheduled for today</Text>
                <Text style={styles.emptyCardSub}>Add one below and we'll cross-check it with live AQI</Text>
              </GlassCard>
            ) : (
              assessments.map(a => {
                const cfg = RISK_CONFIG[a.risk_level] ?? RISK_CONFIG.CAUTION;
                return (
                  <GlassCard
                    key={a.routine_id}
                    style={{ ...styles.assessCard, borderColor: cfg.border }}
                    glowColor={cfg.color}
                  >
                    {/* Top row */}
                    <View style={styles.assessTop}>
                      <View style={styles.assessLeft}>
                        <Text style={styles.assessTime}>{a.scheduled_time}</Text>
                        <Text style={styles.assessActivity}>{a.activity}</Text>
                        <View style={styles.tagRow}>
                          <View style={[styles.tag, { backgroundColor: 'rgba(6,182,212,0.12)' }]}>
                            <Text style={[styles.tagText, { color: '#06B6D4' }]}>{a.type}</Text>
                          </View>
                          <View style={[styles.tag, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                            <Text style={[styles.tagText, { color: 'rgba(255,255,255,0.5)' }]}>{a.city}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={[styles.riskBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                        <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                        <Text style={[styles.riskLabel, { color: cfg.color }]}>{a.risk_level}</Text>
                      </View>
                    </View>

                    {/* AQI row */}
                    <View style={styles.aqiRow}>
                      <Text style={[styles.aqiVal, { color: cfg.color }]}>AQI {a.aqi}</Text>
                      <Text style={styles.aqiPol}>· {a.dominant_pollutant}</Text>
                    </View>

                    {/* Personalised reason */}
                    <Text style={styles.reason}>{a.personalised_reason}</Text>

                    {/* Preventive tip */}
                    {a.preventive_tip ? (
                      <View style={styles.tipRow}>
                        <Ionicons name="shield-checkmark-outline" size={13} color="#06B6D4" />
                        <Text style={styles.tipText}>{a.preventive_tip}</Text>
                      </View>
                    ) : null}

                    {/* Best time window */}
                    {a.best_time_window && a.risk_level !== 'SAFE' ? (
                      <View style={styles.bestTimeRow}>
                        <Ionicons name="time-outline" size={13} color="#FBBF24" />
                        <Text style={styles.bestTimeText}>Best window: {a.best_time_window}</Text>
                      </View>
                    ) : null}

                    {/* Reschedule button */}
                    {a.risk_level !== 'SAFE' && (
                      <TouchableOpacity
                        style={styles.rescheduleBtn}
                        onPress={() => handleReschedule(a.routine_id)}
                        disabled={rescheduling}
                      >
                        {rescheduling
                          ? <ActivityIndicator size="small" color="#FBBF24" />
                          : <>
                              <Ionicons name="sparkles" size={14} color="#FBBF24" />
                              <Text style={styles.rescheduleBtnText}>AI Reschedule</Text>
                            </>
                        }
                      </TouchableOpacity>
                    )}
                  </GlassCard>
                );
              })
            )}

            {/* ════════════════════════════════════════════
                SECTION 2 — MY ROUTINES
            ════════════════════════════════════════════ */}
            <View style={[styles.sectionHeader, { marginTop: 28 }]}>
              <Ionicons name="list" size={16} color="#4ADE80" />
              <Text style={styles.sectionTitle}>My Routines</Text>
            </View>

            {loadingAll ? (
              <ActivityIndicator color="#4ADE80" style={{ marginVertical: 16 }} />
            ) : routines.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={48} color="rgba(255,255,255,0.15)" />
                <Text style={styles.emptyText}>No routines yet</Text>
                <Text style={styles.emptySubtext}>Add your daily activities below</Text>
              </View>
            ) : (
              routines.map((r, i) => (
                <GlassCard key={r.routine_id} testID={`routine-item-${i}`} style={styles.routineCard}>
                  <View style={styles.routineRow}>
                    <View style={styles.routineInfo}>
                      <Text style={styles.routineTime}>{r.time}</Text>
                      <Text style={styles.routineActivity}>{r.activity}</Text>
                      <View style={styles.tagRow}>
                        <View style={[styles.tag, {
                          backgroundColor: r.type === 'outdoor' ? 'rgba(74,222,128,0.12)' : 'rgba(6,182,212,0.12)',
                        }]}>
                          <Text style={[styles.tagText, {
                            color: r.type === 'outdoor' ? '#4ADE80' : '#06B6D4',
                          }]}>{r.type}</Text>
                        </View>
                        <View style={[styles.tag, {
                          backgroundColor: r.health_impact === 'high'
                            ? 'rgba(248,113,113,0.1)'
                            : r.health_impact === 'medium'
                            ? 'rgba(251,191,36,0.1)'
                            : 'rgba(74,222,128,0.08)',
                        }]}>
                          <Text style={[styles.tagText, {
                            color: r.health_impact === 'high' ? '#F87171'
                              : r.health_impact === 'medium' ? '#FBBF24' : '#4ADE80',
                          }]}>{r.health_impact} sensitivity</Text>
                        </View>
                      </View>
                      {r.days?.length > 0 && (
                        <View style={styles.daysRow}>
                          {r.days.map(d => (
                            <View key={d} style={styles.dayChip}>
                              <Text style={styles.dayChipText}>{d}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      testID={`delete-routine-${i}`}
                      onPress={() => Alert.alert('Delete', `Remove "${r.activity}"?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => handleDelete(r.routine_id) },
                      ])}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.3)" />
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              ))
            )}

            {/* ── Add button / form ── */}
            {showForm ? (
              <GlassCard testID="add-routine-form" style={styles.formCard}>
                <Text style={styles.formTitle}>New Routine</Text>

                <TextInput
                  testID="routine-activity-input"
                  style={styles.formInput}
                  placeholder="Activity (e.g. Morning Walk)"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={activity}
                  onChangeText={setActivity}
                />
                <TextInput
                  testID="routine-time-input"
                  style={styles.formInput}
                  placeholder="Time (e.g. 07:00 AM)"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={time}
                  onChangeText={setTime}
                />
                <TextInput
                  style={styles.formInput}
                  placeholder="City (leave blank to use your default city)"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={location}
                  onChangeText={setLocation}
                />

                {/* Type selector */}
                <Text style={styles.formLabel}>Activity Type</Text>
                <View style={styles.segRow}>
                  {ACTIVITY_TYPES.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.segBtn, type === t && styles.segBtnActive]}
                      onPress={() => setType(t)}
                    >
                      <Text style={[styles.segText, type === t && styles.segTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Sensitivity selector */}
                <Text style={styles.formLabel}>Health Sensitivity</Text>
                <View style={styles.segRow}>
                  {SENSITIVITY.map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.segBtn, sensitivity === s && styles.segBtnActiveSens]}
                      onPress={() => setSensitivity(s)}
                    >
                      <Text style={[styles.segText, sensitivity === s && { color: '#FFF', fontWeight: '700' }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Day selector */}
                <Text style={styles.formLabel}>Repeat Days</Text>
                <View style={styles.dayGrid}>
                  {DAYS.map(d => (
                    <TouchableOpacity
                      key={d}
                      style={[styles.dayToggle, selectedDays.includes(d) && styles.dayToggleActive]}
                      onPress={() => toggleDay(d)}
                    >
                      <Text style={[styles.dayToggleText, selectedDays.includes(d) && styles.dayToggleTextActive]}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="save-routine-btn"
                    style={styles.saveBtn}
                    onPress={handleAdd}
                    disabled={adding}
                  >
                    {adding
                      ? <ActivityIndicator size="small" color="#000" />
                      : <Text style={styles.saveBtnText}>Add Routine</Text>
                    }
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ) : (
              <TouchableOpacity
                testID="show-add-routine-btn"
                style={styles.addBtn}
                onPress={() => setShowForm(true)}
              >
                <Ionicons name="add" size={22} color="#4ADE80" />
                <Text style={styles.addBtnText}>Add Routine</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ── Reschedule bottom sheet ── */}
      <Modal visible={rescheduleModal} transparent animationType="none" onRequestClose={closeRescheduleSheet}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeRescheduleSheet} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Ionicons name="sparkles" size={18} color="#FBBF24" />
            <Text style={styles.sheetTitle}>AI Reschedule Suggestion</Text>
          </View>
          {rescheduleResult && (
            <>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>Original time</Text>
                <Text style={styles.sheetVal}>{rescheduleResult.original_time}</Text>
              </View>
              <View style={[styles.sheetRow, styles.sheetRowHighlight]}>
                <Text style={styles.sheetLabel}>Suggested time</Text>
                <Text style={[styles.sheetVal, { color: '#4ADE80', fontWeight: '700', fontSize: 18 }]}>
                  {rescheduleResult.suggested_time}
                </Text>
              </View>
              <View style={styles.sheetConfidenceRow}>
                <Ionicons
                  name={rescheduleResult.confidence === 'high' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={14}
                  color={rescheduleResult.confidence === 'high' ? '#4ADE80' : '#FBBF24'}
                />
                <Text style={styles.sheetConfidence}>{rescheduleResult.confidence} confidence</Text>
              </View>
              <Text style={styles.sheetReason}>{rescheduleResult.reason}</Text>
            </>
          )}
          <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeRescheduleSheet}>
            <Text style={styles.sheetCloseBtnText}>Got it</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  refreshBtn: { padding: 8 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#FFF', letterSpacing: 0.5, textTransform: 'uppercase' },

  loadingCard: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },

  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  emptyCardText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  emptyCardSub: { fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', maxWidth: 260 },

  // Assessment cards
  assessCard: { marginBottom: 12, padding: 16 },
  assessTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  assessLeft: { flex: 1 },
  assessTime: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 },
  assessActivity: { fontSize: 18, fontWeight: '700', color: '#FFF', marginTop: 2 },
  riskBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1,
  },
  riskLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  aqiRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aqiVal: { fontSize: 15, fontWeight: '700' },
  aqiPol: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  reason: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 20, marginBottom: 8 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  tipText: { fontSize: 12, color: '#06B6D4', fontStyle: 'italic', flex: 1, lineHeight: 18 },
  bestTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  bestTimeText: { fontSize: 12, color: '#FBBF24', fontWeight: '600' },
  rescheduleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)', marginTop: 4,
  },
  rescheduleBtnText: { fontSize: 13, fontWeight: '600', color: '#FBBF24' },

  // Routine list cards
  routineCard: { marginBottom: 10, padding: 14 },
  routineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  routineInfo: { flex: 1 },
  routineTime: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5 },
  routineActivity: { fontSize: 16, fontWeight: '700', color: '#FFF', marginTop: 2 },
  deleteBtn: { padding: 8 },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },

  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  dayChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.06)' },
  dayChipText: { fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 6 },
  emptyText: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.3)' },
  emptySubtext: { fontSize: 13, color: 'rgba(255,255,255,0.2)', textAlign: 'center' },

  // Add form
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)', backgroundColor: 'rgba(74,222,128,0.08)', marginTop: 16,
  },
  addBtnText: { fontSize: 15, fontWeight: '600', color: '#4ADE80' },
  formCard: { marginTop: 16, padding: 16 },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 14 },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, height: 48,
    color: '#FFF', fontSize: 15, marginBottom: 10,
  },
  formLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  segRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  segBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  segBtnActive: { backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.4)' },
  segBtnActiveSens: { backgroundColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.4)' },
  segText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'capitalize' },
  segTextActive: { color: '#4ADE80', fontWeight: '700' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  dayToggle: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  dayToggleActive: { backgroundColor: 'rgba(74,222,128,0.12)', borderColor: 'rgba(74,222,128,0.4)' },
  dayToggleText: { fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
  dayToggleTextActive: { color: '#4ADE80' },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)' },
  cancelText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16, backgroundColor: '#4ADE80' },
  saveBtnText: { color: '#000', fontWeight: '700' },

  // Reschedule sheet
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0C1825', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    padding: 24, paddingBottom: 36,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 18 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  sheetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  sheetRowHighlight: { backgroundColor: 'rgba(74,222,128,0.06)', borderRadius: 10, paddingHorizontal: 10, marginVertical: 4 },
  sheetLabel: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  sheetVal: { fontSize: 15, color: '#FFF', fontWeight: '600' },
  sheetConfidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 4 },
  sheetConfidence: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '600', textTransform: 'capitalize' },
  sheetReason: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 22, marginTop: 8, marginBottom: 20 },
  sheetCloseBtn: { backgroundColor: '#4ADE80', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  sheetCloseBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
