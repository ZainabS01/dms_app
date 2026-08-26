import { API_URL as CENTRAL_API_URL } from '@/config/api';
import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  SafeAreaView, Modal, Platform, Alert, ActivityIndicator, KeyboardAvoidingView, DeviceEventEmitter, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, router } from 'expo-router';

const cleanDeptName = (name: string) => {
  return (name || '').replace(/^(BS\s+|BS)/i, '').trim();
};

export default function QueriesManager() {
  const [queries, setQueries] = useState<any[]>([]);
  const [filteredQueries, setFilteredQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filters state
  const [activeTab, setActiveTab] = useState<'student' | 'teacher'>('student');
  const [statusTab, setStatusTab] = useState<'PENDING' | 'RESOLVED'>('PENDING');
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');

  const fetchQueries = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${CENTRAL_API_URL}/queries/admin`);
      if (response.ok) {
        const data = await response.json();
        setQueries(data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load queries.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch(`${CENTRAL_API_URL}/departments`);
      if (response.ok) {
        setDepartmentsList(await response.json());
      }
    } catch (e) {
      console.log('Failed to fetch departments in queries');
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadTheme = async () => {
        const theme = await AsyncStorage.getItem('appTheme');
        setIsDarkMode(theme === 'dark');
      };
      loadTheme();
      fetchQueries();
      fetchDepartments();

      const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
      return () => sub.remove();
    }, [])
  );

  // Reset secondary filters on primary tab change
  useEffect(() => {
    setSelectedDeptFilter('All');
  }, [activeTab]);

  // Combined filtering logic
  useEffect(() => {
    let result = queries;

    // 1. Filter by student vs teacher role
    result = result.filter(q => {
      const isStudent = q.rollNumber !== 'N/A' && q.semester !== 'N/A' && q.semester !== 'Faculty';
      return activeTab === 'student' ? isStudent : !isStudent;
    });

    // 2. Filter by PENDING vs RESOLVED status
    result = result.filter(q => q.status === statusTab);

    // 3. Filter by department
    if (selectedDeptFilter !== 'All') {
      const deptObj = departmentsList.find(d => d.code === selectedDeptFilter);
      const filterCode = selectedDeptFilter.toLowerCase();
      const filterName = deptObj ? deptObj.name.toLowerCase() : '';
      const filterCleanedName = deptObj ? cleanDeptName(deptObj.name).toLowerCase() : '';

      result = result.filter(q => {
        const qDept = (q.department || '').toLowerCase().trim();
        return (
          qDept === filterCode ||
          qDept === filterName ||
          qDept === filterCleanedName ||
          qDept.includes(filterCode) ||
          qDept.includes(filterCleanedName)
        );
      });
    }

    setFilteredQueries(result);
  }, [queries, activeTab, statusTab, selectedDeptFilter, departmentsList]);

  const handleSendReply = async () => {
    if (!replyText.trim()) return Alert.alert('Error', 'Please enter a reply.');
    
    setSubmitting(true);
    try {
      const response = await fetch(`${CENTRAL_API_URL}/queries/${selectedQuery._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          adminReply: replyText.trim(),
          reply: replyText.trim(),
          status: 'RESOLVED'
        })
      });

      if (response.ok) {
        Alert.alert('Success', 'Reply saved successfully.');
        setSelectedQuery(null);
        setReplyText('');
        fetchQueries();
      } else {
        Alert.alert('Error', 'Failed to save reply.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network communication issue.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditReplyTrigger = (query: any) => {
    setSelectedQuery(query);
    setReplyText(query.adminReply || query.reply || '');
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
            try {
              const response = await fetch(`${CENTRAL_API_URL}/queries/${queryId}`, {
                method: 'DELETE'
              });
              if (response.ok) {
                Alert.alert('Success', 'Query deleted successfully.');
                fetchQueries();
              } else {
                Alert.alert('Error', 'Failed to delete query.');
              }
            } catch (error) {
              Alert.alert('Error', 'Network communication failure.');
            }
          }
        }
      ]
    );
  };

  const renderQueryItem = ({ item }: { item: any }) => {
    const isPending = item.status === 'PENDING';
    return (
      <View style={[styles.queryCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 40 }}>
            <Text style={[styles.studentName, isDarkMode && { color: '#ffffff' }]}>{item.studentName}</Text>
            <Text style={styles.studentMeta}>
              {activeTab === 'student' 
                ? `Dept: ${cleanDeptName(item.department)} | Sem: ${item.semester} | Roll: ${item.rollNumber}`
                : `Dept: ${cleanDeptName(item.department)} | Faculty`
              }
            </Text>
          </View>
          
          {/* Action buttons (Edit & Delete) */}
          <View style={styles.cardActions}>
            {!isPending && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleEditReplyTrigger(item)}>
                <Ionicons name="create-outline" size={16} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteQuery(item._id)}>
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.subjectText, isDarkMode && { color: '#eab308' }]}>Subj: {item.subject}</Text>
        <Text style={[styles.messageText, isDarkMode && { color: '#cbd5e1' }]}>{item.message}</Text>
        
        {item.adminReply || item.reply ? (
          <View style={[styles.replyBox, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]}>
            <Text style={styles.replyLabel}>Admin Response:</Text>
            <Text style={[styles.replyText, isDarkMode && { color: '#ffffff' }]}>{item.adminReply || item.reply}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.replyBtn} onPress={() => setSelectedQuery(item)}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.replyBtnText}>Reply to Query</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#ffffff' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>Review Queries</Text>
      </View>

      {/* Primary Role Tabs */}
      <View style={[styles.tabsRow, isDarkMode && { backgroundColor: '#1e293b' }]}>
        <TouchableOpacity style={[styles.tab, activeTab === 'student' && styles.tabActive]} onPress={() => setActiveTab('student')}>
          <Text style={[styles.tabText, activeTab === 'student' && styles.tabTextActive]}>Students</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'teacher' && styles.tabActive]} onPress={() => setActiveTab('teacher')}>
          <Text style={[styles.tabText, activeTab === 'teacher' && styles.tabTextActive]}>Teachers</Text>
        </TouchableOpacity>
      </View>

      {/* Sub Tabs for Status Filter */}
      <View style={[styles.statusTabsRow, isDarkMode && { backgroundColor: '#0f172a', borderBottomColor: '#334155' }]}>
        <TouchableOpacity 
          style={[
            styles.statusTabBtn, 
            statusTab === 'PENDING' && { backgroundColor: isDarkMode ? '#60a5fa' : '#001b3a', borderColor: isDarkMode ? '#60a5fa' : '#001b3a' },
            isDarkMode && { borderColor: '#334155', backgroundColor: '#1e293b' }
          ]} 
          onPress={() => setStatusTab('PENDING')}
        >
          <Text style={[styles.statusTabText, statusTab === 'PENDING' && { color: isDarkMode ? '#0f172a' : '#ffffff' }]}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.statusTabBtn, 
            statusTab === 'RESOLVED' && { backgroundColor: isDarkMode ? '#60a5fa' : '#001b3a', borderColor: isDarkMode ? '#60a5fa' : '#001b3a' },
            isDarkMode && { borderColor: '#334155', backgroundColor: '#1e293b' }
          ]} 
          onPress={() => setStatusTab('RESOLVED')}
        >
          <Text style={[styles.statusTabText, statusTab === 'RESOLVED' && { color: isDarkMode ? '#0f172a' : '#ffffff' }]}>Resolved</Text>
        </TouchableOpacity>
      </View>

      {/* Department Filter Bar */}
      <View style={[styles.deptFilterContainer, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deptFilterScroll}>
          <TouchableOpacity 
            style={[
              styles.deptFilterItem, 
              selectedDeptFilter === 'All' && { backgroundColor: isDarkMode ? '#60a5fa' : '#001b3a', borderColor: isDarkMode ? '#60a5fa' : '#001b3a' },
              isDarkMode && { borderColor: '#334155', backgroundColor: '#1e293b' }
            ]} 
            onPress={() => setSelectedDeptFilter('All')}
          >
            <Text style={[
              styles.deptFilterText, 
              selectedDeptFilter === 'All' && { color: isDarkMode ? '#0f172a' : '#ffffff' }
            ]}>All</Text>
          </TouchableOpacity>
          {departmentsList.map((dept) => (
            <TouchableOpacity 
              key={dept.code} 
              style={[
                styles.deptFilterItem, 
                selectedDeptFilter === dept.code && { backgroundColor: isDarkMode ? '#60a5fa' : '#001b3a', borderColor: isDarkMode ? '#60a5fa' : '#001b3a' },
                isDarkMode && { borderColor: '#334155', backgroundColor: '#1e293b' }
              ]} 
              onPress={() => setSelectedDeptFilter(dept.code)}
            >
              <Text style={[
                styles.deptFilterText, 
                selectedDeptFilter === dept.code && { color: isDarkMode ? '#0f172a' : '#ffffff' }
              ]}>
                {cleanDeptName(dept.name)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Query list */}
      {loading ? (
        <ActivityIndicator size="large" color="#001b3a" style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={filteredQueries}
          keyExtractor={item => item._id}
          renderItem={renderQueryItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>No queries found.</Text>
            </View>
          }
        />
      )}

      {/* Reply Modal */}
      <Modal visible={selectedQuery !== null} transparent animationType="fade" onRequestClose={() => setSelectedQuery(null)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reply to Query</Text>
              <TouchableOpacity onPress={() => setSelectedQuery(null)}>
                <Ionicons name="close" size={24} color="#0f172a" />
              </TouchableOpacity>
            </View>

            {selectedQuery && (
              <View style={styles.queryDetail}>
                <Text style={styles.detailStudent}>{selectedQuery.studentName}</Text>
                <Text style={styles.detailMessage}>"{selectedQuery.message}"</Text>
              </View>
            )}

            <TextInput
              style={styles.replyInput}
              placeholder="Type your response here..."
              placeholderTextColor="#94a3b8"
              multiline
              value={replyText}
              onChangeText={setReplyText}
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleSendReply} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Send Reply</Text>}
            </TouchableOpacity>
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
    paddingTop: Platform.OS === 'android' ? 50 : 20, paddingBottom: 15, paddingHorizontal: 20,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
  },
  backBtn: { padding: 4, marginRight: 10 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  
  tabsRow: { flexDirection: 'row', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#001b3a' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#001b3a' },

  statusTabsRow: { flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', gap: 10 },
  statusTabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', alignItems: 'center' },
  statusTabBtnActive: { backgroundColor: '#001b3a', borderColor: '#001b3a' },
  statusTabText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  statusTabTextActive: { color: '#ffffff' },
  
  deptFilterContainer: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  deptFilterScroll: {
    gap: 8,
    paddingVertical: 2
  },
  deptFilterItem: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    minWidth: 50,
    alignItems: 'center'
  },
  deptFilterText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b'
  },

  listContainer: { padding: 15, paddingBottom: 100 },
  queryCard: { 
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 15,
    padding: 15, marginBottom: 15, position: 'relative'
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  studentName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  cardActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionBtn: { padding: 4 },
  
  studentMeta: { fontSize: 12, color: '#64748b', marginBottom: 6 },
  subjectText: { fontSize: 13, fontWeight: 'bold', color: '#001b3a', marginBottom: 8 },
  messageText: { fontSize: 14, color: '#334155', lineHeight: 20, marginBottom: 12 },
  
  replyBox: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 5 },
  replyLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 4 },
  replyText: { fontSize: 13, color: '#0f172a', lineHeight: 18 },
  
  replyBtn: { flexDirection: 'row', backgroundColor: '#001b3a', paddingVertical: 10, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  replyBtnText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  
  queryDetail: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, marginBottom: 15, borderLeftWidth: 3, borderLeftColor: '#001b3a' },
  detailStudent: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  detailMessage: { fontSize: 13, color: '#64748b' },
  
  replyInput: { height: 100, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, fontSize: 14, color: '#0f172a', backgroundColor: '#f8fafc', textAlignVertical: 'top', marginBottom: 15 },
  submitBtn: { height: 48, backgroundColor: '#001b3a', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' }
});
