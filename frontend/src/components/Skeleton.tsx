import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';

interface ShimmerProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function ShimmerBox({ width = '100%', height = 20, borderRadius = 12, style }: ShimmerProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const bgStyle = useAnimatedStyle(() => {
    const opacity = interpolate(shimmer.value, [0, 0.5, 1], [0.04, 0.12, 0.04]);
    return { opacity };
  });

  const waveStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmer.value, [0, 1], [-200, 400]);
    return { transform: [{ translateX }] };
  });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
        bgStyle,
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0, bottom: 0,
            width: 120,
            backgroundColor: 'rgba(255,255,255,0.08)',
            transform: [{ skewX: '-20deg' }],
          },
          waveStyle,
        ]}
      />
    </Animated.View>
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <ShimmerBox width="45%" height={14} />
      <View style={{ height: 14 }} />
      <ShimmerBox width="100%" height={48} borderRadius={14} />
      <View style={{ height: 10 }} />
      <ShimmerBox width="65%" height={12} />
    </View>
  );
}

export function SkeletonDashboard() {
  return (
    <View style={styles.dashboard}>
      <View style={styles.headerRow}>
        <View>
          <ShimmerBox width={180} height={26} />
          <View style={{ height: 10 }} />
          <ShimmerBox width={110} height={14} />
        </View>
        <ShimmerBox width={80} height={34} borderRadius={17} />
      </View>
      <View style={styles.orbPlaceholder}>
        <ShimmerBox width={180} height={180} borderRadius={90} />
        <View style={{ height: 12 }} />
        <ShimmerBox width={60} height={40} borderRadius={8} />
      </View>
      <SkeletonCard />
      <View style={{ height: 14 }} />
      <SkeletonCard />
      <View style={{ height: 14 }} />
      <SkeletonCard />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  dashboard: { padding: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 },
  orbPlaceholder: { alignItems: 'center', paddingVertical: 36, marginBottom: 28 },
});
