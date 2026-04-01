import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay } from 'react-native-reanimated';
import { useAuth } from '../src/context/AuthContext';
import { COLORS, FONTS, FONT_SIZE } from '../src/utils/tokens';

export default function SplashScreen() {
  const { user, loading, isFirstLaunch } = useAuth();
  const router = useRouter();
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    logoScale.value = withSequence(
      withTiming(1.1, { duration: 800 }),
      withTiming(1, { duration: 300 })
    );
    logoOpacity.value = withTiming(1, { duration: 800 });
    textOpacity.value = withDelay(500, withTiming(1, { duration: 600 }));
  }, []);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        if (user) {
          router.replace('/(tabs)/home');
        } else if (isFirstLaunch) {
          router.replace('/onboarding');
        } else {
          router.replace('/login');
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, user, isFirstLaunch]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  return (
    <View testID="splash-screen" style={styles.container}>
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <View style={styles.orbSmall}>
          <View style={styles.orbInner} />
        </View>
      </Animated.View>
      <Animated.View style={textStyle}>
        <Text style={styles.title}>EnviroCare</Text>
        <Text style={styles.subtitle}>AI</Text>
      </Animated.View>
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={COLORS.accent} size="small" />
        <Text style={styles.loadingText}>Analyzing your environment...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  orbSmall: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(0, 229, 160, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  title: {
    fontSize: FONT_SIZE.hero,
    fontFamily: FONTS.heading,
    color: COLORS.textWhite,
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: FONT_SIZE.xl,
    fontFamily: FONTS.body,
    color: COLORS.accent,
    textAlign: 'center',
    letterSpacing: 8,
    marginTop: 4,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    fontFamily: FONTS.body,
  },
});
