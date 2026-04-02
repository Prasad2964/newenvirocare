import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';

export default function AqiMapScreen() {
  const router = useRouter();
  const { city } = useLocalSearchParams<{ city: string }>();
  const [loading, setLoading] = useState(true);

  const citySlug = (city || 'world').toLowerCase().replace(/\s+/g, '-');
  const mapUrl = `https://aqicn.org/map/india/#@g/${citySlug}`;
  const fallbackUrl = 'https://aqicn.org/map/india/';

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Live AQI Map</Text>
            {city ? <Text style={styles.headerSub}>{city}</Text> : null}
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          {loading && (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator size="large" color="#4ADE80" />
              <Text style={styles.loaderText}>Loading live air quality map...</Text>
            </View>
          )}

          {Platform.OS === 'web' ? (
            // @ts-ignore — iframe is valid HTML on web
            <iframe
              src={fallbackUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              onLoad={() => setLoading(false)}
              title="Live AQI Map"
            />
          ) : (
            <WebView
              source={{ uri: fallbackUrl }}
              style={styles.webview}
              onLoad={() => setLoading(false)}
              onError={() => setLoading(false)}
              javaScriptEnabled
              domStorageEnabled
              startInLoadingState={false}
            />
          )}
        </View>

        {/* Footer note */}
        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.4)" />
          <Text style={styles.footerText}>Data from World Air Quality Index (WAQI)</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A1520' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  mapContainer: { flex: 1, position: 'relative' },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A1520',
    alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 10,
  },
  loaderText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  webview: { flex: 1 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerText: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
});
