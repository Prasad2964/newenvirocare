import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  error?: boolean;
}

const STORAGE_KEY = 'envirocare_chat_history';
const MAX_STORED = 20;
const DAILY_LIMIT = 20;

export function useChat(aqi: number | null, city: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [messagesRemaining, setMessagesRemaining] = useState(DAILY_LIMIT);
  const [limitReached, setLimitReached] = useState(false);
  const [usageLoading, setUsageLoading] = useState(true);

  useEffect(() => {
    loadHistory();
    fetchUsage();
  }, []);

  async function loadHistory() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setMessages(JSON.parse(stored));
    } catch (_) {}
  }

  async function fetchUsage() {
    try {
      const data = await api.get('/api/chat/usage');
      setMessagesRemaining(data.messages_remaining);
      setLimitReached(data.messages_remaining === 0);
    } catch (_) {}
    finally { setUsageLoading(false); }
  }

  async function persistMessages(msgs: Message[]) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-MAX_STORED)));
    } catch (_) {}
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading || limitReached) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const currentMessages = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: Message[] = currentMessages ? JSON.parse(currentMessages) : [];
      const history = [...parsed, userMsg].slice(-6).map(m => ({ role: m.role, content: m.content }));

      const data = await api.post('/api/chat', { message: text.trim(), history, aqi, city });

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => {
        const updated = [...prev, aiMsg];
        persistMessages(updated);
        return updated;
      });
      setMessagesRemaining(data.messages_remaining);
      setLimitReached(data.messages_remaining === 0);
    } catch (e: any) {
      const isLimit = e.message?.includes('limit') || e.message?.includes('429') || e.message?.includes('quota');
      if (isLimit) { setLimitReached(true); setMessagesRemaining(0); }

      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: isLimit
          ? (e.message?.includes('quota') || e.message?.includes('wait')
              ? 'AI quota exceeded. Please wait a minute and try again.'
              : 'Daily limit reached. Upgrade to Premium for unlimited chats.')
          : (e.message || 'Something went wrong. Please try again.'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        error: true,
      };
      setMessages(prev => {
        const updated = [...prev, errMsg];
        persistMessages(updated);
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [loading, limitReached, aqi, city]);

  const clearHistory = useCallback(async () => {
    setMessages([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return { messages, loading, messagesRemaining, limitReached, usageLoading, sendMessage, clearHistory };
}
