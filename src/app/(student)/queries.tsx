import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { API_URL } from '@/config/api';

export default function StudentQueries() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  const [queries, setQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState<'admin' | 'teacher'>('teacher');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [editingQuery, setEditingQuery] = useState<any>(null);

  useEffect(() => {
    const loadThemeAndData = async () => {
      const theme = await AsyncStorage.getItem('appTheme');
      setIsDarkMode(theme === 'dark');
      const dataStr = await AsyncStorage.getItem('userData');
      if (dataStr) {
        const user = JSON.parse(dataStr);
        setUserData(user);
        const identifier = user.id || user._id || user.roll_no || user.rollNo;
        if (identifier) fetchQueries(identifier);
        if (user.department) fetchTeachers(user.department);
      }
    };
    loadThemeAndData();
    const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
    return () => sub.remove();
  }, []);

  const fetchQueries = async (rollNo: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/queries/student/${encodeURIComponent(rollNo)}`);
      if (res.ok) setQueries(await res.json());
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

  const handleDeleteQuery = (queryId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this query?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await fetch(`${API_URL}/queries/${queryId}`, {
                method: 'DELETE'
              });
              if (res.ok) {
                Alert.alert('Success', 'Query deleted successfully');
                const identifier = userData.id || userData._id || userData.roll_no || userData.rollNo;
                if (identifier) fetchQueries(identifier);
              } else {
                Alert.alert('Error', 'Failed to delete query');
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

  const handleEditQuery = (query: any) => {
    setEditingQuery(query);
    setSubject(query.subject);
    setMessage(query.message);
    setRecipient(query.recipient || 'teacher');
    setSelectedTeacherId(query.teacherId || '');
    setModalVisible(true);
  };

  const handleSendQuery = async () => {
    if (!subject.trim() || !message.trim()) {
      return Alert.alert('Error', 'Please enter subject and message');
    }
    if (recipient === 'teacher' && !selectedTeacherId) {
      return Alert.alert('Error', 'Please select a teacher');
    }
    setSubmitting(true);
    try {
      const url = editingQuery ? `${API_URL}/queries/${editingQuery._id}` : `${API_URL}/queries`;
      const method = editingQuery ? 'PUT' : 'POST';
      
      const payload: any = {
        subject,
        message,
        recipient,
        teacherId: recipient === 'teacher' ? selectedTeacherId : undefined
      };
      
      if (!editingQuery) {
        payload.studentId = userData.id || userData._id;
        payload.rollNumber = userData.roll_no || userData.rollNo || 'N/A';
        payload.studentName = userData.name;
        payload.department = userData.department;
        payload.semester = userData.semester || 'N/A';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        Alert.alert('Success', editingQuery ? 'Query updated successfully' : 'Query sent successfully');
        setSubject('');
        setMessage('');
        setSelectedTeacherId('');
        setEditingQuery(null);
        setModalVisible(false);
        const identifier = userData.id || userData._id || userData.roll_no || userData.rollNo;
        if (identifier) fetchQueries(identifier);
      } else {
        const errData = await res.json();
        Alert.alert('Error', errData.message || 'Failed to send query');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Error sending query. Please check your network connection.');
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
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>My Queries</Text>
        <TouchableOpacity 
          style={[styles.addBtn, isDarkMode && { backgroundColor: '#38bdf8' }]} 
          onPress={() => {
            setEditingQuery(null);
            setSubject('');
            setMessage('');
            setSelectedTeacherId('');
            setRecipient('teacher');
            setModalVisible(true);
          }}
        >
          <Ionicons name="add" size={24} color={isDarkMode ? '#001b3a' : '#ffffff'} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#001b3a" style={{ marginTop: 50 }} />
        ) : queries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={60} color={isDarkMode ? '#334155' : '#cbd5e1'} />
            <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }]}>No queries asked yet.</Text>
          </View>
        ) : (
          queries.map(q => (
            <View key={q._id} style={[styles.queryCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
              <View style={styles.queryHeader}>
                <Text style={[styles.querySubject, isDarkMode && { color: '#f8fafc' }]} numberOfLines={1}>{q.subject}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={[styles.statusBadge, q.status === 'RESOLVED' ? styles.statusResolved : styles.statusPending]}>
                    <Text style={[styles.statusText, q.status === 'RESOLVED' ? styles.textResolved : styles.textPending]}>{q.status}</Text>
                  </View>
                  
                  {/* Only allow editing if the query is not RESOLVED yet */}
                  {q.status !== 'RESOLVED' && (
                    <TouchableOpacity onPress={() => handleEditQuery(q)} style={{ padding: 4 }}>
                      <Ionicons name="create-outline" size={18} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity onPress={() => handleDeleteQuery(q._id)} style={{ padding: 4 }}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={[styles.queryMessage, isDarkMode && { color: '#cbd5e1' }]}>{q.message}</Text>

              {q.reply && (
                <View style={[styles.replyBox, isDarkMode && { backgroundColor: '#0f172a' }]}>
                  <Text style={[styles.replyLabel, isDarkMode && { color: '#94a3b8' }]}>
                    {q.recipient === 'admin' ? 'Reply from Admin:' : 'Reply from Teacher:'}
                  </Text>
                  <Text style={[styles.replyMessage, isDarkMode && { color: '#f8fafc' }]}>{q.reply}</Text>
                </View>
              )}
              <Text style={styles.dateText}>{new Date(q.createdAt).toLocaleDateString()}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* New Query Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <Text style={[styles.modalTitle, isDarkMode && { color: '#f8fafc' }]}>{editingQuery ? 'Edit Question' : 'Ask a Question'}</Text>

            <View style={{ flexDirection: 'row', gap: 15, marginBottom: 15 }}>
              <TouchableOpacity style={[styles.typeBtn, recipient === 'teacher' && styles.typeBtnActive]} onPress={() => setRecipient('teacher')}>
                <Text style={[styles.typeBtnText, recipient === 'teacher' && styles.typeBtnTextActive]}>To Teacher</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, recipient === 'admin' && styles.typeBtnActive]} onPress={() => setRecipient('admin')}>
                <Text style={[styles.typeBtnText, recipient === 'admin' && styles.typeBtnTextActive]}>To Admin</Text>
              </TouchableOpacity>
            </View>

            {recipient === 'teacher' && (
              <>
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
              </>
            )}

            <TextInput
              style={[styles.input, isDarkMode && { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' }]}
              placeholder="Subject" placeholderTextColor="#94a3b8"
              value={subject} onChangeText={setSubject}
            />

            <TextInput
              style={[styles.input, styles.textArea, isDarkMode && { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' }]}
              placeholder="Type your message here..." placeholderTextColor="#94a3b8"
              value={message} onChangeText={setMessage}
              multiline numberOfLines={5} textAlignVertical="top"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSendQuery} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Send</Text>}
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

  queryCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  queryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  querySubject: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', flex: 1 },
  queryMessage: { fontSize: 14, color: '#334155', lineHeight: 20 },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginLeft: 10 },
  statusPending: { backgroundColor: '#fef3c7' },
  statusResolved: { backgroundColor: '#dcfce3' },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  textPending: { color: '#d97706' },
  textResolved: { color: '#16a34a' },

  replyBox: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12, marginTop: 15 },
  replyLabel: { fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 5 },
  replyMessage: { fontSize: 14, color: '#0f172a' },

  dateText: { fontSize: 12, color: '#94a3b8', marginTop: 15 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { color: '#64748b', marginTop: 15, fontSize: 16 },
  addBtn: { marginLeft: 'auto', backgroundColor: '#001b3a', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 20, textAlign: 'center' },
  typeBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#eff6ff', borderColor: '#001b3a' },
  typeBtnText: { color: '#64748b', fontWeight: '600' },
  typeBtnTextActive: { color: '#001b3a', fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
  pickerBox: { maxHeight: 150, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, marginBottom: 15, backgroundColor: '#f8fafc' },
  pickerItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerItemActive: { backgroundColor: '#eff6ff' },
  pickerItemText: { fontSize: 15, color: '#334155' },
  pickerItemTextActive: { color: '#001b3a', fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15, backgroundColor: '#f8fafc' },
  textArea: { height: 120 },
  modalBtns: { flexDirection: 'row', gap: 15, marginTop: 10 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
  submitBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#001b3a', alignItems: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
});
