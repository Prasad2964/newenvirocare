import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  withSpring, withRepeat, withSequence, FadeIn, FadeInDown,
  FadeInUp, interpolate, interpolateColor, Easing,
} from 'react-native-reanimated';
import { COLORS, FONTS, FONT_SIZE, SPACING, RADIUS } from '../src/utils/tokens';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FEATURES = [
  { icon: 'sparkles', label: 'AI Health Assistant', desc: 'Personalized health advice' },
  { icon: 'analytics', label: 'Advanced Analytics', desc: 'Weekly health reports' },
  { icon: 'notifications', label: 'Smart Alerts', desc: 'Real-time AQI notifications' },
  { icon: 'map', label: 'Pollution Heatmaps', desc: 'Neighborhood-level data' },
  { icon: 'fitness', label: 'Breathe Coach', desc: 'Guided breathing exercises' },
  { icon: 'people', label: 'Family Protection', desc: 'Monitor your loved ones' },
];

interface Plan {
  id: string;
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  yearlySaving: string;
  description: string;
  accent: string;
  icon: string;
}

const PLANS: Plan[] = [
  {
    id: 'premium',
    name: 'Premium',
    monthlyPrice: '₹299',
    yearlyPrice: '₹2,499',
    yearlySaving: 'Save 30%',
    description: 'For individuals who care about their health',
    accent: COLORS.accent,
    icon: 'diamond',
  },
  {
    id: 'family',
    name: 'Family',
    monthlyPrice: '₹699',
    yearlyPrice: '₹5,999',
    yearlySaving: 'Save 29%',
    description: 'Protect your entire family',
    accent: COLORS.purple,
    icon: 'people',
  },
];

// Animated feature item with checkmark appearing
function FeatureItem({ item, index }: { item: typeof FEATURES[0]; index: number }) {
  const checkScale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = 400 + index * 200;
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
    checkScale.value = withDelay(delay + 100, withSpring(1, { damping: 8, stiffness: 200 }));
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const rowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: interpolate(opacity.value, [0, 1], [30, 0]) }],
  }));

  return (
    <Animated.View style={[styles.featureRow, rowStyle]}>
      <Animated.View style={[styles.featureCheck, checkStyle]}>
        <Ionicons name="checkmark" size={14} color={COLORS.bg} />
      </Animated.View>
      <View style={styles.featureTextWrap}>
        <Text style={styles.featureLabel}>{item.label}</Text>
        <Text style={styles.featureDesc}>{item.desc}</Text>
      </View>
    </Animated.View>
  );
}

// Toggle switch
function BillingToggle({ isYearly, onToggle }: { isYearly: boolean; onToggle: () => void }) {
  const togglePos = useSharedValue(0);

  useEffect(() => {
    togglePos.value = withSpring(isYearly ? 1 : 0, { damping: 15, stiffness: 200 });
  }, [isYearly]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(togglePos.value, [0, 1], [2, 42]) }],
  }));

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      togglePos.value,
      [0, 1],
      [COLORS.bgElevated, COLORS.accent + '40']
    ),
  }));

  return (
    <View style={styles.toggleContainer}>
      <Text style={[styles.toggleLabel, !isYearly && styles.toggleLabelActive]}>Monthly</Text>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8}>
        <Animated.View style={[styles.toggleTrack, trackStyle]}>
          <Animated.View style={[styles.toggleThumb, thumbStyle]} />
        </Animated.View>
      </TouchableOpacity>
      <View style={styles.yearlyLabelWrap}>
        <Text style={[styles.toggleLabel, isYearly && styles.toggleLabelActive]}>Yearly</Text>
        {isYearly && (
          <View style={styles.saveBadge}>
            <Text style={styles.saveBadgeText}>-30%</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// Plan Card
function PlanCard({ plan, isYearly, selected, onSelect }: {
  plan: Plan; isYearly: boolean; selected: boolean; onSelect: () => void;
}) {
  const borderAnim = useSharedValue(0);

  useEffect(() => {
    borderAnim.value = withTiming(selected ? 1 : 0, { duration: 250 });
  }, [selected]);

  const cardStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      borderAnim.value,
      [0, 1],
      [COLORS.border, plan.accent]
    ),
    transform: [{ scale: interpolate(borderAnim.value, [0, 1], [1, 1.02]) }],
  }));

  const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
  const period = isYearly ? '/year' : '/month';

  return (
    <TouchableOpacity onPress={onSelect} activeOpacity={0.85}>
      <Animated.View style={[styles.planCard, cardStyle]}>
        {selected && (
          <View style={[styles.selectedIndicator, { backgroundColor: plan.accent }]} />
        )}
        <View style={styles.planHeader}>
          <View style={[styles.planIconWrap, { backgroundColor: plan.accent + '15' }]}>
            <Ionicons name={plan.icon as any} size={22} color={plan.accent} />
          </View>
          <View style={styles.planTitleWrap}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planDesc}>{plan.description}</Text>
          </View>
          {selected && (
            <View style={[styles.planCheckCircle, { backgroundColor: plan.accent }]}>
              <Ionicons name="checkmark" size={16} color={COLORS.bg} />
            </View>
          )}
        </View>
        <View style={styles.priceRow}>
          <Text style={[styles.priceText, { color: plan.accent }]}>{price}</Text>
          <Text style={styles.pricePeriod}>{period}</Text>
          {isYearly && (
            <View style={[styles.savingBadge, { backgroundColor: COLORS.accent + '20' }]}>
              <Text style={[styles.savingText, { color: COLORS.accent }]}>{plan.yearlySaving}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function PaywallScreen() {
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('premium');
  const router = useRouter();

  const handleSubscribe = () => {
    // Mocked subscription
    router.back();
  };

  const handleRestore = () => {
    // Mocked restore
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Close Button */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRestore}>
            <Text style={styles.restoreText}>Restore</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.hero}>
            <View style={styles.crownWrap}>
              <Ionicons name="diamond" size={36} color={COLORS.accent} />
            </View>
            <Text style={styles.heroTitle}>Unlock Premium</Text>
            <Text style={styles.heroSubtitle}>
              Breathe smarter with advanced AI health insights
            </Text>
          </Animated.View>

          {/* Features */}
          <View style={styles.featuresSection}>
            {FEATURES.map((item, index) => (
              <FeatureItem key={item.label} item={item} index={index} />
            ))}
          </View>

          {/* Billing Toggle */}
          <Animated.View entering={FadeIn.delay(800).duration(400)}>
            <BillingToggle
              isYearly={isYearly}
              onToggle={() => setIsYearly(!isYearly)}
            />
          </Animated.View>

          {/* Plan Cards */}
          <Animated.View entering={FadeInUp.delay(900).duration(500)} style={styles.plansSection}>
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isYearly={isYearly}
                selected={selectedPlan === plan.id}
                onSelect={() => setSelectedPlan(plan.id)}
              />
            ))}
          </Animated.View>

          {/* Subscribe CTA */}
          <Animated.View entering={FadeInUp.delay(1100).duration(500)} style={styles.ctaSection}>
            <TouchableOpacity
              style={[styles.subscribeBtn, { backgroundColor: selectedPlan === 'family' ? COLORS.purple : COLORS.accent }]}
              onPress={handleSubscribe}
              activeOpacity={0.85}
            >
              <Text style={styles.subscribeBtnText}>
                Start 7-Day Free Trial
              </Text>
            </TouchableOpacity>
            <Text style={styles.legalText}>
              Cancel anytime. No commitment required.
            </Text>
          </Animated.View>

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.glass,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.glassBorder,
  },
  restoreText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZE.md,
    fontFamily: FONTS.bodyMedium,
  },
  scroll: { paddingHorizontal: SPACING.xxl, paddingBottom: 40 },

  // Hero
  hero: { alignItems: 'center', marginTop: SPACING.lg, marginBottom: SPACING.xxxl },
  crownWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.accent + '15',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.accent + '30',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  heroTitle: {
    fontSize: FONT_SIZE.xxl + 4,
    fontFamily: FONTS.heading,
    color: COLORS.textWhite,
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    fontSize: FONT_SIZE.md + 1,
    fontFamily: FONTS.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.xl,
  },

  // Features
  featuresSection: { marginBottom: SPACING.xxxl },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  featureCheck: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  featureTextWrap: { flex: 1 },
  featureLabel: {
    fontSize: FONT_SIZE.md + 1,
    fontFamily: FONTS.bodySemibold,
    color: COLORS.textWhite,
  },
  featureDesc: {
    fontSize: FONT_SIZE.sm + 1,
    fontFamily: FONTS.body,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  toggleLabel: {
    fontSize: FONT_SIZE.md,
    fontFamily: FONTS.bodyMedium,
    color: COLORS.textMuted,
  },
  toggleLabelActive: {
    color: COLORS.textWhite,
    fontFamily: FONTS.bodySemibold,
  },
  yearlyLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  saveBadge: {
    backgroundColor: COLORS.accent + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  saveBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontFamily: FONTS.monoBold,
    color: COLORS.accent,
  },
  toggleTrack: {
    width: 76, height: 34, borderRadius: 17,
    backgroundColor: COLORS.bgElevated,
    borderWidth: 1, borderColor: COLORS.border,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.textWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  // Plans
  plansSection: { gap: SPACING.lg, marginBottom: SPACING.xxl },
  planCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    overflow: 'hidden',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  planIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  planTitleWrap: { flex: 1 },
  planName: {
    fontSize: FONT_SIZE.lg + 1,
    fontFamily: FONTS.heading,
    color: COLORS.textWhite,
  },
  planDesc: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONTS.body,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  planCheckCircle: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs,
  },
  priceText: {
    fontSize: FONT_SIZE.xxl,
    fontFamily: FONTS.monoBold,
  },
  pricePeriod: {
    fontSize: FONT_SIZE.md,
    fontFamily: FONTS.body,
    color: COLORS.textSecondary,
  },
  savingBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    marginLeft: SPACING.sm,
  },
  savingText: {
    fontSize: FONT_SIZE.xs + 1,
    fontFamily: FONTS.monoBold,
  },

  // CTA
  ctaSection: { alignItems: 'center' },
  subscribeBtn: {
    width: '100%',
    height: 58,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  subscribeBtnText: {
    fontSize: FONT_SIZE.lg,
    fontFamily: FONTS.heading,
    color: COLORS.bg,
    letterSpacing: 0.5,
  },
  legalText: {
    fontSize: FONT_SIZE.sm,
    fontFamily: FONTS.body,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
});
