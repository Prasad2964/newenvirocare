import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../src/context/AuthContext';
import { showToast } from '../src/components/Toast';

WebBrowser.maybeCompleteAuthSession();

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#FFC107" />
      <Path d="M5.3 14.7l7.1 5.2C14.1 16.3 18.7 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 15.4 2 8.1 7.3 5.3 14.7z" fill="#FF3D00" />
      <Path d="M24 46c5.4 0 10.3-1.8 14.1-5l-6.9-5.7C29.1 37 26.7 38 24 38c-6 0-11.1-4-12.9-9.5l-7 5.4C7 41 14.7 46 24 46z" fill="#4CAF50" />
      <Path d="M44.5 20H24v8.5h11.8c-1 3-3 5.5-5.6 7.1l6.9 5.7C41.1 38 46 31.8 46 24c0-1.3-.2-2.7-.5-4z" fill="#1976D2" />
    </Svg>
  );
}

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { signup, loginWithGoogle, isFirstLaunch } = useAuth();
  const router = useRouter();

  const googleConfigured = !!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'not-configured',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || 'not-configured',
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || 'not-configured',
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token ?? (response.authentication?.idToken ?? '');
      const accessToken = response.params?.access_token ?? (response.authentication?.accessToken ?? '');
      handleGoogleSuccess(idToken, accessToken);
    } else if (response?.type === 'error') {
      showToast('Google sign-in was cancelled or failed', 'error');
      setGoogleLoading(false);
    } else if (response?.type === 'dismiss') {
      setGoogleLoading(false);
    }
  }, [response]);

  async function handleGoogleSuccess(idToken: string, accessToken: string) {
    try {
      await loginWithGoogle(idToken, accessToken);
      showToast('Welcome!', 'success');
      router.replace(isFirstLaunch ? '/permissions' : '/(tabs)/home');
    } catch (e: any) {
      showToast(e.message || 'Google sign-in failed', 'error');
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    if (!googleConfigured) {
      showToast('Google Sign-In not set up yet', 'info');
      return;
    }
    setGoogleLoading(true);
    try {
      await promptAsync();
    } catch {
      setGoogleLoading(false);
    }
  }

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      showToast('Please fill in all fields', 'warning');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'warning');
      return;
    }
    setLoading(true);
    try {
      await signup(name.trim(), email.trim(), password);
      showToast('Account created! Welcome aboard!', 'success');
      if (isFirstLaunch) {
        router.replace('/permissions');
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (e: any) {
      showToast(e.message || 'Could not create account', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.orbMini}>
              <View style={styles.orbMiniInner} />
            </View>
            <Text style={styles.brand}>EnviroCare</Text>
            <Text style={styles.brandSub}>AI</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Start monitoring your air quality health</Text>

            {/* Google Sign-Up */}
            <TouchableOpacity
              style={styles.googleBtn}
              onPress={handleGoogleSignUp}
              activeOpacity={0.85}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator size="small" color="#444" />
              ) : (
                <>
                  <GoogleLogo size={20} />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="rgba(255,255,255,0.5)" />
              <TextInput
                testID="signup-name-input"
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="rgba(255,255,255,0.5)" />
              <TextInput
                testID="signup-email-input"
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="rgba(255,255,255,0.5)" />
              <TextInput
                testID="signup-password-input"
                style={styles.input}
                placeholder="Password (min 6 chars)"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="signup-submit-btn"
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.btnText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              testID="go-to-login-btn"
              style={styles.linkBtn}
              onPress={() => router.replace('/login')}
            >
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.linkHighlight}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 48 },
  orbMini: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(6,182,212,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  orbMiniInner: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#06B6D4',
    shadowColor: '#06B6D4', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 12, elevation: 10,
  },
  brand: { fontSize: 32, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  brandSub: { fontSize: 16, fontWeight: '300', color: '#06B6D4', letterSpacing: 6 },
  form: { width: '100%' },
  title: { fontSize: 28, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 32 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16, marginBottom: 16, height: 56,
  },
  input: { flex: 1, color: '#FFF', fontSize: 16, marginLeft: 12 },
  btn: {
    height: 56, borderRadius: 28, backgroundColor: '#06B6D4',
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#000', letterSpacing: 1 },
  linkBtn: { alignItems: 'center', marginTop: 24 },
  linkText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  linkHighlight: { color: '#06B6D4', fontWeight: '600' },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 54, borderRadius: 16, backgroundColor: '#FFFFFF', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3, marginBottom: 20,
  },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: '#3C4043' },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  dividerText: { color: 'rgba(255,255,255,0.3)', fontSize: 12, paddingHorizontal: 12, textTransform: 'uppercase', letterSpacing: 1 },
});
