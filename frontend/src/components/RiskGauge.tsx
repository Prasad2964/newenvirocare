import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface Props {
  score: number;
  color: string;
  label: string;
  size?: number;
}

export default function RiskGauge({ score, color, label, size = 220 }: Props) {
  const animatedScore = useSharedValue(0);
  const needleGlow = useSharedValue(0);
  const scoreScale = useSharedValue(0.5);
  const scoreOpacity = useSharedValue(0);

  useEffect(() => {
    // Spring physics for needle — overshoot + settle
    animatedScore.value = withSequence(
      withSpring(score * 1.08, { damping: 6, stiffness: 60, mass: 0.8 }),
      withSpring(score, { damping: 15, stiffness: 120, mass: 0.5 })
    );

    // Glow pulse on the needle
    needleGlow.value = withSequence(
      withTiming(1, { duration: 300 }),
      withTiming(0.4, { duration: 800 })
    );

    // Score label entrance
    scoreScale.value = withDelay(300, withSpring(1, { damping: 12, stiffness: 100 }));
    scoreOpacity.value = withDelay(200, withTiming(1, { duration: 500 }));

    // Haptic tick when crossing thresholds
    if (Platform.OS !== 'web') {
      if (score > 75) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (score > 50) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  }, [score]);

  const needleStyle = useAnimatedStyle(() => {
    const angle = -90 + (animatedScore.value / 100) * 180;
    return {
      transform: [{ rotate: `${angle}deg` }],
    };
  });

  const needleGlowStyle = useAnimatedStyle(() => ({
    opacity: needleGlow.value,
    shadowOpacity: needleGlow.value,
  }));

  const scoreLabelStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
    opacity: scoreOpacity.value,
  }));

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 20;
  const strokeW = 14;

  // Tick marks
  const ticks = [0, 25, 50, 75, 100].map((val) => {
    const angle = (-90 + (val / 100) * 180) * (Math.PI / 180);
    const x1 = cx + (r - strokeW) * Math.cos(angle);
    const y1 = cy + (r - strokeW) * Math.sin(angle);
    const x2 = cx + (r + 4) * Math.cos(angle);
    const y2 = cy + (r + 4) * Math.sin(angle);
    return { x1, y1, x2, y2, val };
  });

  return (
    <View testID="risk-gauge" style={[styles.container, { width: size, height: size / 2 + 48 }]}>
      <Svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        <Defs>
          <SvgGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#4ADE80" />
            <Stop offset="0.33" stopColor="#FACC15" />
            <Stop offset="0.66" stopColor="#FB923C" />
            <Stop offset="1" stopColor="#DC2626" />
          </SvgGradient>
        </Defs>
        {/* Background arc */}
        <Path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {/* Colored arc */}
        <Path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * Math.PI * r} ${Math.PI * r}`}
          opacity={0.85}
        />
        {/* Tick marks */}
        {ticks.map((t) => (
          <Path
            key={t.val}
            d={`M ${t.x1} ${t.y1} L ${t.x2} ${t.y2}`}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth={1.5}
          />
        ))}
        {/* Center dot */}
        <Circle cx={cx} cy={cy} r={8} fill={color} opacity={0.9} />
        <Circle cx={cx} cy={cy} r={4} fill="#FFF" opacity={0.8} />
      </Svg>

      {/* Needle with glow */}
      <Animated.View
        style={[
          styles.needle,
          needleStyle,
          needleGlowStyle,
          {
            left: cx - 2,
            top: cy - r + 20,
            height: r - 14,
            backgroundColor: color,
            shadowColor: color,
          },
        ]}
      />

      {/* Score label */}
      <Animated.View style={[styles.labelContainer, scoreLabelStyle]}>
        <Text style={[styles.score, { color }]}>{Math.round(score)}</Text>
        <View style={[styles.labelBadge, { backgroundColor: color + '20' }]}>
          <Text style={[styles.label, { color }]}>{label}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  needle: {
    position: 'absolute',
    width: 3,
    borderRadius: 2,
    transformOrigin: 'bottom center',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    elevation: 5,
  },
  labelContainer: {
    alignItems: 'center',
    marginTop: -16,
  },
  score: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 10,
  },
  labelBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});
