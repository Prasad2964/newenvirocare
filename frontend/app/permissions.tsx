import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface PermStatus {
  location: 'pending' | 'granted' | 'denied';
  notifications: 'pending' | 'granted' | 'denied';
  camera: 'pending' | 'granted' | 'denied';
}

export default function PermissionsScreen() {
  const router = useRouter();
  const [perms, setPerms] = useState<PermStatus>({
    location: 'pending',
    notifications: 'pending',
    camera: 'pending',
  });
  const [step, setStep] = useState(0);

  const items = [
    {
      key: 'location' as const,
      icon: 'location',
      color: '#4ADE80',
      title: 'Location Access',
      desc: 'Monitor air quality at your exact location for personalized alerts.',
      request: async () => {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          setPerms(p => ({ ...p, location: status === 'granted' ? 'granted' : 'denied' }));
        } catch {
          setPerms(p => ({ ...p, location: 'denied' }));
        }
      },
    },
    {
      key: 'notifications' as const,
      icon: 'notifications',
      color: '#FACC15',
      title: 'Push Notifications',
      desc: 'Get real-time alerts when air quality changes or becomes hazardous.',
      request: async () => {
        try {
          if (Platform.OS === 'web') {
            setPerms(p => ({ ...p, notifications: 'granted' }));
            return;
          }
          const { status } = await Notifications.requestPermissionsAsync();
          setPerms(p => ({ ...p, notifications: status === 'granted' ? 'granted' : 'denied' }));
        } catch {
          setPerms(p => ({ ...p, notifications: 'denied' }));
        }
      },
    },
    {
      key: 'camera' as const,
      icon: 'camera',
      color: '#06B6D4',
      title: 'Camera Access',
      desc: 'Scan medical prescriptions for automatic health profile setup.',
      request: async () => {
        try {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          setPerms(p => ({ ...p, camera: status === 'granted' ? 'granted' : 'denied' }));
        } catch {
          setPerms(p => ({ ...p, camera: 'denied' }));
        }
      },
    },
  ];

  const current = items[step];
  const allDone = step >= items.length;

  async function handleAllow() {
    await current.request();
    if (step < items.length - 1) {
      setStep(step + 1);
    } else {
      router.replace('/(tabs)/home');
    }
  }

  function handleSkip() {
    setPerms(p => ({ ...p, [current.key]: 'denied' }));
    if (step < items.length - 1) {
      setStep(step + 1);
    } else {
      router.replace('/(tabs)/home');
    }
  }

  function handleSkipAll() {
    router.replace('/(tabs)/home');
  }

  if (allDone) {
    router.replace('/(tabs)/home');
    return null;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Progress */}
        <View style={styles.progress}>
          {items.map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i === step && { backgroundColor: current.color, width: 32 },
                i < step && { backgroundColor: 'rgba(255,255,255,0.5)' },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity testID="skip-all-btn" style={styles.skipAllBtn} onPress={handleSkipAll}>
          <Text style={styles.skipAllText}>Skip All</Text>
        </TouchableOpacity>

        {/* Content */}
        <Animated.View entering={FadeInDown.duration(400)} key={step} style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: current.color + '20' }]}>
            <Ionicons name={current.icon as any} size={56} color={current.color} />
          </View>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.desc}>{current.desc}</Text>

          {perms[current.key] === 'denied' && (
            <View style={styles.deniedBanner}>
              <Ionicons name="information-circle" size={18} color="#FB923C" />
              <Text style={styles.deniedText}>
                Permission denied. You can enable it later in Settings.
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            testID={`allow-${current.key}-btn`}
            style={[styles.allowBtn, { backgroundColor: current.color }]}
            onPress={handleAllow}
          >
            <Text style={styles.allowText}>Allow {current.title}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID={`skip-${current.key}-btn`} style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, padding: 24 },
  progress: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 },
  progressDot: {
    height: 4, width: 12, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)',
  },
  skipAllBtn: { position: 'absolute', top: 16, right: 24, zIndex: 10 },
  skipAllText: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '500' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  iconCircle: {
    width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 32,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#FFF', textAlign: 'center', marginBottom: 16 },
  desc: { fontSize: 16, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 24, maxWidth: 300 },
  deniedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24,
    backgroundColor: 'rgba(251,146,60,0.1)', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(251,146,60,0.3)',
  },
  deniedText: { color: '#FB923C', fontSize: 13, flex: 1 },
  actions: { gap: 12, paddingBottom: 16 },
  allowBtn: {
    height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
  },
  allowText: { fontSize: 16, fontWeight: '700', color: '#000', letterSpacing: 0.5 },
  skipBtn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontSize: 15, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
});
