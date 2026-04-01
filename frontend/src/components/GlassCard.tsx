import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
  glowColor?: string;
}

export default function GlassCard({ children, style, testID, glowColor }: Props) {
  const shimmer = useSharedValue(-1);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(2, { duration: 6000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * 200 }],
    opacity: 0.04,
  }));

  return (
    <View testID={testID} style={[styles.card, glowColor ? { shadowColor: glowColor } : undefined, style]}>
      {/* Light streak shimmer */}
      <Animated.View style={[styles.shimmer, shimmerStyle]} />
      {/* Subtle noise grain layer */}
      <View style={styles.grain} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 16,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: -100,
    width: 100,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    transform: [{ skewX: '-15deg' }],
  },
  grain: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderRadius: 24,
  },
});
