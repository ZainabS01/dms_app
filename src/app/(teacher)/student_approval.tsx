import { API_URL } from '@/config/api';
import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  SafeAreaView, Alert, ActivityIndicator, Platform, DeviceEventEmitter, TextInput
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, router } from 'expo-router';

export default function StudentApprovalManager() {
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedSemester, setSelectedSemester] = useState('1');
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchStudents = async (department: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/students-dept/${encodeURIComponent(department)}`);
      if (response.ok) {
        const data = await response.json();
        // Show only pending approvals
        const pendingList = data.filter((s: any) => (s.status || '').toUpperCase() === 'PENDING');
        setStudents(pendingList);
        setFilteredStudents(pendingList);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load student requests.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadThemeAndUser = async () => {
        const theme = await AsyncStorage.getItem('appTheme');
        setIsDarkMode(theme === 'dark');

        const data = await AsyncStorage.getItem('userData');
        if (data) {
          const user = JSON.parse(data);
          setUserData(user);
          if (user.department) {
            fetchStudents(user.department);
          }
        }
      };
      loadThemeAndUser();

      const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
      return () => sub.remove();
    }, [])
  );

  useEffect(() => {
    let filtered = students;
    
    // First, filter by semester
    filtered = filtered.filter(s => s.semester === selectedSemester);
    
    // Then, filter by search query if any
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        (s.name || '').toLowerCase().includes(query) || 
        (s.roll_no || s.rollNo || '').toLowerCase().includes(query)
      );
    }
    
    setFilteredStudents(filtered);
  }, [searchQuery, students, selectedSemester]);

  const handleUpdateStatus = async (id: string, name: string, newStatus: string) => {
    setProcessingId(id);
    try {
      const response = await fetch(`${API_URL}/auth/students/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) {
        Alert.alert('Success', `${name}'s status has been updated to ${newStatus}.`);
        if (userData?.department) {
          fetchStudents(userData.department);
        }
      } else {
        Alert.alert('Error', 'Failed to update student status.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network communication issue.');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch ((status || '').toUpperCase()) {
      case 'ACTIVE': return '#10b981';
      case 'PENDING': return '#f59e0b';
      case 'REJECTED': return '#ef4444';
      default: return '#64748b';
    }
  };

  const renderStudentItem = ({ item }: { item: any }) => {
    const statusUpper = (item.status || 'ACTIVE').toUpperCase();
    
    return (
      <View style={[styles.card, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.studentName, isDarkMode && { color: '#ffffff' }]}>{item.name}</Text>
            <Text style={[styles.rollNo, isDarkMode && { color: '#cbd5e1' }]}>Roll No: {item.roll_no || item.rollNo || 'N/A'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(statusUpper) + '20', borderColor: getStatusColor(statusUpper) }]}>
            <Text style={[styles.statusText, { color: getStatusColor(statusUpper) }]}>{statusUpper}</Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <Text style={[styles.detailText, isDarkMode && { color: '#cbd5e1' }]}>Semester: {item.semester || 'N/A'}</Text>
          <Text style={[styles.detailText, isDarkMode && { color: '#cbd5e1' }]}>Email: {item.email}</Text>
        </View>

        <View style={styles.actionsRow}>
          {statusUpper !== 'ACTIVE' && (
            <TouchableOpacity 
              style={[styles.actionBtn, styles.approveBtn]}
              onPress={() => handleUpdateStatus(item._id, item.name, 'ACTIVE')}
              disabled={processingId === item._id}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.actionBtnText}>Approve</Text>
            </TouchableOpacity>
          )}

          {statusUpper !== 'PENDING' && (
            <TouchableOpacity 
              style={[styles.actionBtn, styles.pendingBtn]}
              onPress={() => handleUpdateStatus(item._id, item.name, 'PENDING')}
              disabled={processingId === item._id}
            >
              <Ionicons name="hourglass-outline" size={16} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.actionBtnText}>Set Pending</Text>
            </TouchableOpacity>
          )}

          {statusUpper !== 'REJECTED' && (
            <TouchableOpacity 
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleUpdateStatus(item._id, item.name, 'REJECTED')}
              disabled={processingId === item._id}
            >
              <Ionicons name="close-circle-outline" size={16} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.actionBtnText}>Suspend</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#ffffff' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>Student Approvals</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
          <Ionicons name="search" size={20} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput 
            placeholder="Search requests..." 
            placeholderTextColor="#94a3b8"
            style={[styles.searchInput, isDarkMode && { color: '#ffffff' }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Semester Dropdown Filter */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 15, zIndex: 10 }}>
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

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#001b3a" />
          <Text style={[styles.loadingText, isDarkMode && { color: '#cbd5e1' }]}>Loading requests...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item._id}
          renderItem={renderStudentItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="account-search" size={48} color="#cbd5e1" />
              <Text style={[styles.emptyText, isDarkMode && { color: '#cbd5e1' }]}>No approval requests for Semester {selectedSemester}.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 50 : 20, paddingBottom: 15, paddingHorizontal: 15,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 5 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#001b3a' },
  searchContainer: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 10 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, height: 45
  },
  
  // Dropdown styles
  dropdownButton: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 16, height: 45
  },
  dropdownButtonText: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  dropdownList: {
    position: 'absolute', top: 50, left: 20, right: 20,
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 5,
    zIndex: 999, paddingVertical: 6
  },
  dropdownItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16
  },
  dropdownItemText: { fontSize: 14, color: '#475569' },

  searchInput: { flex: 1, fontSize: 14, color: '#0f172a' },
  semesterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  semesterChipActive: {
    backgroundColor: '#001b3a',
    borderColor: '#001b3a',
  },
  semesterChipText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  semesterChipTextActive: {
    color: '#ffffff',
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  listContainer: { padding: 20, paddingBottom: 100 },
  card: {
    backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0',
    padding: 16, marginBottom: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  studentName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  rollNo: { fontSize: 12, color: '#64748b', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  detailsRow: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10, marginBottom: 15 },
  detailText: { fontSize: 13, color: '#475569', marginBottom: 4 },
  actionsRow: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  actionBtnText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  approveBtn: { backgroundColor: '#10b981' },
  pendingBtn: { backgroundColor: '#f59e0b' },
  rejectBtn: { backgroundColor: '#ef4444' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 40 },
  emptyText: { marginTop: 12, fontSize: 14, color: '#64748b', textAlign: 'center' }
});
