import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  withSpring, withRepeat, withSequence, Easing, FadeInDown,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../src/context/AuthContext';
import { showToast } from '../src/components/Toast';
import { COLORS, FONTS, FONT_SIZE, SPACING, RADIUS } from '../src/utils/tokens';

WebBrowser.maybeCompleteAuthSession();

// Isolated component — Google hook only runs when Client ID actually exists
function GoogleButton({
  loading,
  onStart,
  onSuccess,
  onFail,
}: {
  loading: boolean;
  onStart: () => void;
  onSuccess: (idToken: string, accessToken: string) => void;
  onFail: () => void;
}) {
  const redirectUri = AuthSession.makeRedirectUri();
  console.log('[Google OAuth] redirectUri:', redirectUri);

  const [, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const idToken = response.params?.id_token ?? response.authentication?.idToken ?? '';
      const accessToken = response.params?.access_token ?? response.authentication?.accessToken ?? '';
      onSuccess(idToken, accessToken);
    } else {
      onFail();
    }
  }, [response]);

  return (
    <TouchableOpacity style={styles.googleBtn} onPress={() => { onStart(); promptAsync(); }} disabled={loading} activeOpacity={0.85}>
      {loading ? <ActivityIndicator size="small" color="#444" /> : <><GoogleLogo size={20} /><Text style={styles.googleBtnText}>Continue with Google</Text></>}
    </TouchableOpacity>
  );
}

// Google "G" Logo SVG
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

// Floating Label Input Component
function FloatingLabelInput({
  label,
  value,
  onChangeText,
  icon,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  icon: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  autoCapitalize?: any;
  testID?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const labelPos = useSharedValue(value ? 1 : 0);
  const borderColor = useSharedValue(0);

  useEffect(() => {
    labelPos.value = withTiming(focused || value ? 1 : 0, { duration: 200 });
    borderColor.value = withTiming(focused ? 1 : 0, { duration: 200 });
  }, [focused, value]);

  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(labelPos.value, [0, 1], [0, -24]) },
      { scale: interpolate(labelPos.value, [0, 1], [1, 0.8]) },
    ],
    color: focused ? COLORS.accent : COLORS.textSecondary,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    borderColor: focused ? COLORS.borderFocus : COLORS.border,
  }));

  return (
    <Animated.View style={[styles.inputOuter, containerStyle]}>
      <View style={styles.inputRow}>
        <Ionicons name={icon as any} size={20} color={focused ? COLORS.accent : COLORS.textMuted} style={styles.inputIcon} />
        <View style={styles.inputLabelWrap}>
          <Animated.Text style={[styles.floatingLabel, labelStyle]}>{label}</Animated.Text>
          <TextInput
            testID={testID}
            style={styles.input}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            secureTextEntry={secureTextEntry && !showPass}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize || 'none'}
            placeholderTextColor="transparent"
          />
        </View>
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
            <Ionicons name={showPass ? 'eye-off' : 'eye'} size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, loginWithGoogle, isFirstLaunch } = useAuth();
  const router = useRouter();


  // Animated orb
  const orbScale = useSharedValue(0.9);
  const orbGlow = useSharedValue(0.15);

  useEffect(() => {
    orbScale.value = withRepeat(
      withSequence(
        withSpring(1.05, { damping: 10, stiffness: 40 }),
        withSpring(0.95, { damping: 10, stiffness: 40 })
      ),
      -1, true
    );
    orbGlow.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 2000 }),
        withTiming(0.1, { duration: 2000 })
      ),
      -1, true
    );
  }, []);

  const orbAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: orbGlow.value,
  }));

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      showToast('Please fill in all fields', 'warning');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      showToast('Welcome back!', 'success');
      if (isFirstLaunch) {
        router.replace('/permissions');
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (e: any) {
      showToast(e.message || 'Invalid credentials', 'error');
    } finally {
      setLoading(false);
    }
  }

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

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Header with animated orb */}
            <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.header}>
              <View style={styles.orbArea}>
                <Animated.View style={[styles.orbGlow, glowAnimStyle]} />
                <Animated.View style={[styles.orbOuter, orbAnimStyle]}>
                  <View style={styles.orbInner} />
                </Animated.View>
              </View>
              <Text style={styles.brand}>EnviroCare</Text>
              <Text style={styles.brandSub}>AI</Text>
            </Animated.View>

            {/* Form */}
            <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.form}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to monitor your environment</Text>

              {/* Google Sign-In Button */}
              {process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ? (
                <GoogleButton
                  loading={googleLoading}
                  onStart={() => setGoogleLoading(true)}
                  onSuccess={handleGoogleSuccess}
                  onFail={() => { showToast('Google sign-in cancelled', 'info'); setGoogleLoading(false); }}
                />
              ) : (
                <TouchableOpacity
                  testID="google-signin-btn"
                  style={[styles.googleBtn, { opacity: 0.6 }]}
                  onPress={() => showToast('Google Sign-In not configured yet', 'info')}
                  activeOpacity={0.85}
                >
                  <GoogleLogo size={20} />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </TouchableOpacity>
              )}

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Floating Label Inputs */}
              <FloatingLabelInput
                testID="login-email-input"
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                icon="mail-outline"
                keyboardType="email-address"
              />

              <FloatingLabelInput
                testID="login-password-input"
                label="Password"
                value={password}
                onChangeText={setPassword}
                icon="lock-closed-outline"
                secureTextEntry
              />

              {/* Forgot Password */}
              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>

              {/* Sign In Button */}
              <TouchableOpacity
                testID="login-submit-btn"
                style={[styles.signInBtn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.bg} />
                ) : (
                  <Text style={styles.signInBtnText}>Sign In</Text>
                )}
              </TouchableOpacity>

              {/* Sign Up Link */}
              <TouchableOpacity
                testID="go-to-signup-btn"
                style={styles.linkBtn}
                onPress={() => router.push('/signup')}
              >
                <Text style={styles.linkText}>
                  Don't have an account?{' '}
                  <Text style={styles.linkHighlight}>Sign Up</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: SPACING.xxl },

  // Header
  header: { alignItems: 'center', marginBottom: 40 },
  orbArea: {
    width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  orbGlow: {
    position: 'absolute',
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.accent,
  },
  orbOuter: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.accent + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  orbInner: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 15,
    elevation: 12,
  },
  brand: {
    fontSize: FONT_SIZE.xxl + 4,
    fontFamily: FONTS.heading,
    color: COLORS.textWhite,
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: FONT_SIZE.lg,
    fontFamily: FONTS.body,
    color: COLORS.accent,
    letterSpacing: 6,
    marginTop: 2,
  },

  // Form
  form: { width: '100%' },
  title: {
    fontSize: FONT_SIZE.xxl,
    fontFamily: FONTS.heading,
    color: COLORS.textWhite,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZE.md + 1,
    fontFamily: FONTS.body,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xxl,
  },

  // Google Button
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: RADIUS.md,
    backgroundColor: '#FFFFFF',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: SPACING.xl,
  },
  googleBtnText: {
    fontSize: FONT_SIZE.md + 1,
    fontFamily: FONTS.bodySemibold,
    color: '#3C4043',
    letterSpacing: 0.2,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZE.sm,
    fontFamily: FONTS.bodyMedium,
    paddingHorizontal: SPACING.lg,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Floating Label Input
  inputOuter: {
    backgroundColor: COLORS.bgInput,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
    height: 58,
    justifyContent: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  inputIcon: {
    marginRight: SPACING.md,
  },
  inputLabelWrap: {
    flex: 1,
    justifyContent: 'center',
    height: 58,
  },
  floatingLabel: {
    position: 'absolute',
    fontSize: FONT_SIZE.md,
    fontFamily: FONTS.body,
    color: COLORS.textSecondary,
    left: 0,
  },
  input: {
    flex: 1,
    color: COLORS.textWhite,
    fontSize: FONT_SIZE.md + 1,
    fontFamily: FONTS.bodyMedium,
    paddingTop: 8,
    height: 58,
  },
  eyeBtn: {
    padding: SPACING.sm,
  },

  // Forgot Password
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.xl,
    marginTop: -SPACING.sm,
  },
  forgotText: {
    color: COLORS.accent,
    fontSize: FONT_SIZE.sm + 1,
    fontFamily: FONTS.bodyMedium,
  },

  // Sign In Button
  signInBtn: {
    height: 56,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  btnDisabled: { opacity: 0.6 },
  signInBtnText: {
    fontSize: FONT_SIZE.lg,
    fontFamily: FONTS.heading,
    color: COLORS.bg,
    letterSpacing: 0.5,
  },

  // Links
  linkBtn: { alignItems: 'center', marginTop: SPACING.xxl },
  linkText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    fontFamily: FONTS.body,
  },
  linkHighlight: {
    color: COLORS.accent,
    fontFamily: FONTS.bodySemibold,
  },
});
