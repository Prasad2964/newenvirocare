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

const DISEASE_SUGGESTIONS = [
  'Eczema', 'Psoriasis', 'Rhinitis', 'Sinusitis', 'Sleep Apnea',
  'Anxiety', 'Depression', 'Migraine', 'Arthritis', 'Osteoporosis',
  'Thyroid Disorder', 'Obesity', 'Anemia', 'Kidney Disease', 'Liver Disease',
  'Epilepsy', 'Multiple Sclerosis', 'Parkinson\'s Disease', 'Stroke', 'Atrial Fibrillation',
  'Chronic Fatigue Syndrome', 'Fibromyalgia', 'Lupus', 'Celiac Disease', 'Crohn\'s Disease',
  'Ulcerative Colitis', 'Irritable Bowel Syndrome', 'Gastroesophageal Reflux', 'Peptic Ulcer',
  'Polycystic Ovary Syndrome', 'Endometriosis', 'Menopause', 'Gout', 'Sickle Cell Disease',
  'Thalassemia', 'Hemophilia', 'Deep Vein Thrombosis', 'Pulmonary Embolism', 'Peripheral Artery Disease',
  'Cardiomyopathy', 'Heart Failure', 'Angina', 'Pericarditis', 'Myocarditis',
  'Glaucoma', 'Cataracts', 'Macular Degeneration', 'Diabetic Retinopathy', 'Hearing Loss',
  'Tinnitus', 'Vertigo', 'Chronic Sinusitis', 'Nasal Polyps', 'Vocal Cord Dysfunction',
  'Interstitial Lung Disease', 'Pulmonary Fibrosis', 'Sarcoidosis', 'Pleural Effusion',
  'Pneumonia', 'Tuberculosis', 'Hyperlipidemia', 'Metabolic Syndrome',
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const COMMON_MEDICATIONS = [
  'Inhaler', 'Ventolin', 'Seretide', 'Symbicort', 'Montelukast',
  'Cetirizine', 'Fexofenadine', 'Loratadine', 'Paracetamol', 'Ibuprofen',
  'Aspirin', 'Metformin', 'Insulin', 'Atorvastatin', 'Amlodipine',
  'Lisinopril', 'Metoprolol', 'Omeprazole', 'Pantoprazole', 'Ranitidine',
  'Amoxicillin', 'Azithromycin', 'Ciprofloxacin', 'Doxycycline', 'Prednisolone',
  'Dexamethasone', 'Levothyroxine', 'Methotrexate', 'Hydroxychloroquine',
  'Warfarin', 'Clopidogrel', 'Salbutamol', 'Budesonide', 'Fluticasone',
  'Tiotropium', 'Ipratropium', 'Theophylline', 'Aminophylline',
];

const COMMON_ALLERGENS = [
  'Pollen', 'Dust Mites', 'Pet Dander', 'Mold', 'Cockroaches',
  'Peanuts', 'Tree Nuts', 'Shellfish', 'Fish', 'Milk',
  'Eggs', 'Wheat', 'Soy', 'Latex', 'Penicillin',
  'Aspirin', 'Ibuprofen', 'Sulfa Drugs', 'Insect Stings', 'Grass Pollen',
  'Tree Pollen', 'Ragweed', 'Cat Hair', 'Dog Hair', 'Mold Spores',
  'Nickel', 'Fragrance', 'Chlorine', 'Formaldehyde', 'Gluten',
];

function getSeverityColor(n: number) {
  if (n <= 3) return '#4ADE80';
  if (n <= 6) return '#FBBF24';
  return '#F87171';
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [conditions, setConditions] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [age, setAge] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [symptomInput, setSymptomInput] = useState('');
  const [logSymptomMode, setLogSymptomMode] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<{conditions: string[], medications: string[], allergies: string[], notes: string} | null>(null);
  const [symptomSaving, setSymptomSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [originalProfile, setOriginalProfile] = useState<any>(null);
  const [loggedSymptoms, setLoggedSymptoms] = useState<any[]>([]);
  const [ocrApplied, setOcrApplied] = useState(false);
  const [severity, setSeverity] = useState(5);
  const [customConditionInput, setCustomConditionInput] = useState('');
  const [showConditionDropdown, setShowConditionDropdown] = useState(false);
  const [medicationInput, setMedicationInput] = useState('');
  const [showMedicationDropdown, setShowMedicationDropdown] = useState(false);
  const [allergyInput, setAllergyInput] = useState('');
  const [showAllergyDropdown, setShowAllergyDropdown] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [insights, setInsights] = useState<any[]>([]);
  const [insightsMessage, setInsightsMessage] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      const data = await api.get('/api/health-profile');
      setProfile(data);
      const snap = {
        conditions: data.conditions || [],
        medications: data.medications || [],
        allergies: data.allergies || [],
        age: data.age ? String(data.age) : '',
        bloodGroup: data.blood_group || '',
      };
      setOriginalProfile(snap);
      setConditions(snap.conditions);
      setMedications(snap.medications);
      setAllergies(snap.allergies);
      setAge(snap.age);
      setBloodGroup(snap.bloodGroup);
      if (data.photo_url) setPhotoUrl(data.photo_url);
    } catch (e) {
      console.log('Fetch profile error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSymptoms = useCallback(async () => {
    try {
      const data = await api.get('/api/symptoms');
      setLoggedSymptoms(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log('Fetch symptoms error:', e);
    }
  }, []);

  const fetchInsights = useCallback(async () => {
    try {
      const data = await api.get('/api/symptoms/insights');
      if (data.has_data) {
        setInsights(data.insights || []);
        setInsightsMessage('');
      } else {
        setInsights([]);
        setInsightsMessage(data.message || '');
      }
    } catch (e) {
      console.log('Fetch insights error:', e);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchSymptoms();
    fetchInsights();
  }, [fetchProfile, fetchSymptoms, fetchInsights]);

  function getCompleteness() {
    let score = 0;
    if (conditions.length > 0) score += 20;
    if (age) score += 20;
    if (bloodGroup) score += 20;
    if (medications.length > 0) score += 20;
    if (allergies.length > 0) score += 20;
    return score;
  }

  function getMissingFields() {
    const missing: string[] = [];
    if (conditions.length === 0) missing.push('conditions');
    if (!age) missing.push('age');
    if (!bloodGroup) missing.push('blood group');
    if (medications.length === 0) missing.push('medications');
    if (allergies.length === 0) missing.push('allergies');
    return missing;
  }

  function toggleCondition(c: string) {
    setConditions(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  function addCustomCondition() {
    const trimmed = customConditionInput.trim();
    if (!trimmed || conditions.includes(trimmed)) return;
    setConditions(prev => [...prev, trimmed]);
    setCustomConditionInput('');
    setEditing(true);
  }

  function addMedication(med?: string) {
    const trimmed = (med ?? medicationInput).trim();
    if (!trimmed || medications.includes(trimmed)) return;
    setMedications(prev => [...prev, trimmed]);
    setMedicationInput('');
    setShowMedicationDropdown(false);
    setEditing(true);
  }

  function removeMedication(med: string) {
    setMedications(prev => prev.filter(m => m !== med));
    setEditing(true);
  }

  function addAllergy(al?: string) {
    const trimmed = (al ?? allergyInput).trim();
    if (!trimmed || allergies.includes(trimmed)) return;
    setAllergies(prev => [...prev, trimmed]);
    setAllergyInput('');
    setShowAllergyDropdown(false);
    setEditing(true);
  }

  function removeAllergy(al: string) {
    setAllergies(prev => prev.filter(a => a !== al));
    setEditing(true);
  }

  async function handlePhotoUpload() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64) {
        setPhotoLoading(true);
        const data = await api.post('/api/profile/photo', {
          image_base64: result.assets[0].base64,
          mime_type: 'image/jpeg',
        });
        setPhotoUrl(data.photo_url);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not upload photo');
    } finally {
      setPhotoLoading(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    try {
      await api.post('/api/health-profile', {
        conditions,
        medications,
        allergies,
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

  function cancelEdit() {
    if (originalProfile) {
      setConditions(originalProfile.conditions);
      setMedications(originalProfile.medications);
      setAllergies(originalProfile.allergies);
      setAge(originalProfile.age);
      setBloodGroup(originalProfile.bloodGroup);
    }
    setEditing(false);
  }

  async function confirmDeleteProfile() {
    setDeleting(true);
    try {
      await api.delete('/api/health-profile');
      setProfile(null);
      setOriginalProfile(null);
      setConditions([]); setMedications([]); setAllergies([]);
      setAge(''); setBloodGroup('');
      setEditing(false);
      setShowDeleteConfirm(false);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  async function logSymptomEntry() {
    if (symptoms.length === 0) {
      Alert.alert('Error', 'Add at least one symptom');
      return;
    }
    setSymptomSaving(true);
    try {
      await api.post('/api/symptoms', { symptoms, severity });
      Alert.alert('Logged', 'Symptoms recorded successfully');
      setSymptoms([]);
      setSymptomInput('');
      setSeverity(5);
      setLogSymptomMode(false);
      fetchSymptoms();
      fetchInsights();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to log symptoms. Please try again.');
    } finally {
      setSymptomSaving(false);
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

  const completeness = getCompleteness();
  const missingFields = getMissingFields();

  return (
    <View testID="profile-screen" style={styles.container}>
      <LinearGradient colors={['#0A1520', '#000']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* User Card */}
            <GlassCard testID="user-card" style={styles.userCard}>
              <TouchableOpacity onPress={handlePhotoUpload} disabled={photoLoading} style={styles.avatarWrapper}>
                {photoLoading ? (
                  <View style={styles.avatar}><ActivityIndicator size="small" color="#4ADE80" /></View>
                ) : photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.avatarPhoto} />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
                  </View>
                )}
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={12} color="#000" />
                </View>
              </TouchableOpacity>
              <Text style={styles.userName}>{user?.name || 'User'}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </GlassCard>

            {/* Health Completeness Card */}
            <GlassCard style={styles.completenessCard}>
              <View style={styles.completenessHeader}>
                <Text style={styles.completenessTitle}>Profile Completeness</Text>
                <Text style={[styles.completenessPercent, { color: completeness === 100 ? '#4ADE80' : '#FBBF24' }]}>{completeness}%</Text>
              </View>
              <View style={styles.completenessBar}>
                <View style={[styles.completenessFill, {
                  width: `${completeness}%` as any,
                  backgroundColor: completeness === 100 ? '#4ADE80' : '#FBBF24',
                }]} />
              </View>
              {missingFields.length > 0 && (
                <Text style={styles.completenessHint}>Add your {missingFields.slice(0, 2).join(' & ')} to complete your profile</Text>
              )}
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
                    const mergedMeds = [...new Set([...medications, ...ocrResult.medications])];
                    const mergedAllergies = [...new Set([...allergies, ...ocrResult.allergies])];
                    setConditions(mergedConditions);
                    setMedications(mergedMeds);
                    setAllergies(mergedAllergies);
                    setEditing(true);
                    setOcrApplied(true);
                    setOcrResult(null);
                  }}
                >
                  <Text style={styles.saveBtnText}>Apply & Edit Profile</Text>
                </TouchableOpacity>
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                  You can fill in age, blood group and other details after applying
                </Text>
              </GlassCard>
            )}

            {/* Health Profile */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Health Profile</Text>
              {editing && (
                <TouchableOpacity testID="cancel-edit-btn" onPress={cancelEdit}>
                  <Text style={[styles.editLink, { color: '#F87171' }]}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>

            {ocrApplied && (
              <View style={styles.ocrBanner}>
                <Ionicons name="checkmark-circle" size={18} color="#4ADE80" />
                <Text style={styles.ocrBannerText}>OCR data applied — review below and fill in missing details like age and blood group, then save.</Text>
                <TouchableOpacity onPress={() => setOcrApplied(false)}>
                  <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            )}

            <GlassCard testID="health-edit-form">
              <Text style={styles.fieldLabel}>Medical Conditions</Text>
              <View style={styles.chipGrid}>
                {COMMON_CONDITIONS.map(c => (
                  <TouchableOpacity
                    key={c}
                    testID={`condition-chip-${c.toLowerCase().replace(/\s/g, '-')}`}
                    style={[styles.chip, conditions.includes(c) && styles.chipActive]}
                    onPress={() => { toggleCondition(c); setEditing(true); }}
                  >
                    <Text style={[styles.chipText, conditions.includes(c) && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
                {conditions.filter(c => !COMMON_CONDITIONS.includes(c)).map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, styles.chipActive]}
                    onPress={() => { toggleCondition(c); setEditing(true); }}
                  >
                    <Text style={styles.chipTextActive}>{c}</Text>
                    <Ionicons name="close" size={12} color="#4ADE80" />
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.customConditionRow}>
                <TextInput
                  style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                  value={customConditionInput}
                  onChangeText={(t) => { setCustomConditionInput(t); setShowConditionDropdown(t.length > 0); }}
                  onFocus={() => setShowConditionDropdown(customConditionInput.length > 0)}
                  onBlur={() => setTimeout(() => setShowConditionDropdown(false), 150)}
                  placeholder="Search or type a condition..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  onSubmitEditing={addCustomCondition}
                />
                <TouchableOpacity style={styles.addSymBtn} onPress={addCustomCondition}>
                  <Ionicons name="add" size={20} color="#4ADE80" />
                </TouchableOpacity>
              </View>
              {showConditionDropdown && (() => {
                const query = customConditionInput.toLowerCase();
                const filtered = [...COMMON_CONDITIONS, ...DISEASE_SUGGESTIONS]
                  .filter(d => d.toLowerCase().includes(query) && !conditions.includes(d))
                  .slice(0, 6);
                return filtered.length > 0 ? (
                  <View style={styles.dropdown}>
                    {filtered.map((d, i) => (
                      <TouchableOpacity
                        key={d}
                        style={[styles.dropdownItem, i < filtered.length - 1 && styles.dropdownDivider]}
                        onPress={() => { setConditions(prev => [...prev, d]); setCustomConditionInput(''); setShowConditionDropdown(false); setEditing(true); }}
                      >
                        <Ionicons name="add-circle-outline" size={16} color="rgba(74,222,128,0.6)" />
                        <Text style={styles.dropdownText}>{d}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null;
              })()}

              <Text style={styles.fieldLabel}>Age</Text>
              <TextInput
                testID="age-input"
                style={styles.formInput}
                value={age}
                onChangeText={(t) => { setAge(t); setEditing(true); }}
                keyboardType="numeric"
                placeholder="Enter age"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />

              {/* Blood Group — chip selector */}
              <Text style={styles.fieldLabel}>Blood Group</Text>
              <View style={styles.bloodGroupRow}>
                {BLOOD_GROUPS.map(bg => (
                  <TouchableOpacity
                    key={bg}
                    testID={`blood-group-${bg}`}
                    style={[styles.bloodGroupChip, bloodGroup === bg && styles.bloodGroupChipActive]}
                    onPress={() => { setBloodGroup(bloodGroup === bg ? '' : bg); setEditing(true); }}
                  >
                    <Text style={[styles.bloodGroupText, bloodGroup === bg && styles.bloodGroupTextActive]}>{bg}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Medications — chip + searchable dropdown */}
              <Text style={styles.fieldLabel}>Medications</Text>
              {medications.length > 0 && (
                <View style={[styles.chipGrid, { marginBottom: 8 }]}>
                  {medications.map((m, i) => (
                    <View key={i} style={[styles.chip, styles.chipActive]}>
                      <Text style={styles.chipTextActive}>{m}</Text>
                      <TouchableOpacity onPress={() => removeMedication(m)}>
                        <Ionicons name="close" size={12} color="#4ADE80" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.customConditionRow}>
                <TextInput
                  testID="medications-input"
                  style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                  value={medicationInput}
                  onChangeText={(t) => { setMedicationInput(t); setShowMedicationDropdown(t.length > 0); }}
                  onFocus={() => setShowMedicationDropdown(medicationInput.length > 0)}
                  onBlur={() => setTimeout(() => setShowMedicationDropdown(false), 150)}
                  placeholder="Search or type a medication..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  onSubmitEditing={() => addMedication()}
                />
                <TouchableOpacity style={styles.addSymBtn} onPress={() => addMedication()}>
                  <Ionicons name="add" size={20} color="#4ADE80" />
                </TouchableOpacity>
              </View>
              {showMedicationDropdown && (() => {
                const query = medicationInput.toLowerCase();
                const filtered = COMMON_MEDICATIONS
                  .filter(m => m.toLowerCase().includes(query) && !medications.includes(m))
                  .slice(0, 6);
                return filtered.length > 0 ? (
                  <View style={styles.dropdown}>
                    {filtered.map((m, i) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.dropdownItem, i < filtered.length - 1 && styles.dropdownDivider]}
                        onPress={() => addMedication(m)}
                      >
                        <Ionicons name="add-circle-outline" size={16} color="rgba(74,222,128,0.6)" />
                        <Text style={styles.dropdownText}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null;
              })()}

              {/* Allergies — chip + searchable dropdown */}
              <Text style={styles.fieldLabel}>Allergies</Text>
              {allergies.length > 0 && (
                <View style={[styles.chipGrid, { marginBottom: 8 }]}>
                  {allergies.map((a, i) => (
                    <View key={i} style={[styles.chip, { backgroundColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.25)' }]}>
                      <Text style={{ fontSize: 13, color: '#FBBF24', fontWeight: '600' }}>{a}</Text>
                      <TouchableOpacity onPress={() => removeAllergy(a)}>
                        <Ionicons name="close" size={12} color="#FBBF24" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.customConditionRow}>
                <TextInput
                  testID="allergies-input"
                  style={[styles.formInput, { flex: 1, marginBottom: 0 }]}
                  value={allergyInput}
                  onChangeText={(t) => { setAllergyInput(t); setShowAllergyDropdown(t.length > 0); }}
                  onFocus={() => setShowAllergyDropdown(allergyInput.length > 0)}
                  onBlur={() => setTimeout(() => setShowAllergyDropdown(false), 150)}
                  placeholder="Search or type an allergen..."
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  onSubmitEditing={() => addAllergy()}
                />
                <TouchableOpacity style={[styles.addSymBtn, { backgroundColor: 'rgba(251,191,36,0.1)' }]} onPress={() => addAllergy()}>
                  <Ionicons name="add" size={20} color="#FBBF24" />
                </TouchableOpacity>
              </View>
              {showAllergyDropdown && (() => {
                const query = allergyInput.toLowerCase();
                const filtered = COMMON_ALLERGENS
                  .filter(a => a.toLowerCase().includes(query) && !allergies.includes(a))
                  .slice(0, 6);
                return filtered.length > 0 ? (
                  <View style={[styles.dropdown, { borderColor: 'rgba(251,191,36,0.2)' }]}>
                    {filtered.map((a, i) => (
                      <TouchableOpacity
                        key={a}
                        style={[styles.dropdownItem, i < filtered.length - 1 && styles.dropdownDivider]}
                        onPress={() => addAllergy(a)}
                      >
                        <Ionicons name="add-circle-outline" size={16} color="rgba(251,191,36,0.6)" />
                        <Text style={styles.dropdownText}>{a}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null;
              })()}

              <TouchableOpacity
                testID="save-profile-btn"
                style={[styles.saveBtn, { marginTop: 16, opacity: saving ? 0.6 : 1 }]}
                onPress={saveProfile}
                disabled={saving}
              >
                {saving ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveBtnText}>Save Profile</Text>}
              </TouchableOpacity>

              {conditions.length === 0 && !age && !bloodGroup && medications.length === 0 && allergies.length === 0 && (
                <View style={[styles.noProfile, { marginTop: 12 }]}>
                  <Ionicons name="heart-outline" size={28} color="rgba(255,255,255,0.15)" />
                  <Text style={styles.noProfileText}>No health data yet</Text>
                  <Text style={styles.noProfileSub}>Fill in fields above or scan a prescription</Text>
                </View>
              )}
            </GlassCard>

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

                <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Severity</Text>
                <View style={styles.severityRow}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setSeverity(n)}
                      style={[
                        styles.severityBtn,
                        severity === n && { borderColor: getSeverityColor(n), backgroundColor: getSeverityColor(n) + '22' },
                      ]}
                    >
                      <Text style={[styles.severityBtnText, severity === n && { color: getSeverityColor(n), fontWeight: '700' }]}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.severityLabel}>
                  {severity <= 3 ? 'Mild' : severity <= 6 ? 'Moderate' : 'Severe'}
                </Text>

                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => { setLogSymptomMode(false); setSymptoms([]); setSymptomInput(''); setSeverity(5); }}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="submit-symptoms-btn"
                    style={[styles.saveBtn, { opacity: symptomSaving ? 0.6 : 1 }]}
                    onPress={logSymptomEntry}
                    disabled={symptomSaving}
                  >
                    {symptomSaving
                      ? <ActivityIndicator size="small" color="#000" />
                      : <Text style={styles.saveBtnText}>Log Symptoms</Text>
                    }
                  </TouchableOpacity>
                </View>
              </GlassCard>
            ) : (
              <TouchableOpacity testID="open-symptom-log-btn" style={styles.logBtn} onPress={() => setLogSymptomMode(true)}>
                <Ionicons name="pulse" size={20} color="#06B6D4" />
                <Text style={styles.logBtnText}>Log New Symptoms</Text>
              </TouchableOpacity>
            )}

            {/* Symptom History */}
            {loggedSymptoms.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Symptom History</Text>
                  <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>Last {Math.min(loggedSymptoms.length, 10)}</Text>
                </View>
                {loggedSymptoms.slice(0, 10).map((entry, i) => {
                  const date = entry.logged_at ? new Date(entry.logged_at) : null;
                  const dateStr = date ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
                  const timeStr = date ? date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
                  const sev = entry.severity ?? 5;
                  return (
                    <GlassCard key={entry.symptom_id || i} style={styles.symptomHistoryCard}>
                      <View style={styles.symptomHistoryHeader}>
                        <View style={styles.symptomHistoryMeta}>
                          <Ionicons name="pulse" size={14} color="#06B6D4" />
                          <Text style={styles.symptomHistoryDate}>{dateStr}</Text>
                          <Text style={styles.symptomHistoryTime}>{timeStr}</Text>
                        </View>
                        <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(sev) + '22', borderColor: getSeverityColor(sev) + '55' }]}>
                          <Text style={[styles.severityText, { color: getSeverityColor(sev) }]}>Sev {sev}/10</Text>
                        </View>
                      </View>
                      <View style={[styles.chipGrid, { marginTop: 8 }]}>
                        {(entry.symptoms || []).map((s: string, j: number) => (
                          <View key={j} style={styles.symptomTag}>
                            <Text style={styles.symptomTagText}>{s}</Text>
                          </View>
                        ))}
                      </View>
                      {entry.notes ? <Text style={styles.symptomNotes}>{entry.notes}</Text> : null}
                    </GlassCard>
                  );
                })}
              </>
            )}

            {/* Symptom Insights */}
            {(insights.length > 0 || insightsMessage) && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Symptom Insights</Text>
                </View>
                {insightsMessage ? (
                  <GlassCard style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <Ionicons name="analytics-outline" size={28} color="rgba(255,255,255,0.2)" />
                    <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 8, fontSize: 14, textAlign: 'center' }}>{insightsMessage}</Text>
                  </GlassCard>
                ) : insights.map((ins, i) => (
                  <GlassCard key={i} style={styles.insightCard}>
                    <View style={styles.insightHeader}>
                      <Ionicons name="analytics" size={16} color="#A78BFA" />
                      <Text style={styles.insightSymptom}>{ins.symptom}</Text>
                      <View style={styles.insightBadge}>
                        <Text style={styles.insightBadgeText}>{ins.occurrences}x</Text>
                      </View>
                    </View>
                    <Text style={styles.insightText}>{ins.insight}</Text>
                    <Text style={styles.insightAqi}>Avg AQI when reported: {ins.avg_aqi_when_reported}</Text>
                  </GlassCard>
                ))}
              </>
            )}

            {/* Account */}
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
              {showDeleteConfirm ? (
                <View style={{ paddingVertical: 12 }}>
                  <Text style={{ color: '#FB923C', fontSize: 14, fontWeight: '600', marginBottom: 10 }}>
                    Delete all health data? This cannot be undone.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setShowDeleteConfirm(false)} disabled={deleting}>
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID="confirm-delete-profile-btn"
                      style={[styles.saveBtn, { flex: 1, backgroundColor: '#FB923C', opacity: deleting ? 0.6 : 1 }]}
                      onPress={confirmDeleteProfile}
                      disabled={deleting}
                    >
                      {deleting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={[styles.saveBtnText, { color: '#fff' }]}>Yes, Delete</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity testID="delete-profile-btn" style={styles.actionRow} onPress={() => setShowDeleteConfirm(true)}>
                  <Ionicons name="trash-outline" size={20} color="#FB923C" />
                  <Text style={[styles.actionText, { color: '#FB923C' }]}>Delete Health Profile</Text>
                </TouchableOpacity>
              )}
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
  userCard: { alignItems: 'center', marginBottom: 16, paddingVertical: 28 },
  avatarWrapper: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(74,222,128,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarPhoto: { width: 72, height: 72, borderRadius: 36 },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#4ADE80', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#000',
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#4ADE80' },
  userName: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  userEmail: { fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  completenessCard: { marginBottom: 20 },
  completenessHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  completenessTitle: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  completenessPercent: { fontSize: 16, fontWeight: '800' },
  completenessBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  completenessFill: { height: 6, borderRadius: 3 },
  completenessHint: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 8 },
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
  customConditionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  dropdown: {
    backgroundColor: '#1A1A2E', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)', marginTop: 4, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  dropdownDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  dropdownText: { fontSize: 14, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 16, height: 48,
    color: '#FFF', fontSize: 15, marginBottom: 8,
  },
  bloodGroupRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  bloodGroupChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    minWidth: 52, alignItems: 'center',
  },
  bloodGroupChipActive: { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.4)' },
  bloodGroupText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  bloodGroupTextActive: { color: '#A78BFA' },
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
  severityRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  severityBtn: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  severityBtnText: { fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  severityLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 },
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
  ocrBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12,
    backgroundColor: 'rgba(74,222,128,0.08)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.25)',
    borderRadius: 12, padding: 12,
  },
  ocrBannerText: { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 18 },
  symptomHistoryCard: { marginBottom: 10 },
  symptomHistoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  symptomHistoryMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  symptomHistoryDate: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  symptomHistoryTime: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  severityBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
    backgroundColor: 'rgba(6,182,212,0.12)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.25)',
  },
  severityText: { fontSize: 12, color: '#06B6D4', fontWeight: '600' },
  symptomTag: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: 'rgba(167,139,250,0.12)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)',
  },
  symptomTagText: { fontSize: 13, color: '#A78BFA', fontWeight: '500' },
  symptomNotes: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 8, fontStyle: 'italic' },
  insightCard: { marginBottom: 10 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  insightSymptom: { fontSize: 15, fontWeight: '700', color: '#FFF', flex: 1 },
  insightBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
    backgroundColor: 'rgba(167,139,250,0.15)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)',
  },
  insightBadgeText: { fontSize: 12, color: '#A78BFA', fontWeight: '600' },
  insightText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 20 },
  insightAqi: { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 6 },
});
