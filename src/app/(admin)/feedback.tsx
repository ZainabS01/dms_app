import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, 
  SafeAreaView, Modal, Platform, Alert, ActivityIndicator, DeviceEventEmitter, KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';

import { API_URL } from '@/config/api';

const cleanDeptName = (name: string) => {
  return (name || '').replace(/^(BS\s+|BS)/i, '').trim();
};

export default function AdminFeedbackScreen() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [filteredFeedbacks, setFilteredFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Reacting Modal States
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);
  const [reactionStatus, setReactionStatus] = useState<'PENDING' | 'REVIEWED' | 'RESOLVED'>('REVIEWED');
  const [adminReplyText, setAdminReplyText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'REVIEWED' | 'RESOLVED'>('ALL');
  const [deptFilter, setDeptFilter] = useState('All');
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);

  const router = useRouter();

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/feedback/view`);
      if (response.ok) {
        setFeedbacks(await response.json());
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load student feedbacks.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch(`${API_URL}/departments`);
      if (response.ok) {
        setDepartmentsList(await response.json());
      }
    } catch (e) {
      console.log('Failed to fetch departments in feedbacks');
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadTheme = async () => {
        const theme = await AsyncStorage.getItem('appTheme');
        setIsDarkMode(theme === 'dark');
      };
      loadTheme();
      fetchFeedbacks();
      fetchDepartments();

      const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
      return () => sub.remove();
    }, [])
  );

  // Filter application logic
  useEffect(() => {
    let result = feedbacks;

    // 1. Status Filter
    if (statusFilter !== 'ALL') {
      result = result.filter(f => f.status === statusFilter);
    }

    // 2. Department Filter
    if (deptFilter !== 'All') {
      const deptObj = departmentsList.find(d => d.code === deptFilter);
      const filterCode = deptFilter.toLowerCase();
      const filterName = deptObj ? deptObj.name.toLowerCase() : '';
      const filterCleanedName = deptObj ? cleanDeptName(deptObj.name).toLowerCase() : '';

      result = result.filter(f => {
        const fDept = (f.department || '').toLowerCase().trim();
        return (
          fDept === filterCode ||
          fDept === filterName ||
          fDept === filterCleanedName ||
          (deptObj && (fDept === deptObj.code.toLowerCase() || fDept === deptObj._id))
        );
      });
    }

    setFilteredFeedbacks(result);
  }, [feedbacks, statusFilter, deptFilter, departmentsList]);

  const handleOpenReactionModal = (item: any) => {
    setSelectedFeedback(item);
    setReactionStatus(item.status || 'REVIEWED');
    setAdminReplyText(item.adminReply || '');
    setModalVisible(true);
  };

  const handleReactionSubmit = async () => {
    if (!adminReplyText.trim()) {
      Alert.alert('Error', 'Please enter a response reply.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/feedback/${selectedFeedback._id}/react`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: reactionStatus,
          adminReply: adminReplyText.trim()
        })
      });

      if (response.ok) {
        setModalVisible(false);
        setSelectedFeedback(null);
        setAdminReplyText('');
        Alert.alert('Success', 'Feedback response updated successfully!');
        fetchFeedbacks();
      } else {
        Alert.alert('Error', 'Failed to submit response.');
      }
    } catch (e) {
      Alert.alert('Error', 'Network connection failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    Alert.alert('Delete Feedback', 'Are you sure you want to delete this feedback?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${API_URL}/feedback/${id}`, { method: 'DELETE' });
            if (res.ok) {
              fetchFeedbacks();
            }
          } catch (e) {
            Alert.alert('Error', 'Could not delete feedback.');
          }
        }
      }
    ]);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'RESOLVED':
        return { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0' };
      case 'REVIEWED':
        return { bg: '#eff6ff', text: '#3b82f6', border: '#bfdbfe' };
      default:
        return { bg: '#fef3c7', text: '#d97706', border: '#fde68a' };
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#1e293b' }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#f8fafc' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>Manage Feedback</Text>
      </View>

      {/* Filter Toolbar */}
      <View style={[styles.filterBar, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        {/* Status Filter Tab */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 10, gap: 10 }}>
          {(['ALL', 'PENDING', 'REVIEWED', 'RESOLVED'] as const).map(tab => (
            <TouchableOpacity 
              key={tab} 
              style={[
                styles.tabBtn, 
                statusFilter === tab && styles.tabBtnActive,
                isDarkMode && statusFilter === tab && { backgroundColor: '#38bdf8', borderColor: '#38bdf8' },
                isDarkMode && statusFilter !== tab && { borderColor: '#475569' }
              ]} 
              onPress={() => setStatusFilter(tab)}
            >
              <Text style={[
                styles.tabBtnText, 
                statusFilter === tab && styles.tabBtnTextActive,
                isDarkMode && statusFilter === tab && { color: '#0f172a' }
              ]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Department Filter Selector */}
        <View style={{ borderTopWidth: 1, borderTopColor: isDarkMode ? '#334155' : '#f1f5f9' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 15, paddingVertical: 8, gap: 8 }}>
            <TouchableOpacity 
              style={[
                styles.deptFilterBtn, 
                deptFilter === 'All' && styles.deptFilterBtnActive, 
                isDarkMode && deptFilter === 'All' && { backgroundColor: '#38bdf8', borderColor: '#38bdf8' },
                isDarkMode && deptFilter !== 'All' && { borderColor: '#475569' }
              ]}
              onPress={() => setDeptFilter('All')}
            >
              <Text style={[
                styles.deptFilterText, 
                deptFilter === 'All' && styles.deptFilterTextActive,
                isDarkMode && deptFilter === 'All' && { color: '#0f172a' }
              ]}>All Depts</Text>
            </TouchableOpacity>
            {departmentsList.map(dept => (
              <TouchableOpacity 
                key={dept._id}
                style={[
                  styles.deptFilterBtn, 
                  deptFilter === dept.code && styles.deptFilterBtnActive, 
                  isDarkMode && deptFilter === dept.code && { backgroundColor: '#38bdf8', borderColor: '#38bdf8' },
                  isDarkMode && deptFilter !== dept.code && { borderColor: '#475569' }
                ]}
                onPress={() => setDeptFilter(dept.code)}
              >
                <Text style={[
                  styles.deptFilterText, 
                  deptFilter === dept.code && styles.deptFilterTextActive,
                  isDarkMode && deptFilter === dept.code && { color: '#0f172a' }
                ]}>
                  {cleanDeptName(dept.name)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Main List */}
      {loading ? (
        <ActivityIndicator size="large" color="#001b3a" style={{ marginTop: 80 }} />
      ) : filteredFeedbacks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbox-ellipses-outline" size={64} color={isDarkMode ? '#334155' : '#cbd5e1'} />
          <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }]}>No student feedbacks found.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {filteredFeedbacks.map(item => {
            const statusStyle = getStatusStyle(item.status);
            return (
              <View key={item._id} style={[styles.feedbackCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
                {/* Header */}
                <View style={styles.feedbackCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.studentName, isDarkMode && { color: '#ffffff' }]}>{item.studentName}</Text>
                    <Text style={styles.studentMeta}>{item.studentRollNo} | {item.department} ({item.semester})</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border, borderWidth: 1 }]}>
                      <Text style={[styles.statusText, { color: statusStyle.text }]}>{item.status}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteFeedback(item._id)} style={styles.trashBtn}>
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Rating display */}
                <View style={{ flexDirection: 'row', gap: 3, marginVertical: 6 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons 
                      key={star} 
                      name={star <= (item.rating || 5) ? "star" : "star-outline"} 
                      size={14} 
                      color="#fbbf24" 
                    />
                  ))}
                </View>

                {/* Topic / Subject */}
                <Text style={[styles.feedbackSubjectText, isDarkMode && { color: '#f8fafc' }]}>
                  <Text style={{ fontWeight: 'bold' }}>Topic: </Text>{item.subject}
                </Text>

                {/* Message */}
                <Text style={[styles.feedbackMessageText, isDarkMode && { color: '#cbd5e1' }]}>{item.message}</Text>
                
                {/* Date */}
                <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleString()}</Text>

                {/* Admin Reply Display */}
                {item.adminReply ? (
                  <View style={[styles.replyBox, isDarkMode && { backgroundColor: '#0f172a' }]}>
                    <Text style={[styles.replyLabel, isDarkMode && { color: '#94a3b8' }]}>My Reaction Response:</Text>
                    <Text style={[styles.replyMessage, isDarkMode && { color: '#f8fafc' }]}>{item.adminReply}</Text>
                  </View>
                ) : null}

                {/* Action button */}
                <TouchableOpacity style={styles.reactBtn} onPress={() => handleOpenReactionModal(item)}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.reactBtnText}>{item.adminReply ? 'Update Response' : 'React & Respond'}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* React Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>Respond to Feedback</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#cbd5e1' : '#0f172a'} />
              </TouchableOpacity>
            </View>

            {selectedFeedback && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Feedback preview */}
                <View style={[styles.previewBox, isDarkMode && { backgroundColor: '#0f172a', borderColor: '#334155' }]}>
                  <Text style={[styles.previewStudent, isDarkMode && { color: '#ffffff' }]}>{selectedFeedback.studentName} ({selectedFeedback.studentRollNo})</Text>
                  <Text style={[styles.previewMessage, isDarkMode && { color: '#cbd5e1' }]}>"{selectedFeedback.message}"</Text>
                </View>

                {/* Status select buttons */}
                <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>Reaction Status</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                  {(['PENDING', 'REVIEWED', 'RESOLVED'] as const).map(status => {
                    const active = reactionStatus === status;
                    let activeBg = '#eab308';
                    if (status === 'REVIEWED') activeBg = '#3b82f6';
                    if (status === 'RESOLVED') activeBg = '#16a34a';

                    return (
                      <TouchableOpacity 
                        key={status} 
                        style={[
                          styles.statusSelectBtn, 
                          active && { backgroundColor: activeBg, borderColor: activeBg },
                          isDarkMode && !active && { borderColor: '#475569' }
                        ]} 
                        onPress={() => setReactionStatus(status)}
                      >
                        <Text style={[styles.statusSelectText, active && { color: '#ffffff', fontWeight: 'bold' }]}>{status}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Response Text Input */}
                <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>Your Reply Message</Text>
                <TextInput
                  style={[styles.replyInput, isDarkMode && { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' }]}
                  placeholder="Type your reaction reply here..."
                  placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
                  multiline
                  numberOfLines={4}
                  value={adminReplyText}
                  onChangeText={setAdminReplyText}
                />

                <View style={styles.modalBtns}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.submitBtn} onPress={handleReactionSubmit} disabled={submitting}>
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save Response</Text>}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </KeyboardAvoidingView>
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
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#001b3a' },
  
  filterBar: { backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  tabBtnActive: { backgroundColor: '#001b3a', borderColor: '#001b3a' },
  tabBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  tabBtnTextActive: { color: '#ffffff', fontWeight: 'bold' },

  deptFilterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  deptFilterBtnActive: { backgroundColor: '#001b3a', borderColor: '#001b3a' },
  deptFilterText: { fontSize: 11, fontWeight: '600', color: '#64748b' },
  deptFilterTextActive: { color: '#ffffff', fontWeight: 'bold' },

  feedbackCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  feedbackCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
  studentName: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  studentMeta: { fontSize: 11, color: '#64748b', marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  trashBtn: { padding: 4, marginLeft: 5 },
  feedbackSubjectText: { fontSize: 14, color: '#0f172a', marginVertical: 4 },
  feedbackMessageText: { fontSize: 13, color: '#475569', lineHeight: 18, marginTop: 2 },
  dateText: { fontSize: 11, color: '#94a3b8', marginTop: 8, textAlign: 'right' },
  
  replyBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginTop: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  replyLabel: { fontSize: 11, color: '#64748b', fontWeight: 'bold', marginBottom: 4 },
  replyMessage: { fontSize: 13, color: '#0f172a' },

  reactBtn: { 
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', 
    backgroundColor: '#001b3a', paddingVertical: 10, borderRadius: 12, marginTop: 12 
  },
  reactBtnText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 120 },
  emptyText: { color: '#64748b', marginTop: 15, fontSize: 16 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },

  previewBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 15 },
  previewStudent: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  previewMessage: { fontSize: 13, color: '#64748b', lineHeight: 18 },

  inputLabel: { fontSize: 13, fontWeight: 'bold', color: '#64748b', marginBottom: 8 },
  statusSelectBtn: { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, alignItems: 'center', backgroundColor: '#f8fafc' },
  statusSelectText: { fontSize: 12, color: '#64748b', fontWeight: '600' },

  replyInput: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 14, minHeight: 80, textAlignVertical: 'top', backgroundColor: '#f8fafc', marginBottom: 20, color: '#0f172a' },
  modalBtns: { flexDirection: 'row', gap: 15 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: 'bold', color: '#64748b' },
  submitBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#001b3a', alignItems: 'center' },
  submitBtnText: { fontSize: 15, fontWeight: 'bold', color: '#ffffff' },
});
