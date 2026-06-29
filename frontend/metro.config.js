// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const path = require('path');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);

// Use a stable on-disk store (shared across web/android)
const root = process.env.METRO_CACHE_ROOT || path.join(__dirname, '.metro-cache');
config.cacheStores = [
  new FileStore({ root: path.join(root, 'cache') }),
];

// Force Babel to transform react-native core files that ship with private class
// fields (#privateField syntax). Without this, Hermes in older Expo Go builds
// rejects the syntax with "private properties are not supported".
config.transformer.transformIgnorePatterns = [
  'node_modules/(?!(react-native|@react-native|expo|@expo|@expo-google-fonts|' +
  'expo-router|expo-modules-core|expo-font|expo-web-browser|expo-blur|' +
  'expo-linear-gradient|expo-location|expo-notifications|expo-image|' +
  'expo-haptics|expo-constants|expo-status-bar|expo-splash-screen|' +
  'expo-system-ui|expo-symbols|expo-image-picker|expo-auth-session|' +
  'expo-crypto|expo-device|expo-linking|' +
  'react-native-gesture-handler|react-native-reanimated|react-native-worklets|' +
  'react-native-safe-area-context|react-native-screens|react-native-svg|' +
  'react-native-webview|@react-navigation|@react-native-async-storage)/)',
];

// Reduce the number of workers to decrease resource usage
config.maxWorkers = 2;

module.exports = config;
