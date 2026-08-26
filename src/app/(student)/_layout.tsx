import { Tabs, useFocusEffect } from 'expo-router';
import { View, TouchableOpacity, Text, StyleSheet, DeviceEventEmitter } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

function ModernTabBar({ state, descriptors, navigation }: any) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadTheme = async () => {
        const theme = await AsyncStorage.getItem('appTheme');
        setIsDarkMode(theme === 'dark');
      };
      loadTheme();
      
      const sub = DeviceEventEmitter.addListener('themeChanged', (isDark) => {
        setIsDarkMode(isDark);
      });
      return () => sub.remove();
    }, [])
  );

  return (
    <>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <View style={[styles.tabBarContainer, isDarkMode && { backgroundColor: '#1e293b' }]}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          if (['attendance', 'results', 'tasks', 'timetable', 'queries', 'applications', 'feedback'].includes(route.name)) return null;
          
          const isFocused = state.index === index;
        
        let iconName = 'home';
        if (route.name === 'courses') iconName = 'book';
        if (route.name === 'nexiai') iconName = 'robot-outline';
        if (route.name === 'profile') iconName = 'person';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={index}
            onPress={onPress}
            style={[styles.tabItem, isFocused && styles.tabItemActive]}
          >
            {route.name === 'nexiai' ? (
              <MaterialCommunityIcons name={iconName as any} size={22} color={isFocused ? '#ffffff' : '#94a3b8'} />
            ) : (
              <Ionicons name={iconName as any} size={22} color={isFocused ? '#ffffff' : '#94a3b8'} />
            )}
            {isFocused && (
              <Text style={styles.tabText}>{options.title || route.name}</Text>
            )}
          </TouchableOpacity>
        );
      })}
      </View>
    </>
  );
}

export default function StudentLayout() {
  return (
    <Tabs tabBar={(props) => <ModernTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="courses" options={{ title: 'Courses' }} />
      <Tabs.Screen name="nexiai" options={{ title: 'Nexi AI' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="attendance" options={{ href: null }} />
      <Tabs.Screen name="results" options={{ href: null }} />
      <Tabs.Screen name="feedback" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 35,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 24, // Matches section corners
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 16, // So it fits nicely inside the 24px container
  },
  tabItemActive: {
    backgroundColor: '#eab308', // Yellow
  },
  tabText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
    textTransform: 'capitalize'
  }
});
