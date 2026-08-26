import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  DeviceEventEmitter, ActivityIndicator, SafeAreaView, Platform, Alert 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import * as Print from 'expo-print';

import { API_URL } from '@/config/api';

export default function StudentAttendance() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Filter view state: 'today' (Daily), 'weekly' (This Week / Last 7 Days), or 'all' (Full History)
  const [filterType, setFilterType] = useState<'today' | 'weekly' | 'all'>('all');

  useFocusEffect(
    useCallback(() => {
      const loadThemeAndData = async () => {
        const theme = await AsyncStorage.getItem('appTheme');
        setIsDarkMode(theme === 'dark');
        const dataStr = await AsyncStorage.getItem('userData');
        if (dataStr) {
          const user = JSON.parse(dataStr);
          setUserData(user);
          fetchData(user.id || user._id);
        }
      };
      loadThemeAndData();
      const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
      return () => sub.remove();
    }, [])
  );

  const fetchData = async (studentId: string) => {
    setLoading(true);
    try {
      const attRes = await fetch(`${API_URL}/attendance/student/${studentId}`);
      if (attRes.ok) {
        setAttendanceData(await attRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredRecords = () => {
    if (!attendanceData?.records) return [];
    if (filterType === 'all') return attendanceData.records;
    
    if (filterType === 'weekly') {
      // Filter for last 7 days (Weekly view)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return attendanceData.records.filter((r: any) => new Date(r.date) >= sevenDaysAgo);
    }
    
    // filterType === 'today' (Daily view)
    const todayStr = new Date().toDateString();
    const todayRecords = attendanceData.records.filter((r: any) => new Date(r.date).toDateString() === todayStr);
    if (todayRecords.length === 0 && attendanceData.records.length > 0) {
      return [attendanceData.records[0]]; // fallback to latest record
    }
    return todayRecords;
  };

  const exportPDF = async () => {
    const filteredRecords = getFilteredRecords();
    if (filteredRecords.length === 0) {
      return Alert.alert('Empty', 'No records found for the selected view');
    }

    try {
      // Accumulate stats for filtered records
      let presentCount = 0;
      let absentCount = 0;
      let leaveCount = 0;
      
      filteredRecords.forEach((r: any) => {
        if (r.status === 'present') presentCount++;
        else if (r.status === 'absent') absentCount++;
        else if (r.status === 'leave') leaveCount++;
      });

      const subtitleText = filterType === 'today'
        ? 'Daily Attendance Report'
        : filterType === 'weekly' 
        ? 'Weekly Attendance Report (Last 7 Days)' 
        : 'Daily Status Report (Full History)';

      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 25px; color: #1e293b; }
              .header { text-align: center; border-bottom: 2px solid #001b3a; padding-bottom: 15px; margin-bottom: 25px; }
              .title { font-size: 26px; font-weight: bold; color: #001b3a; margin-bottom: 5px; }
              .subtitle { font-size: 15px; color: #64748b; }
              .student-card { background: #f8fafc; padding: 20px; border-radius: 12px; margin-bottom: 30px; border: 1px solid #e2e8f0; }
              .student-card p { margin: 8px 0; font-size: 15px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 14px; }
              th { background-color: #001b3a; color: #ffffff; font-weight: bold; }
              tr:nth-child(even) { background-color: #f8fafc; }
              .present { color: #16a34a; font-weight: bold; text-transform: uppercase; }
              .absent { color: #dc2626; font-weight: bold; text-transform: uppercase; }
              .leave { color: #d97706; font-weight: bold; text-transform: uppercase; }
              .summary { display: flex; justify-content: space-between; margin-top: 30px; background: #eff6ff; padding: 20px; border-radius: 12px; font-weight: bold; font-size: 15px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">Official Attendance Record</div>
              <div class="subtitle">${subtitleText}</div>
            </div>
            
            <div class="student-card">
              <p><strong>Student Name:</strong> ${userData?.name || 'N/A'}</p>
              <p><strong>Roll Number:</strong> ${userData?.roll_no || 'N/A'}</p>
              <p><strong>Department:</strong> ${userData?.department || 'N/A'}</p>
              <p><strong>Semester:</strong> Semester ${userData?.semester || 'N/A'}</p>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${filteredRecords.map((r: any) => `
                  <tr>
                    <td>${new Date(r.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                    <td class="${r.status}">${r.status}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="summary">
              <span>Total Days: ${filteredRecords.length}</span>
              <span class="present">Present: ${presentCount}</span>
              <span class="absent">Absent: ${absentCount}</span>
              <span class="leave">Leave: ${leaveCount}</span>
            </div>
          </body>
        </html>
      `;

      await Print.printAsync({ html });
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to generate PDF report');
    }
  };

  const filteredRecords = getFilteredRecords();

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#ffffff' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>My Attendance</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 150 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#001b3a" style={{ marginTop: 50 }} />
        ) : (
          <>
            {/* Overview Card */}
            {attendanceData && (
              <View style={[styles.overviewCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={[styles.statValue, isDarkMode && { color: '#f8fafc' }]}>{attendanceData.total}</Text>
                    <Text style={[styles.statLabel, isDarkMode && { color: '#64748b' }]}>Total Days</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: '#10b981' }]}>{attendanceData.present}</Text>
                    <Text style={[styles.statLabel, isDarkMode && { color: '#64748b' }]}>Present</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: '#ef4444' }]}>{attendanceData.absent}</Text>
                    <Text style={[styles.statLabel, isDarkMode && { color: '#64748b' }]}>Absent</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statValue, { color: '#f59e0b' }]}>{attendanceData.leave}</Text>
                    <Text style={[styles.statLabel, isDarkMode && { color: '#64748b' }]}>Leave</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Filter Toggle Control */}
            <View style={styles.filterContainer}>
              <TouchableOpacity 
                style={[
                  styles.filterBtnToggle, 
                  filterType === 'today' ? styles.filterBtnActive : (isDarkMode ? styles.btnDark : styles.btnLight)
                ]}
                onPress={() => setFilterType('today')}
              >
                <Text style={[
                  styles.filterBtnText, 
                  filterType === 'today' ? styles.filterBtnTextActive : (isDarkMode ? { color: '#cbd5e1' } : { color: '#475569' })
                ]}>Daily</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.filterBtnToggle, 
                  filterType === 'weekly' ? styles.filterBtnActive : (isDarkMode ? styles.btnDark : styles.btnLight)
                ]}
                onPress={() => setFilterType('weekly')}
              >
                <Text style={[
                  styles.filterBtnText, 
                  filterType === 'weekly' ? styles.filterBtnTextActive : (isDarkMode ? { color: '#cbd5e1' } : { color: '#475569' })
                ]}>This Week</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.filterBtnToggle, 
                  filterType === 'all' ? styles.filterBtnActive : (isDarkMode ? styles.btnDark : styles.btnLight)
                ]}
                onPress={() => setFilterType('all')}
              >
                <Text style={[
                  styles.filterBtnText, 
                  filterType === 'all' ? styles.filterBtnTextActive : (isDarkMode ? { color: '#cbd5e1' } : { color: '#475569' })
                ]}>Full History</Text>
              </TouchableOpacity>
            </View>

            {/* Daily Records */}
            <Text style={[styles.sectionTitle, isDarkMode && { color: '#e2e8f0' }]}>Daily Log</Text>
            {filteredRecords.length === 0 ? (
              <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }]}>No attendance records found for this view.</Text>
            ) : (
              filteredRecords.map((rec: any, idx: number) => (
                <View key={idx} style={[styles.recordRow, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="calendar" size={20} color={isDarkMode ? '#64748b' : '#94a3b8'} />
                    <Text style={[styles.recordDate, isDarkMode && { color: '#e2e8f0' }]}>
                      {new Date(rec.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <View style={[styles.badge, 
                    rec.status === 'present' ? { backgroundColor: '#dcfce7' } :
                    rec.status === 'absent' ? { backgroundColor: '#fee2e2' } : { backgroundColor: '#fef3c7' }
                  ]}>
                    <Text style={[styles.badgeText,
                      rec.status === 'present' ? { color: '#16a34a' } :
                      rec.status === 'absent' ? { color: '#dc2626' } : { color: '#d97706' }
                    ]}>{rec.status.toUpperCase()}</Text>
                  </View>
                </View>
              ))
            )}
            
            <TouchableOpacity style={styles.exportBtn} onPress={exportPDF}>
              <MaterialCommunityIcons name="file-pdf-box" size={24} color="#ffffff" />
              <Text style={styles.exportBtnText}>
                {filterType === 'today' ? 'Export Daily Report' : 
                 filterType === 'weekly' ? 'Export Weekly Report' : 'Export Full Report'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 50 : 20, paddingBottom: 15, paddingHorizontal: 15, 
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' 
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#001b3a', flex: 1 },
  
  overviewCard: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  statLabel: { fontSize: 13, color: '#64748b', marginTop: 4 },
  
  // Filter Toggle styling
  filterContainer: { 
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: '#f1f5f9', padding: 4, borderRadius: 12, marginBottom: 20 
  },
  filterBtnToggle: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  filterBtnActive: { backgroundColor: '#001b3a' },
  filterBtnText: { fontSize: 13, fontWeight: 'bold' },
  filterBtnTextActive: { color: '#ffffff' },
  btnLight: { backgroundColor: 'transparent' },
  btnDark: { backgroundColor: 'transparent' },

  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
  
  exportBtn: { 
    backgroundColor: '#001b3a', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    padding: 14, borderRadius: 12, marginTop: 25, marginBottom: 20 
  },
  exportBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
  
  recordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  recordDate: { fontSize: 14, fontWeight: '600', color: '#334155', marginLeft: 10 },
  
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: 'bold' },
  
  emptyText: { color: '#64748b', marginTop: 15, fontSize: 14, textAlign: 'center' }
});
