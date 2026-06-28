import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../src/context/AuthContext';
import api from '../src/utils/api';
import { showToast } from '../src/components/Toast';
import { COLORS, FONTS, FONT_SIZE, SPACING, RADIUS } from '../src/utils/tokens';

type Step = 'choice' | 'scanning' | 'reviewing' | 'saving';

const CONDITION_CHIPS = [
  'Asthma', 'COPD', 'Heart Disease', 'Diabetes', 'Hypertension',
  'Lung Disease', 'Bronchitis', 'Allergies', 'Pregnancy',
  'Sinusitis', 'Rhinitis', 'Eczema', 'Thyroid Disorder', 'Anemia',
];

export default function MedicalSetupScreen() {
  const router = useRouter();
  const { isFirstLaunch } = useAuth();

  const [step, setStep] = useState<Step>('choice');
  const [conditions, setConditions] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [ocrNotes, setOcrNotes] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);

  function toggleCondition(c: string) {
    setConditions(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  function navigate() {
    if (isFirstLaunch) {
      router.replace('/permissions');
    } else {
      router.replace('/(tabs)/home');
    }
  }

  async function pickAndScan(useCamera: boolean) {
    setScanError(null);
    try {
      let result: ImagePicker.ImagePickerResult;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera access is required to scan your document.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.7,
          base64: true,
        });
      }

      if (result.canceled || !result.assets[0]?.base64) return;

      setStep('scanning');
      const data = await api.post('/api/ocr/prescription', {
        image_base64: result.assets[0].base64,
      });

      const extracted = data.extracted || {};
      setConditions(extracted.conditions || []);
      setMedications(extracted.medications || []);
      setAllergies(extracted.allergies || []);
      setOcrNotes(extracted.notes || '');
      setStep('reviewing');
    } catch (e: any) {
      setScanError(e.message || 'Could not scan document. Try a clearer image.');
      setStep('choice');
    }
  }

  async function saveAndContinue() {
    setStep('saving');
    try {
      await api.post('/api/health-profile', { conditions, medications, allergies });
      showToast('Health profile saved!', 'success');
    } catch {
      // Non-blocking — profile will be editable later in the Profile tab
    }
    navigate();
  }

  function skip() {
    navigate();
  }

  // ── Scanning state ──────────────────────────────────────────────
  if (step === 'scanning') {
    return (
      <View style={styles.centeredFull}>
        <View style={styles.scanningOrb}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
        <Text style={styles.scanningTitle}>Reading your document…</Text>
        <Text style={styles.scanningSubtitle}>Extracting health data via OCR</Text>
      </View>
    );
  }

  // ── Saving state ────────────────────────────────────────────────
  if (step === 'saving') {
    return (
      <View style={styles.centeredFull}>
        <View style={styles.scanningOrb}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
        <Text style={styles.scanningTitle}>Saving your profile…</Text>
      </View>
    );
  }

  // ── Review extracted data ───────────────────────────────────────
  if (step === 'reviewing') {
    const extraConditions = conditions.filter(c => !CONDITION_CHIPS.includes(c));

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.reviewHeader}>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark-circle" size={32} color={COLORS.accent} />
            </View>
            <Text style={styles.reviewTitle}>Review Extracted Data</Text>
            <Text style={styles.reviewSubtitle}>
              Tap to toggle — we'll use this to personalise your alerts
            </Text>
          </View>

          {/* Conditions */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              <Ionicons name="medkit-outline" size={14} color={COLORS.textSecondary} />
              {'  '}CONDITIONS
            </Text>
            <View style={styles.chipGrid}>
              {CONDITION_CHIPS.map(c => {
                const selected = conditions.includes(c);
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, selected && styles.chipActive]}
                    onPress={() => toggleCondition(c)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
              {extraConditions.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, styles.chipActive]}
                  onPress={() => toggleCondition(c)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.chipTextActive}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Medications */}
          {medications.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                <Ionicons name="flask-outline" size={14} color={COLORS.textSecondary} />
                {'  '}MEDICATIONS DETECTED
              </Text>
              <View style={styles.chipGrid}>
                {medications.map(m => (
                  <View key={m} style={[styles.chip, styles.chipMed]}>
                    <Text style={styles.chipTextMed}>{m}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Allergies */}
          {allergies.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                <Ionicons name="warning-outline" size={14} color={COLORS.textSecondary} />
                {'  '}ALLERGIES DETECTED
              </Text>
              <View style={styles.chipGrid}>
                {allergies.map(a => (
                  <View key={a} style={[styles.chip, styles.chipAllergy]}>
                    <Text style={styles.chipTextAllergy}>{a}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {conditions.length === 0 && medications.length === 0 && allergies.length === 0 && (
            <View style={styles.noDataBox}>
              <Ionicons name="information-circle-outline" size={24} color={COLORS.textMuted} />
              <Text style={styles.noDataText}>
                No medical data detected. Select any conditions below that apply to you.
              </Text>
            </View>
          )}

          <Text style={styles.editHint}>
            You can always edit your full profile in the Profile tab.
          </Text>
        </ScrollView>

        {/* Save Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.saveBtn} onPress={saveAndContinue} activeOpacity={0.85}>
            <Text style={styles.saveBtnText}>Save & Continue</Text>
            <Ionicons name="arrow-forward" size={20} color={COLORS.bg} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.skipLink} onPress={skip}>
            <Text style={styles.skipLinkText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Choice screen ───────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.choiceContent}>
        {/* Icon */}
        <View style={styles.iconRing}>
          <View style={styles.iconInner}>
            <Ionicons name="document-text" size={48} color={COLORS.accent} />
          </View>
        </View>

        {/* Text */}
        <Text style={styles.choiceTitle}>Set Up Health Profile</Text>
        <Text style={styles.choiceSubtitle}>
          Scan your medical report or prescription. We'll extract your conditions and medications automatically
          to give you personalised air quality alerts.
        </Text>

        {scanError && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#F87171" />
            <Text style={styles.errorText}>{scanError}</Text>
          </View>
        )}

        {/* Scan Options */}
        <View style={styles.scanButtons}>
          {Platform.OS !== 'web' && (
            <TouchableOpacity
              style={styles.scanBtn}
              onPress={() => pickAndScan(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={22} color={COLORS.bg} />
              <Text style={styles.scanBtnText}>Take Photo</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.scanBtn, Platform.OS === 'web' && styles.scanBtnFull]}
            onPress={() => pickAndScan(false)}
            activeOpacity={0.85}
          >
            <Ionicons name="images" size={22} color={COLORS.bg} />
            <Text style={styles.scanBtnText}>Choose from Library</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.skipBtn} onPress={skip} activeOpacity={0.7}>
          <Text style={styles.skipBtnText}>Skip for now</Text>
        </TouchableOpacity>

        <Text style={styles.privacyNote}>
          <Ionicons name="lock-closed-outline" size={12} color={COLORS.textMuted} />
          {'  '}Your medical data is encrypted and stored securely. Never shared.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  // Scanning / saving
  centeredFull: {
    flex: 1, backgroundColor: COLORS.bg,
    alignItems: 'center', justifyContent: 'center', gap: 20,
  },
  scanningOrb: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.accent + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  scanningTitle: {
    fontSize: FONT_SIZE.lg, fontFamily: FONTS.heading,
    color: COLORS.textWhite,
  },
  scanningSubtitle: {
    fontSize: FONT_SIZE.sm, fontFamily: FONTS.body,
    color: COLORS.textSecondary,
  },

  // Choice screen
  choiceContent: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  iconRing: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: COLORS.accent + '12',
    borderWidth: 1.5, borderColor: COLORS.accent + '30',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.xxl,
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
  },
  iconInner: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.accent + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  choiceTitle: {
    fontSize: FONT_SIZE.xxl + 2, fontFamily: FONTS.heading,
    color: COLORS.textWhite, textAlign: 'center',
    marginBottom: SPACING.md,
  },
  choiceSubtitle: {
    fontSize: FONT_SIZE.md, fontFamily: FONTS.body,
    color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 22, marginBottom: SPACING.xxl,
  },
  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: RADIUS.md, padding: SPACING.md,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.25)',
    marginBottom: SPACING.lg, width: '100%',
  },
  errorText: {
    flex: 1, fontSize: FONT_SIZE.sm, fontFamily: FONTS.body,
    color: '#F87171', lineHeight: 18,
  },
  scanButtons: {
    flexDirection: 'row', gap: SPACING.md, width: '100%', marginBottom: SPACING.lg,
  },
  scanBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, height: 52, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  scanBtnFull: { flex: 1 },
  scanBtnText: {
    fontSize: FONT_SIZE.md, fontFamily: FONTS.bodySemibold,
    color: COLORS.bg,
  },
  skipBtn: {
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xxl,
    borderRadius: RADIUS.pill, borderWidth: 1,
    borderColor: COLORS.glassBorder, marginBottom: SPACING.xxl,
  },
  skipBtnText: {
    fontSize: FONT_SIZE.md, fontFamily: FONTS.body,
    color: COLORS.textSecondary,
  },
  privacyNote: {
    fontSize: FONT_SIZE.xs, fontFamily: FONTS.body,
    color: COLORS.textMuted, textAlign: 'center',
  },

  // Review screen
  scroll: { paddingHorizontal: SPACING.xl, paddingBottom: 140 },
  reviewHeader: {
    alignItems: 'center', paddingTop: SPACING.xxl, paddingBottom: SPACING.xl,
  },
  successBadge: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.accent + '15',
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg,
  },
  reviewTitle: {
    fontSize: FONT_SIZE.xxl, fontFamily: FONTS.heading,
    color: COLORS.textWhite, marginBottom: SPACING.sm,
  },
  reviewSubtitle: {
    fontSize: FONT_SIZE.md, fontFamily: FONTS.body,
    color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20,
  },
  section: { marginBottom: SPACING.xl },
  sectionLabel: {
    fontSize: FONT_SIZE.xs, fontFamily: FONTS.bodySemibold,
    color: COLORS.textSecondary, letterSpacing: 1.2,
    marginBottom: SPACING.md,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: SPACING.md, paddingVertical: 7,
    borderRadius: RADIUS.pill, borderWidth: 1,
    borderColor: COLORS.glassBorder, backgroundColor: COLORS.glass,
  },
  chipActive: {
    backgroundColor: COLORS.accent + '20',
    borderColor: COLORS.accent + '60',
  },
  chipText: {
    fontSize: FONT_SIZE.sm, fontFamily: FONTS.body, color: COLORS.textSecondary,
  },
  chipTextActive: {
    fontSize: FONT_SIZE.sm, fontFamily: FONTS.bodySemibold, color: COLORS.accent,
  },
  chipMed: {
    backgroundColor: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.3)',
  },
  chipTextMed: {
    fontSize: FONT_SIZE.sm, fontFamily: FONTS.body, color: '#A78BFA',
  },
  chipAllergy: {
    backgroundColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.25)',
  },
  chipTextAllergy: {
    fontSize: FONT_SIZE.sm, fontFamily: FONTS.body, color: '#FCD34D',
  },
  noDataBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: COLORS.glass, borderRadius: RADIUS.md,
    padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.glassBorder,
    marginBottom: SPACING.lg,
  },
  noDataText: {
    flex: 1, fontSize: FONT_SIZE.sm, fontFamily: FONTS.body,
    color: COLORS.textSecondary, lineHeight: 20,
  },
  editHint: {
    fontSize: FONT_SIZE.xs, fontFamily: FONTS.body,
    color: COLORS.textMuted, textAlign: 'center', marginTop: SPACING.sm,
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1, borderTopColor: COLORS.glassBorder,
    gap: 12,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, height: 54, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  saveBtnText: {
    fontSize: FONT_SIZE.lg, fontFamily: FONTS.bodySemibold, color: COLORS.bg,
  },
  skipLink: { alignItems: 'center', paddingVertical: 4 },
  skipLinkText: {
    fontSize: FONT_SIZE.sm, fontFamily: FONTS.body, color: COLORS.textMuted,
  },
});
