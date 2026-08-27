import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  DeviceEventEmitter, ActivityIndicator, SafeAreaView, Platform, 
  TextInput, Modal, Linking, Alert 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { API_URL, BASE_URL } from '@/config/api';

const getTodayDateString = () => new Date().toISOString().split('T')[0];
const getFutureDateString = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export default function TeacherTasks() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Semester selector
  const [selectedSemester, setSelectedSemester] = useState('1');
  const [showDropdown, setShowDropdown] = useState(false);

  // New/Edit Task Modal
  const [newTaskModal, setNewTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [taskType, setTaskType] = useState('Assignment');
  const [submitting, setSubmitting] = useState(false);
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Calendar Selector State
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarTarget, setCalendarTarget] = useState<'start' | 'due' | null>(null);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const changeMonth = (direction: number) => {
    const newDate = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + direction, 1);
    setCurrentCalendarDate(newDate);
  };

  const getCalendarDays = () => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Prefix empty slots
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    // Days numbers
    for (let i = 1; i <= totalDays; i++) {
      days.push(i);
    }
    return days;
  };

  const handleSelectDay = (day: number) => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const selected = new Date(year, month, day);
    const dateStr = selected.toISOString().split('T')[0];
    
    if (calendarTarget === 'start') {
      setIssueDate(dateStr);
    } else {
      setDueDate(dateStr);
    }
    setCalendarVisible(false);
  };

  const isSelectedDay = (day: number) => {
    const targetVal = calendarTarget === 'start' ? issueDate : dueDate;
    if (!targetVal) return false;
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const currentStr = new Date(year, month, day).toISOString().split('T')[0];
    return currentStr === targetVal;
  };

  // Submissions Modal
  const [submissionsModal, setSubmissionsModal] = useState(false);
  const [activeTask, setActiveTask] = useState<any>(null);

  // Grading State
  const [gradingSubId, setGradingSubId] = useState<string | null>(null);
  const [grade, setGrade] = useState('');
  const [remarks, setRemarks] = useState('');
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    const loadThemeAndData = async () => {
      const theme = await AsyncStorage.getItem('appTheme');
      setIsDarkMode(theme === 'dark');
      const dataStr = await AsyncStorage.getItem('userData');
      if (dataStr) {
        const user = JSON.parse(dataStr);
        setUserData(user);
        if (user.department) fetchTasks(user.department, selectedSemester);
      }
    };
    loadThemeAndData();
  }, [selectedSemester]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
    return () => sub.remove();
  }, []);

  const fetchTasks = async (department: string, semester: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/tasks/class/${encodeURIComponent(department)}/${encodeURIComponent(semester)}`);
      if (res.ok) setTasks(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!title || !subject) return Alert.alert('Error', 'Title and Subject are required');
    if (!issueDate.trim() || !dueDate.trim()) return Alert.alert('Error', 'Start date and Due date are required');
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(issueDate) || !dateRegex.test(dueDate)) {
      return Alert.alert('Error', 'Please enter dates in YYYY-MM-DD format (e.g. 2026-08-26)');
    }

    setSubmitting(true);
    try {
      const payload = {
        title, 
        description, 
        subject, 
        taskType,
        teacherId: userData.id || userData._id,
        teacherName: userData.name,
        department: userData.department,
        semester: selectedSemester,
        issueDate: new Date(issueDate).toISOString(),
        dueDate: new Date(dueDate).toISOString()
      };

      const url = editingTask ? `${API_URL}/tasks/${editingTask._id}` : `${API_URL}/tasks`;
      const method = editingTask ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        Alert.alert('Success', editingTask ? 'Task updated successfully' : 'Task created successfully');
        setTitle(''); 
        setDescription(''); 
        setSubject('');
        setIssueDate('');
        setDueDate('');
        setEditingTask(null);
        setNewTaskModal(false);
        fetchTasks(userData.department, selectedSemester);
      } else {
        Alert.alert('Error', 'Failed to save task');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditTaskTrigger = (task: any) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setSubject(task.subject || '');
    setTaskType(task.taskType || 'Assignment');
    setIssueDate(task.issueDate ? new Date(task.issueDate).toISOString().split('T')[0] : getTodayDateString());
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : getFutureDateString(7));
    setNewTaskModal(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/tasks/${taskId}`, {
                method: 'DELETE'
              });
              if (res.ok) {
                Alert.alert('Success', 'Task deleted successfully');
                fetchTasks(userData.department, selectedSemester);
              } else {
                Alert.alert('Error', 'Failed to delete task');
              }
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Network error occurred');
            }
          }
        }
      ]
    );
  };

  const handleGradeSubmission = async (studentId: string) => {
    if (!grade) return Alert.alert('Error', 'Grade is required');
    setGrading(true);
    try {
      const res = await fetch(`${API_URL}/tasks/${activeTask._id}/grade/${studentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade, remarks })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveTask(data.task);
        setGradingSubId(null);
        setGrade('');
        setRemarks('');
        fetchTasks(userData.department, selectedSemester);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGrading(false);
    }
  };

  const handleDeleteSubmission = async (taskId: string, studentId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this student\'s submission? The file will be deleted permanently.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/tasks/${taskId}/submission/${studentId}`, {
                method: 'DELETE'
              });
              if (res.ok) {
                const data = await res.json();
                Alert.alert('Deleted', 'Submission deleted successfully.');
                setActiveTask(data.task);
                fetchTasks(userData.department, selectedSemester);
              } else {
                Alert.alert('Error', 'Failed to delete submission');
              }
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Network error occurred');
            }
          }
        }
      ]
    );
  };

  const openSubmissions = (task: any) => {
    setActiveTask(task);
    setSubmissionsModal(true);
  };

  const openPdf = async (fileUrl: string) => {
    if (!fileUrl) {
      Alert.alert('Error', 'No file was uploaded for this submission.');
      return;
    }
    try {
      Alert.alert('Downloading', 'Downloading file, please wait...');
      const formatted = fileUrl.replace(/\\/g, '/');
      const fileName = formatted.split('/').pop() || 'submission.pdf';
      const downloadUrl = `${BASE_URL}/api/auth/download?file=${encodeURIComponent(fileName)}`;
      
      const localUri = `${FileSystem.cacheDirectory}${fileName}`;
      const { uri } = await FileSystem.downloadAsync(downloadUrl, localUri);
      
      if (await Sharing.isAvailableAsync()) {
        try {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'View Submission PDF',
            UTI: 'com.adobe.pdf'
          });
        } catch (shareErr) {
          console.log('Share dismissed or failed:', shareErr);
        }
      } else {
        await Linking.openURL(downloadUrl);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to open PDF');
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#ffffff' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]} numberOfLines={1}>Tasks Directory</Text>
        <TouchableOpacity onPress={() => { setEditingTask(null); setTitle(''); setDescription(''); setSubject(''); setIssueDate(getTodayDateString()); setDueDate(getFutureDateString(7)); setNewTaskModal(true); }}>
          <Ionicons name="add-circle" size={28} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
        </TouchableOpacity>
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
        {loading && tasks.length === 0 ? (
          <ActivityIndicator size="large" color="#001b3a" style={{ marginTop: 50 }} />
        ) : tasks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={60} color={isDarkMode ? '#334155' : '#cbd5e1'} />
            <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }]}>No tasks assigned for Semester {selectedSemester}.</Text>
          </View>
        ) : (
          tasks.map(task => (
            <View key={task._id} style={[styles.taskCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
              <View style={styles.taskHeader}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.taskTitle, isDarkMode && { color: '#f8fafc' }]} numberOfLines={2}>{task.title}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[styles.badge, isDarkMode && { backgroundColor: '#334155' }]}><Text style={styles.badgeText}>{task.taskType}</Text></View>
                  <TouchableOpacity onPress={() => handleEditTaskTrigger(task)} style={styles.actionIconBtn}>
                    <Ionicons name="create-outline" size={16} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteTask(task._id)} style={styles.actionIconBtn}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={[styles.taskSubject, isDarkMode && { color: '#94a3b8' }]}>{task.subject}</Text>
              {task.description ? <Text style={[styles.taskDesc, isDarkMode && { color: '#cbd5e1' }]}>{task.description}</Text> : null}
              
              <View style={{ flexDirection: 'row', gap: 15, marginTop: 10 }}>
                <Text style={[styles.dateSubText, isDarkMode && { color: '#94a3b8' }]}>
                  Start: {task.issueDate ? new Date(task.issueDate).toLocaleDateString() : 'N/A'}
                </Text>
                <Text style={[styles.dateSubText, { color: '#ef4444', fontWeight: 'bold' }]}>
                  Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 }}>
                <Text style={styles.dateText}>Submissions: {task.submissions?.length || 0}</Text>
                <TouchableOpacity style={styles.viewBtn} onPress={() => openSubmissions(task)}>
                  <Text style={styles.viewBtnText}>View Submissions</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* New/Edit Task Modal */}
      <Modal visible={newTaskModal} animationType="fade" transparent onRequestClose={() => setNewTaskModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && { color: '#f8fafc' }, { textAlign: 'left', marginBottom: 0 }]} numberOfLines={1}>
                {editingTask ? 'Edit Task' : 'Assign New Task'}
              </Text>
              <TouchableOpacity onPress={() => setNewTaskModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#ffffff' : '#001b3a'} />
              </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              <Text style={[styles.label, isDarkMode && { color: '#94a3b8' }]}>Task Title</Text>
              <TextInput style={[styles.input, isDarkMode && { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' }]} placeholder="Task Title" placeholderTextColor="#94a3b8" value={title} onChangeText={setTitle} />
              
              <Text style={[styles.label, isDarkMode && { color: '#94a3b8' }]}>Subject</Text>
              <TextInput style={[styles.input, isDarkMode && { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' }]} placeholder="Subject" placeholderTextColor="#94a3b8" value={subject} onChangeText={setSubject} />
              
              <Text style={[styles.label, isDarkMode && { color: '#94a3b8' }]}>Description / Instructions</Text>
              <TextInput style={[styles.input, styles.textArea, isDarkMode && { backgroundColor: '#0f172a', color: '#ffffff', borderColor: '#334155' }]} placeholder="Description / Instructions" placeholderTextColor="#94a3b8" value={description} onChangeText={setDescription} multiline numberOfLines={4} textAlignVertical="top" />
              
              <Text style={[styles.label, isDarkMode && { color: '#94a3b8' }]}>Task Type</Text>
              <View style={{ flexDirection: 'row', gap: 15, marginBottom: 15 }}>
                <TouchableOpacity style={[styles.typeBtn, taskType === 'Assignment' && styles.typeBtnActive, isDarkMode && { borderColor: '#334155' }]} onPress={() => setTaskType('Assignment')}>
                  <Text style={[styles.typeBtnText, taskType === 'Assignment' && styles.typeBtnTextActive]}>Assignment</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.typeBtn, taskType === 'Quiz' && styles.typeBtnActive, isDarkMode && { borderColor: '#334155' }]} onPress={() => setTaskType('Quiz')}>
                  <Text style={[styles.typeBtnText, taskType === 'Quiz' && styles.typeBtnTextActive]}>Quiz</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, isDarkMode && { color: '#94a3b8' }]}>Start Date</Text>
              <TouchableOpacity 
                style={[styles.inputContainer, isDarkMode && { backgroundColor: '#0f172a', borderColor: '#334155' }, { marginBottom: 15 }]}
                onPress={() => { setCalendarTarget('start'); setCalendarVisible(true); }}
              >
                <TextInput 
                  style={[styles.inputField, isDarkMode && { color: '#ffffff' }]} 
                  placeholder="Select Start Date" 
                  placeholderTextColor="#94a3b8" 
                  value={issueDate} 
                  editable={false} 
                />
                <Ionicons name="calendar-outline" size={20} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
              </TouchableOpacity>

              <Text style={[styles.label, isDarkMode && { color: '#94a3b8' }]}>Due Date</Text>
              <TouchableOpacity 
                style={[styles.inputContainer, isDarkMode && { backgroundColor: '#0f172a', borderColor: '#334155' }]}
                onPress={() => { setCalendarTarget('due'); setCalendarVisible(true); }}
              >
                <TextInput 
                  style={[styles.inputField, isDarkMode && { color: '#ffffff' }]} 
                  placeholder="Select Due Date" 
                  placeholderTextColor="#94a3b8" 
                  value={dueDate} 
                  editable={false} 
                />
                <Ionicons name="calendar-outline" size={20} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
              </TouchableOpacity>
              
              <View style={styles.modalBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setNewTaskModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.submitBtn, isDarkMode && { backgroundColor: '#38bdf8' }]} 
                  onPress={handleCreateTask} 
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={isDarkMode ? '#001b3a' : '#fff'} />
                  ) : (
                    <Text style={[styles.submitBtnText, isDarkMode && { color: '#001b3a' }]}>
                      {editingTask ? 'Save Task' : 'Assign Task'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Mini Calendar Modal */}
      <Modal visible={calendarVisible} animationType="fade" transparent onRequestClose={() => setCalendarVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.calendarContent, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            
            {/* Calendar Header */}
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.calNavBtn}>
                <Ionicons name="chevron-back" size={20} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
              </TouchableOpacity>
              <Text style={[styles.calMonthText, isDarkMode && { color: '#ffffff' }]}>
                {MONTHS[currentCalendarDate.getMonth()]} {currentCalendarDate.getFullYear()}
              </Text>
              <TouchableOpacity onPress={() => changeMonth(1)} style={styles.calNavBtn}>
                <Ionicons name="chevron-forward" size={20} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
              </TouchableOpacity>
            </View>

            {/* Calendar Grid */}
            <View style={styles.calGrid}>
              {DAYS_OF_WEEK.map((d) => (
                <Text key={d} style={[styles.calWeekDayText, isDarkMode && { color: '#94a3b8' }]}>{d}</Text>
              ))}
              {getCalendarDays().map((day, idx) => (
                <View key={idx} style={styles.calGridCell}>
                  {day ? (
                    <TouchableOpacity 
                      style={[
                        styles.calDayBtn,
                        isSelectedDay(day) && (isDarkMode ? { backgroundColor: '#38bdf8' } : { backgroundColor: '#001b3a' })
                      ]}
                      onPress={() => handleSelectDay(day)}
                    >
                      <Text style={[
                        styles.calDayText,
                        isDarkMode && { color: '#ffffff' },
                        isSelectedDay(day) && { color: isDarkMode ? '#001b3a' : '#ffffff', fontWeight: 'bold' }
                      ]}>{day}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>

            {/* Cancel Button */}
            <TouchableOpacity style={[styles.calCancelBtn, isDarkMode && { backgroundColor: '#334155' }]} onPress={() => setCalendarVisible(false)}>
              <Text style={[styles.calCancelBtnText, isDarkMode && { color: '#94a3b8' }]}>Close</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

      {/* Submissions Modal */}
      <Modal visible={submissionsModal} animationType="slide" transparent onRequestClose={() => setSubmissionsModal(false)}>
        <View style={[styles.fullModalOverlay, isDarkMode && { backgroundColor: '#0f172a' }]}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
              <TouchableOpacity onPress={() => setSubmissionsModal(false)} style={{ marginRight: 15 }}>
                <Ionicons name="close" size={28} color={isDarkMode ? '#ffffff' : '#001b3a'} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>Submissions</Text>
            </View>
            
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              {activeTask?.submissions?.length === 0 ? (
                <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }, { marginTop: 50, textAlign: 'center' }]}>No students have submitted yet.</Text>
              ) : (
                activeTask?.submissions?.map((sub: any) => (
                  <View key={sub.studentId} style={[styles.subCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
                    <View style={styles.taskHeader}>
                      <Text style={[styles.subName, isDarkMode && { color: '#f8fafc' }]}>{sub.studentName}</Text>
                      {sub.status === 'Checked' ? (
                        <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}><Text style={{color: '#16a34a', fontWeight: 'bold', fontSize: 12}}>Graded: {sub.grade}</Text></View>
                      ) : (
                        <View style={[styles.badge, { backgroundColor: '#fef3c7' }]}><Text style={{color: '#d97706', fontWeight: 'bold', fontSize: 12}}>Needs Grading</Text></View>
                      )}
                    </View>
                    
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                      <TouchableOpacity style={[styles.fileBtn, { flex: 1, marginTop: 0 }, isDarkMode && { backgroundColor: '#334155' }]} onPress={() => openPdf(sub.fileUrl)}>
                        <MaterialCommunityIcons name="file-pdf-box" size={24} color="#ef4444" />
                        <Text style={[styles.fileBtnText, isDarkMode && { color: '#ffffff' }]}>View Submission</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.deleteSubBtn, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]} 
                        onPress={() => handleDeleteSubmission(activeTask._id, sub.studentId)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>

                    {gradingSubId === sub.studentId ? (
                      <View style={[styles.gradingBox, isDarkMode && { backgroundColor: '#0f172a' }]}>
                        <TextInput style={[styles.input, isDarkMode && { backgroundColor: '#1e293b', color: '#fff', borderColor: '#334155' }]} placeholder="Grade (e.g. 10/10)" placeholderTextColor="#94a3b8" value={grade} onChangeText={setGrade} />
                        <TextInput style={[styles.input, isDarkMode && { backgroundColor: '#1e293b', color: '#fff', borderColor: '#334155' }]} placeholder="Remarks (optional)" placeholderTextColor="#94a3b8" value={remarks} onChangeText={setRemarks} />
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <TouchableOpacity style={[styles.cancelBtn, { flex: 1, padding: 12 }]} onPress={() => setGradingSubId(null)}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.submitBtn, { flex: 1, padding: 12 }]} onPress={() => handleGradeSubmission(sub.studentId)} disabled={grading}>
                            {grading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitBtnText}>Save</Text>}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      sub.status !== 'Checked' && (
                        <TouchableOpacity style={styles.gradeBtn} onPress={() => { setGradingSubId(sub.studentId); setGrade(''); setRemarks(''); }}>
                          <Text style={styles.gradeBtnText}>Grade Submission</Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </SafeAreaView>
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
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#001b3a', flex: 1 },
  
  // Dropdown styles
  dropdownButton: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 16, height: 45
  },
  dropdownButtonText: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  dropdownList: {
    position: 'absolute', top: 80, left: 20, right: 20,
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 5,
    zIndex: 999, paddingVertical: 6
  },
  dropdownItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16
  },
  dropdownItemText: { fontSize: 14, color: '#475569' },

  taskCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  taskTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  badge: { backgroundColor: 'rgba(0, 27, 58, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { color: '#001b3a', fontWeight: 'bold', fontSize: 11 },
  taskSubject: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 2 },
  taskDesc: { fontSize: 14, color: '#334155', marginTop: 10, lineHeight: 20 },
  
  dateText: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  viewBtn: { backgroundColor: '#001b3a', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  viewBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { color: '#64748b', marginTop: 15, fontSize: 16, textAlign: 'center' },
  dateSubText: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, maxHeight: '90%', borderWidth: 1, borderColor: '#e2e8f0' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a', marginBottom: 20, textAlign: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, width: '100%' },
  modalCloseBtn: { padding: 4 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 12, fontSize: 15, marginBottom: 15, backgroundColor: '#f8fafc', color: '#0f172a' },
  label: { fontSize: 13, fontWeight: 'bold', color: '#001b3a', marginBottom: 8 },
  textArea: { height: 100 },
  typeBtn: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', backgroundColor: '#f8fafc' },
  typeBtnActive: { backgroundColor: 'rgba(0, 27, 58, 0.1)', borderColor: '#001b3a' },
  typeBtnText: { color: '#64748b', fontWeight: '600' },
  typeBtnTextActive: { color: '#001b3a', fontWeight: 'bold' },
  modalBtns: { flexDirection: 'row', gap: 15, marginTop: 25, marginBottom: 10 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
  submitBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#001b3a', alignItems: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },

  fullModalOverlay: { flex: 1, backgroundColor: '#f8fafc' },
  subCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  subName: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  fileBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 12, borderRadius: 12 },
  fileBtnText: { color: '#0f172a', fontWeight: 'bold', marginLeft: 10, fontSize: 14 },
  
  deleteSubBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ef4444',
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },

  gradeBtn: { backgroundColor: '#001b3a', padding: 12, borderRadius: 12, alignItems: 'center', marginTop: 15 },
  gradeBtnText: { color: '#ffffff', fontWeight: 'bold' },
  gradingBox: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginTop: 15 },
  
  actionIconBtn: {
    padding: 6
  },
  actionIconBtnText: {
    fontSize: 14
  },

  // Input Container style for Date Pickers
  inputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    borderRadius: 12, 
    paddingHorizontal: 15, 
    height: 48, 
    backgroundColor: '#f8fafc',
    marginBottom: 15
  },
  inputField: { 
    flex: 1, 
    fontSize: 15, 
    color: '#0f172a' 
  },

  // Mini Calendar styles
  calendarContent: { 
    backgroundColor: '#ffffff', 
    borderRadius: 24, 
    padding: 20, 
    width: '90%', 
    maxWidth: 340, 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    alignItems: 'center' 
  },
  calHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    width: '100%', 
    marginBottom: 15 
  },
  calNavBtn: { 
    padding: 8 
  },
  calMonthText: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    color: '#001b3a' 
  },
  calGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    width: '100%', 
    marginBottom: 10 
  },
  calWeekDayText: { 
    width: '14.28%', 
    textAlign: 'center', 
    fontSize: 12, 
    fontWeight: 'bold', 
    color: '#64748b', 
    marginBottom: 10 
  },
  calGridCell: { 
    width: '14.28%', 
    aspectRatio: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginVertical: 2 
  },
  calDayBtn: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  calDayText: { 
    fontSize: 13, 
    color: '#0f172a', 
    fontWeight: '500' 
  },
  calCancelBtn: { 
    marginTop: 15, 
    width: '100%', 
    padding: 12, 
    backgroundColor: '#f1f5f9', 
    borderRadius: 10, 
    alignItems: 'center' 
  },
  calCancelBtnText: { 
    fontSize: 14, 
    fontWeight: 'bold', 
    color: '#64748b' 
  }
});

