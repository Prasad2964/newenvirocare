import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  error?: boolean;
}

export function ChatBubble({ role, content, timestamp, error }: Props) {
  const isUser = role === 'user';
  return (
    <View style={[styles.row, isUser && styles.rowReverse]}>
      {!isUser && (
        <View style={[styles.aiAvatar, error && styles.aiAvatarError]}>
          <Ionicons name={error ? 'warning-outline' : 'leaf'} size={14} color={error ? '#F87171' : '#4ADE80'} />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble, error && styles.errorBubble]}>
        <Text style={[styles.content, isUser && styles.userContent, error && styles.errorContent]}>{content}</Text>
        <Text style={[styles.time, isUser && styles.timeUser]}>{timestamp}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginBottom: 14, alignItems: 'flex-end', gap: 8 },
  rowReverse: { flexDirection: 'row-reverse' },
  aiAvatar: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(74,222,128,0.12)', borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  aiAvatarError: { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: 'rgba(248,113,113,0.3)' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  aiBubble: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', borderBottomLeftRadius: 4,
  },
  userBubble: { backgroundColor: '#4ADE80', borderBottomRightRadius: 4 },
  errorBubble: { backgroundColor: 'rgba(248,113,113,0.1)', borderColor: 'rgba(248,113,113,0.2)' },
  content: { fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 22 },
  userContent: { color: '#000' },
  errorContent: { color: '#F87171' },
  time: { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4, alignSelf: 'flex-end' },
  timeUser: { color: 'rgba(0,0,0,0.4)' },
});
