import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

let addToastFn: ((toast: Omit<ToastData, 'id'>) => void) | null = null;

export function showToast(message: string, type: ToastData['type'] = 'info', duration = 3000) {
  addToastFn?.({ message, type, duration });
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    addToastFn = (toast) => {
      const id = Date.now().toString();
      setToasts(prev => [...prev, { ...toast, id }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, toast.duration || 3000);
    };
    return () => { addToastFn = null; };
  }, []);

  const iconMap = {
    success: { name: 'checkmark-circle', color: '#4ADE80' },
    error: { name: 'close-circle', color: '#F87171' },
    warning: { name: 'warning', color: '#FACC15' },
    info: { name: 'information-circle', color: '#06B6D4' },
  };

  return (
    <View style={styles.wrapper}>
      {children}
      <View style={styles.toastContainer} pointerEvents="box-none">
        {toasts.map((toast) => {
          const icon = iconMap[toast.type];
          return (
            <TouchableOpacity
              key={toast.id}
              style={[styles.toast, { borderLeftColor: icon.color }]}
              onPress={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              activeOpacity={0.8}
            >
              <Ionicons name={icon.name as any} size={20} color={icon.color} />
              <Text style={styles.toastText}>{toast.message}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderLeftWidth: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
});
