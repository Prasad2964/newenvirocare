import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';

function buildMapHtml(lat: number, lon: number, city: string): string {
  const legendItems = [
    { color: '#00E400', label: 'Good', range: '0-50' },
    { color: '#FFFF00', label: 'Moderate', range: '51-100' },
    { color: '#FF7E00', label: 'Unhealthy*', range: '101-150' },
    { color: '#FF0000', label: 'Unhealthy', range: '151-200' },
    { color: '#8F3F97', label: 'Very Bad', range: '201-300' },
    { color: '#7E0023', label: 'Hazardous', range: '300+' },
  ];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden;background:#0A1520;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    #map{width:100%;height:100%}

    /* City badge */
    .city-badge{
      position:fixed;top:14px;left:50%;transform:translateX(-50%);
      background:rgba(10,21,32,0.88);
      border:1px solid rgba(255,255,255,0.14);
      border-radius:24px;padding:8px 18px;
      display:flex;align-items:center;gap:8px;
      backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
      z-index:1000;white-space:nowrap;
      box-shadow:0 4px 24px rgba(0,0,0,0.4);
    }
    .city-badge span{color:#fff;font-size:13px;font-weight:600}
    .city-badge small{color:rgba(255,255,255,0.45);font-size:11px}
    .live-dot{
      width:8px;height:8px;border-radius:50%;background:#4ADE80;
      box-shadow:0 0 6px rgba(74,222,128,0.8);
      animation:blink 1.6s ease-in-out infinite;
    }
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}

    /* Legend */
    .legend{
      position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
      background:rgba(10,21,32,0.88);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:16px;padding:10px 14px;
      display:flex;align-items:center;gap:6px;
      backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
      z-index:1000;
      box-shadow:0 4px 24px rgba(0,0,0,0.4);
    }
    .legend-label{color:rgba(255,255,255,0.35);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin-right:4px}
    .l-item{display:flex;flex-direction:column;align-items:center;gap:3px}
    .l-dot{width:13px;height:13px;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.5)}
    .l-text{color:rgba(255,255,255,0.55);font-size:9px;white-space:nowrap}

    /* Zoom controls */
    .leaflet-control-zoom{border:none!important;background:transparent!important}
    .leaflet-control-zoom a{
      background:rgba(10,21,32,0.88)!important;
      border:1px solid rgba(255,255,255,0.14)!important;
      color:#fff!important;font-size:16px!important;
      width:36px!important;height:36px!important;line-height:34px!important;
      backdrop-filter:blur(12px);border-radius:10px!important;
      margin-bottom:4px!important;display:block!important;
      box-shadow:0 2px 12px rgba(0,0,0,0.4)!important;
    }
    .leaflet-control-zoom a:hover{background:rgba(74,222,128,0.15)!important}
    .leaflet-control-attribution{display:none!important}

    /* Popup */
    .leaflet-popup-content-wrapper{
      background:rgba(10,21,32,0.95)!important;
      border:1px solid rgba(255,255,255,0.15)!important;
      border-radius:14px!important;color:#fff!important;
      box-shadow:0 8px 32px rgba(0,0,0,0.5)!important;
    }
    .leaflet-popup-tip{background:rgba(10,21,32,0.95)!important}
    .leaflet-popup-close-button{color:rgba(255,255,255,0.5)!important;font-size:18px!important;top:8px!important;right:8px!important}
  </style>
</head>
<body>
  <div id="map"></div>

  <div class="city-badge">
    <div class="live-dot"></div>
    <span>${city}</span>
    <small>Live AQI</small>
  </div>

  <div class="legend">
    <span class="legend-label">AQI</span>
    ${legendItems.map(i => `
      <div class="l-item">
        <div class="l-dot" style="background:${i.color}"></div>
        <span class="l-text">${i.label.replace('*', '')}</span>
      </div>
    `).join('')}
  </div>

  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false })
              .setView([${lat}, ${lon}], 9);

    // Dark base tiles — CartoDB Dark Matter
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_matter/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd', maxZoom: 18
    }).addTo(map);

    // AQI color overlay from WAQI
    L.tileLayer('https://tiles.aqicn.org/tiles/usepa-aqi/{z}/{x}/{y}.png?token=demo', {
      opacity: 0.72, maxZoom: 18
    }).addTo(map);

    // Zoom control bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Glowing user location marker
    var pulseIcon = L.divIcon({
      html: '<div style="position:relative;width:20px;height:20px">'
          + '<div style="position:absolute;inset:0;border-radius:50%;background:rgba(74,222,128,0.25);animation:ring 1.8s ease-out infinite"></div>'
          + '<div style="position:absolute;inset:4px;border-radius:50%;background:#4ADE80;border:2px solid #fff;box-shadow:0 0 14px rgba(74,222,128,0.9)"></div>'
          + '</div>'
          + '<style>@keyframes ring{0%{transform:scale(1);opacity:0.8}100%{transform:scale(2.5);opacity:0}}</style>',
      className: '',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    L.marker([${lat}, ${lon}], { icon: pulseIcon }).addTo(map)
      .bindPopup(
        '<div style="padding:4px 2px">'
        + '<div style="font-weight:700;font-size:14px;color:#4ADE80;margin-bottom:2px">${city}</div>'
        + '<div style="font-size:12px;color:rgba(255,255,255,0.5)">Your location</div>'
        + '</div>'
      )
      .openPopup();

    // Force Leaflet to recalculate container size after render
    setTimeout(function() { map.invalidateSize(); }, 300);
  <\/script>
</body>
</html>`;
}

export default function AqiMapScreen() {
  const router = useRouter();
  const { city } = useLocalSearchParams<{ city: string }>();
  const [loading, setLoading] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const displayCity = (Array.isArray(city) ? city[0] : city) || 'India';

  useEffect(() => {
    // Get coordinates for the city via IP geolocation
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(d => {
        if (d.latitude && d.longitude) {
          setCoords({ lat: d.latitude, lon: d.longitude });
        } else {
          setCoords({ lat: 20.5937, lon: 78.9629 }); // India center fallback
        }
      })
      .catch(() => setCoords({ lat: 20.5937, lon: 78.9629 }));
  }, []);

  const htmlContent = coords ? buildMapHtml(coords.lat, coords.lon, displayCity) : null;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Live AQI Map</Text>
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Real-time data</Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          {(!coords || loading) && (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator size="large" color="#4ADE80" />
              <Text style={styles.loaderTitle}>Building your map</Text>
              <Text style={styles.loaderSub}>Loading live air quality data...</Text>
            </View>
          )}

          {htmlContent && (
            Platform.OS === 'web' ? (
              // @ts-ignore
              <iframe
                srcDoc={htmlContent}
                style={{ width: '100%', height: '100%', border: 'none' }}
                onLoad={() => setLoading(false)}
                title="Live AQI Map"
              />
            ) : (
              <WebView
                source={{ html: htmlContent }}
                style={styles.webview}
                onLoad={() => setLoading(false)}
                onError={() => setLoading(false)}
                javaScriptEnabled
                domStorageEnabled
                originWhitelist={['*']}
                mixedContentMode="always"
              />
            )
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Ionicons name="leaf-outline" size={13} color="#4ADE80" />
          <Text style={styles.footerText}>Data · World Air Quality Index (WAQI)  ·  Map · CartoDB</Text>
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
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(10,21,32,0.95)',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' },
  liveText: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
  mapContainer: { flex: 1 },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A1520',
    alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 10,
  },
  loaderTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginTop: 8 },
  loaderSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  webview: { flex: 1 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, backgroundColor: 'rgba(10,21,32,0.95)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  footerText: { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
});
