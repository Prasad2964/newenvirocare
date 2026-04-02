import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../src/context/AuthContext';
import api from '../../src/utils/api';
import GlassCard from '../../src/components/GlassCard';

const COMMON_CONDITIONS = [
  'Asthma', 'COPD', 'Heart Disease', 'Diabetes', 'Hypertension',
  'Lung Disease', 'Bronchitis', 'Allergies', 'Pregnancy',
];

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [conditions, setConditions] = useState<string[]>([]);
  const [medications, setMedications] = useState('');
  const [allergies, setAllergies] = useState('');
  const [age, setAge] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomInput, setSymptomInput] = useState('');
  const [logSymptomMode, setLogSymptomMode] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<{conditions: string[], medications: string[], allergies: string[], notes: string} | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.get('/api/health-profile');
      setProfile(data);
      if (data.conditions?.length) setConditions(data.conditions);
      if (data.medications?.length) setMedications(data.medications.join(', '));
      if (data.allergies?.length) setAllergies(data.allergies.join(', '));
      if (data.age) setAge(String(data.age));
      if (data.blood_group) setBloodGroup(data.blood_group);
    } catch (e) {
      console.log('Fetch profile error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  function toggleCondition(c: string) {
    setConditions(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  async function saveProfile() {
    setSaving(true);
    try {
      await api.post('/api/health-profile', {
        conditions,
        medications: medications.split(',').map(m => m.trim()).filter(Boolean),
        allergies: allergies.split(',').map(a => a.trim()).filter(Boolean),
        age: age ? parseInt(age) : null,
        blood_group: bloodGroup || null,
      });
      Alert.alert('Saved', 'Health profile updated');
      setEditing(false);
      fetchProfile();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProfile() {
    Alert.alert('Delete Profile', 'Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete('/api/health-profile');
            setProfile(null);
            setConditions([]); setMedications(''); setAllergies('');
            setAge(''); setBloodGroup('');
            Alert.alert('Done', 'Health profile deleted');
          } catch (e) { console.log(e); }
        },
      },
    ]);
  }

  async function logSymptomEntry() {
    if (symptoms.length === 0) {
      Alert.alert('Error', 'Add at least one symptom');
      return;
    }
    try {
      await api.post('/api/symptoms', { symptoms, severity: 5 });
      Alert.alert('Logged', 'Symptoms recorded');
      setSymptoms([]); setLogSymptomMode(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  function addSymptom() {
    if (symptomInput.trim()) {
      setSymptoms([...symptoms, symptomInput.trim()]);
      setSymptomInput('');
    }
  }

  async function processOCR(imageBase64: string, mimeType: string = 'image/jpeg') {
    setOcrLoading(true);
    setOcrResult(null);
    try {
      const data = await api.post('/api/ocr/prescription', { image_base64: imageBase64, mime_type: mimeType });
      if (data.success && data.extracted) {
        setOcrResult({
          conditions: data.extracted.conditions || [],
          medications: data.extracted.medications || [],
          allergies: data.extracted.allergies || [],
          notes: data.extracted.notes || '',
        });
      }
    } catch (e: any) {
      Alert.alert('OCR Failed', e.message || 'Could not extract data from image');
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleUploadPrescription() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        await processOCR(result.assets[0].base64);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open gallery');
    }
  }

  async function handleCameraCapture() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to scan prescriptions');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        await processOCR(result.assets[0].base64);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open camera');
    }
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  async function handleDeleteAccount() {
    Alert.alert('Delete Account', 'This will permanently delete your account and all data. Are you sure?', [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await api.delete('/api/auth/account');
            await logout();
            router.replace('/login');
          } catch (e) { console.log(e); }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ADE80" />
      </View>
    );
  }

  return (
    <View testID="profile-screen" style={styles.container}>
      <LinearGradient colors={['#0A1520', '#000']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* User Card */}
            <GlassCard testID="user-card" style={styles.userCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
              </View>
              <Text style={styles.userName}>{user?.name || 'User'}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </GlassCard>

            {/* OCR Upload Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upload Prescription</Text>
            </View>
            <View style={styles.ocrRow}>
              <TouchableOpacity testID="upload-prescription-btn" style={styles.ocrBtn} onPress={handleUploadPrescription} disabled={ocrLoading}>
                <Ionicons name="image-outline" size={24} color="#06B6D4" />
                <Text style={styles.ocrBtnText}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="camera-prescription-btn" style={styles.ocrBtn} onPress={handleCameraCapture} disabled={ocrLoading}>
                <Ionicons name="camera-outline" size={24} color="#A78BFA" />
                <Text style={styles.ocrBtnText}>Camera</Text>
              </TouchableOpacity>
            </View>

            {ocrLoading && (
              <GlassCard style={{ alignItems: 'center', paddingVertical: 24 }}>
                <ActivityIndicator size="large" color="#4ADE80" />
                <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 12, fontSize: 14 }}>Scanning document with AI...</Text>
              </GlassCard>
            )}

            {ocrResult && !ocrLoading && (
              <GlassCard testID="ocr-result-card">
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ color: '#4ADE80', fontWeight: '700', fontSize: 16 }}>Extracted from Document</Text>
                  <TouchableOpacity onPress={() => setOcrResult(null)}>
                    <Ionicons name="close-circle" size={22} color="rgba(255,255,255,0.3)" />
                  </TouchableOpacity>
                </View>

                {ocrResult.conditions.length > 0 && (
                  <>
                    <Text style={styles.fieldLabel}>Conditions Found</Text>
                    <View style={styles.chipGrid}>
                      {ocrResult.conditions.map((c, i) => (
                        <View key={i} style={[styles.chip, { backgroundColor: 'rgba(6,182,212,0.12)', borderColor: 'rgba(6,182,212,0.3)' }]}>
                          <Text style={{ fontSize: 13, color: '#06B6D4', fontWeight: '600' }}>{c}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {ocrResult.medications.length > 0 && (
                  <>
                    <Text style={styles.fieldLabel}>Medications Found</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{ocrResult.medications.join(', ')}</Text>
                  </>
                )}

                {ocrResult.allergies.length > 0 && (
                  <>
                    <Text style={styles.fieldLabel}>Allergies Found</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>{ocrResult.allergies.join(', ')}</Text>
                  </>
                )}

                {ocrResult.notes ? (
                  <>
                    <Text style={styles.fieldLabel}>Notes</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{ocrResult.notes}</Text>
                  </>
                ) : null}

                {ocrResult.conditions.length === 0 && ocrResult.medications.length === 0 && (
                  <Text style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', paddingVertical: 8 }}>
                    No medical data could be extracted. Try a clearer image.
                  </Text>
                )}

                <TouchableOpacity
                  style={[styles.saveBtn, { marginTop: 16 }]}
                  onPress={() => {
                    const mergedConditions = [...new Set([...conditions, ...ocrResult.conditions])];
                    const mergedMeds = medications
                      ? medications + (ocrResult.medications.length ? ', ' + ocrResult.medications.join(', ') : '')
                      : ocrResult.medications.join(', ');
                    const mergedAllergies = allergies
                      ? allergies + (ocrResult.allergies.length ? ', ' + ocrResult.allergies.join(', ') : '')
                      : ocrResult.allergies.join(', ');
                    setConditions(mergedConditions);
                    setMedications(mergedMeds);
                    setAllergies(mergedAllergies);
                    setEditing(true);
                    setOcrResult(null);
                  }}
                >
                  <Text style={styles.saveBtnText}>Apply to Profile</Text>
                </TouchableOpacity>
              </GlassCard>
            )}

            {/* Health Profile */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Health Profile</Text>
              {!editing && (
                <TouchableOpacity testID="edit-profile-btn" onPress={() => setEditing(true)}>
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              )}
            </View>

            {editing ? (
              <GlassCard testID="health-edit-form">
                <Text style={styles.fieldLabel}>Medical Conditions</Text>
                <View style={styles.chipGrid}>
                  {COMMON_CONDITIONS.map(c => (
                    <TouchableOpacity
                      key={c}
                      testID={`condition-chip-${c.toLowerCase().replace(/\s/g, '-')}`}
                      style={[styles.chip, conditions.includes(c) && styles.chipActive]}
                      onPress={() => toggleCondition(c)}
                    >
                      <Text style={[styles.chipText, conditions.includes(c) && styles.chipTextActive]}>{c}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Age</Text>
                <TextInput testID="age-input" style={styles.formInput} value={age} onChangeText={setAge} keyboardType="numeric" placeholder="Enter age" placeholderTextColor="rgba(255,255,255,0.3)" />

                <Text style={styles.fieldLabel}>Blood Group</Text>
                <TextInput testID="blood-group-input" style={styles.formInput} value={bloodGroup} onChangeText={setBloodGroup} placeholder="e.g. O+" placeholderTextColor="rgba(255,255,255,0.3)" />

                <Text style={styles.fieldLabel}>Medications (comma separated)</Text>
                <TextInput testID="medications-input" style={styles.formInput} value={medications} onChangeText={setMedications} placeholder="e.g. Inhaler, Aspirin" placeholderTextColor="rgba(255,255,255,0.3)" />

                <Text style={styles.fieldLabel}>Allergies (comma separated)</Text>
                <TextInput testID="allergies-input" style={styles.formInput} value={allergies} onChangeText={setAllergies} placeholder="e.g. Pollen, Dust" placeholderTextColor="rgba(255,255,255,0.3)" />

                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="save-profile-btn" style={styles.saveBtn} onPress={saveProfile} disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Save</Text>}
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ) : (
              <GlassCard testID="health-profile-view">
                {conditions.length > 0 ? (
                  <>
                    <Text style={styles.fieldLabel}>Conditions</Text>
                    <View style={styles.chipGrid}>
                      {conditions.map(c => (
                        <View key={c} style={[styles.chip, styles.chipActive]}>
                          <Text style={styles.chipTextActive}>{c}</Text>
                        </View>
                      ))}
                    </View>
                    {age ? <><Text style={styles.fieldLabel}>Age</Text><Text style={styles.fieldValue}>{age}</Text></> : null}
                    {bloodGroup ? <><Text style={styles.fieldLabel}>Blood Group</Text><Text style={styles.fieldValue}>{bloodGroup}</Text></> : null}
                  </>
                ) : (
                  <View style={styles.noProfile}>
                    <Ionicons name="heart-outline" size={32} color="rgba(255,255,255,0.2)" />
                    <Text style={styles.noProfileText}>No health data added yet</Text>
                    <Text style={styles.noProfileSub}>Add your medical conditions for personalized risk assessment</Text>
                  </View>
                )}
              </GlassCard>
            )}

            {/* Symptom Logging */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Log Symptoms</Text>
            </View>
            {logSymptomMode ? (
              <GlassCard testID="symptom-log-form">
                <View style={styles.symptomInputRow}>
                  <TextInput
                    testID="symptom-input"
                    style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                    value={symptomInput}
                    onChangeText={setSymptomInput}
                    placeholder="e.g. Headache, Dry eyes"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    onSubmitEditing={addSymptom}
                  />
                  <TouchableOpacity testID="add-symptom-btn" style={styles.addSymBtn} onPress={addSymptom}>
                    <Ionicons name="add" size={20} color="#4ADE80" />
                  </TouchableOpacity>
                </View>
                <View style={styles.chipGrid}>
                  {symptoms.map((s, i) => (
                    <View key={i} style={[styles.chip, styles.chipActive]}>
                      <Text style={styles.chipTextActive}>{s}</Text>
                      <TouchableOpacity onPress={() => setSymptoms(symptoms.filter((_, j) => j !== i))}>
                        <Ionicons name="close" size={14} color="#4ADE80" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setLogSymptomMode(false); setSymptoms([]); }}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID="submit-symptoms-btn" style={styles.saveBtn} onPress={logSymptomEntry}>
                    <Text style={styles.saveBtnText}>Log Symptoms</Text>
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ) : (
              <TouchableOpacity testID="open-symptom-log-btn" style={styles.logBtn} onPress={() => setLogSymptomMode(true)}>
                <Ionicons name="pulse" size={20} color="#06B6D4" />
                <Text style={styles.logBtnText}>Log New Symptoms</Text>
              </TouchableOpacity>
            )}

            {/* Actions */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Account</Text>
            </View>
            <GlassCard>
              <TouchableOpacity testID="open-settings-btn" style={styles.actionRow} onPress={() => router.push('/settings')}>
                <Ionicons name="settings-outline" size={20} color="#4ADE80" />
                <Text style={[styles.actionText, { color: '#4ADE80' }]}>Settings</Text>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.2)" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
              <View style={styles.actionDivider} />
              <TouchableOpacity testID="delete-profile-btn" style={styles.actionRow} onPress={deleteProfile}>
                <Ionicons name="trash-outline" size={20} color="#FB923C" />
                <Text style={[styles.actionText, { color: '#FB923C' }]}>Delete Health Profile</Text>
              </TouchableOpacity>
              <View style={styles.actionDivider} />
              <TouchableOpacity testID="delete-account-btn" style={styles.actionRow} onPress={handleDeleteAccount}>
                <Ionicons name="person-remove-outline" size={20} color="#F87171" />
                <Text style={[styles.actionText, { color: '#F87171' }]}>Delete Account</Text>
              </TouchableOpacity>
              <View style={styles.actionDivider} />
              <TouchableOpacity testID="logout-btn" style={styles.actionRow} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.5)" />
                <Text style={styles.actionText}>Logout</Text>
              </TouchableOpacity>
            </GlassCard>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  loadingContainer: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  userCard: { alignItems: 'center', marginBottom: 24, paddingVertical: 28 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(74,222,128,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#4ADE80' },
  userName: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  userEmail: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  editLink: { fontSize: 14, fontWeight: '600', color: '#4ADE80' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 12 },
  fieldValue: { fontSize: 16, color: '#FFF', fontWeight: '500' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: { backgroundColor: 'rgba(74,222,128,0.12)', borderColor: 'rgba(74,222,128,0.3)' },
  chipText: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  chipTextActive: { fontSize: 13, color: '#4ADE80', fontWeight: '600' },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, height: 48,
    color: '#FFF', fontSize: 15, marginBottom: 8,
  },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)' },
  cancelText: { color: 'rgba(255,255,255,0.5)', fontWeight: '600' },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16, backgroundColor: '#4ADE80' },
  saveBtnText: { color: '#000', fontWeight: '700' },
  noProfile: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  noProfileText: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.3)' },
  noProfileSub: { fontSize: 13, color: 'rgba(255,255,255,0.2)', textAlign: 'center' },
  symptomInputRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  addSymBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(74,222,128,0.1)', alignItems: 'center', justifyContent: 'center' },
  logBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(6,182,212,0.3)',
    backgroundColor: 'rgba(6,182,212,0.08)',
  },
  logBtnText: { fontSize: 15, fontWeight: '600', color: '#06B6D4' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  actionText: { fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: '500' },
  actionDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  ocrRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  ocrBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 20, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  ocrBtnText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
});
