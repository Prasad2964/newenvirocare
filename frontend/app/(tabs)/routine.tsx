import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../src/utils/api';
import GlassCard from '../../src/components/GlassCard';

const ACTIVITY_TYPES = ['outdoor', 'indoor', 'commute'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function RoutineScreen() {
  const [routines, setRoutines] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [checking, setChecking] = useState(false);
  const [activity, setActivity] = useState('');
  const [time, setTime] = useState('');
  const [type, setType] = useState('outdoor');
  const [showForm, setShowForm] = useState(false);

  const fetchRoutines = useCallback(async () => {
    try {
      const data = await api.get('/api/routines');
      setRoutines(data);
    } catch (e) {
      console.log('Fetch routines error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoutines(); }, [fetchRoutines]);

  async function addRoutine() {
    if (!activity.trim() || !time.trim()) {
      Alert.alert('Error', 'Please fill activity and time');
      return;
    }
    setAdding(true);
    try {
      await api.post('/api/routines', { activity: activity.trim(), time: time.trim(), type, days: DAYS });
      setActivity(''); setTime(''); setShowForm(false);
      fetchRoutines();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAdding(false);
    }
  }

  async function deleteRoutine(id: string) {
    try {
      await api.delete(`/api/routines/${id}`);
      fetchRoutines();
    } catch (e) {
      console.log('Delete error:', e);
    }
  }

  async function checkAI() {
    setChecking(true);
    try {
      const data = await api.post('/api/routines/ai-adjust', { city: 'Mumbai' });
      setAdjustments(data.adjustments || []);
      setAiSummary(data.ai_summary || '');
    } catch (e) {
      console.log('AI adjust error:', e);
    } finally {
      setChecking(false);
    }
  }

  return (
    <View testID="routine-screen" style={styles.container}>
      <LinearGradient colors={['#0A1A2B', '#000']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Routine Planner</Text>
                <Text style={styles.subtitle}>AI-optimized daily schedule</Text>
              </View>
              <TouchableOpacity testID="ai-check-btn" style={styles.aiBtn} onPress={checkAI} disabled={checking}>
                {checking ? <ActivityIndicator size="small" color="#FACC15" /> : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#FACC15" />
                    <Text style={styles.aiBtnText}>AI Check</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {aiSummary ? (
              <GlassCard testID="ai-summary-card" style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Ionicons name="sparkles" size={16} color="#FACC15" />
                  <Text style={styles.summaryTitle}>AI Summary</Text>
                </View>
                <Text style={styles.summaryText}>{aiSummary}</Text>
              </GlassCard>
            ) : null}

            {/* Timeline */}
            <View style={styles.timeline}>
              {(adjustments.length > 0 ? adjustments : routines).map((r, i) => {
                const isRisky = r.is_risky;
                const riskColor = r.risk_level === 'high' ? '#F87171' : r.risk_level === 'medium' ? '#FB923C' : '#4ADE80';
                return (
                  <View key={r.routine_id || i} style={styles.timelineItem}>
                    <View style={styles.timelineDot}>
                      <View style={[styles.dot, { backgroundColor: isRisky ? '#F87171' : '#4ADE80' }]} />
                      {i < (adjustments.length > 0 ? adjustments : routines).length - 1 && (
                        <View style={[styles.timelineLine, { backgroundColor: isRisky ? 'rgba(248,113,113,0.3)' : 'rgba(74,222,128,0.2)' }]} />
                      )}
                    </View>
                    <GlassCard testID={`routine-item-${i}`} style={[styles.routineCard, isRisky && styles.riskyCard]}>
                      <View style={styles.routineHeader}>
                        <View style={styles.routineInfo}>
                          <Text style={styles.routineTime}>{r.time}</Text>
                          <Text style={styles.routineActivity}>{r.activity}</Text>
                          <View style={styles.routineTags}>
                            <View style={[styles.tag, { backgroundColor: r.type === 'outdoor' ? 'rgba(74,222,128,0.15)' : 'rgba(6,182,212,0.15)' }]}>
                              <Text style={[styles.tagText, { color: r.type === 'outdoor' ? '#4ADE80' : '#06B6D4' }]}>
                                {r.type}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <TouchableOpacity testID={`delete-routine-${i}`} onPress={() => deleteRoutine(r.routine_id)} style={styles.deleteBtn}>
                          <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.3)" />
                        </TouchableOpacity>
                      </View>
                      {r.suggestion && (
                        <View style={styles.suggestionRow}>
                          <Ionicons name="sparkles" size={14} color="#FACC15" />
                          <Text style={styles.suggestionText}>{r.suggestion}</Text>
                        </View>
                      )}
                    </GlassCard>
                  </View>
                );
              })}
            </View>

            {routines.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={48} color="rgba(255,255,255,0.2)" />
                <Text style={styles.emptyText}>No routines yet</Text>
                <Text style={styles.emptySubtext}>Add your daily activities to get AI recommendations</Text>
              </View>
            )}

            {/* Add Form */}
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
                <View style={styles.typeRow}>
                  {ACTIVITY_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeBtn, type === t && styles.typeBtnActive]}
                      onPress={() => setType(t)}
                    >
                      <Text style={[styles.typeText, type === t && styles.typeTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="save-routine-btn" style={styles.saveBtn} onPress={addRoutine} disabled={adding}>
                    {adding ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Add Routine</Text>}
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ) : (
              <TouchableOpacity testID="show-add-routine-btn" style={styles.addBtn} onPress={() => setShowForm(true)}>
                <Ionicons name="add" size={24} color="#4ADE80" />
                <Text style={styles.addBtnText}>Add Routine</Text>
              </TouchableOpacity>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  aiBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(250,204,21,0.1)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(250,204,21,0.3)',
  },
  aiBtnText: { fontSize: 13, fontWeight: '600', color: '#FACC15' },
  summaryCard: { marginBottom: 20, borderColor: 'rgba(250,204,21,0.2)' },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  summaryTitle: { fontSize: 14, fontWeight: '700', color: '#FACC15' },
  summaryText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 22 },
  timeline: { marginLeft: 8 },
  timelineItem: { flexDirection: 'row', marginBottom: 4 },
  timelineDot: { alignItems: 'center', width: 24, paddingTop: 20 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  timelineLine: { width: 2, flex: 1, marginTop: 4 },
  routineCard: { flex: 1, marginLeft: 8, marginBottom: 8, padding: 16 },
  riskyCard: { borderColor: 'rgba(248,113,113,0.3)' },
  routineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  routineInfo: { flex: 1 },
  routineTime: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },
  routineActivity: { fontSize: 17, fontWeight: '700', color: '#FFF', marginTop: 4 },
  routineTags: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  deleteBtn: { padding: 8 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  suggestionText: { fontSize: 13, color: '#FACC15', flex: 1 },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.3)' },
  emptySubtext: { fontSize: 13, color: 'rgba(255,255,255,0.2)', textAlign: 'center' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
    backgroundColor: 'rgba(74,222,128,0.08)', marginTop: 16,
  },
  addBtnText: { fontSize: 15, fontWeight: '600', color: '#4ADE80' },
  formCard: { marginTop: 16 },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 16 },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, height: 48,
    color: '#FFF', fontSize: 15, marginBottom: 12,
  },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  typeBtnActive: { backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.3)' },
  typeText: { fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  typeTextActive: { color: '#4ADE80' },
  formActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)' },
  cancelText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16, backgroundColor: '#4ADE80' },
  saveBtnText: { color: '#000', fontWeight: '700' },
});
