import { API_URL } from '@/config/api';
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, DeviceEventEmitter, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Linking, Platform, SafeAreaView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function SubjectsScreen() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      const loadTheme = async () => {
        const theme = await AsyncStorage.getItem('appTheme');
        setIsDarkMode(theme === 'dark');
      };
      loadTheme();
      
      const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
      return () => sub.remove();
    }, [])
  );

  useEffect(() => {
    fetchUserDataAndSubjects();
  }, []);

  const fetchUserDataAndSubjects = async () => {
    try {
      const data = await AsyncStorage.getItem('userData');
      if (data) {
        const parsed = JSON.parse(data);
        setUserData(parsed);
        await fetchSubjects(parsed.department, parsed.semester);
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.error('Error fetching user data', e);
      setLoading(false);
    }
  };

  const fetchSubjects = async (department: string, semester: string) => {
    try {
      const res = await fetch(`${API_URL}/subjects/${department}/${semester}`);
      if (res.ok) {
        const data = await res.json();
        setSubjects(data);
      }
    } catch (error) {
      console.error("Error fetching subjects:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (userData) {
      fetchSubjects(userData.department, userData.semester);
    } else {
      setRefreshing(false);
    }
  }, [userData]);

  const openFile = (fileUrl: string) => {
    // We use Linking to open the file URL in the default browser/viewer
    Linking.openURL(fileUrl).catch(err => console.error("Couldn't load page", err));
  };

  const handleDownloadFile = async (fileUrl: string, fileName: string) => {
    try {
      Alert.alert('Downloading', 'Downloading file, please wait...');
      // Convert static view URL to attachment download URL
      const downloadUrl = fileUrl.replace('/uploads/', '/api/auth/download?file=');
      await Linking.openURL(downloadUrl);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to download file.');
    }
  };

  const renderSubjectCards = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#001b3a" />
        </View>
      );
    }

    if (subjects.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="library-outline" size={80} color={isDarkMode ? '#334155' : '#cbd5e1'} />
          <Text style={[styles.emptyTitle, isDarkMode && { color: '#f8fafc' }]}>No Subjects Yet</Text>
          <Text style={[styles.emptyDesc, isDarkMode && { color: '#94a3b8' }]}>
            It looks like teachers haven't uploaded any subjects or files for your semester yet.
          </Text>
        </View>
      );
    }

    return subjects.map((subject, index) => {
      const totalFiles = subject.folders ? subject.folders.reduce((acc: number, cat: any) => acc + (cat.files ? cat.files.length : 0), 0) : 0;

      return (
        <TouchableOpacity 
          key={index} 
          style={[styles.subjectCard, isDarkMode && { backgroundColor: '#1e293b', shadowColor: '#000', borderColor: '#334155' }]}
          activeOpacity={0.7}
          onPress={() => {
            setSelectedSubject(subject);
            setSelectedCategory(null);
          }}
        >
          <View style={styles.subjectHeader}>
            <View>
              <Text style={[styles.subjectCode, isDarkMode && { color: '#94a3b8' }]}>{subject.code.toUpperCase()}</Text>
              <Text style={[styles.subjectTitle, isDarkMode && { color: '#f8fafc' }]}>{subject.title}</Text>
            </View>
            <View style={[styles.crBadge, isDarkMode && { backgroundColor: '#0f172a' }]}>
              <Text style={[styles.crText, isDarkMode && { color: '#38bdf8' }]}>{subject.cr} CR</Text>
            </View>
          </View>
          
          <View style={[styles.subjectFooter, isDarkMode && { borderTopColor: '#334155' }]}>
            <View style={styles.footerItem}>
              <Ionicons name="document-text-outline" size={16} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
              <Text style={[styles.footerText, isDarkMode && { color: '#cbd5e1' }]}>{totalFiles} Files Available</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={isDarkMode ? '#64748b' : '#94a3b8'} />
          </View>
        </TouchableOpacity>
      );
    });
  };

  const getCategoryIcon = (name: string) => {
    switch(name.toLowerCase()) {
      case 'books': return 'book-outline';
      case 'lecture notes': return 'clipboard-outline';
      case 'assignments': return 'create-outline';
      case 'past papers': return 'time-outline';
      default: return 'folder-outline';
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
            <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#f8fafc' : '#001b3a'} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, isDarkMode && { color: '#f8fafc' }]}>My Subjects</Text>
            <Text style={[styles.subtitle, isDarkMode && { color: '#94a3b8' }]}>
              {userData ? `${userData.department.toUpperCase()} - Semester ${userData.semester}` : 'Loading...'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={isDarkMode ? '#fff' : '#000'} />}
      >
        {renderSubjectCards()}
      </ScrollView>

      {/* Modal for Categories / Files */}
      <Modal visible={!!selectedSubject} animationType="fade" transparent={true} onRequestClose={() => setSelectedSubject(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#0f172a' }]}>
            
            {/* Modal Header */}
            <View style={[styles.modalHeader, isDarkMode && { borderBottomColor: '#334155' }]}>
              <View style={{flex: 1}}>
                <Text style={[styles.modalTitle, isDarkMode && { color: '#f8fafc' }]} numberOfLines={1}>
                  {selectedCategory ? selectedCategory.name : selectedSubject?.title}
                </Text>
                {selectedCategory && (
                  <Text style={[styles.modalSubtitle, isDarkMode && { color: '#94a3b8' }]}>{selectedSubject?.title}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => {
                if (selectedCategory) {
                  setSelectedCategory(null);
                } else {
                  setSelectedSubject(null);
                }
              }} style={[styles.closeBtn, isDarkMode && { backgroundColor: '#1e293b' }]}>
                <Ionicons name={selectedCategory ? "arrow-back" : "close"} size={24} color={isDarkMode ? '#f8fafc' : '#0f172a'} />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView style={styles.modalBody}>
              {!selectedCategory ? (
                // CATEGORIES VIEW
                <View style={styles.categoriesGrid}>
                  {(selectedSubject?.folders || []).filter((f: any) => !f.parentId).map((cat: any, idx: number) => (
                    <TouchableOpacity 
                      key={idx} 
                      style={[styles.categoryCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}
                      onPress={() => setSelectedCategory(cat)}
                    >
                      <View style={[styles.categoryIconBox, isDarkMode && { backgroundColor: '#0f172a' }]}>
                        <Ionicons name={getCategoryIcon(cat.name)} size={28} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
                      </View>
                      <Text style={[styles.categoryName, isDarkMode && { color: '#f8fafc' }]}>{cat.name}</Text>
                      <Text style={[styles.fileCount, isDarkMode && { color: '#94a3b8' }]}>{cat.files.length} Files</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                // FILES VIEW
                <View style={styles.filesList}>
                  {selectedCategory.files.length === 0 ? (
                    <View style={styles.emptyFiles}>
                      <Ionicons name="folder-open-outline" size={50} color={isDarkMode ? '#334155' : '#cbd5e1'} />
                      <Text style={[styles.emptyFilesText, isDarkMode && { color: '#94a3b8' }]}>No files uploaded in this category yet.</Text>
                    </View>
                  ) : (
                    selectedCategory.files.map((file: any, idx: number) => (
                      <View 
                        key={idx} 
                        style={[styles.fileItem, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}
                      >
                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                          onPress={() => openFile(file.fileUrl)}
                        >
                          <View style={[styles.fileIconBox, { backgroundColor: file.fileName.toLowerCase().endsWith('.pdf') ? '#fee2e2' : '#e0f2fe' }]}>
                            <Ionicons name="document-outline" size={24} color={file.fileName.toLowerCase().endsWith('.pdf') ? '#ef4444' : '#0ea5e9'} />
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[styles.fileName, isDarkMode && { color: '#f8fafc' }]} numberOfLines={1}>{file.fileName}</Text>
                            <Text style={[styles.fileDate, isDarkMode && { color: '#94a3b8' }]}>
                              {new Date(file.uploadedAt).toLocaleDateString()}
                            </Text>
                          </View>
                        </TouchableOpacity>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity style={{ padding: 6 }} onPress={() => openFile(file.fileUrl)}>
                            <Ionicons name="eye-outline" size={18} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
                          </TouchableOpacity>
                          <TouchableOpacity style={{ padding: 6 }} onPress={() => handleDownloadFile(file.fileUrl, file.fileName)}>
                            <Ionicons name="download-outline" size={18} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}
            </ScrollView>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { 
    paddingHorizontal: 24, 
    paddingTop: Platform.OS === 'android' ? 50 : 20, 
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  title: { fontSize: 28, fontWeight: 'bold', color: '#001b3a' },
  subtitle: { fontSize: 15, color: '#64748b', marginTop: 4, fontWeight: '500' },
  
  contentContainer: { paddingHorizontal: 20, paddingBottom: 150, paddingTop: 10 },
  
  // Subject Card
  subjectCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginBottom: 16,
    padding: 22,
    shadowColor: '#001b3a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 15, elevation: 4,
    borderWidth: 1, borderColor: '#f8fafc'
  },
  subjectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  subjectCode: { fontSize: 13, color: '#64748b', fontWeight: '600', marginBottom: 4, letterSpacing: 1 },
  subjectTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', flexShrink: 1, marginRight: 10 },
  crBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  crText: { fontSize: 12, fontWeight: 'bold', color: '#001b3a' },
  
  subjectFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  footerItem: { flexDirection: 'row', alignItems: 'center' },
  footerText: { fontSize: 14, color: '#475569', marginLeft: 6, fontWeight: '500' },

  // Empty State
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginTop: 20 },
  emptyDesc: { fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 10, lineHeight: 22 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 30, width: '92%', height: '78%', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#001b3a' },
  modalSubtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  closeBtn: { backgroundColor: '#f1f5f9', padding: 8, borderRadius: 20 },
  modalBody: { flex: 1, padding: 24 },

  // Categories
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  categoryCard: { width: '48%', backgroundColor: '#ffffff', borderRadius: 20, padding: 20, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 5, elevation: 2 },
  categoryIconBox: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  categoryName: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
  fileCount: { fontSize: 12, color: '#64748b', marginTop: 5 },

  // Files
  filesList: { paddingBottom: 40 },
  fileItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  fileIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  fileName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  fileDate: { fontSize: 12, color: '#64748b', marginTop: 4 },
  emptyFiles: { alignItems: 'center', marginTop: 60 },
  emptyFilesText: { fontSize: 15, color: '#64748b', marginTop: 15 }
});
