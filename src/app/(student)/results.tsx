import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, DeviceEventEmitter, ActivityIndicator, SafeAreaView, Platform, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Print from 'expo-print';

import { API_URL, BASE_URL } from '@/config/api';

export default function StudentResults() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadThemeAndData = async () => {
      const theme = await AsyncStorage.getItem('appTheme');
      setIsDarkMode(theme === 'dark');
      const dataStr = await AsyncStorage.getItem('userData');
      if (dataStr) {
        const user = JSON.parse(dataStr);
        setUserData(user);
        const roll = user.roll_no || user.rollNo || user.rollno;
        if (roll) {
          fetchResults(roll);
        }
      }
    };
    loadThemeAndData();
    const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
    return () => sub.remove();
  }, []);

  const fetchResults = async (rollNo: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/results/student/${encodeURIComponent(rollNo)}`);
      if (res.ok) {
        setResults(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const generateResultCard = async (resItem: any) => {
    try {
      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 30px; color: #1e293b; border: 10px solid #f1f5f9; }
              .header { text-align: center; border-bottom: 3px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }
              .school-name { font-size: 28px; font-weight: bold; color: #001b3a; margin-bottom: 5px; }
              .title { font-size: 22px; font-weight: bold; color: #3b82f6; letter-spacing: 2px; text-transform: uppercase; }
              .student-card { background: #f8fafc; padding: 25px; border-radius: 12px; margin-bottom: 30px; }
              .student-card p { margin: 10px 0; font-size: 18px; }
              .result-details { margin-top: 20px; }
              .result-row { display: flex; justify-content: space-between; padding: 15px; border-bottom: 1px solid #e2e8f0; font-size: 18px; }
              .highlight { color: #0f172a; font-weight: bold; font-size: 22px; }
              .footer { margin-top: 50px; text-align: center; font-size: 14px; color: #64748b; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="school-name">DMS Institute</div>
              <div class="title">Official Result Card</div>
            </div>
            
            <div class="student-card">
              <p><strong>Student Name:</strong> ${userData?.name || 'N/A'}</p>
              <p><strong>Roll Number:</strong> ${(userData?.roll_no || userData?.rollNo || 'N/A').toUpperCase()}</p>
              <p><strong>Department:</strong> ${(userData?.department || 'N/A').toUpperCase()}</p>
              <p><strong>Semester:</strong> ${resItem.semester} Semester</p>
            </div>
            
            <div class="result-details">
              <div class="result-row">
                <span>GPA:</span>
                <span class="highlight">${resItem.gpa || 'N/A'}</span>
              </div>
              <div class="result-row">
                <span>CGPA:</span>
                <span class="highlight">${resItem.cgpa || 'N/A'}</span>
              </div>
              <div class="result-row">
                <span>Declaration Date:</span>
                <span class="highlight">${new Date(resItem.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            
            <div class="footer">
              This is a computer generated document.
            </div>
          </body>
        </html>
      `;

      await Print.printAsync({ html });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to generate Result Card');
    }
  };

  const handleDeleteResult = (resItem: any) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete the result for Semester ${resItem.semester}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const studentId = userData._id || userData.id;
              const res = await fetch(`${API_URL}/results/record/${encodeURIComponent(resItem.department)}/${encodeURIComponent(resItem.semester)}/${encodeURIComponent(studentId)}`, {
                method: 'DELETE'
              });
              if (res.ok) {
                Alert.alert('Success', 'Result deleted successfully');
                const roll = userData.roll_no || userData.rollNo || userData.rollno;
                if (roll) fetchResults(roll);
              } else {
                Alert.alert('Error', 'Failed to delete result');
              }
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Network Error');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#1e293b' }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#f8fafc' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>My Results</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 150 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
        ) : results.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={60} color={isDarkMode ? '#334155' : '#cbd5e1'} />
            <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }]}>No result files published yet.</Text>
          </View>
        ) : (
          results.map(res => (
            <View 
              key={res._id} 
              style={[styles.resultCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}
            >
              <View style={[
                styles.iconBox, 
                isDarkMode ? { backgroundColor: '#334155' } : { backgroundColor: '#e6f0fa' }
              ]}>
                <MaterialCommunityIcons 
                  name="certificate" 
                  size={35} 
                  color={isDarkMode ? '#38bdf8' : '#001b3a'} 
                />
              </View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={[styles.termTitle, isDarkMode && { color: '#f8fafc' }]}>{res.semester} Semester</Text>
                <Text style={[styles.fileName, isDarkMode && { color: '#94a3b8' }]}>CGPA: {res.cgpa || '--'} | GPA: {res.gpa || '--'}</Text>
                <Text style={styles.dateText}>Published on {new Date(res.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 15 }}>
                <TouchableOpacity style={{ padding: 6 }} onPress={() => generateResultCard(res)}>
                  <Ionicons name="eye-outline" size={22} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
                </TouchableOpacity>
                <TouchableOpacity style={{ padding: 6 }} onPress={() => handleDeleteResult(res)}>
                  <Ionicons name="trash-outline" size={22} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', alignItems: 'center', 
    paddingTop: Platform.OS === 'android' ? 50 : 20, paddingBottom: 20, paddingHorizontal: 24, 
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' 
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#001b3a' },
  
  resultCard: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', 
    padding: 16, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' 
  },
  iconBox: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#e6f0fa', justifyContent: 'center', alignItems: 'center' },
  termTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  fileName: { fontSize: 13, color: '#64748b', marginTop: 2 },
  dateText: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { color: '#64748b', marginTop: 15, fontSize: 16 }
});
