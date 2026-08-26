import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const API_URL = 'http://10.248.205.106:5001/api';

export default function StudentApplications() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [subject, setSubject] = useState('');
  const [reason, setReason] = useState('');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadThemeAndData = async () => {
      const theme = await AsyncStorage.getItem('appTheme');
      setIsDarkMode(theme === 'dark');
      const dataStr = await AsyncStorage.getItem('userData');
      if (dataStr) {
        const user = JSON.parse(dataStr);
        setUserData(user);
        fetchApplications(user.id || user._id);
        if (user.department) fetchTeachers(user.department);
      }
    };
    loadThemeAndData();
    const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
    return () => sub.remove();
  }, []);

  const fetchApplications = async (studentId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/applications/student/${studentId}`);
      if (res.ok) setApplications(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async (department: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/teachers/${encodeURIComponent(department)}`);
      if (res.ok) setTeachers(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleApply = async () => {
    if (!subject.trim() || !reason.trim()) return alert('Please enter subject and reason');
    if (!selectedTeacherId) return alert('Please select a teacher');
    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetch(`${API_URL}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: userData.id || userData._id,
          subject,
          reason,
          startDate: today,
          endDate: today,
          teacherId: selectedTeacherId
        })
      });
      if (res.ok) {
        setSubject('');
        setReason('');
        setSelectedTeacherId('');
        setModalVisible(false);
        fetchApplications(userData.id || userData._id);
      }
    } catch (err) {
      console.error(err);
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
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]} numberOfLines={1}>My Leave Applications</Text>
        <TouchableOpacity 
          style={[styles.addBtn, isDarkMode && { backgroundColor: '#38bdf8' }]} 
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color={isDarkMode ? '#001b3a' : '#ffffff'} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
        ) : applications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={60} color={isDarkMode ? '#334155' : '#cbd5e1'} />
            <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }]}>No applications submitted.</Text>
          </View>
        ) : (
          applications.map(app => (
            <View key={app._id} style={[styles.appCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
              <View style={styles.appHeader}>
                <Text style={[styles.appSubject, isDarkMode && { color: '#f8fafc' }]}>{app.subject}</Text>
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
                  <Text style={[styles.remarksLabel, isDarkMode && { color: '#94a3b8' }]}>Teacher's Remarks:</Text>
                  <Text style={[styles.remarksText, isDarkMode && { color: '#f8fafc' }]}>{app.teacherRemarks}</Text>
                </View>
              )}
              <Text style={styles.dateText}>Applied on: {new Date(app.createdAt).toLocaleDateString()}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* New Application Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <Text style={[styles.modalTitle, isDarkMode && { color: '#f8fafc' }]}>Apply for Leave</Text>

            <Text style={[styles.label, isDarkMode && { color: '#94a3b8' }]}>Select Teacher</Text>
            <ScrollView style={styles.pickerBox} nestedScrollEnabled={true}>
              {teachers.map(t => (
                <TouchableOpacity
                  key={t._id}
                  style={[styles.pickerItem, selectedTeacherId === t._id && styles.pickerItemActive]}
                  onPress={() => setSelectedTeacherId(t._id)}
                >
                  <Text style={[styles.pickerItemText, selectedTeacherId === t._id && styles.pickerItemTextActive]}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput
              style={[styles.input, isDarkMode && { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' }]}
              placeholder="Subject (e.g. Sick Leave)" placeholderTextColor="#94a3b8"
              value={subject} onChangeText={setSubject}
            />

            <TextInput
              style={[styles.input, styles.textArea, isDarkMode && { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' }]}
              placeholder="State your reason for leave..." placeholderTextColor="#94a3b8"
              value={reason} onChangeText={setReason}
              multiline numberOfLines={5} textAlignVertical="top"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitBtn, isDarkMode && { backgroundColor: '#38bdf8' }]} 
                onPress={handleApply} 
                disabled={submitting}
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
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#001b3a', flex: 1 },

  appCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  appHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  appSubject: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', flex: 1 },
  appReason: { fontSize: 14, color: '#334155', lineHeight: 20 },

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

  dateText: { fontSize: 12, color: '#94a3b8', marginTop: 15 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { color: '#64748b', marginTop: 15, fontSize: 16 },
  addBtn: { backgroundColor: '#001b3a', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 20, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
  pickerBox: { maxHeight: 150, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, marginBottom: 15, backgroundColor: '#f8fafc' },
  pickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerItemActive: { backgroundColor: '#eff6ff' },
  pickerItemText: { fontSize: 15, color: '#334155' },
  pickerItemTextActive: { color: '#3b82f6', fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15, backgroundColor: '#f8fafc' },
  textArea: { height: 120 },
  modalBtns: { flexDirection: 'row', gap: 15, marginTop: 10 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
  submitBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#001b3a', alignItems: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
});
