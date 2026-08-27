import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, DeviceEventEmitter, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export function GlobalToast() {
  const [toast, setToast] = useState<{ title: string; message?: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const slideAnim = useRef(new Animated.Value(-150)).current; // Start off-screen at the top
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadTheme = async () => {
      const theme = await AsyncStorage.getItem('appTheme');
      setIsDarkMode(theme === 'dark');
    };
    loadTheme();
    const themeSub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);

    const toastSub = DeviceEventEmitter.addListener('showToast', (data) => {
      // Clear previous timeout if any
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      setToast(data);
      
      // Animate In
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: Platform.OS === 'ios' ? 50 : 60, // Position below status bar/safe area
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        })
      ]).start();

      // Auto Dismiss after 3.5 seconds
      timeoutRef.current = setTimeout(() => {
        dismissToast();
      }, 3500);
    });

    return () => {
      themeSub.remove();
      toastSub.remove();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const dismissToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -150,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      })
    ]).start(() => {
      setToast(null);
    });
  };

  if (!toast) return null;

  const isError = toast.type === 'error';
  const iconName = isError ? 'close-circle-outline' : (toast.type === 'info' ? 'information-circle-outline' : 'checkmark-circle-outline');
  const iconColor = isError ? '#ef4444' : (toast.type === 'info' ? '#3b82f6' : '#10b981');
  const borderColor = isError ? '#fecaca' : '#dcfce3';
  const darkBorderColor = isError ? '#7f1d1d' : '#064e3b';

  return (
    <Animated.View 
      style={[
        styles.toastContainer, 
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
        isDarkMode 
          ? { backgroundColor: '#1e293b', borderColor: darkBorderColor } 
          : { backgroundColor: '#ffffff', borderColor: borderColor }
      ]}
    >
      <View style={styles.toastContent}>
        <Ionicons name={iconName} size={28} color={iconColor} style={styles.icon} />
        <View style={styles.textContainer}>
          <Text style={[styles.messageText, isDarkMode && { color: '#ffffff' }]} numberOfLines={2}>
            {toast.message || toast.title}
          </Text>
        </View>
        <TouchableOpacity onPress={dismissToast} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color={isDarkMode ? '#64748b' : '#94a3b8'} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  messageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
  },
});
