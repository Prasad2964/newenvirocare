import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withSpring,
  withDelay,
  Easing,
  withTiming,
} from 'react-native-reanimated';
import { getOrbGradient, getOrbPulseDuration, COLORS, FONTS, FONT_SIZE } from '../utils/tokens';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface Props {
  aqi: number;
  color: string;
  size?: number;
  showValue?: boolean;
}

// Floating particle component
function Particle({ size: pSize, color, delay, duration, startX, startY, endX, endY }: any) {
  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }), -1, true)
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.7, { duration: duration * 0.4 }),
          withTiming(0, { duration: duration * 0.6 })
        ),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: startX + (endX - startX) * progress.value },
      { translateY: startY + (endY - startY) * progress.value },
      { scale: 0.5 + progress.value * 0.5 },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: pSize,
          height: pSize,
          borderRadius: pSize / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}

export default function BreathingOrb({ aqi, color, size = 180, showValue = true }: Props) {
  const scale = useSharedValue(0.85);
  const innerScale = useSharedValue(0.9);
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.15);
  const ringRotation = useSharedValue(0);
  const ringOpacity = useSharedValue(0.4);
  const ripple1Scale = useSharedValue(1);
  const ripple1Opacity = useSharedValue(0);
  const ripple2Scale = useSharedValue(1);
  const ripple2Opacity = useSharedValue(0);

  const gradientColors = getOrbGradient(aqi);

  useEffect(() => {
    const duration = getOrbPulseDuration(aqi);

    // Main orb pulse (spring-based)
    scale.value = withRepeat(
      withSequence(
        withSpring(1.1, { damping: 8, stiffness: 40, mass: 1 }),
        withSpring(0.9, { damping: 8, stiffness: 40, mass: 1 })
      ),
      -1, true
    );

    // Inner pulse (slightly offset)
    innerScale.value = withDelay(200, withRepeat(
      withSequence(
        withSpring(1.06, { damping: 10, stiffness: 50 }),
        withSpring(0.94, { damping: 10, stiffness: 50 })
      ),
      -1, true
    ));

    // Glow intensity based on AQI
    const glowIntensity = Math.min(0.5, aqi / 500);
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.4 + glowIntensity, { duration: duration * 0.7 }),
        withTiming(1.1, { duration: duration * 0.3 })
      ),
      -1, true
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.2 + glowIntensity, { duration: duration * 0.5 }),
        withTiming(0.08, { duration: duration * 0.5 })
      ),
      -1, true
    );

    // *** Rotating outer ring (KEY FEATURE) ***
    ringRotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1, false
    );

    // Ripple rings
    ripple1Scale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(2.0, { duration: duration * 1.8 })
      ),
      -1, false
    );
    ripple1Opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 0 }),
        withTiming(0, { duration: duration * 1.8 })
      ),
      -1, false
    );

    ripple2Scale.value = withDelay(duration * 0.6, withRepeat(
      withSequence(
        withTiming(1, { duration: 0 }),
        withTiming(2.0, { duration: duration * 1.8 })
      ),
      -1, false
    ));
    ripple2Opacity.value = withDelay(duration * 0.6, withRepeat(
      withSequence(
        withTiming(0.25, { duration: 0 }),
        withTiming(0, { duration: duration * 1.8 })
      ),
      -1, false
    ));

    // Haptic feedback on AQI change
    if (Platform.OS !== 'web') {
      if (aqi > 200) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, [aqi]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const innerOrbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotation.value}deg` }],
    opacity: ringOpacity.value,
  }));

  const ripple1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ripple1Scale.value }],
    opacity: ripple1Opacity.value,
  }));

  const ripple2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ripple2Scale.value }],
    opacity: ripple2Opacity.value,
  }));

  // Particles
  const particles = useMemo(() => {
    const count = Math.min(8, Math.floor(aqi / 40) + 2);
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const r = size * 0.4;
      return {
        id: i,
        size: 3 + Math.random() * 4,
        color: i % 2 === 0 ? gradientColors[0] : gradientColors[1],
        delay: i * 400,
        duration: 3000 + Math.random() * 2000,
        startX: Math.cos(angle) * r * 0.3,
        startY: Math.sin(angle) * r * 0.3,
        endX: Math.cos(angle) * r,
        endY: Math.sin(angle) * r,
      };
    });
  }, [aqi, size]);

  return (
    <View style={[styles.container, { width: size * 2, height: size * 2 }]}>
      {/* Ripple rings (bonus) */}
      <Animated.View
        style={[styles.ripple, ripple1Style, {
          width: size, height: size, borderRadius: size / 2, borderColor: color,
        }]}
      />
      <Animated.View
        style={[styles.ripple, ripple2Style, {
          width: size, height: size, borderRadius: size / 2, borderColor: color,
        }]}
      />

      {/* Outer glow */}
      <Animated.View
        style={[styles.glow, glowStyle, {
          width: size * 1.5, height: size * 1.5, borderRadius: size * 0.75,
          backgroundColor: color,
        }]}
      />

      {/* Rotating outer ring (MUST-HAVE) */}
      <Animated.View
        style={[styles.rotatingRing, ringStyle, {
          width: size * 1.2, height: size * 1.2, borderRadius: size * 0.6,
        }]}
      >
        <View style={[styles.ringSegment, {
          width: size * 1.2, height: size * 1.2, borderRadius: size * 0.6,
          borderColor: 'transparent',
          borderTopColor: gradientColors[0] + 'CC',
          borderRightColor: gradientColors[1] + '66',
          borderBottomColor: 'transparent',
          borderLeftColor: gradientColors[0] + '33',
        }]} />
      </Animated.View>

      {/* Particles */}
      <View style={[styles.particleContainer, { width: size * 1.4, height: size * 1.4 }]}>
        {particles.map((p) => (
          <Particle key={p.id} {...p} />
        ))}
      </View>

      {/* Main orb */}
      <Animated.View
        testID="breathing-orb"
        style={[styles.orb, orbStyle, {
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: gradientColors[1] + '40',
          shadowColor: color,
        }]}
      >
        {/* Inner layer */}
        <Animated.View
          style={[styles.innerOrb, innerOrbStyle, {
            width: size * 0.75, height: size * 0.75, borderRadius: size * 0.375,
            backgroundColor: gradientColors[0] + '50',
          }]}
        />
        {/* Core */}
        <View
          style={[styles.core, {
            width: size * 0.45, height: size * 0.45, borderRadius: size * 0.225,
            backgroundColor: gradientColors[0],
            shadowColor: gradientColors[0],
          }]}
        />
        {/* Highlight */}
        <View
          style={[styles.highlight, {
            width: size * 0.2, height: size * 0.2, borderRadius: size * 0.1,
            top: size * 0.18, left: size * 0.22,
          }]}
        />
      </Animated.View>

      {/* AQI Value Overlay (JetBrains Mono) */}
      {showValue && (
        <View style={styles.aqiOverlay}>
          <Text style={[styles.aqiNumber, { color: color, fontSize: size * 0.28 }]}>{aqi}</Text>
          <Text style={[styles.aqiUnit, { color: color + 'AA' }]}>AQI</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    borderWidth: 1,
  },
  glow: {
    position: 'absolute',
  },
  rotatingRing: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSegment: {
    borderWidth: 2,
  },
  particleContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 40,
    elevation: 25,
  },
  innerOrb: {
    position: 'absolute',
  },
  core: {
    position: 'absolute',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  highlight: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  aqiOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aqiNumber: {
    fontFamily: FONTS.monoBold,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 2 },
  },
  aqiUnit: {
    fontFamily: FONTS.mono,
    fontSize: FONT_SIZE.xs,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: -2,
  },
});
