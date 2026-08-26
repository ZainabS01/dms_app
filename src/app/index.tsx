import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

export default function CustomSplashScreen() {
  // Animation values
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(30)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Dismiss the native splash screen immediately to show our animated splash screen
    SplashScreen.hideAsync().catch(() => {});

    const checkLoginStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const userDataStr = await AsyncStorage.getItem('userData');
        const appLock = await AsyncStorage.getItem('appLock');
        
        if (token && userDataStr) {
          const user = JSON.parse(userDataStr);
          
          if (appLock === 'enabled') {
            const auth = await LocalAuthentication.authenticateAsync({
              promptMessage: 'Unlock DMS',
              fallbackLabel: 'Use PIN'
            });
            if (!auth.success) {
              return;
            }
          }

          if (user.role === 'student') {
            router.replace('/(student)' as any);
          } else if (user.role === 'teacher') {
            router.replace('/(teacher)' as any);
          } else if (user.role === 'admin') {
            router.replace('/(admin)' as any);
          } else {
            router.replace('/login' as any);
          }
        } else {
          router.replace('/login' as any);
        }
      } catch (e) {
        router.replace('/login' as any);
      }
    };

    const timer = setTimeout(() => {
      checkLoginStatus();
    }, 3500);

    // Start modern staggered animation
    Animated.sequence([
      // 1. Logo fades in and scales up
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // 2. Text slides up and fades in
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Animated Logo */}
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
            marginBottom: -50 // Pulled text significantly closer to compensate for transparent padding in PNG
          }}
        >
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Animated Text Lines */}
        <Animated.View
          style={{
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
            alignItems: 'center'
          }}
        >
          <Text style={styles.title}>Department Management System</Text>
          <Text style={styles.subtitle}>Where Knowledge Meets Excellence</Text>
        </Animated.View>
      </View>
      <Text style={styles.versionText}>Version 1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // White background
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: 20,
    width: '100%',
  },
  // logoBox: {
  //   backgroundColor: '#ffffff',
  //   padding: 15,
  //   borderRadius: 25,
  //   marginBottom: 15,
  // },
  logo: {
    width: 260, // Much larger logo size
    height: 260,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#001b3a', // Navy blue text
    textAlign: 'center',
    marginBottom: 5,
    letterSpacing: 0.5,
    paddingHorizontal: 45, // Keeps text away from sides and wraps beautifully
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#eab308', // Gold/Yellow text
    textAlign: 'center',
    fontStyle: 'normal',
  },
  versionText: {
    position: 'absolute',
    bottom: 45,
    fontSize: 13,
    fontWeight: 'bold',
    color: '#94a3b8',
    letterSpacing: 0.5,
  },
});
