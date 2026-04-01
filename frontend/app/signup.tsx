import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { showToast } from '../src/components/Toast';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { signup, isFirstLaunch } = useAuth();
  const router = useRouter();

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
});
