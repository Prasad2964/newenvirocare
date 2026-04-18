import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useChat, Message } from '../../src/hooks/useChat';
import { ChatBubble } from '../../src/components/chat/ChatBubble';
import { TypingIndicator } from '../../src/components/chat/TypingIndicator';
import api from '../../src/utils/api';

const SUGGESTED = [
  'Is today safe for outdoor exercise?',
  'What mask should I wear?',
  'Explain my risk score',
  'How does AQI affect my condition?',
];

export default function ChatScreen() {
  const [input, setInput] = useState('');
  const [aqi, setAqi] = useState<number | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const { messages, loading, messagesRemaining, limitReached, usageLoading, sendMessage, clearHistory } = useChat(aqi, city);

  useEffect(() => {
    fetchContext();
  }, []);

  async function fetchContext() {
    try {
      const settings = await api.get('/api/settings');
      const defaultCity = settings.default_city || 'Mumbai';
      setCity(defaultCity);
      const aqiData = await api.get(`/api/aqi/${defaultCity}`);
      setAqi(aqiData.aqi ?? null);
    } catch (_) {}
  }

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  }, [input, sendMessage]);

  const renderItem = useCallback(({ item }: { item: Message }) => (
    <ChatBubble role={item.role} content={item.content} timestamp={item.timestamp} error={item.error} />
  ), []);

  const contextLabel = [
    aqi != null && `AQI: ${aqi}`,
    city,
  ].filter(Boolean).join(' · ');

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0A1520', '#000']} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>AI Assistant</Text>
            <Text style={styles.subtitle}>Powered by Gemini 2.0</Text>
          </View>
          <TouchableOpacity onPress={clearHistory} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.35)" />
          </TouchableOpacity>
        </View>

        {/* Context pill */}
        {contextLabel ? (
          <View style={styles.contextPill}>
            <Ionicons name="location-outline" size={12} color="#06B6D4" />
            <Text style={styles.contextText}>{contextLabel}</Text>
          </View>
        ) : null}

        {/* Rate limit banner */}
        {!limitReached && !usageLoading && messagesRemaining <= DAILY_LIMIT && (
          <View style={styles.limitBanner}>
            <Ionicons name="chatbubble-outline" size={13} color="#FBBF24" />
            <Text style={styles.limitText}>
              {messagesRemaining} message{messagesRemaining !== 1 ? 's' : ''} remaining today
            </Text>
          </View>
        )}

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={[styles.messageList, messages.length === 0 && styles.messageListEmpty]}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<EmptyState onSuggest={sendMessage} />}
            ListFooterComponent={loading ? <TypingIndicator /> : null}
          />

          {/* Limit overlay */}
          {limitReached && (
            <View style={styles.limitOverlay}>
              <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />
              <View style={styles.limitCard}>
                <Ionicons name="lock-closed" size={36} color="#FBBF24" />
                <Text style={styles.limitTitle}>Daily Limit Reached</Text>
                <Text style={styles.limitSub}>Upgrade to Premium for unlimited AI health conversations</Text>
                <TouchableOpacity style={styles.upgradeBtn}>
                  <Text style={styles.upgradeBtnText}>Upgrade to Premium</Text>
                </TouchableOpacity>
                <Text style={styles.resetNote}>Resets at midnight</Text>
              </View>
            </View>
          )}

          {/* Input bar */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask about air quality or your health..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              multiline
              maxLength={500}
              editable={!limitReached && !loading}
              onSubmitEditing={handleSend}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || loading || limitReached) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || loading || limitReached}
            >
              {loading
                ? <ActivityIndicator size="small" color="#000" />
                : <Ionicons name="send" size={18} color="#000" />
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const DAILY_LIMIT = 3;

function EmptyState({ onSuggest }: { onSuggest: (t: string) => void }) {
  return (
    <View style={emptyStyles.container}>
      <View style={emptyStyles.orb}>
        <Ionicons name="leaf" size={32} color="#4ADE80" />
      </View>
      <Text style={emptyStyles.title}>Ask EnviroCare AI</Text>
      <Text style={emptyStyles.sub}>Get personalized air quality & health advice based on your profile</Text>
      <Text style={emptyStyles.suggestLabel}>Try asking</Text>
      <View style={emptyStyles.grid}>
        {SUGGESTED.map((s, i) => (
          <TouchableOpacity key={i} style={emptyStyles.chip} onPress={() => onSuggest(s)}>
            <Text style={emptyStyles.chipText}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#FFF' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  clearBtn: { padding: 8 },
  contextPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center',
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 8,
    backgroundColor: 'rgba(6,182,212,0.1)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.2)',
  },
  contextText: { fontSize: 12, color: '#06B6D4', fontWeight: '600' },
  limitBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
  },
  limitText: { fontSize: 13, color: '#FBBF24', fontWeight: '500' },
  messageList: { paddingHorizontal: 16, paddingVertical: 8 },
  messageListEmpty: { flexGrow: 1 },
  limitOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 10, alignItems: 'center', justifyContent: 'center' },
  limitCard: {
    margin: 24, padding: 32, borderRadius: 24, alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(12,12,20,0.96)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  limitTitle: { fontSize: 20, fontWeight: '700', color: '#FFF', textAlign: 'center', marginTop: 4 },
  limitSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 20 },
  upgradeBtn: {
    marginTop: 8, backgroundColor: '#FBBF24',
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16,
  },
  upgradeBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
  resetNote: { fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 4 },
  inputRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  input: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 22,
    paddingHorizontal: 18, paddingVertical: 12, color: '#FFF', fontSize: 15,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', maxHeight: 100,
  },
  sendBtn: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: '#4ADE80',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end',
  },
  sendBtnDisabled: { opacity: 0.35 },
});

const emptyStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 48, paddingHorizontal: 20 },
  orb: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  suggestLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  chipText: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
});
