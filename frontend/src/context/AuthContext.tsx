import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';

interface User {
  user_id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isFirstLaunch: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setFirstLaunchDone: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  loading: true,
  isFirstLaunch: true,
  login: async () => {},
  signup: async () => {},
  logout: async () => {},
  setFirstLaunchDone: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFirstLaunch, setIsFirstLaunch] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const [stored, launched] = await Promise.all([
        AsyncStorage.getItem('auth_token'),
        AsyncStorage.getItem('has_launched'),
      ]);
      if (launched) setIsFirstLaunch(false);
      if (stored) {
        api.setToken(stored);
        try {
          const userData = await api.get('/api/auth/me');
          setUser(userData);
          setToken(stored);
        } catch {
          await AsyncStorage.removeItem('auth_token');
          api.setToken(null);
        }
      }
    } catch {
      await AsyncStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const res = await api.post('/api/auth/login', { email, password });
    api.setToken(res.token);
    await AsyncStorage.setItem('auth_token', res.token);
    setUser(res.user);
    setToken(res.token);
  }

  async function signup(name: string, email: string, password: string) {
    await api.post('/api/auth/signup', { name, email, password });
    // Auto-login after signup
    const res = await api.post('/api/auth/login', { email, password });
    api.setToken(res.token);
    await AsyncStorage.setItem('auth_token', res.token);
    setUser(res.user);
    setToken(res.token);
  }

  async function logout() {
    api.setToken(null);
    await AsyncStorage.removeItem('auth_token');
    setUser(null);
    setToken(null);
  }

  async function setFirstLaunchDone() {
    await AsyncStorage.setItem('has_launched', 'true');
    setIsFirstLaunch(false);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, isFirstLaunch, login, signup, logout, setFirstLaunchDone }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
