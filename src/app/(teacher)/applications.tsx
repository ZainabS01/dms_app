import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, DeviceEventEmitter, ActivityIndicator, SafeAreaView, Platform, TextInput, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { API_URL } from '@/config/api';

export default function TeacherApplications() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [activeApp, setActiveApp] = useState<any>(null);
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    const loadThemeAndData = async () => {
      const theme = await AsyncStorage.getItem('appTheme');
      setIsDarkMode(theme === 'dark');
      const dataStr = await AsyncStorage.getItem('userData');
      if (dataStr) {
        const user = JSON.parse(dataStr);
        setUserData(user);
        if (user.id || user._id) fetchApplications(user.id || user._id);
      }
    };
    loadThemeAndData();
    const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
    return () => sub.remove();
  }, []);

  const fetchApplications = async (teacherId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/applications/teacher/${encodeURIComponent(teacherId)}`);
      if (res.ok) setApplications(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/applications/${activeApp._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, teacherRemarks: remarks })
      });
      if (res.ok) {
        setRemarks('');
        setActiveApp(null);
        setModalVisible(false);
        fetchApplications(userData.id || userData._id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const openActionModal = (app: any) => {
    setActiveApp(app);
    setRemarks(app.teacherRemarks || '');
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#1e293b' }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#f8fafc' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>Leave Applications</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
        ) : applications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={60} color={isDarkMode ? '#334155' : '#cbd5e1'} />
            <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }]}>No applications found.</Text>
          </View>
        ) : (
          applications.map(app => (
            <View key={app._id} style={[styles.appCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
              <View style={styles.appHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.appSubject, isDarkMode && { color: '#f8fafc' }]}>{app.subject}</Text>
                  {app.studentId && (
                    <Text style={[styles.studentName, isDarkMode && { color: '#94a3b8' }]}>
                      {app.studentId.name} ({app.studentId.roll_no || app.studentId.rollNo || 'No Roll No'})
                    </Text>
                  )}
                </View>
                <View style={[
                  styles.statusBadge, 
                  app.status === 'APPROVED' ? styles.statusApproved : 
                  app.status === 'REJECTED' ? styles.statusRejected : styles.statusPending
                ]}>
                  <Text style={[
                    styles.statusText, 
                    app.status === 'APPROVED' ? styles.textApproved : 
                    app.status === 'REJECTED' ? styles.textRejected : styles.textPending
                  ]}>{app.status}</Text>
                </View>
              </View>
              
              <Text style={[styles.appReason, isDarkMode && { color: '#cbd5e1' }]}>{app.reason}</Text>
              
              {app.teacherRemarks && (
                <View style={[styles.remarksBox, isDarkMode && { backgroundColor: '#0f172a' }]}>
                  <Text style={[styles.remarksLabel, isDarkMode && { color: '#94a3b8' }]}>Your Remarks:</Text>
                  <Text style={[styles.remarksText, isDarkMode && { color: '#f8fafc' }]}>{app.teacherRemarks}</Text>
                </View>
              )}
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 }}>
                <Text style={styles.dateText}>Applied on: {new Date(app.createdAt).toLocaleDateString()}</Text>
                <TouchableOpacity style={styles.actionBtn} onPress={() => openActionModal(app)}>
                  <Text style={styles.actionBtnText}>{app.status === 'PENDING' ? 'Take Action' : 'Edit'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Action Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <Text style={[styles.modalTitle, isDarkMode && { color: '#f8fafc' }]}>Process Application</Text>
            
            <View style={[styles.detailsBox, isDarkMode && { backgroundColor: '#0f172a' }]}>
              <Text style={[styles.remarksLabel, isDarkMode && { color: '#94a3b8' }]}>Reason from Student:</Text>
              <Text style={[styles.appReason, isDarkMode && { color: '#cbd5e1' }]}>{activeApp?.reason}</Text>
            </View>

            <TextInput 
              style={[styles.input, styles.textArea, isDarkMode && { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' }]}
              placeholder="Add remarks (optional)..." placeholderTextColor="#94a3b8"
              value={remarks} onChangeText={setRemarks}
              multiline numberOfLines={3} textAlignVertical="top"
            />
            
            <View style={{ flexDirection: 'row', gap: 15, marginTop: 10, marginBottom: 15 }}>
              <TouchableOpacity 
                style={[styles.processBtn, { backgroundColor: '#ef4444' }]} 
                onPress={() => handleUpdateStatus('REJECTED')} disabled={submitting}
              >
                <Text style={styles.submitBtnText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.processBtn, { backgroundColor: '#10b981' }]} 
                onPress={() => handleUpdateStatus('APPROVED')} disabled={submitting}
              >
                <Text style={styles.submitBtnText}>Approve</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
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
  
  appCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  appHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  appSubject: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  studentName: { fontSize: 13, color: '#64748b', marginTop: 2 },
  appReason: { fontSize: 14, color: '#334155', lineHeight: 20, marginTop: 10 },
  
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginLeft: 10 },
  statusPending: { backgroundColor: '#fef3c7' },
  statusApproved: { backgroundColor: '#dcfce3' },
  statusRejected: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  textPending: { color: '#d97706' },
  textApproved: { color: '#16a34a' },
  textRejected: { color: '#ef4444' },
  
  remarksBox: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12, marginTop: 15 },
  remarksLabel: { fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 5 },
  remarksText: { fontSize: 14, color: '#0f172a' },
  
  dateText: { fontSize: 12, color: '#94a3b8' },
  actionBtn: { backgroundColor: '#eff6ff', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  actionBtnText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 13 },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { color: '#64748b', marginTop: 15, fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 20, textAlign: 'center' },
  detailsBox: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginBottom: 15 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15, backgroundColor: '#f8fafc' },
  textArea: { height: 100 },
  processBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
  cancelBtn: { padding: 16, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
});
