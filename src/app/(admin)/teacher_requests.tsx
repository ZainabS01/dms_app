import { API_URL as CENTRAL_API_URL } from '@/config/api';
import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  SafeAreaView, Alert, ActivityIndicator, Platform, DeviceEventEmitter
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, router } from 'expo-router';

const cleanDeptName = (name: string) => {
  return (name || '').replace(/^(BS\s+|BS)/i, '').trim();
};

export default function TeacherRequestsManager() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${CENTRAL_API_URL}/auth/teachers-pending`);
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load teacher requests.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadTheme = async () => {
        const theme = await AsyncStorage.getItem('appTheme');
        setIsDarkMode(theme === 'dark');
      };
      loadTheme();
      fetchRequests();

      const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
      return () => sub.remove();
    }, [])
  );

  const handleApprove = async (id: string, name: string) => {
    setProcessingId(id);
    try {
      const response = await fetch(`${CENTRAL_API_URL}/auth/teachers/${id}/approve`, {
        method: 'PUT'
      });
      if (response.ok) {
        Alert.alert('Success', `${name} has been approved.`);
        fetchRequests();
      } else {
        Alert.alert('Error', 'Failed to approve teacher.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network communication issue.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = (id: string, name: string) => {
    Alert.alert(
      'Confirm Reject',
      `Are you sure you want to reject ${name}'s request? This will delete their registration request.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(id);
            try {
              const response = await fetch(`${CENTRAL_API_URL}/auth/teachers/${id}/reject`, {
                method: 'PUT'
              });
              if (response.ok) {
                Alert.alert('Success', `${name}'s request has been rejected.`);
                fetchRequests();
              } else {
                Alert.alert('Error', 'Failed to reject teacher.');
              }
            } catch (error) {
              Alert.alert('Error', 'Network communication issue.');
            } finally {
              setProcessingId(null);
            }
          }
        }
      ]
    );
  };

  const renderRequestItem = ({ item }: { item: any }) => (
    <View style={[styles.card, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
      <View style={styles.infoContainer}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={20} color="#001b3a" />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.name, isDarkMode && { color: '#ffffff' }]}>{item.name}</Text>
          <Text style={styles.email}>{item.email}</Text>
          {item.department && <Text style={styles.meta}>Dept: {cleanDeptName(item.department)}</Text>}
        </View>
      </View>
      
      <View style={styles.actions}>
        {processingId === item._id ? (
          <ActivityIndicator size="small" color="#001b3a" />
        ) : (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleApprove(item._id, item.name)}>
              <Ionicons name="checkmark-circle-outline" size={24} color="#16a34a" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleReject(item._id, item.name)}>
              <Ionicons name="close-circle-outline" size={24} color="#ef4444" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#ffffff' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>Teacher Requests</Text>
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator size="large" color="#001b3a" style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={item => item._id}
          renderItem={renderRequestItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>No pending approval requests.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 50 : 20, paddingBottom: 15, paddingHorizontal: 20,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
  },
  backBtn: { padding: 4, marginRight: 10 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  
  list: { padding: 15, paddingBottom: 100 },
  card: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 15,
    padding: 15, marginBottom: 12
  },
  infoContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  email: { fontSize: 13, color: '#64748b', marginTop: 2 },
  meta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  actionBtn: { padding: 4 }
});
