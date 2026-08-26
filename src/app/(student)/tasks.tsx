import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, DeviceEventEmitter, ActivityIndicator, SafeAreaView, Platform, Modal, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';

import { API_URL } from '@/config/api';

export default function StudentTasks() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [uploadModal, setUploadModal] = useState(false);
  const [activeTask, setActiveTask] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hiddenTaskIds, setHiddenTaskIds] = useState<string[]>([]);

  useEffect(() => {
    const loadThemeAndData = async () => {
      const theme = await AsyncStorage.getItem('appTheme');
      setIsDarkMode(theme === 'dark');
      const dataStr = await AsyncStorage.getItem('userData');
      if (dataStr) {
        const user = JSON.parse(dataStr);
        setUserData(user);
        const userId = user.id || user._id;
        const hidden = await AsyncStorage.getItem(`hiddenTasks_${userId}`);
        if (hidden) {
          setHiddenTaskIds(JSON.parse(hidden));
        }
        if (user.department && user.semester) fetchTasks(user.department, user.semester);
      }
    };
    loadThemeAndData();
    const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
    return () => sub.remove();
  }, []);

  const handleHideTask = (taskId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to remove this task from your list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = [...hiddenTaskIds, taskId];
            setHiddenTaskIds(updated);
            if (userData) {
              const userId = userData.id || userData._id;
              await AsyncStorage.setItem(`hiddenTasks_${userId}`, JSON.stringify(updated));
            }
          }
        }
      ]
    );
  };

  const fetchTasks = async (department: string, semester: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/tasks/class/${encodeURIComponent(department)}/${encodeURIComponent(semester)}`);
      if (res.ok) setTasks(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getMySubmission = (task: any) => {
    if (!task.submissions || !userData) return null;
    return task.submissions.find((s: any) => s.studentId === userData.id || s.studentId === userData._id);
  };

  const openUploadModal = (task: any) => {
    setActiveTask(task);
    setSelectedFile(null);
    setUploadModal(true);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setSelectedFile(result.assets[0]);
    } catch (err) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleSubmitTask = async () => {
    if (!selectedFile) return Alert.alert('Error', 'Please select a PDF file');
    
    setSubmitting(true);
    try {
      // Fetch the file locally as a Blob to bypass React Native FormData regressions
      const localFileResponse = await fetch(selectedFile.uri);
      const blob = await localFileResponse.blob();

      const formData = new FormData();
      formData.append('studentId', userData.id || userData._id);
      formData.append('studentName', userData.name);
      formData.append('file', blob, selectedFile.name || 'assignment.pdf');

      const res = await fetch(`${API_URL}/tasks/${activeTask._id}/submit`, {
        method: 'POST',
        body: formData,
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.ok) {
        Alert.alert('Success', 'Assignment submitted successfully');
        setUploadModal(false);
        fetchTasks(userData.department, userData.semester);
      } else {
        const data = await res.json();
        Alert.alert('Error', data.message || 'Failed to submit assignment');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#1e293b' }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#f8fafc' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>My Tasks</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {loading ? (
          <ActivityIndicator size="large" color={isDarkMode ? '#38bdf8' : '#001b3a'} style={{ marginTop: 50 }} />
        ) : tasks.filter(t => !hiddenTaskIds.includes(t._id)).length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={60} color={isDarkMode ? '#334155' : '#cbd5e1'} />
            <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }]}>No tasks available.</Text>
          </View>
        ) : (
          tasks
            .filter(t => !hiddenTaskIds.includes(t._id))
            .map(task => {
              const mySub = getMySubmission(task);
              return (
                <View key={task._id} style={[styles.taskCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
                  <View style={styles.taskHeader}>
                    <Text style={[styles.taskTitle, isDarkMode && { color: '#f8fafc' }]}>{task.title}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={[
                        styles.badge, 
                        isDarkMode ? { backgroundColor: '#334155' } : { backgroundColor: '#e6f0fa' }
                      ]}>
                        <Text style={[
                          styles.badgeText, 
                          isDarkMode ? { color: '#38bdf8' } : { color: '#001b3a' }
                        ]}>
                          {task.taskType}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => handleHideTask(task._id)} style={{ padding: 4 }}>
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={[styles.taskSubject, isDarkMode && { color: '#94a3b8' }]}>{task.subject} • By {task.teacherName}</Text>
                  
                  {task.description ? <Text style={[styles.taskDesc, isDarkMode && { color: '#cbd5e1' }]}>{task.description}</Text> : null}
                  
                  <View style={[styles.statusBox, isDarkMode && { backgroundColor: '#0f172a' }]}>
                    {mySub ? (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                          <Ionicons name="checkmark-circle" size={20} color="#10b981" />
                          <Text style={[styles.submittedText, isDarkMode && { color: '#f8fafc' }]}>Submitted</Text>
                        </View>
                        {mySub.status === 'Checked' && (
                          <View style={[styles.gradeBadge, { backgroundColor: '#dcfce3' }]}>
                            <Text style={{color: '#16a34a', fontWeight: 'bold'}}>Grade: {mySub.grade}</Text>
                          </View>
                        )}
                        {mySub.remarks && <Text style={[styles.remarksText, isDarkMode && { color: '#cbd5e1' }]}>Remarks: {mySub.remarks}</Text>}
                      </>
                    ) : (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                          <Ionicons name="time-outline" size={20} color="#ef4444" />
                          <Text style={[styles.pendingText, isDarkMode && { color: '#f8fafc' }]}>Pending</Text>
                        </View>
                        <TouchableOpacity 
                          style={[styles.uploadBtn, isDarkMode && { backgroundColor: '#38bdf8' }]} 
                          onPress={() => openUploadModal(task)}
                        >
                          <Text style={[styles.uploadBtnText, isDarkMode && { color: '#001b3a' }]}>Upload Assignment</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, borderTopWidth: 1, borderTopColor: isDarkMode ? '#334155' : '#f1f5f9', paddingTop: 10 }}>
                    <Text style={[styles.dateText, isDarkMode && { color: '#94a3b8' }]}>
                      Assigned: {task.issueDate ? new Date(task.issueDate).toLocaleDateString() : 'N/A'}
                    </Text>
                    <Text style={[styles.dateText, { color: '#ef4444', fontWeight: 'bold' }]}>
                      Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}
                    </Text>
                  </View>
                </View>
              );
            })
        )}
      </ScrollView>

      {/* Upload Modal */}
      <Modal visible={uploadModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <Text style={[styles.modalTitle, isDarkMode && { color: '#f8fafc' }]}>Submit {activeTask?.title}</Text>
            
            <TouchableOpacity 
              style={[
                styles.uploadBox, 
                isDarkMode ? { backgroundColor: '#0f172a', borderColor: '#38bdf8' } : { borderColor: '#001b3a' }
              ]} 
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
                  <Text style={[styles.uploadText, isDarkMode && { color: '#94a3b8' }]}>Select PDF File</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setUploadModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.submitBtn, 
                  isDarkMode && { backgroundColor: '#38bdf8' },
                  !selectedFile && { opacity: 0.5 }
                ]} 
                onPress={handleSubmitTask} 
                disabled={submitting || !selectedFile}
              >
                {submitting ? (
                  <ActivityIndicator color={isDarkMode ? '#001b3a' : '#fff'} />
                ) : (
                  <Text style={[styles.submitBtnText, isDarkMode && { color: '#001b3a' }]}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  
  taskCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
  taskTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', flex: 1 },
  badge: { backgroundColor: '#e6f0fa', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginLeft: 10 },
  badgeText: { color: '#001b3a', fontWeight: 'bold', fontSize: 12 },
  taskSubject: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  taskDesc: { fontSize: 14, color: '#334155', marginTop: 10, lineHeight: 20 },
  
  statusBox: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginTop: 15, marginBottom: 15 },
  submittedText: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginLeft: 8 },
  pendingText: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginLeft: 8 },
  uploadBtn: { backgroundColor: '#001b3a', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  uploadBtnText: { color: '#ffffff', fontWeight: 'bold' },
  gradeBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 8 },
  remarksText: { fontSize: 14, color: '#475569' },
  
  dateText: { fontSize: 13, color: '#94a3b8', fontWeight: '600', textAlign: 'right' },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { color: '#64748b', marginTop: 15, fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 20, textAlign: 'center' },
  
  uploadBox: { 
    borderWidth: 2, borderColor: '#e2e8f0', borderStyle: 'dashed', 
    borderRadius: 16, padding: 30, alignItems: 'center', 
    backgroundColor: '#f8fafc', marginBottom: 20 
  },
  uploadText: { marginTop: 10, fontSize: 16, color: '#64748b', fontWeight: '500' },
  fileName: { marginTop: 10, fontSize: 16, color: '#0f172a', fontWeight: 'bold', textAlign: 'center' },
  
  modalBtns: { flexDirection: 'row', gap: 15 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
  submitBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#001b3a', alignItems: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
});
