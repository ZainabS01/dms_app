import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, Linking, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { API_URL, BASE_URL } from '@/config/api';

export default function StudentTimetable() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  const [timetable, setTimetable] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const loadThemeAndData = async () => {
      const theme = await AsyncStorage.getItem('appTheme');
      setIsDarkMode(theme === 'dark');
      const dataStr = await AsyncStorage.getItem('userData');
      if (dataStr) {
        const user = JSON.parse(dataStr);
        setUserData(user);
        if (user.department && user.semester) {
          fetchTimetable(user.department, user.semester);
        }
      }
    };
    loadThemeAndData();
    const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
    return () => sub.remove();
  }, []);

  const fetchTimetable = async (department: string, semester: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/timetables/${encodeURIComponent(department)}/${encodeURIComponent(semester)}`);
      if (res.ok) {
        const data = await res.json();
        setTimetable(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPdf = async (fileUrl: string) => {
    try {
      const formatted = fileUrl.replace(/\\/g, '/');
      const fullUrl = `${BASE_URL}/${formatted}`;
      await Linking.openURL(fullUrl);
    } catch (err) {
      Alert.alert('Error', 'Failed to view PDF');
    }
  };

  const handleDownloadPdf = async (fileUrl: string) => {
    try {
      Alert.alert('Downloading', 'Downloading timetable, please wait...');
      const formatted = fileUrl.replace(/\\/g, '/');
      const fileName = formatted.split('/').pop() || 'timetable.pdf';
      const downloadUrl = `${BASE_URL}/api/auth/download?file=${encodeURIComponent(fileName)}`;
      await Linking.openURL(downloadUrl);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to download timetable');
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#1e293b' }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#f8fafc' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>Class Timetable</Text>
      </View>

      <View style={{ flex: 1, padding: 24 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
        ) : !timetable ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={80} color={isDarkMode ? '#334155' : '#cbd5e1'} />
            <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }]}>No timetable has been published yet.</Text>
          </View>
        ) : (
          <View style={[styles.card, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            <View style={{ alignItems: 'center', marginBottom: 20, marginTop: 10 }}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="calendar-clock" size={40} color="#001b3a" />
              </View>
              <Text style={[styles.title, isDarkMode && { color: '#f8fafc' }]}>Weekly Schedule</Text>
              <Text style={styles.subtitle}>{userData?.department} • {userData?.semester} Semester</Text>
            </View>

            <View style={{ alignItems: 'center', marginBottom: 15, padding: 25, width: '100%', backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9', borderRadius: 12, borderWidth: 1, borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
              <MaterialCommunityIcons
                name="file-pdf-box"
                size={54}
                color={isDarkMode ? "#38bdf8" : "#001b3a"}
              />
              <Text style={{ marginTop: 10, fontSize: 16, fontWeight: 'bold', color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                Class Timetable Document
              </Text>
              <Text style={{ marginTop: 4, fontSize: 12, color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                PDF Format
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, width: '100%' }}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.viewBtn, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}
                onPress={() => handleViewPdf(timetable.fileUrl)}
              >
                <Ionicons name="eye-outline" size={20} color={isDarkMode ? '#38bdf8' : '#001b3a'} style={{ marginRight: 8 }} />
                <Text style={[styles.btnText, isDarkMode && { color: '#f8fafc' }]}>View</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.downloadBtn, isDarkMode && { backgroundColor: '#38bdf8' }]}
                onPress={() => handleDownloadPdf(timetable.fileUrl)}
              >
                <Ionicons name="download-outline" size={20} color={isDarkMode ? '#001b3a' : '#ffffff'} style={{ marginRight: 8 }} />
                <Text style={[styles.btnText, { color: isDarkMode ? '#001b3a' : '#ffffff' }]}>Download</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.dateText}>Published on {new Date(timetable.createdAt).toLocaleDateString()}</Text>
          </View>
        )}
      </View>
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

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: '#64748b', marginTop: 20, fontSize: 16, textAlign: 'center' },

  card: {
    backgroundColor: '#ffffff', borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3
  },
  iconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#64748b', fontWeight: '500' },

  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  viewBtn: {
    backgroundColor: '#ffffff'
  },
  downloadBtn: {
    backgroundColor: '#001b3a',
    borderWidth: 0
  },
  btnText: { fontSize: 15, fontWeight: 'bold', color: '#001b3a' },
  dateText: { fontSize: 12, color: '#94a3b8', marginTop: 12 }
});
