import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, DeviceEventEmitter, ActivityIndicator, Alert, SafeAreaView, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { API_URL, BASE_URL } from '@/config/api';

export default function TeacherTimetable() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [timetable, setTimetable] = useState<any>(null);
  const [selectedSemester, setSelectedSemester] = useState('1');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setIsEditing(false);
    setSelectedFile(null);
    const loadThemeAndData = async () => {
      const theme = await AsyncStorage.getItem('appTheme');
      setIsDarkMode(theme === 'dark');
      const dataStr = await AsyncStorage.getItem('userData');
      if (dataStr) {
        const user = JSON.parse(dataStr);
        setUserData(user);
        if (user.department) {
          fetchTimetable(user.department, selectedSemester);
        }
      }
    };
    loadThemeAndData();
  }, [selectedSemester]);

  useEffect(() => {
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
      } else {
        setTimetable(null);
      }
    } catch (err) {
      console.error(err);
      setTimetable(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      
      const file = result.assets[0];
      setSelectedFile(file);
    } catch (err) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleUploadTimetable = async () => {
    if (!selectedFile) return Alert.alert('Error', 'Please select a PDF file');
    
    setSaving(true);
    try {
      // Fetch the file locally as a Blob to bypass React Native FormData regressions
      const localFileResponse = await fetch(selectedFile.uri);
      const blob = await localFileResponse.blob();

      const formData = new FormData();
      formData.append('department', userData.department);
      formData.append('semester', selectedSemester);
      formData.append('file', blob, selectedFile.name || 'timetable.pdf');

      const res = await fetch(`${API_URL}/timetables`, {
        method: 'POST',
        body: formData,
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.ok) {
        Alert.alert('Success', isEditing ? 'Timetable updated successfully' : 'Timetable published successfully');
        setSelectedFile(null);
        setIsEditing(false);
        fetchTimetable(userData.department, selectedSemester);
      } else {
        const data = await res.json();
        Alert.alert('Error', data.message || 'Failed to publish timetable');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const openPdf = async (fileUrl: string) => {
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

  const handleDeleteTimetable = async () => {
    if (!timetable?._id) return;
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this timetable?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/timetables/${timetable._id}`, {
                method: 'DELETE'
              });
              if (res.ok) {
                Alert.alert('Success', 'Timetable deleted successfully');
                setTimetable(null);
                setSelectedFile(null);
              } else {
                Alert.alert('Error', 'Failed to delete timetable');
              }
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Network error occurred');
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
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]} numberOfLines={1}>Manage Timetable</Text>
      </View>

      {/* Semester Dropdown Filter */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 15, zIndex: 10 }}>
        <TouchableOpacity 
          style={[styles.dropdownButton, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}
          onPress={() => setShowDropdown(!showDropdown)}
        >
          <Text style={[styles.dropdownButtonText, isDarkMode && { color: '#ffffff' }]}>
            {`Semester ${selectedSemester}`}
          </Text>
          <Ionicons 
            name={showDropdown ? "chevron-up" : "chevron-down"} 
            size={20} 
            color={isDarkMode ? '#ffffff' : '#001b3a'} 
          />
        </TouchableOpacity>

        {showDropdown && (
          <View style={[styles.dropdownList, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            {['1', '2', '3', '4', '5', '6', '7', '8'].map((sem) => (
              <TouchableOpacity
                key={sem}
                style={[
                  styles.dropdownItem,
                  selectedSemester === sem && { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }
                ]}
                onPress={() => {
                  setSelectedSemester(sem);
                  setShowDropdown(false);
                }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  isDarkMode && { color: '#ffffff' },
                  selectedSemester === sem && { fontWeight: 'bold', color: isDarkMode ? '#38bdf8' : '#001b3a' }
                ]}>
                  {`Semester ${sem}`}
                </Text>
                {selectedSemester === sem && (
                  <Ionicons 
                    name="checkmark" 
                    size={16} 
                    color={isDarkMode ? '#38bdf8' : '#001b3a'} 
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 150 }}>
        {loading ? (
          <ActivityIndicator size="large" color={isDarkMode ? '#38bdf8' : '#001b3a'} style={{ marginTop: 50 }} />
        ) : (
          <>
            {timetable && !isEditing ? (
              <View style={[styles.timetableCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons name="calendar-clock" size={40} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
                  <View style={{ flex: 1, marginLeft: 15 }}>
                    <Text style={[styles.cardTitle, isDarkMode && { color: '#f8fafc' }, { marginBottom: 4 }]}>Semester {selectedSemester} Timetable</Text>
                    <Text style={[styles.dateText, isDarkMode && { color: '#94a3b8' }]}>
                      Published: {new Date(timetable.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
                
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { flex: 1, backgroundColor: '#001b3a' }]} 
                    onPress={() => openPdf(timetable.fileUrl)}
                  >
                    <MaterialCommunityIcons name="file-pdf-box" size={20} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.actionBtnText}>View</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.actionBtn, 
                      { flex: 1, backgroundColor: isDarkMode ? '#38bdf8' : '#e2e8f0', borderWidth: 1, borderColor: isDarkMode ? '#38bdf8' : '#cbd5e1' }
                    ]} 
                    onPress={() => setIsEditing(true)}
                  >
                    <Ionicons name="cloud-upload-outline" size={20} color="#001b3a" style={{ marginRight: 6 }} />
                    <Text style={[styles.actionBtnText, { color: '#001b3a' }]}>Upload New</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.deleteBtn, isDarkMode && { borderColor: '#ef4444', backgroundColor: '#1e293b' }]} 
                    onPress={handleDeleteTimetable}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={[styles.uploadCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
                <Text style={[styles.cardTitle, isDarkMode && { color: '#f8fafc' }]}>
                  {isEditing ? `Update Semester ${selectedSemester} Timetable` : 'Upload Class Timetable'}
                </Text>
                
                <Text style={[styles.label, isDarkMode && { color: '#94a3b8' }]}>Department</Text>
                <View style={[styles.readonlyInput, isDarkMode && { backgroundColor: '#334155' }]}>
                  <Text style={[styles.readonlyText, isDarkMode && { color: '#f8fafc' }]}>{userData?.department}</Text>
                </View>

                <TouchableOpacity 
                  style={[styles.uploadBox, isDarkMode && { backgroundColor: '#0f172a', borderColor: '#38bdf8' }]} 
                  onPress={handlePickDocument}
                >
                  {selectedFile ? (
                    <View style={{ alignItems: 'center' }}>
                       <Ionicons name="document-text" size={40} color="#10b981" />
                      <Text style={[styles.fileName, isDarkMode && { color: '#f8fafc' }]} numberOfLines={1}>{selectedFile.name}</Text>
                      <Text style={{ color: '#64748b', marginTop: 5 }}>Tap to change file</Text>
                    </View>
                  ) : (
                    <View style={{ alignItems: 'center' }}>
                      <Ionicons name="cloud-upload-outline" size={40} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
                      <Text style={[styles.uploadText, isDarkMode && { color: '#94a3b8' }]}>Select PDF Timetable</Text>
                    </View>
                  )}
                </TouchableOpacity>
                
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {isEditing && (
                    <TouchableOpacity 
                      style={[styles.cancelBtn, { flex: 1 }]} 
                      onPress={() => { setIsEditing(false); setSelectedFile(null); }}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity 
                    style={[
                      styles.saveBtn, 
                      { flex: 1 }, 
                      isDarkMode && { backgroundColor: '#38bdf8' },
                      !selectedFile && { opacity: 0.5 }
                    ]} 
                    onPress={handleUploadTimetable}
                    disabled={saving || !selectedFile}
                  >
                    {saving ? (
                      <ActivityIndicator color={isDarkMode ? '#001b3a' : '#ffffff'} />
                    ) : (
                      <Text style={[styles.saveBtnText, isDarkMode && { color: '#001b3a' }]}>{isEditing ? 'Save Changes' : 'Publish Timetable'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
    paddingTop: Platform.OS === 'android' ? 50 : 20, paddingBottom: 20, paddingHorizontal: 24, 
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' 
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#001b3a', flex: 1 },
  
  // Dropdown styles
  dropdownButton: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 16, height: 45
  },
  dropdownButtonText: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  dropdownList: {
    position: 'absolute', top: 70, left: 20, right: 20,
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 5,
    zIndex: 999, paddingVertical: 6
  },
  dropdownItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16
  },
  dropdownItemText: { fontSize: 14, color: '#475569' },

  uploadCard: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, marginBottom: 30, borderWidth: 1, borderColor: '#e2e8f0' },
  timetableCard: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, marginBottom: 30, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  readonlyInput: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginBottom: 15 },
  readonlyText: { fontSize: 16, color: '#334155', fontWeight: '500' },
  
  uploadBox: { 
    borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', 
    borderRadius: 16, padding: 30, alignItems: 'center', 
    backgroundColor: '#f8fafc', marginBottom: 20 
  },
  uploadText: { marginTop: 10, fontSize: 16, color: '#64748b', fontWeight: '500' },
  fileName: { marginTop: 10, fontSize: 16, color: '#0f172a', fontWeight: 'bold', textAlign: 'center' },
  
  saveBtn: { backgroundColor: '#001b3a', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  actionBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 },
  cancelBtn: { backgroundColor: '#f1f5f9', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  cancelBtnText: { color: '#64748b', fontSize: 16, fontWeight: 'bold' },
  editBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#001b3a',
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  deleteBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ef4444',
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  dateText: { fontSize: 13, color: '#64748b', marginTop: 4 }
});
