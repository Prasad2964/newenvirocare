import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  Modal, Animated, KeyboardAvoidingView, Platform, ActivityIndicator,
  Dimensions, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat, Message } from '../../hooks/useChat';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import api from '../../utils/api';
import { calculatePersonalizedRisk } from '../../utils/riskEngine';

const { height: SCREEN_H } = Dimensions.get('window');
const POPUP_H = SCREEN_H * 0.80;

const SUGGESTED = [
  'Is today safe for outdoor exercise?',
  'What mask should I wear today?',
  'Explain my risk score',
  'How does AQI affect my condition?',
];

export default function FloatingChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [aqi, setAqi] = useState<number | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [riskLevel, setRiskLevel] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const slideAnim = useRef(new Animated.Value(POPUP_H)).current;
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
    Animated.spring(slideAnim, {
      toValue: 0,
      damping: 22,
      mass: 0.85,
      stiffness: 160,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const closeChat = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: POPUP_H,
      duration: 260,
      useNativeDriver: true,
    }).start(() => setOpen(false));
  }, [slideAnim]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  }, [input, sendMessage]);

  const contextLabel = [
    city,
    aqi != null && `AQI ${aqi}`,
    riskScore != null && `Risk ${riskScore}/100`,
  ].filter(Boolean).join(' · ');

  return (
    <>
      {/* Floating action button */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 76 }]}
        onPress={openChat}
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubble-ellipses" size={22} color="#000" />
        {messages.length > 0 && (
          <View style={styles.fabBadge} />
        )}
      </TouchableOpacity>

      {/* Slide-up popup */}
      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeChat}
      >
        <Pressable style={styles.backdrop} onPress={closeChat}>
          <Animated.View
            style={[styles.popup, { height: POPUP_H, transform: [{ translateY: slideAnim }] }]}
          >
            <Pressable style={styles.popupInner}>
              {/* Drag handle */}
              <View style={styles.handle} />

              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                  <View style={styles.aiIcon}>
                    <Ionicons name="leaf" size={16} color="#4ADE80" />
                  </View>
                  <View>
                    <Text style={styles.title}>AI Assistant</Text>
                    {contextLabel ? (
                      <Text style={styles.subtitle} numberOfLines={1}>{contextLabel}</Text>
                    ) : (
                      <Text style={styles.subtitle}>Air quality health advisor</Text>
                    )}
                  </View>
                </View>
                <View style={styles.headerActions}>
                  <TouchableOpacity style={styles.iconBtn} onPress={clearHistory}>
                    <Ionicons name="trash-outline" size={17} color="rgba(255,255,255,0.35)" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={closeChat}>
                    <Ionicons name="close" size={21} color="rgba(255,255,255,0.55)" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.divider} />

              <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={20}
              >
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
                  contentContainerStyle={[
                    styles.messageList,
                    messages.length === 0 && { flexGrow: 1 },
                  ]}
                  onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyTitle}>Ask EnviroCare AI</Text>
                      <Text style={styles.emptySub}>
                        Get advice based on your health profile and today's air quality
                      </Text>
                      <View style={styles.chipGrid}>
                        {SUGGESTED.map((s, i) => (
                          <TouchableOpacity
                            key={i}
                            style={styles.chip}
                            onPress={() => sendMessage(s)}
                          >
                            <Text style={styles.chipText}>{s}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  }
                  ListFooterComponent={loading ? <TypingIndicator /> : null}
                />

                {/* Limit banner */}
                {limitReached && (
                  <View style={styles.limitBanner}>
                    <Ionicons name="lock-closed" size={14} color="#FBBF24" />
                    <Text style={styles.limitText}>Daily limit reached. Resets at midnight.</Text>
                  </View>
                )}

                {/* Input bar */}
                <View style={[styles.inputRow, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
                  <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Ask about air quality or your health..."
                    placeholderTextColor="rgba(255,255,255,0.28)"
                    multiline
                    maxLength={500}
                    editable={!limitReached && !loading}
                    returnKeyType="send"
                    blurOnSubmit={false}
                    onSubmitEditing={handleSend}
                  />
                  <TouchableOpacity
                    style={[
                      styles.sendBtn,
                      (!input.trim() || loading || limitReached) && styles.sendBtnDisabled,
                    ]}
                    onPress={handleSend}
                    disabled={!input.trim() || loading || limitReached}
                  >
                    {loading
                      ? <ActivityIndicator size="small" color="#000" />
                      : <Ionicons name="send" size={16} color="#000" />
                    }
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
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
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#06B6D4',
    borderWidth: 1.5,
    borderColor: '#4ADE80',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  popup: {
    backgroundColor: '#0A1520',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  popupInner: {
    flex: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  aiIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(74,222,128,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1, maxWidth: 200 },
  headerActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 8 },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 0,
  },
  flex: { flex: 1 },
  messageList: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 20,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#FFF', marginBottom: 6 },
  emptySub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  chipText: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: 'rgba(251,191,36,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.2)',
  },
  limitText: { fontSize: 13, color: '#FBBF24', fontWeight: '500' },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: '#FFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    maxHeight: 90,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  sendBtnDisabled: { opacity: 0.35 },
});
