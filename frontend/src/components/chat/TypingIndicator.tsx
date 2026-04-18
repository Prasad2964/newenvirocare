import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function TypingIndicator() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 350, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Ionicons name="leaf" size={14} color="#4ADE80" />
      </View>
      <View style={styles.bubble}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, {
              opacity: dot,
              transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
            }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 14 },
  avatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  bubble: {
    flexDirection: 'row', gap: 5, paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 20, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ADE80' },
});
