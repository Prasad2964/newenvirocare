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
    { color: '#00E400', label: 'Good' },
    { color: '#FFFF00', label: 'Moderate' },
    { color: '#FF7E00', label: 'Unhealthy*' },
    { color: '#FF0000', label: 'Unhealthy' },
    { color: '#8F3F97', label: 'Very Bad' },
    { color: '#7E0023', label: 'Hazardous' },
  ];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden;background:#0A1520;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    #map{width:100%;height:100%;background:#0A1520}
    /* Invert OSM tiles to get a dark map. AQI overlay lives in a custom pane
       that sits outside .leaflet-tile-pane, so its colours are never inverted. */
    .leaflet-tile-pane{filter:invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)}

    .city-badge{
      position:fixed;top:14px;left:50%;transform:translateX(-50%);
      background:rgba(10,21,32,0.88);border:1px solid rgba(255,255,255,0.14);
      border-radius:24px;padding:8px 18px;display:flex;align-items:center;gap:8px;
      backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
      z-index:1000;white-space:nowrap;box-shadow:0 4px 24px rgba(0,0,0,0.4);
    }
    .city-badge span{color:#fff;font-size:13px;font-weight:600}
    .city-badge small{color:rgba(255,255,255,0.45);font-size:11px}
    .live-dot{
      width:8px;height:8px;border-radius:50%;background:#4ADE80;
      box-shadow:0 0 6px rgba(74,222,128,0.8);
      animation:blink 1.6s ease-in-out infinite;
    }
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}

    .legend{
      position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
      background:rgba(10,21,32,0.88);border:1px solid rgba(255,255,255,0.12);
      border-radius:16px;padding:10px 14px;display:flex;align-items:center;gap:6px;
      backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
      z-index:1000;box-shadow:0 4px 24px rgba(0,0,0,0.4);
    }
    .legend-label{color:rgba(255,255,255,0.35);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;margin-right:4px}
    .l-item{display:flex;flex-direction:column;align-items:center;gap:3px}
    .l-dot{width:13px;height:13px;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.5)}
    .l-text{color:rgba(255,255,255,0.55);font-size:9px;white-space:nowrap}

    .leaflet-control-zoom{border:none!important;background:transparent!important}
    .leaflet-control-zoom a{
      background:rgba(10,21,32,0.88)!important;border:1px solid rgba(255,255,255,0.14)!important;
      color:#fff!important;font-size:16px!important;width:36px!important;height:36px!important;
      line-height:34px!important;backdrop-filter:blur(12px);border-radius:10px!important;
      margin-bottom:4px!important;display:block!important;box-shadow:0 2px 12px rgba(0,0,0,0.4)!important;
    }
    .leaflet-control-zoom a:hover{background:rgba(74,222,128,0.15)!important}
    .leaflet-control-attribution{display:none!important}
    .leaflet-popup-content-wrapper{
      background:rgba(10,21,32,0.95)!important;border:1px solid rgba(255,255,255,0.15)!important;
      border-radius:14px!important;color:#fff!important;box-shadow:0 8px 32px rgba(0,0,0,0.5)!important;
    }
    .leaflet-popup-tip{background:rgba(10,21,32,0.95)!important}
    .leaflet-popup-close-button{color:rgba(255,255,255,0.5)!important;font-size:18px!important;top:8px!important;right:8px!important}

    #map-init-msg{
      position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      color:rgba(255,255,255,0.35);font-size:13px;text-align:center;
      z-index:500;pointer-events:none;line-height:1.6;
    }
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

  <div id="map-init-msg">Loading map tiles...</div>

  <script>
    function aqiColor(v) {
      if (v <= 50)  return '#00E400';
      if (v <= 100) return '#FFFF00';
      if (v <= 150) return '#FF7E00';
      if (v <= 200) return '#FF0000';
      if (v <= 300) return '#8F3F97';
      return '#7E0023';
    }
    function aqiLabel(v) {
      if (v <= 50)  return 'Good';
      if (v <= 100) return 'Moderate';
      if (v <= 150) return 'Unhealthy for Sensitive Groups';
      if (v <= 200) return 'Unhealthy';
      if (v <= 300) return 'Very Unhealthy';
      return 'Hazardous';
    }
    function stationPopup(name, aqi) {
      var c = aqiColor(aqi);
      return '<div style="padding:8px 4px;min-width:160px">'
        + '<div style="font-size:11px;color:rgba(255,255,255,0.45);margin-bottom:6px;font-weight:500;line-height:1.4">' + name + '</div>'
        + '<div style="font-size:38px;font-weight:800;color:' + c + ';line-height:1;letter-spacing:-1px">' + aqi + '</div>'
        + '<div style="font-size:11px;font-weight:700;color:' + c + ';margin-top:6px;text-transform:uppercase;letter-spacing:0.6px">' + aqiLabel(aqi) + '</div>'
        + '</div>';
    }

    var map, stationGroup, moveTimer;

    function loadStations() {
      var b = map.getBounds();
      var latlng = b.getSouth().toFixed(4) + ',' + b.getWest().toFixed(4)
                 + ',' + b.getNorth().toFixed(4) + ',' + b.getEast().toFixed(4);
      fetch('https://api.waqi.info/map/bounds/?latlng=' + latlng + '&token=demo')
        .then(function(r) { return r.json(); })
        .then(function(res) {
          stationGroup.clearLayers();
          if (res.status !== 'ok' || !Array.isArray(res.data)) return;
          res.data.forEach(function(s) {
            var aqi = parseInt(s.aqi);
            if (isNaN(aqi) || aqi < 0) return;
            var c = aqiColor(aqi);
            L.circleMarker([s.lat, s.lon], {
              radius: 13,
              fillColor: c,
              color: '#fff',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.88,
              pane: 'aqi',
            })
            .bindPopup(stationPopup(s.station.name, aqi), { maxWidth: 240 })
            .addTo(stationGroup);
          });
        })
        .catch(function() {});
    }

    function initMap() {
      var msg = document.getElementById('map-init-msg');
      if (msg) msg.style.display = 'none';

      map = L.map('map', { zoomControl: false, attributionControl: false })
              .setView([${lat}, ${lon}], 9);

      // OSM as base — reliable from any origin. CSS invert (above) makes it dark.
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18, crossOrigin: true,
      }).addTo(map);

      // Custom pane for all AQI content — sits above tiles but excluded from CSS invert.
      map.createPane('aqi');
      map.getPane('aqi').style.zIndex = 450;

      // Layer group for station markers (cleared and refilled on pan/zoom)
      stationGroup = L.layerGroup([], { pane: 'aqi' }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // User's city marker
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
      L.marker([${lat}, ${lon}], { icon: pulseIcon })
        .bindPopup(
          '<div style="padding:4px 2px">'
          + '<div style="font-weight:700;font-size:14px;color:#4ADE80;margin-bottom:2px">${city}</div>'
          + '<div style="font-size:12px;color:rgba(255,255,255,0.5)">Your location</div>'
          + '</div>'
        )
        .openPopup()
        .addTo(map);

      // Load stations for current view, then refresh on every pan/zoom (debounced)
      loadStations();
      map.on('moveend', function() {
        clearTimeout(moveTimer);
        moveTimer = setTimeout(loadStations, 500);
      });

      setTimeout(function() { map.invalidateSize(); }, 500);
    }

    function onLeafletError() {
      var msg = document.getElementById('map-init-msg');
      if (msg) msg.textContent = 'Could not load map.\\nCheck your connection.';
    }
  </script>

  <!-- async so the WebView onLoad fires immediately without waiting for this CDN script -->
  <script async src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          crossorigin=""
          onload="initMap()"
          onerror="onLeafletError()"></script>
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
    // City name only — no ", India" suffix so non-Indian cities also work
    const query = encodeURIComponent(displayCity);
    fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'EnviroCareApp/2.0',
      },
    })
      .then(r => r.json())
      .then(results => {
        if (results && results[0]) {
          setCoords({ lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) });
        } else {
          setCoords({ lat: 20.5937, lon: 78.9629 });
        }
      })
      .catch(() => setCoords({ lat: 20.5937, lon: 78.9629 }));
  }, [displayCity]);

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
          {/* Spinner while geocoding city or WebView loading */}
          {(!coords || loading) && (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator size="large" color="#4ADE80" />
              <Text style={styles.loaderTitle}>
                {!coords ? 'Finding location...' : 'Loading map...'}
              </Text>
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
                // baseUrl lets the WebView treat external resource requests as
                // coming from a real origin, avoiding Android's null-origin blocks
                source={{ html: htmlContent, baseUrl: 'https://unpkg.com' }}
                style={styles.webview}
                onLoadEnd={() => setLoading(false)}
                onError={() => setLoading(false)}
                javaScriptEnabled
                domStorageEnabled
                originWhitelist={['*']}
                mixedContentMode="always"
                allowsInlineMediaPlayback
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
    alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 10,
  },
  loaderTitle: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  webview: { flex: 1 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, backgroundColor: 'rgba(10,21,32,0.95)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  footerText: { fontSize: 11, color: 'rgba(255,255,255,0.25)' },
});
