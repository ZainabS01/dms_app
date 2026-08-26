import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, DeviceEventEmitter, ActivityIndicator, SafeAreaView, Platform, TextInput, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { API_URL } from '@/config/api';

export default function TeacherQueries() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  const [queries, setQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [activeQuery, setActiveQuery] = useState<any>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [selectedSemester, setSelectedSemester] = useState('1');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const loadThemeAndData = async () => {
      const theme = await AsyncStorage.getItem('appTheme');
      setIsDarkMode(theme === 'dark');
      const dataStr = await AsyncStorage.getItem('userData');
      if (dataStr) {
        const user = JSON.parse(dataStr);
        setUserData(user);
        if (user.id || user._id) fetchQueries(user.id || user._id);
      }
    };
    loadThemeAndData();
    const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
    return () => sub.remove();
  }, []);

  const fetchQueries = async (teacherId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/queries/teacher/${encodeURIComponent(teacherId)}`);
      if (res.ok) setQueries(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !activeQuery) return alert('Please enter a reply');
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/queries/${activeQuery._id}/reply`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: replyMessage })
      });
      if (res.ok) {
        setReplyMessage('');
        setActiveQuery(null);
        setModalVisible(false);
        fetchQueries(userData.id || userData._id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const openReplyModal = (q: any) => {
    setActiveQuery(q);
    setReplyMessage(q.reply || '');
    setModalVisible(true);
  };

  const filteredQueries = queries.filter(q => q.semester === selectedSemester);

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#1e293b' }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#f8fafc' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>Student Queries</Text>
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

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#001b3a" style={{ marginTop: 50 }} />
        ) : filteredQueries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={60} color={isDarkMode ? '#334155' : '#cbd5e1'} />
            <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }]}>No queries for Semester {selectedSemester}.</Text>
          </View>
        ) : (
          filteredQueries.map(q => (
            <View key={q._id} style={[styles.queryCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
              <View style={styles.queryHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.querySubject, isDarkMode && { color: '#f8fafc' }]}>{q.subject}</Text>
                  <Text style={[styles.studentName, isDarkMode && { color: '#94a3b8' }]}>{q.studentName} ({q.rollNumber})</Text>
                </View>
                <View style={[styles.statusBadge, q.status === 'RESOLVED' ? styles.statusResolved : styles.statusPending]}>
                  <Text style={[styles.statusText, q.status === 'RESOLVED' ? styles.textResolved : styles.textPending]}>{q.status}</Text>
                </View>
              </View>
              
              <Text style={[styles.queryMessage, isDarkMode && { color: '#cbd5e1' }]}>{q.message}</Text>
              
              {q.reply && (
                <View style={[styles.replyBox, isDarkMode && { backgroundColor: '#0f172a' }]}>
                  <Text style={[styles.replyLabel, isDarkMode && { color: '#94a3b8' }]}>Your Reply:</Text>
                  <Text style={[styles.replyMessage, isDarkMode && { color: '#f8fafc' }]}>{q.reply}</Text>
                </View>
              )}
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 }}>
                <Text style={styles.dateText}>{new Date(q.createdAt).toLocaleDateString()}</Text>
                <TouchableOpacity style={styles.replyBtn} onPress={() => openReplyModal(q)}>
                  <Text style={styles.replyBtnText}>{q.reply ? 'Edit Reply' : 'Reply'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Reply Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <Text style={[styles.modalTitle, isDarkMode && { color: '#f8fafc' }]}>Reply to {activeQuery?.studentName}</Text>
            
            <View style={[styles.questionBox, isDarkMode && { backgroundColor: '#0f172a' }]}>
              <Text style={[styles.replyLabel, isDarkMode && { color: '#94a3b8' }]}>Question:</Text>
              <Text style={[styles.queryMessage, isDarkMode && { color: '#cbd5e1' }]}>{activeQuery?.message}</Text>
            </View>

            <TextInput 
              style={[styles.input, styles.textArea, isDarkMode && { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' }]}
              placeholder="Type your reply here..." placeholderTextColor="#94a3b8"
              value={replyMessage} onChangeText={setReplyMessage}
              multiline numberOfLines={5} textAlignVertical="top"
            />
            
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSendReply} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Send Reply</Text>}
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

  queryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  querySubject: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  studentName: { fontSize: 13, color: '#64748b', marginTop: 2 },
  queryMessage: { fontSize: 14, color: '#334155', lineHeight: 20, marginTop: 10 },
  
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginLeft: 10 },
  statusPending: { backgroundColor: '#fef3c7' },
  statusResolved: { backgroundColor: '#dcfce3' },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  textPending: { color: '#d97706' },
  textResolved: { color: '#16a34a' },
  
  replyBox: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12, marginTop: 15 },
  replyLabel: { fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 5 },
  replyMessage: { fontSize: 14, color: '#0f172a' },
  
  dateText: { fontSize: 12, color: '#94a3b8' },
  replyBtn: { backgroundColor: '#eff6ff', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  replyBtnText: { color: '#001b3a', fontWeight: 'bold', fontSize: 13 },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { color: '#64748b', marginTop: 15, fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 20, textAlign: 'center' },
  questionBox: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginBottom: 15 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15, backgroundColor: '#f8fafc' },
  textArea: { height: 120 },
  modalBtns: { flexDirection: 'row', gap: 15, marginTop: 10 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
  submitBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#001b3a', alignItems: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
});
