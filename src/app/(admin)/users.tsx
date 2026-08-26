import { API_URL as CENTRAL_API_URL } from '@/config/api';
import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, 
  SafeAreaView, Modal, Platform, Alert, ActivityIndicator, KeyboardAvoidingView, ScrollView, DeviceEventEmitter, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, router } from 'expo-router';

const cleanDeptName = (name: string) => {
  return (name || '').replace(/^(BS\s+|BS)/i, '').trim();
};

export default function UsersManager() {
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'student' | 'teacher' | 'admin'>('student');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
  const [editingUser, setEditingUser] = useState<any>(null);

  // Add User Form States
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formRole, setFormRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [isHOD, setIsHOD] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [secureText, setSecureText] = useState(true);

  // Custom Dropdown Pickers
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showSemPicker, setShowSemPicker] = useState(false);

  const semestersList = [
    '1st Sem', '2nd Sem', '3rd Sem', '4th Sem',
    '5th Sem', '6th Sem', '7th Sem', '8th Sem'
  ];

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${CENTRAL_API_URL}/departments`);
      if (res.ok) {
        setDepartmentsList(await res.json());
      } else {
        setDepartmentsList([
          { name: 'Computer Science', code: 'CS' },
          { name: 'Electrical Engineering', code: 'EE' },
          { name: 'Software Engineering', code: 'SE' },
          { name: 'Business Administration', code: 'BA' }
        ]);
      }
    } catch (e) {
      setDepartmentsList([
        { name: 'Computer Science', code: 'CS' },
        { name: 'Electrical Engineering', code: 'EE' },
        { name: 'Software Engineering', code: 'SE' },
        { name: 'Business Administration', code: 'BA' }
      ]);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${CENTRAL_API_URL}/auth/users`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch users.');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadTheme = async () => {
        const theme = await AsyncStorage.getItem('appTheme');
        setIsDarkMode(theme === 'dark');
      };
      loadTheme();
      fetchUsers();
      fetchDepartments();

      const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
      return () => sub.remove();
    }, [])
  );

  // Reset department filter and search query when changing tabs
  useEffect(() => {
    setSelectedDeptFilter('All');
    setSearchQuery('');
  }, [activeTab]);

  // Filter logic
  useEffect(() => {
    let result = users.filter(user => user.role === activeTab);
    
    // Apply department filter if not 'All'
    if (selectedDeptFilter !== 'All') {
      const deptObj = departmentsList.find(d => d.code === selectedDeptFilter);
      const filterCode = selectedDeptFilter.toLowerCase();
      const filterName = deptObj ? deptObj.name.toLowerCase() : '';
      const filterCleanedName = deptObj ? cleanDeptName(deptObj.name).toLowerCase() : '';

      result = result.filter(user => {
        const userDept = (user.department || '').toLowerCase().trim();
        return (
          userDept === filterCode ||
          userDept === filterName ||
          userDept === filterCleanedName ||
          userDept.includes(filterCode) ||
          userDept.includes(filterCleanedName)
        );
      });
    }
    
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      if (activeTab === 'student') {
        // Students search is roll no wise
        result = result.filter(user => 
          user.roll_no?.toLowerCase().includes(query)
        );
      } else {
        // Teachers / Admins search is name/email wise
        result = result.filter(user => 
          user.name?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query)
        );
      }
    }
    setFilteredUsers(result);
  }, [users, activeTab, searchQuery, selectedDeptFilter]);

  const handleDeleteUser = (userId: string, userName: string) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ${userName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${CENTRAL_API_URL}/auth/users/${userId}`, {
                method: 'DELETE'
              });
              if (response.ok) {
                Alert.alert('Success', 'User deleted successfully.');
                fetchUsers();
              } else {
                const err = await response.json();
                Alert.alert('Error', err.message || 'Failed to delete user.');
              }
            } catch (error) {
              Alert.alert('Error', 'Server communication failure.');
            }
          }
        }
      ]
    );
  };

  const handleAddUser = async () => {
    if (!name.trim() || !email.trim() || (!editingUser && !password.trim())) {
      return Alert.alert('Error', 'Name, Email, and Password are required.');
    }

    setSubmitting(true);
    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: formRole,
        department: department.trim(),
        adminCreated: true
      };
      if (password.trim()) {
        payload.password = password;
      }
      if (formRole === 'teacher') {
        payload.isHOD = isHOD;
      }
      if (formRole === 'student') {
        payload.semester = semester.trim();
        payload.roll_no = rollNo.trim().toUpperCase();
      }

      const url = editingUser 
        ? `${CENTRAL_API_URL}/auth/users/${editingUser._id}`
        : `${CENTRAL_API_URL}/auth/register`;
      const method = editingUser ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', editingUser ? 'User updated successfully!' : 'Account registered and activated successfully!');
        setShowAddModal(false);
        setEditingUser(null);
        // Reset form
        setName('');
        setEmail('');
        setPassword('');
        setFormRole('student');
        setDepartment('');
        setSemester('');
        setRollNo('');
        setIsHOD(false);
        fetchUsers();
      } else {
        Alert.alert('Operation Failed', data.message || 'Validation error.');
      }
    } catch (e) {
      Alert.alert('Error', 'Server communication failure.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUserTrigger = (user: any) => {
    setEditingUser(user);
    setName(user.name || '');
    setEmail(user.email || '');
    setPassword('');
    setFormRole(user.role || 'student');
    setDepartment(user.department || '');
    setSemester(user.semester || '');
    setRollNo(user.roll_no || '');
    setIsHOD(user.isHOD || false);
    setShowAddModal(true);
  };

  const renderUserItem = ({ item }: { item: any }) => (
    <View style={[styles.userCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
      <View style={styles.userInfo}>
        <View style={[styles.avatarPlaceholder, { backgroundColor: activeTab === 'student' ? (isDarkMode ? 'rgba(56, 189, 248, 0.1)' : '#eff6ff') : (activeTab === 'teacher' ? (isDarkMode ? 'rgba(22, 163, 74, 0.1)' : '#f0fdf4') : (isDarkMode ? 'rgba(124, 58, 237, 0.1)' : '#f3e8ff')) }]}>
          <Ionicons 
            name={activeTab === 'student' ? "school" : (activeTab === 'teacher' ? "person" : "shield-checkmark")} 
            size={20} 
            color={activeTab === 'student' ? (isDarkMode ? '#38bdf8' : '#001b3a') : (activeTab === 'teacher' ? '#16a34a' : '#7c3aed')} 
          />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
            <Text style={[styles.userName, isDarkMode && { color: '#ffffff' }]}>{item.name}</Text>
            {activeTab === 'teacher' && item.isHOD && (
              <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginLeft: 6 }}>
                <Text style={{ color: '#ef4444', fontSize: 10, fontWeight: 'bold' }}>HOD</Text>
              </View>
            )}
          </View>
          <Text style={styles.userEmail}>{item.email}</Text>
          {item.department && <Text style={styles.userMeta}>Dept: {item.department}</Text>}
          {activeTab === 'student' && item.roll_no && <Text style={styles.userMeta}>Roll: {item.roll_no}</Text>}
          {activeTab === 'student' && item.semester && <Text style={styles.userMeta}>Sem: {item.semester}</Text>}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TouchableOpacity style={styles.editBtn} onPress={() => handleEditUserTrigger(item)}>
          <Ionicons name="create-outline" size={18} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteUser(item._id, item.name)}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#ffffff' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]} numberOfLines={1}>Manage Users</Text>
        <TouchableOpacity 
          style={[styles.addBtn, isDarkMode && { backgroundColor: '#38bdf8' }]} 
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={24} color={isDarkMode ? '#001b3a' : '#ffffff'} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsRow, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity 
          style={[
            styles.tab, 
            activeTab === 'student' && styles.tabActive,
            isDarkMode && activeTab === 'student' && { borderBottomColor: '#38bdf8' }
          ]} 
          onPress={() => setActiveTab('student')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'student' && styles.tabTextActive,
            isDarkMode && activeTab === 'student' && { color: '#38bdf8' }
          ]}>Students</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.tab, 
            activeTab === 'teacher' && styles.tabActive,
            isDarkMode && activeTab === 'teacher' && { borderBottomColor: '#38bdf8' }
          ]} 
          onPress={() => setActiveTab('teacher')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'teacher' && styles.tabTextActive,
            isDarkMode && activeTab === 'teacher' && { color: '#38bdf8' }
          ]}>Teachers</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[
            styles.tab, 
            activeTab === 'admin' && styles.tabActive,
            isDarkMode && activeTab === 'admin' && { borderBottomColor: '#38bdf8' }
          ]} 
          onPress={() => setActiveTab('admin')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'admin' && styles.tabTextActive,
            isDarkMode && activeTab === 'admin' && { color: '#38bdf8' }
          ]}>Admins</Text>
        </TouchableOpacity>
      </View>

      {/* Department Filter (Only for Students and Teachers) */}
      {(activeTab === 'student' || activeTab === 'teacher') && (
        <View style={[styles.deptFilterContainer, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.deptFilterScroll}>
            <TouchableOpacity 
              style={[
                styles.deptFilterItem, 
                selectedDeptFilter === 'All' && { backgroundColor: isDarkMode ? '#38bdf8' : '#001b3a', borderColor: isDarkMode ? '#38bdf8' : '#001b3a' },
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
                  selectedDeptFilter === dept.code && { backgroundColor: isDarkMode ? '#38bdf8' : '#001b3a', borderColor: isDarkMode ? '#38bdf8' : '#001b3a' },
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
      )}

      {/* Search */}
      <View style={[styles.searchContainer, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
        <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
        <TextInput 
          style={[styles.searchInput, isDarkMode && { color: '#ffffff' }]} 
          placeholder={activeTab === 'student' ? "Search by roll number..." : "Search name, email..."} 
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* User list */}
      {loading ? (
        <ActivityIndicator size="large" color="#001b3a" style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={item => item._id}
          renderItem={renderUserItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ color: '#94a3b8', fontSize: 15 }}>No users found.</Text>
            </View>
          }
        />
      )}

      {/* Add User Modal */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContentWrapper}>
            <View style={[styles.modalContent, { borderRadius: 20 }, isDarkMode && { backgroundColor: '#1e293b' }]}>
              
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>{editingUser ? 'Edit User' : 'Register User'}</Text>
                <TouchableOpacity onPress={() => {
                  setShowAddModal(false);
                  setEditingUser(null);
                  setName('');
                  setEmail('');
                  setPassword('');
                  setFormRole('student');
                  setDepartment('');
                  setSemester('');
                  setRollNo('');
                }}>
                  <Ionicons name="close" size={24} color={isDarkMode ? '#cbd5e1' : '#0f172a'} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Form Role Selector */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>Role</Text>
                  <View style={styles.roleSelectionRow}>
                    <TouchableOpacity style={[styles.roleSelectBtn, formRole === 'student' && styles.roleSelectBtnActive]} onPress={() => setFormRole('student')}>
                      <Text style={[styles.roleSelectBtnText, formRole === 'student' && { color: '#001b3a' }]}>Student</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.roleSelectBtn, formRole === 'teacher' && styles.roleSelectBtnActive]} onPress={() => setFormRole('teacher')}>
                      <Text style={[styles.roleSelectBtnText, formRole === 'teacher' && { color: '#001b3a' }]}>Teacher</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.roleSelectBtn, formRole === 'admin' && styles.roleSelectBtnActive]} onPress={() => setFormRole('admin')}>
                      <Text style={[styles.roleSelectBtnText, formRole === 'admin' && { color: '#001b3a' }]}>Admin</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Name */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>Full Name</Text>
                  <TextInput style={[styles.input, isDarkMode && { backgroundColor: '#334155', color: '#ffffff', borderColor: '#475569' }]} placeholder="John Doe" placeholderTextColor="#64748b" value={name} onChangeText={setName} />
                </View>

                {/* Email */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>Email Address</Text>
                  <TextInput style={[styles.input, isDarkMode && { backgroundColor: '#334155', color: '#ffffff', borderColor: '#475569' }]} placeholder="john@gmail.com" placeholderTextColor="#64748b" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                </View>

                {/* Password */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>Password</Text>
                  <View style={[styles.passInputContainer, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]}>
                    <TextInput 
                      secureTextEntry={secureText} 
                      style={[styles.passTextInput, isDarkMode && { color: '#ffffff' }]} 
                      placeholder={editingUser ? "•••••••• (only fill to reset)" : "••••••••"} 
                      placeholderTextColor="#64748b" 
                      value={password} 
                      onChangeText={setPassword} 
                    />
                    <TouchableOpacity onPress={() => setSecureText(!secureText)} style={{ padding: 8 }}>
                      <Ionicons name={secureText ? "eye-off" : "eye"} size={20} color={isDarkMode ? '#cbd5e1' : '#64748b'} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Department Dropdown */}
                <View style={styles.formGroup}>
                  <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>Department</Text>
                  <TouchableOpacity 
                    style={[styles.input, { justifyContent: 'center' }, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]} 
                    onPress={() => setShowDeptPicker(true)}
                  >
                    <Text style={[
                      { fontSize: 14, color: '#0f172a' }, 
                      isDarkMode && { color: '#ffffff' },
                      !department && { color: '#64748b' }
                    ]}>
                      {department ? cleanDeptName(departmentsList.find(d => d.code === department)?.name || department) : 'Select Department'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* HOD Status Switch (Teacher only) */}
                {formRole === 'teacher' && (
                  <View style={[styles.formGroup, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10, backgroundColor: isDarkMode ? '#334155' : '#f8fafc', padding: 10, borderRadius: 10 }]}>
                    <Text style={[styles.label, { marginBottom: 0 }, isDarkMode && { color: '#cbd5e1' }]}>Head of Department (HOD)</Text>
                    <Switch value={isHOD} onValueChange={setIsHOD} trackColor={{ false: '#cbd5e1', true: '#001b3a' }} thumbColor="#ffffff" />
                  </View>
                )}

                {/* Student specific fields */}
                {formRole === 'student' && (
                  <>
                    <View style={styles.formGroup}>
                      <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>Semester</Text>
                      <TouchableOpacity 
                        style={[styles.input, { justifyContent: 'center' }, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]} 
                        onPress={() => setShowSemPicker(true)}
                      >
                        <Text style={[
                          { fontSize: 14, color: '#0f172a' }, 
                          isDarkMode && { color: '#ffffff' },
                          !semester && { color: '#64748b' }
                        ]}>
                          {semester || 'Select Semester'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.formGroup}>
                      <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>Roll Number</Text>
                      <TextInput style={[styles.input, isDarkMode && { backgroundColor: '#334155', color: '#ffffff', borderColor: '#475569' }]} placeholder="e.g. 101" placeholderTextColor="#64748b" keyboardType="numeric" value={rollNo} onChangeText={setRollNo} />
                    </View>
                  </>
                )}

                <TouchableOpacity style={styles.submitBtn} onPress={handleAddUser} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>{editingUser ? 'Update User' : 'Register User'}</Text>}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Department Picker Modal */}
      <Modal visible={showDeptPicker} transparent animationType="fade" onRequestClose={() => setShowDeptPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContent, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <Text style={[styles.pickerTitle, isDarkMode && { color: '#ffffff' }]}>Select Department</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              {departmentsList.map((dept) => (
                <TouchableOpacity 
                  key={dept.code} 
                  style={[styles.pickerItem, isDarkMode && { borderBottomColor: '#334155' }]} 
                  onPress={() => {
                    setDepartment(dept.code);
                    setShowDeptPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, isDarkMode && { color: '#cbd5e1' }]}>{cleanDeptName(dept.name)} ({dept.code})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowDeptPicker(false)}>
              <Text style={styles.closePickerText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Semester Picker Modal */}
      <Modal visible={showSemPicker} transparent animationType="fade" onRequestClose={() => setShowSemPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={[styles.pickerContent, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <Text style={[styles.pickerTitle, isDarkMode && { color: '#ffffff' }]}>Select Semester</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              {semestersList.map((sem) => (
                <TouchableOpacity 
                  key={sem} 
                  style={[styles.pickerItem, isDarkMode && { borderBottomColor: '#334155' }]} 
                  onPress={() => {
                    setSemester(sem);
                    setShowSemPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, isDarkMode && { color: '#cbd5e1' }]}>{sem}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowSemPicker(false)}>
              <Text style={styles.closePickerText}>Cancel</Text>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 50 : 20, paddingBottom: 15, paddingHorizontal: 20,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#001b3a', flex: 1 },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#001b3a', justifyContent: 'center', alignItems: 'center' },
  
  tabsRow: { flexDirection: 'row', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#001b3a' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  tabTextActive: { color: '#001b3a' },
  
  searchContainer: { 
    flexDirection: 'row', alignItems: 'center', margin: 15, paddingHorizontal: 12, height: 44,
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10 
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a' },
  
  listContainer: { paddingHorizontal: 15, paddingBottom: 100 },
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
  deleteBtn: { padding: 6 },
  editBtn: { padding: 6 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContentWrapper: { maxHeight: '85%' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  
  formGroup: { marginBottom: 15 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
  roleSelectionRow: { flexDirection: 'row', gap: 10 },
  roleSelectBtn: { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, alignItems: 'center', backgroundColor: '#f8fafc' },
  roleSelectBtnActive: { backgroundColor: '#eab308', borderColor: '#eab308' },
  roleSelectBtnText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  
  input: { height: 48, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: '#0f172a', backgroundColor: '#f8fafc' },
  submitBtn: { height: 48, backgroundColor: '#001b3a', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },

  // Picker modal styles
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
  pickerContent: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  pickerTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 15, textAlign: 'center' },
  pickerItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerItemText: { fontSize: 14, color: '#334155', fontWeight: '500' },
  closePickerBtn: { marginTop: 15, paddingVertical: 12, backgroundColor: '#001b3a', borderRadius: 10, alignItems: 'center' },
  closePickerText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },

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
  
  // Password with Eye Icon Styles
  passInputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    borderRadius: 10, 
    paddingHorizontal: 12, 
    height: 48, 
    backgroundColor: '#f8fafc' 
  },
  passTextInput: { 
    flex: 1, 
    fontSize: 14, 
    color: '#0f172a' 
  }
});
