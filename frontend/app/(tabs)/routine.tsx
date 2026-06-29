import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, Modal, RefreshControl, Animated, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import GlassCard from '../../src/components/GlassCard';
import {
  routineService, Routine, RoutineAssessment,
  getLocalDateString, formatRoutineDate,
} from '../../src/services/routineService';

// ─── constants ───────────────────────────────────────────────────────────────

const ACTIVITY_TYPES = ['outdoor', 'indoor', 'commute'] as const;
const SENSITIVITY    = ['low', 'medium', 'high'] as const;

const RISK_CONFIG = {
  SAFE:    { color: '#4ADE80', bg: 'rgba(74,222,128,0.12)',   border: 'rgba(74,222,128,0.3)',   icon: 'checkmark-circle' as const },
  CAUTION: { color: '#FBBF24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)',   icon: 'warning'          as const },
  AVOID:   { color: '#F87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)',  icon: 'close-circle'     as const },
};

// 30-minute time slots 12:00 AM → 11:30 PM
const TIME_OPTIONS: string[] = (() => {
  const slots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const ampm = h < 12 ? 'AM' : 'PM';
      const dh   = h === 0 ? 12 : h > 12 ? h - 12 : h;
      slots.push(`${dh}:${String(m).padStart(2, '0')} ${ampm}`);
    }
  }
  return slots;
})();

// Next 14 days as { label, value: YYYY-MM-DD }
const DATE_OPTIONS: Array<{ label: string; value: string }> = (() => {
  const opts: Array<{ label: string; value: string }> = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = i === 0 ? 'Today'
      : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
    opts.push({ label, value });
  }
  return opts;
})();

// ─── main component ──────────────────────────────────────────────────────────

export default function RoutineScreen() {
  // data
  const [routines, setRoutines]         = useState<Routine[]>([]);
  const [assessments, setAssessments]   = useState<RoutineAssessment[]>([]);
  const [loadingAll, setLoadingAll]     = useState(true);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  // add-form
  const [showForm, setShowForm]       = useState(false);
  const [adding, setAdding]           = useState(false);
  const [activity, setActivity]       = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [type, setType]               = useState<typeof ACTIVITY_TYPES[number]>('outdoor');
  const [sensitivity, setSensitivity] = useState<typeof SENSITIVITY[number]>('medium');

  // time-picker modal
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  // reschedule bottom-sheet
  const [rescheduleModal, setRescheduleModal]     = useState(false);
  const [rescheduling, setRescheduling]           = useState(false);
  const [rescheduleResult, setRescheduleResult]   = useState<any>(null);
  const slideAnim = useRef(new Animated.Value(500)).current;

  const openSheet = (result: any) => {
    setRescheduleResult(result);
    setRescheduleModal(true);
    Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 180, useNativeDriver: true }).start();
  };
  const closeSheet = () => {
    Animated.timing(slideAnim, { toValue: 500, duration: 240, useNativeDriver: true })
      .start(() => { setRescheduleModal(false); setRescheduleResult(null); });
  };

  // ── fetchers ────────────────────────────────────────────────────────────────
  const fetchRoutines = useCallback(async () => {
    try   { setRoutines(await routineService.getRoutines()); }
    catch (e) { console.log('fetchRoutines', e); }
    finally   { setLoadingAll(false); }
  }, []);

  const fetchTodayCheck = useCallback(async () => {
    try   { const d = await routineService.getTodayCheck(); setAssessments(d.assessments || []); }
    catch (e) { console.log('todayCheck', e); }
    finally   { setLoadingCheck(false); }
  }, []);

  useEffect(() => { fetchRoutines(); fetchTodayCheck(); }, [fetchRoutines, fetchTodayCheck]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchRoutines(), fetchTodayCheck()]);
    setRefreshing(false);
  }, [fetchRoutines, fetchTodayCheck]);

  // ── add ─────────────────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!activity.trim()) { Alert.alert('Missing', 'Please enter an activity name.'); return; }
    if (!selectedTime)    { Alert.alert('Missing', 'Please select a time.'); return; }
    setAdding(true);
    try {
      await routineService.addRoutine({
        activity: activity.trim(),
        time: selectedTime,
        type,
        date: selectedDate,
        health_impact: sensitivity,
      });
      setActivity(''); setSelectedTime(''); setSelectedDate(getLocalDateString());
      setType('outdoor'); setSensitivity('medium');
      setShowForm(false);
      fetchRoutines();
      fetchTodayCheck();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not add routine.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    Alert.alert('Delete', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await routineService.deleteRoutine(id); fetchRoutines(); fetchTodayCheck(); }
        catch (e) { console.log('delete', e); }
      }},
    ]);
  }

  async function handleReschedule(routineId: string) {
    setRescheduling(true);
    try { openSheet(await routineService.aiReschedule(routineId)); }
    catch (e: any) { Alert.alert('Error', e.message || 'Could not get suggestion.'); }
    finally { setRescheduling(false); }
  }

  // ── render ──────────────────────────────────────────────────────────────────
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
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Routine Planner</Text>
                <Text style={styles.subtitle}>AI-powered daily schedule</Text>
              </View>
              <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
                <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            </View>

            {/* ══ SECTION 1 — Today's Check ══ */}
            <SectionHeader icon="today" color="#06B6D4" label="Today's Routine Check" />

            {loadingCheck ? (
              <GlassCard style={styles.loadingCard}>
                <ActivityIndicator color="#06B6D4" />
                <Text style={styles.loadingText}>Checking today's conditions…</Text>
              </GlassCard>
            ) : assessments.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <Ionicons name="sunny-outline" size={32} color="rgba(255,255,255,0.18)" />
                <Text style={styles.emptyCardTitle}>No routines for today</Text>
                <Text style={styles.emptyCardSub}>Add one below and we'll cross-check it with live AQI</Text>
              </GlassCard>
            ) : (
              assessments.map(a => <AssessmentCard key={a.routine_id} a={a} onReschedule={handleReschedule} rescheduling={rescheduling} />)
            )}

            {/* ══ SECTION 2 — My Routines ══ */}
            <SectionHeader icon="list" color="#4ADE80" label="My Routines" style={{ marginTop: 28 }} />

            {loadingAll ? (
              <ActivityIndicator color="#4ADE80" style={{ marginVertical: 20 }} />
            ) : routines.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={44} color="rgba(255,255,255,0.15)" />
                <Text style={styles.emptyText}>No routines yet</Text>
              </View>
            ) : (
              routines.map((r, i) => (
                <GlassCard key={r.routine_id} testID={`routine-item-${i}`} style={styles.routineCard}>
                  <View style={styles.routineRow}>
                    <View style={styles.routineInfo}>
                      <Text style={styles.routineTime}>{r.time}</Text>
                      <Text style={styles.routineActivity}>{r.activity}</Text>
                      <View style={styles.tagRow}>
                        <Tag
                          label={r.type}
                          color={r.type === 'outdoor' ? '#4ADE80' : '#06B6D4'}
                          bg={r.type === 'outdoor' ? 'rgba(74,222,128,0.1)' : 'rgba(6,182,212,0.1)'}
                        />
                        <Tag
                          label={`${r.health_impact} sensitivity`}
                          color={r.health_impact === 'high' ? '#F87171' : r.health_impact === 'medium' ? '#FBBF24' : '#4ADE80'}
                          bg={r.health_impact === 'high' ? 'rgba(248,113,113,0.08)' : r.health_impact === 'medium' ? 'rgba(251,191,36,0.08)' : 'rgba(74,222,128,0.07)'}
                        />
                      </View>
                      {r.date ? (
                        <View style={styles.dateChipSmall}>
                          <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.35)" />
                          <Text style={styles.dateChipSmallText}>{formatRoutineDate(r.date)}</Text>
                        </View>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      testID={`delete-routine-${i}`}
                      onPress={() => handleDelete(r.routine_id, r.activity)}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.28)" />
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              ))
            )}

            {/* Add button / form */}
            {showForm ? (
              <GlassCard testID="add-routine-form" style={styles.formCard}>
                <Text style={styles.formTitle}>New Routine</Text>

                {/* Activity name */}
                <Text style={styles.formLabel}>Activity</Text>
                <TextInput
                  testID="routine-activity-input"
                  style={styles.formInput}
                  placeholder="e.g. Morning Walk, Lunch, Cycling"
                  placeholderTextColor="rgba(255,255,255,0.28)"
                  value={activity}
                  onChangeText={setActivity}
                />

                {/* Time dropdown trigger */}
                <Text style={styles.formLabel}>Time</Text>
                <TouchableOpacity style={styles.pickerTrigger} onPress={() => setTimePickerOpen(true)}>
                  <Ionicons name="time-outline" size={16} color={selectedTime ? '#FFF' : 'rgba(255,255,255,0.3)'} />
                  <Text style={[styles.pickerTriggerText, !selectedTime && { color: 'rgba(255,255,255,0.28)' }]}>
                    {selectedTime || 'Select time'}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>

                {/* Date chips */}
                <Text style={styles.formLabel}>Date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                  {DATE_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.dateChip, selectedDate === opt.value && styles.dateChipActive]}
                      onPress={() => setSelectedDate(opt.value)}
                    >
                      <Text style={[styles.dateChipText, selectedDate === opt.value && styles.dateChipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Activity type */}
                <Text style={styles.formLabel}>Type</Text>
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

                {/* Health sensitivity */}
                <Text style={styles.formLabel}>Health Sensitivity</Text>
                <View style={styles.segRow}>
                  {SENSITIVITY.map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.segBtn, sensitivity === s && styles.segBtnSens]}
                      onPress={() => setSensitivity(s)}
                    >
                      <Text style={[styles.segText, sensitivity === s && styles.segTextSens]}>{s}</Text>
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
                      : <Text style={styles.saveBtnText}>Add Routine</Text>}
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ) : (
              <TouchableOpacity testID="show-add-routine-btn" style={styles.addBtn} onPress={() => setShowForm(true)}>
                <Ionicons name="add" size={22} color="#4ADE80" />
                <Text style={styles.addBtnText}>Add Routine</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* ── Time picker modal ── */}
      <Modal visible={timePickerOpen} transparent animationType="fade" onRequestClose={() => setTimePickerOpen(false)}>
        <TouchableOpacity style={styles.timeBackdrop} activeOpacity={1} onPress={() => setTimePickerOpen(false)} />
        <View style={styles.timeSheet}>
          <View style={styles.timeSheetHeader}>
            <Text style={styles.timeSheetTitle}>Select Time</Text>
            <TouchableOpacity onPress={() => setTimePickerOpen(false)}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={TIME_OPTIONS}
            keyExtractor={item => item}
            showsVerticalScrollIndicator={false}
            initialScrollIndex={Math.max(0, TIME_OPTIONS.indexOf(selectedTime))}
            getItemLayout={(_, index) => ({ length: 48, offset: 48 * index, index })}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.timeOption, item === selectedTime && styles.timeOptionActive]}
                onPress={() => { setSelectedTime(item); setTimePickerOpen(false); }}
              >
                <Text style={[styles.timeOptionText, item === selectedTime && styles.timeOptionTextActive]}>
                  {item}
                </Text>
                {item === selectedTime && <Ionicons name="checkmark" size={16} color="#4ADE80" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* ── Reschedule bottom sheet ── */}
      <Modal visible={rescheduleModal} transparent animationType="none" onRequestClose={closeSheet}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeSheet} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <Ionicons name="sparkles" size={18} color="#FBBF24" />
            <Text style={styles.sheetTitle}>AI Reschedule Suggestion</Text>
          </View>
          {rescheduleResult && (
            <>
              <View style={styles.sheetRow}>
                <Text style={styles.sheetLabel}>Original</Text>
                <Text style={styles.sheetVal}>{rescheduleResult.original_time}</Text>
              </View>
              <View style={[styles.sheetRow, styles.sheetHighlight]}>
                <Text style={styles.sheetLabel}>Suggested</Text>
                <Text style={[styles.sheetVal, { color: '#4ADE80', fontWeight: '700', fontSize: 18 }]}>
                  {rescheduleResult.suggested_time}
                </Text>
              </View>
              <View style={styles.confidenceRow}>
                <Ionicons
                  name={rescheduleResult.confidence === 'high' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={13}
                  color={rescheduleResult.confidence === 'high' ? '#4ADE80' : '#FBBF24'}
                />
                <Text style={styles.confidenceText}>{rescheduleResult.confidence} confidence</Text>
              </View>
              <Text style={styles.sheetReason}>{rescheduleResult.reason}</Text>
            </>
          )}
          <TouchableOpacity style={styles.sheetCloseBtn} onPress={closeSheet}>
            <Text style={styles.sheetCloseBtnText}>Got it</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </View>
  );
}

// ─── small sub-components ────────────────────────────────────────────────────

function SectionHeader({ icon, color, label, style }: { icon: any; color: string; label: string; style?: any }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }, style]}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF', letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </View>
  );
}

function Tag({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: bg }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color, textTransform: 'capitalize' }}>{label}</Text>
    </View>
  );
}

function AssessmentCard({ a, onReschedule, rescheduling }: {
  a: RoutineAssessment;
  onReschedule: (id: string) => void;
  rescheduling: boolean;
}) {
  const cfg = RISK_CONFIG[a.risk_level] ?? RISK_CONFIG.CAUTION;
  return (
    <GlassCard style={{ ...styles.assessCard, borderColor: cfg.border }} glowColor={cfg.color}>
      <View style={styles.assessTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.assessTime}>{a.scheduled_time}</Text>
          <Text style={styles.assessActivity}>{a.activity}</Text>
          <View style={styles.tagRow}>
            <Tag label={a.type} color="#06B6D4" bg="rgba(6,182,212,0.1)" />
          </View>
        </View>
        <View style={[styles.riskBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <Ionicons name={cfg.icon} size={13} color={cfg.color} />
          <Text style={[styles.riskLabel, { color: cfg.color }]}>{a.risk_level}</Text>
        </View>
      </View>

      <View style={styles.aqiRow}>
        <Text style={[styles.aqiVal, { color: cfg.color }]}>AQI {a.aqi}</Text>
        <Text style={styles.aqiPol}>· {a.dominant_pollutant}</Text>
      </View>

      <Text style={styles.reason}>{a.personalised_reason}</Text>

      {a.preventive_tip ? (
        <View style={styles.tipRow}>
          <Ionicons name="shield-checkmark-outline" size={12} color="#06B6D4" />
          <Text style={styles.tipText}>{a.preventive_tip}</Text>
        </View>
      ) : null}

      {a.best_time_window && a.risk_level !== 'SAFE' ? (
        <View style={styles.bestTimeRow}>
          <Ionicons name="time-outline" size={12} color="#FBBF24" />
          <Text style={styles.bestTimeText}>Best window: {a.best_time_window}</Text>
        </View>
      ) : null}

      {a.risk_level !== 'SAFE' && (
        <TouchableOpacity style={styles.rescheduleBtn} onPress={() => onReschedule(a.routine_id)} disabled={rescheduling}>
          {rescheduling
            ? <ActivityIndicator size="small" color="#FBBF24" />
            : <><Ionicons name="sparkles" size={13} color="#FBBF24" /><Text style={styles.rescheduleBtnText}>AI Reschedule</Text></>}
        </TouchableOpacity>
      )}
    </GlassCard>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  refreshBtn: { padding: 8 },

  loadingCard: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  emptyCard: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  emptyCardTitle: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  emptyCardSub: { fontSize: 12, color: 'rgba(255,255,255,0.22)', textAlign: 'center', maxWidth: 260 },

  // Assessment card
  assessCard: { marginBottom: 12, padding: 16 },
  assessTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  assessTime: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 },
  assessActivity: { fontSize: 18, fontWeight: '700', color: '#FFF', marginTop: 2 },
  riskBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  riskLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  aqiRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aqiVal: { fontSize: 14, fontWeight: '700' },
  aqiPol: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  reason: { fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 20, marginBottom: 8 },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 6 },
  tipText: { fontSize: 12, color: '#06B6D4', fontStyle: 'italic', flex: 1, lineHeight: 18 },
  bestTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  bestTimeText: { fontSize: 12, color: '#FBBF24', fontWeight: '600' },
  rescheduleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: 'rgba(251,191,36,0.1)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
  },
  rescheduleBtnText: { fontSize: 12, fontWeight: '600', color: '#FBBF24' },

  // Routine list
  routineCard: { marginBottom: 10, padding: 14 },
  routineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  routineInfo: { flex: 1 },
  routineTime: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 },
  routineActivity: { fontSize: 16, fontWeight: '700', color: '#FFF', marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  deleteBtn: { padding: 8 },
  dateChipSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  dateChipSmallText: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },

  emptyState: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.3)' },

  // Add form
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)', backgroundColor: 'rgba(74,222,128,0.07)', marginTop: 16,
  },
  addBtnText: { fontSize: 15, fontWeight: '600', color: '#4ADE80' },
  formCard: { marginTop: 16, padding: 18 },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 18 },
  formLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.38)',
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8, marginTop: 14,
  },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, height: 48,
    color: '#FFF', fontSize: 15,
  },

  // Time picker trigger
  pickerTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, height: 48,
  },
  pickerTriggerText: { flex: 1, color: '#FFF', fontSize: 15 },

  // Date chips
  dateScroll: { marginBottom: 4 },
  dateChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  dateChipActive: { backgroundColor: 'rgba(74,222,128,0.12)', borderColor: 'rgba(74,222,128,0.4)' },
  dateChipText: { fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  dateChipTextActive: { color: '#4ADE80' },

  // Segmented controls
  segRow: { flexDirection: 'row', gap: 8 },
  segBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  segBtnActive: { backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.35)' },
  segBtnSens: { backgroundColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.35)' },
  segText: { fontSize: 13, color: 'rgba(255,255,255,0.38)', fontWeight: '600', textTransform: 'capitalize' },
  segTextActive: { color: '#4ADE80', fontWeight: '700' },
  segTextSens: { color: '#FBBF24', fontWeight: '700' },

  formActions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)' },
  cancelText: { color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: '#4ADE80' },
  saveBtnText: { color: '#000', fontWeight: '700' },

  // Time picker modal
  timeBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  timeSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0C1825', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '60%', paddingBottom: 30,
  },
  timeSheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  timeSheetTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  timeOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, height: 48, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  timeOptionActive: { backgroundColor: 'rgba(74,222,128,0.08)' },
  timeOptionText: { fontSize: 16, color: 'rgba(255,255,255,0.6)' },
  timeOptionTextActive: { color: '#4ADE80', fontWeight: '700' },

  // Reschedule sheet
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0C1825', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', padding: 24, paddingBottom: 36,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 18 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  sheetRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sheetHighlight: { backgroundColor: 'rgba(74,222,128,0.06)', borderRadius: 10, paddingHorizontal: 10, marginVertical: 4 },
  sheetLabel: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  sheetVal: { fontSize: 15, color: '#FFF', fontWeight: '600' },
  confidenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 6 },
  confidenceText: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'capitalize' },
  sheetReason: { fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 22, marginBottom: 20 },
  sheetCloseBtn: { backgroundColor: '#4ADE80', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  sheetCloseBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
