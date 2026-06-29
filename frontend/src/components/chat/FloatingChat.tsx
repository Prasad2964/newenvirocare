import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  Modal, Animated, KeyboardAvoidingView, Platform, ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat, Message } from '../../hooks/useChat';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import api from '../../utils/api';
import { calculatePersonalizedRisk } from '../../utils/riskEngine';

const WIN_W = 310;
const WIN_H = 460;

const SUGGESTED = [
  'Safe for exercise today?',
  'What mask should I wear?',
  'Explain my risk score',
  'AQI effect on my condition?',
];

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [aqi, setAqi] = useState<number | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [riskLevel, setRiskLevel] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const { messages, loading, sendMessage, clearHistory, limitReached } = useChat(
    aqi, city, riskScore, riskLevel,
  );

  useEffect(() => { fetchContext(); }, []);

  async function fetchContext() {
    try {
      const settings = await api.get('/api/settings');
      const defaultCity = settings?.default_city || 'Mumbai';
      setCity(defaultCity);
      const [aqiData, profile] = await Promise.all([
        api.get(`/api/aqi/${defaultCity}`),
        api.get('/api/health-profile').catch(() => null),
      ]);
      setAqi(aqiData?.aqi ?? null);
      if (aqiData && profile) {
        const result = calculatePersonalizedRisk(aqiData, {
          conditions: profile.conditions || [],
          medications: profile.medications || [],
          age: profile.age ?? null,
        });
        setRiskScore(result.score);
        setRiskLevel(result.level);
      }
    } catch (_) {}
  }

  const openChat = useCallback(() => {
    setOpen(true);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        damping: 16,
        stiffness: 280,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const closeChat = useCallback(() => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.8, duration: 160, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => setOpen(false));
  }, [scaleAnim, opacityAnim]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  }, [input, sendMessage]);

  // Bottom offset: above the tab bar (68) + FAB (52) + gap (12)
  const windowBottom = insets.bottom + 68 + 52 + 12;

  return (
    <>
      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 76 }]}
        onPress={open ? closeChat : openChat}
        activeOpacity={0.85}
      >
        <Ionicons name={open ? 'close' : 'chatbubble-ellipses'} size={22} color="#000" />
        {!open && messages.length > 0 && <View style={styles.fabBadge} />}
      </TouchableOpacity>

      {/* Corner popup */}
      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeChat}
      >
        {/* Invisible full-screen backdrop — tap to close */}
        <Pressable style={StyleSheet.absoluteFill} onPress={closeChat} />

        {/* Window anchored to bottom-right */}
        <KeyboardAvoidingView
          style={[styles.windowWrapper, { bottom: windowBottom, right: 12 }]}
          behavior={Platform.OS === 'ios' ? 'position' : undefined}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.window,
              { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.aiDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>EnviroCare AI</Text>
                  {(city || aqi != null) && (
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {[city, aqi != null && `AQI ${aqi}`].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={clearHistory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={15} color="rgba(255,255,255,0.3)" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={closeChat} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={18} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Messages */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item.id}
              renderItem={({ item }: { item: Message }) => (
                <ChatBubble
                  role={item.role}
                  content={item.content}
                  timestamp={item.timestamp}
                  error={item.error}
                />
              )}
              style={styles.messageList}
              contentContainerStyle={[
                styles.messageListContent,
                messages.length === 0 && { flexGrow: 1 },
              ]}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="leaf" size={24} color="rgba(74,222,128,0.5)" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyTitle}>Ask anything</Text>
                  <Text style={styles.emptySub}>Personalised to your health profile & current AQI</Text>
                  <View style={styles.chipGrid}>
                    {SUGGESTED.map((s, i) => (
                      <TouchableOpacity key={i} style={styles.chip} onPress={() => sendMessage(s)}>
                        <Text style={styles.chipText}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              }
              ListFooterComponent={loading ? <TypingIndicator /> : null}
            />

            {limitReached && (
              <View style={styles.limitBanner}>
                <Ionicons name="lock-closed" size={12} color="#FBBF24" />
                <Text style={styles.limitText}>Daily limit reached</Text>
              </View>
            )}

            <View style={styles.divider} />

            {/* Input */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Ask about your air quality..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                maxLength={500}
                editable={!limitReached && !loading}
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!input.trim() || loading || limitReached) && styles.sendBtnOff]}
                onPress={handleSend}
                disabled={!input.trim() || loading || limitReached}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Ionicons name="send" size={14} color="#000" />
                }
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  /* FAB */
  fab: {
    position: 'absolute',
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  fabBadge: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#06B6D4',
    borderWidth: 1.5,
    borderColor: '#4ADE80',
  },

  /* Window positioning wrapper */
  windowWrapper: {
    position: 'absolute',
    width: WIN_W,
  },

  /* The popup card */
  window: {
    width: WIN_W,
    height: WIN_H,
    backgroundColor: '#0C1825',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 20,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  aiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  title: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  subtitle: { fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 2 },
  iconBtn: { padding: 6 },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },

  /* Messages */
  messageList: { flex: 1 },
  messageListContent: { padding: 10, paddingBottom: 6 },

  /* Empty state */
  empty: { flex: 1, alignItems: 'center', paddingTop: 20, paddingHorizontal: 14 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  emptySub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.38)',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 16,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipText: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },

  /* Limit banner */
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 10,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.2)',
  },
  limitText: { fontSize: 11, color: '#FBBF24', fontWeight: '500' },

  /* Input row */
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#FFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: 72,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnOff: { opacity: 0.3 },
});
