import { API_URL as CENTRAL_API_URL } from '@/config/api';
import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  SafeAreaView, ActivityIndicator, Platform, DeviceEventEmitter, TextInput, Alert,
  Modal, ScrollView, KeyboardAvoidingView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, router } from 'expo-router';

export default function StudentsDirectory() {
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<string>('All');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // CRUD states
  const [showModal, setShowModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [semester, setSemester] = useState('1');
  const [rollNo, setRollNo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const uniqueSemesters = ['All', '1', '2', '3', '4', '5', '6', '7', '8'];

  const fetchStudents = async (department: string) => {
    setLoading(true);
    console.log(`[students.tsx] Fetching students for department: "${department}"`);
    try {
      const url = `${CENTRAL_API_URL}/auth/students-dept/${encodeURIComponent(department)}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setStudents(data);
        setFilteredStudents(data);
      } else {
        const text = await response.text();
        Alert.alert('Error', `Server returned status ${response.status}`);
      }
    } catch (error: any) {
      console.error('Failed to load students:', error);
      Alert.alert('Network Error', `Failed to connect: ${error.message || error}`);
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
    if (selectedSemester !== 'All') {
      filtered = filtered.filter(s => s.semester === selectedSemester);
    }
    
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        (s.name || '').toLowerCase().includes(query) || 
        (s.roll_no || s.rollNo || '').toLowerCase().includes(query)
      );
    }
    setFilteredStudents(filtered);
  }, [searchQuery, students, selectedSemester]);

  const handleAddStudentTrigger = () => {
    setEditingStudent(null);
    setName('');
    setEmail('');
    setPassword('');
    setSemester('1');
    setRollNo('');
    setShowModal(true);
  };

  const handleEditStudentTrigger = (student: any) => {
    setEditingStudent(student);
    setName(student.name || '');
    setEmail(student.email || '');
    setPassword('');
    setSemester(student.semester || '1');
    setRollNo(student.roll_no || student.rollNo || '');
    setShowModal(true);
  };

  const handleDeleteStudent = (id: string, name: string) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ${name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${CENTRAL_API_URL}/auth/users/${id}`, {
                method: 'DELETE'
              });
              if (res.ok) {
                Alert.alert('Success', 'Student deleted successfully.');
                if (userData?.department) fetchStudents(userData.department);
              } else {
                const err = await res.json();
                Alert.alert('Error', err.message || 'Failed to delete student.');
              }
            } catch (error) {
              Alert.alert('Error', 'Network communication issue.');
            }
          }
        }
      ]
    );
  };

  const handleSaveStudent = async () => {
    if (!name.trim() || !email.trim() || !rollNo.trim() || (!editingStudent && !password.trim())) {
      return Alert.alert('Error', 'Please fill in Name, Email, Roll No, and Password.');
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: 'student',
        department: userData?.department,
        semester: semester.trim(),
        roll_no: rollNo.trim().toUpperCase()
      };
      if (password.trim()) {
        payload.password = password;
      }

      const url = editingStudent
        ? `${CENTRAL_API_URL}/auth/users/${editingStudent._id}`
        : `${CENTRAL_API_URL}/auth/register`;
      const method = editingStudent ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'Success',
          editingStudent 
            ? 'Student updated successfully!' 
            : 'Student registered successfully! If verification is required, they can log in and enter OTP.'
        );
        setShowModal(false);
        if (userData?.department) fetchStudents(userData.department);
      } else {
        Alert.alert('Operation Failed', data.message || 'Validation error.');
      }
    } catch (e) {
      Alert.alert('Error', 'Server communication failure.');
    } finally {
      setSubmitting(false);
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
    const statusColor = getStatusColor(statusUpper);

    // Generate initials for avatar
    const initials = (item.name || '')
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    
    return (
      <View style={[styles.userCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
        <View style={styles.userInfo}>
          <View style={[
            styles.avatarPlaceholder, 
            { backgroundColor: isDarkMode ? '#334155' : '#eff6ff' }
          ]}>
            <Text style={{ 
              fontSize: 14, 
              fontWeight: 'bold', 
              color: isDarkMode ? '#38bdf8' : '#001b3a' 
            }}>{initials}</Text>
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={[styles.userName, isDarkMode && { color: '#ffffff' }]}>{item.name}</Text>
              <View style={[
                styles.statusBadgeInline, 
                { backgroundColor: statusColor + '15', borderColor: statusColor }
              ]}>
                <Text style={[styles.statusTextInline, { color: statusColor }]}>{statusUpper}</Text>
              </View>
            </View>
            <Text style={[styles.userEmail, isDarkMode && { color: '#cbd5e1' }]}>{item.email}</Text>
            {item.roll_no && <Text style={styles.userMeta}>Roll: {item.roll_no}</Text>}
            {item.semester && <Text style={styles.userMeta}>Sem: {item.semester}</Text>}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity style={styles.editBtn} onPress={() => handleEditStudentTrigger(item)}>
            <Ionicons name="create-outline" size={18} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteStudent(item._id, item.name)}>
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#ffffff' : '#001b3a'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>Department Students</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAddStudentTrigger}>
          <Ionicons name="add-circle" size={28} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
          <Ionicons name="search" size={20} color="#94a3b8" style={{ marginRight: 8 }} />
          <TextInput 
            placeholder="Search students..." 
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
            {selectedSemester === 'All' ? 'All Semesters' : `Semester ${selectedSemester}`}
          </Text>
          <Ionicons 
            name={showDropdown ? "chevron-up" : "chevron-down"} 
            size={20} 
            color={isDarkMode ? '#ffffff' : '#001b3a'} 
          />
        </TouchableOpacity>

        {showDropdown && (
          <View style={[styles.dropdownList, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            {uniqueSemesters.map((sem) => (
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
                  {sem === 'All' ? 'All Semesters' : `Semester ${sem}`}
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
          <Text style={[styles.loadingText, isDarkMode && { color: '#cbd5e1' }]}>Loading students...</Text>
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
              <Text style={[styles.emptyText, isDarkMode && { color: '#cbd5e1' }]}>No students found in this department.</Text>
            </View>
          }
        />
      )}

      {/* CRUD Add/Edit Student Modal */}
      <Modal
        visible={showModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            <View style={[styles.modalHeader, isDarkMode && { borderBottomColor: '#334155' }]}>
              <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>
                {editingStudent ? 'Edit Student' : 'Add Student'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#ffffff' : '#001b3a'} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm}>
              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>Name</Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && { color: '#ffffff', borderColor: '#334155', backgroundColor: '#0f172a' }]}
                value={name}
                onChangeText={setName}
                placeholder="Enter name"
                placeholderTextColor="#94a3b8"
              />

              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>Email</Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && { color: '#ffffff', borderColor: '#334155', backgroundColor: '#0f172a' }]}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter email"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>Roll Number</Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && { color: '#ffffff', borderColor: '#334155', backgroundColor: '#0f172a' }]}
                value={rollNo}
                onChangeText={setRollNo}
                placeholder="Enter roll number"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
              />

              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>
                Password {editingStudent && '(Leave blank to keep same)'}
              </Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && { color: '#ffffff', borderColor: '#334155', backgroundColor: '#0f172a' }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor="#94a3b8"
                secureTextEntry={true}
                autoCapitalize="none"
              />

              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>Semester</Text>
              <View style={styles.semesterGrid}>
                {['1', '2', '3', '4', '5', '6', '7', '8'].map((sem) => (
                  <TouchableOpacity
                    key={sem}
                    style={[
                      styles.semChip,
                      semester === sem ? styles.semChipActive : (isDarkMode ? { backgroundColor: '#0f172a', borderColor: '#334155' } : {}),
                    ]}
                    onPress={() => setSemester(sem)}
                  >
                    <Text style={[
                      styles.semChipText,
                      semester === sem ? styles.semChipTextActive : (isDarkMode ? { color: '#cbd5e1' } : {}),
                    ]}>
                      Sem {sem}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSaveStudent}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingStudent ? 'Update Student' : 'Add Student'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'android' ? 50 : 20, paddingBottom: 15, paddingHorizontal: 15,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 5 },
  addBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#001b3a' },
  searchContainer: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 10 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, height: 45
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a' },
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },
  listContainer: { padding: 15, paddingBottom: 100 },
  userCard: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 15,
    padding: 15, marginBottom: 10
  },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  userName: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  userEmail: { fontSize: 13, color: '#64748b', marginTop: 2 },
  userMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  statusBadgeInline: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 0.5 },
  statusTextInline: { fontSize: 8, fontWeight: 'bold' },
  editBtn: { padding: 6 },
  deleteBtn: { padding: 6 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 40 },
  emptyText: { marginTop: 12, fontSize: 14, color: '#64748b', textAlign: 'center' },
  
  // Modal styles
  modalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: 20
  },
  modalContent: {
    width: '100%', maxHeight: '90%', backgroundColor: '#ffffff',
    borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0',
    overflow: 'hidden', padding: 20
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 15
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#001b3a' },
  modalForm: { paddingTop: 15, paddingBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 12 },
  modalInput: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    paddingHorizontal: 12, height: 45, fontSize: 14, color: '#0f172a',
    backgroundColor: '#f8fafc'
  },
  semesterGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5, marginBottom: 15
  },
  semChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f1f5f9',
    minWidth: '22%', alignItems: 'center'
  },
  semChipActive: {
    backgroundColor: '#001b3a', borderColor: '#001b3a'
  },
  semChipText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  semChipTextActive: { color: '#ffffff' },
  submitBtn: {
    backgroundColor: '#001b3a', borderRadius: 10, height: 48,
    justifyContent: 'center', alignItems: 'center', marginTop: 25
  },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' }
});
