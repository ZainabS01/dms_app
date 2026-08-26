import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, DeviceEventEmitter, ActivityIndicator, SafeAreaView, Platform, TextInput, Modal, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';

import { API_URL } from '@/config/api';

export default function StudentFeedbackScreen() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [modalVisible, setModalVisible] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('General');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();

  const categories = ['Academics', 'Facility', 'IT Support', 'Management', 'General'];

  useEffect(() => {
    const loadTheme = async () => {
      const theme = await AsyncStorage.getItem('appTheme');
      setIsDarkMode(theme === 'dark');
    };
    loadTheme();
    const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadUserAndFeedbacks = async () => {
        const dataStr = await AsyncStorage.getItem('userData');
        if (dataStr) {
          const user = JSON.parse(dataStr);
          setUserData(user);
          fetchFeedbacks(user.id || user._id);
        }
      };
      loadUserAndFeedbacks();
    }, [])
  );

  const fetchFeedbacks = async (studentId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/feedback/student/${encodeURIComponent(studentId)}`);
      if (res.ok) setFeedbacks(await res.json());
    } catch (err) {
      console.error('Fetch student feedback error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendFeedback = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('Error', 'Please enter a subject and a message.');
      return;
    }
    
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/feedback/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: userData.id || userData._id,
          studentName: userData.name,
          studentRollNo: userData.roll_no || userData.rollNo || 'N/A',
          department: userData.department,
          semester: userData.semester,
          subject: subject.trim(),
          category,
          message: message.trim(),
          rating
        })
      });
      if (res.ok) {
        setSubject('');
        setMessage('');
        setCategory('General');
        setRating(5);
        setModalVisible(false);
        Alert.alert('Success', 'Feedback submitted successfully!');
        fetchFeedbacks(userData.id || userData._id);
      } else {
        const data = await res.json();
        Alert.alert('Error', data.message || 'Failed to submit feedback.');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return { bg: '#dcfce7', text: '#16a34a' };
      case 'REVIEWED':
        return { bg: '#eff6ff', text: '#3b82f6' };
      default:
        return { bg: '#fef3c7', text: '#d97706' };
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#1e293b' }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#f8fafc' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]} numberOfLines={1}>Feedback History</Text>
        <TouchableOpacity 
          style={[styles.addBtn, isDarkMode && { backgroundColor: '#38bdf8' }]} 
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="add" size={24} color={isDarkMode ? '#001b3a' : '#ffffff'} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 50 }} />
        ) : feedbacks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbox-ellipses-outline" size={60} color={isDarkMode ? '#334155' : '#cbd5e1'} />
            <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }]}>No feedback submitted yet.</Text>
          </View>
        ) : (
          feedbacks.map(f => {
            const statusStyle = getStatusStyle(f.status);
            return (
              <View key={f._id} style={[styles.feedbackCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
                <View style={styles.feedbackHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.feedbackSubject, isDarkMode && { color: '#f8fafc' }]}>{f.subject}</Text>
                    <Text style={styles.feedbackMetaText}>{f.category} | {new Date(f.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusText, { color: statusStyle.text }]}>{f.status}</Text>
                  </View>
                </View>

                {/* Rating stars */}
                <View style={{ flexDirection: 'row', gap: 3, marginVertical: 6 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons 
                      key={star} 
                      name={star <= (f.rating || 5) ? "star" : "star-outline"} 
                      size={14} 
                      color="#fbbf24" 
                    />
                  ))}
                </View>

                <Text style={[styles.feedbackMessage, isDarkMode && { color: '#cbd5e1' }]}>{f.message}</Text>
                
                {f.adminReply ? (
                  <View style={[styles.replyBox, isDarkMode && { backgroundColor: '#0f172a' }]}>
                    <Text style={[styles.replyLabel, isDarkMode && { color: '#94a3b8' }]}>Admin Response:</Text>
                    <Text style={[styles.replyMessage, isDarkMode && { color: '#f8fafc' }]}>{f.adminReply}</Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* New Feedback Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <Text style={[styles.modalTitle, isDarkMode && { color: '#f8fafc' }]}>Submit Feedback</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, isDarkMode && { color: '#94a3b8' }]}>Category</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
                {categories.map(c => (
                  <TouchableOpacity 
                    key={c} 
                    style={[styles.categoryBtn, category === c && styles.categoryBtnActive, isDarkMode && category !== c && { borderColor: '#475569' }]} 
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.categoryBtnText, category === c && styles.categoryBtnTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, isDarkMode && { color: '#94a3b8' }]}>Subject</Text>
              <TextInput 
                style={[styles.input, isDarkMode && { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' }]}
                placeholder="Topic / Subject" placeholderTextColor="#94a3b8"
                value={subject} onChangeText={setSubject}
              />
              
              <Text style={[styles.label, isDarkMode && { color: '#94a3b8' }]}>Message</Text>
              <TextInput 
                style={[styles.input, styles.textArea, isDarkMode && { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' }]}
                placeholder="Type your feedback message here..." placeholderTextColor="#94a3b8"
                value={message} onChangeText={setMessage}
                multiline numberOfLines={5} textAlignVertical="top"
              />

              <Text style={[styles.label, isDarkMode && { color: '#94a3b8' }, { textAlign: 'center' }]}>Rating</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10, justifyContent: 'center', marginBottom: 25 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setRating(star)}>
                    <Ionicons 
                      name={star <= rating ? "star" : "star-outline"} 
                      size={36} 
                      color={star <= rating ? "#fbbf24" : (isDarkMode ? "#475569" : "#cbd5e1")} 
                    />
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.submitBtn, isDarkMode && { backgroundColor: '#38bdf8' }]} 
                  onPress={handleSendFeedback} 
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={isDarkMode ? '#001b3a' : '#fff'} />
                  ) : (
                    <Text style={[styles.submitBtnText, isDarkMode && { color: '#001b3a' }]}>Submit</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  
  feedbackCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  feedbackHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
  feedbackSubject: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', flex: 1 },
  feedbackMetaText: { fontSize: 11, color: '#64748b', marginTop: 2 },
  feedbackMessage: { fontSize: 14, color: '#334155', lineHeight: 20, marginTop: 4 },
  
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginLeft: 10 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  
  replyBox: { backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12, marginTop: 15 },
  replyLabel: { fontSize: 12, color: '#64748b', fontWeight: 'bold', marginBottom: 5 },
  replyMessage: { fontSize: 14, color: '#0f172a' },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { color: '#64748b', marginTop: 15, fontSize: 16 },
  addBtn: { backgroundColor: '#001b3a', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 20, textAlign: 'center' },
  categoryBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  categoryBtnActive: { backgroundColor: '#001b3a', borderColor: '#001b3a' },
  categoryBtnText: { color: '#64748b', fontWeight: '600', fontSize: 13 },
  categoryBtnTextActive: { color: '#ffffff', fontWeight: 'bold' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#64748b', marginBottom: 8, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 15, backgroundColor: '#f8fafc', color: '#0f172a' },
  textArea: { height: 100 },
  modalBtns: { flexDirection: 'row', gap: 15, marginTop: 10 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: 'bold', color: '#64748b' },
  submitBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#001b3a', alignItems: 'center' },
  submitBtnText: { fontSize: 15, fontWeight: 'bold', color: '#ffffff' },
});
