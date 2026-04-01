import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  FlatList, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  withSpring, withRepeat, withSequence, Easing, interpolate,
  FadeIn, FadeInDown, FadeInUp, SlideInRight,
} from 'react-native-reanimated';
import { useAuth } from '../src/context/AuthContext';
import { COLORS, FONTS, FONT_SIZE, SPACING, RADIUS } from '../src/utils/tokens';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface OnboardingPage {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  description: string;
  orbColors: [string, string];
}

const PAGES: OnboardingPage[] = [
  {
    id: '1',
    icon: 'leaf',
    iconColor: COLORS.accent,
    title: 'Breathe Smart',
    subtitle: 'Real-time AQI Monitoring',
    description: 'Track air quality in your city with live data, intelligent alerts, and personalized health recommendations.',
    orbColors: [COLORS.accent, COLORS.cyan],
  },
  {
    id: '2',
    icon: 'shield-checkmark',
    iconColor: COLORS.purple,
    title: 'Stay Protected',
    subtitle: 'AI Health Assessment',
    description: 'Get personalized risk scores, mask recommendations, and activity suggestions based on your health profile.',
    orbColors: [COLORS.purple, COLORS.pink],
  },
  {
    id: '3',
    icon: 'sparkles',
    iconColor: COLORS.warning,
    title: 'Live Healthier',
    subtitle: 'Smart Routines & Insights',
    description: 'Build healthy habits with AI-powered routines, exposure tracking, and weekly health reports.',
    orbColors: [COLORS.warning, '#FF6B6B'],
  },
];

// Animated floating orb for each page
function FloatingOrb({ colors, active }: { colors: [string, string]; active: boolean }) {
  const scale = useSharedValue(0.8);
  const innerScale = useSharedValue(0.9);
  const glowOpacity = useSharedValue(0.1);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withSpring(1.08, { damping: 8, stiffness: 40 }),
          withSpring(0.92, { damping: 8, stiffness: 40 })
        ),
        -1, true
      );
      innerScale.value = withDelay(150, withRepeat(
        withSequence(
          withSpring(1.05, { damping: 10, stiffness: 50 }),
          withSpring(0.95, { damping: 10, stiffness: 50 })
        ),
        -1, true
      ));
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.35, { duration: 2000 }),
          withTiming(0.1, { duration: 2000 })
        ),
        -1, true
      );
      rotation.value = withRepeat(
        withTiming(360, { duration: 20000, easing: Easing.linear }),
        -1, false
      );
    }
  }, [active]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const SIZE = 160;

  return (
    <View style={[styles.orbContainer, { width: SIZE * 1.8, height: SIZE * 1.8 }]}>
      {/* Glow */}
      <Animated.View style={[{
        position: 'absolute',
        width: SIZE * 1.6,
        height: SIZE * 1.6,
        borderRadius: SIZE * 0.8,
        backgroundColor: colors[0],
      }, glowStyle]} />
      {/* Rotating ring */}
      <Animated.View style={[{
        position: 'absolute',
        width: SIZE * 1.3,
        height: SIZE * 1.3,
        borderRadius: SIZE * 0.65,
        borderWidth: 1.5,
        borderColor: 'transparent',
        borderTopColor: colors[0] + '80',
        borderRightColor: colors[1] + '40',
      }, ringStyle]} />
      {/* Main orb */}
      <Animated.View style={[{
        width: SIZE,
        height: SIZE,
        borderRadius: SIZE / 2,
        backgroundColor: colors[1] + '40',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors[0],
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 30,
        elevation: 20,
      }, orbStyle]}>
        <Animated.View style={[{
          width: SIZE * 0.7,
          height: SIZE * 0.7,
          borderRadius: SIZE * 0.35,
          backgroundColor: colors[0] + '60',
          alignItems: 'center',
          justifyContent: 'center',
        }, innerStyle]}>
          <View style={{
            width: SIZE * 0.4,
            height: SIZE * 0.4,
            borderRadius: SIZE * 0.2,
            backgroundColor: colors[0],
            shadowColor: colors[0],
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.8,
            shadowRadius: 15,
            elevation: 15,
          }} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// Dot indicator
function DotIndicator({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === current;
        return (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: isActive ? COLORS.accent : COLORS.textMuted,
                width: isActive ? 28 : 8,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

function OnboardingSlide({ item, index, currentIndex }: { item: OnboardingPage; index: number; currentIndex: number }) {
  const isActive = index === currentIndex;

  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <View style={styles.slideContent}>
        {/* Floating Orb */}
        <View style={styles.orbWrapper}>
          <FloatingOrb colors={item.orbColors} active={isActive} />
          <View style={[styles.iconBadge, { backgroundColor: item.iconColor + '20', borderColor: item.iconColor + '40' }]}>
            <Ionicons name={item.icon as any} size={28} color={item.iconColor} />
          </View>
        </View>

        {/* Text Content */}
        <View style={styles.textContent}>
          <Text style={styles.slideTitle}>{item.title}</Text>
          <Text style={[styles.slideSubtitle, { color: item.iconColor }]}>{item.subtitle}</Text>
          <Text style={styles.slideDescription}>{item.description}</Text>
        </View>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const { setFirstLaunchDone } = useAuth();

  const handleNext = () => {
    if (currentIndex < PAGES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = () => {
    handleGetStarted();
  };

  const handleGetStarted = async () => {
    await setFirstLaunchDone();
    router.replace('/login');
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < PAGES.length) {
      setCurrentIndex(index);
    }
  };

  const isLast = currentIndex === PAGES.length - 1;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Skip Button */}
        <Animated.View entering={FadeIn.delay(400).duration(500)} style={styles.skipContainer}>
          {!isLast && (
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipText}>Skip</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Slides */}
        <View style={styles.slidesContainer}>
          <FlatList
            ref={flatListRef}
            data={PAGES}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            bounces={false}
            keyExtractor={(item) => item.id}
            onScroll={onScroll}
            scrollEventThrottle={16}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            renderItem={({ item, index }) => (
              <OnboardingSlide item={item} index={index} currentIndex={currentIndex} />
            )}
          />
        </View>

        {/* Bottom Section */}
        <Animated.View entering={FadeInUp.delay(600).duration(500)} style={styles.bottomSection}>
          <DotIndicator total={PAGES.length} current={currentIndex} />

          <TouchableOpacity
            style={[styles.nextBtn, isLast && styles.getStartedBtn]}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            {isLast ? (
              <View style={styles.getStartedInner}>
                <Text style={styles.getStartedText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={20} color={COLORS.bg} />
              </View>
            ) : (
              <View style={styles.nextBtnInner}>
                <Text style={styles.nextBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color={COLORS.bg} />
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  safe: {
    flex: 1,
  },
  skipContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    height: 44,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
  },
  skipText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    fontFamily: FONTS.bodyMedium,
  },
  slidesContainer: {
    flex: 1,
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  orbWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.huge,
  },
  iconBadge: {
    position: 'absolute',
    bottom: 20,
    right: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  textContent: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  slideTitle: {
    fontSize: FONT_SIZE.xxl + 4,
    fontFamily: FONTS.heading,
    color: COLORS.textWhite,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    letterSpacing: -0.5,
  },
  slideSubtitle: {
    fontSize: FONT_SIZE.lg,
    fontFamily: FONTS.bodySemibold,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    letterSpacing: 0.5,
  },
  slideDescription: {
    fontSize: FONT_SIZE.md + 1,
    fontFamily: FONTS.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: SPACING.lg,
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: SPACING.xxl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  bottomSection: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xxl,
  },
  nextBtn: {
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
  getStartedBtn: {
    height: 60,
  },
  nextBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextBtnText: {
    fontSize: FONT_SIZE.lg,
    fontFamily: FONTS.bodySemibold,
    color: COLORS.bg,
    letterSpacing: 0.5,
  },
  getStartedInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  getStartedText: {
    fontSize: FONT_SIZE.lg + 1,
    fontFamily: FONTS.heading,
    color: COLORS.bg,
    letterSpacing: 0.5,
  },
});
