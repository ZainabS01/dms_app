import { API_URL as CENTRAL_API_URL } from '@/config/api';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, DeviceEventEmitter, SafeAreaView, Platform, ActivityIndicator, Animated, Alert, Modal, TextInput, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

const cleanDeptName = (name: string) => {
  return (name || '').replace(/^(BS\s+|BS)/i, '').trim();
};

const getDeptIconAndColors = (code: string, name: string) => {
  const codeUpper = (code || '').toUpperCase();
  const nameLower = (name || '').toLowerCase();
  
  let iconName: any = 'business-outline';
  let bgColor = '#eff6ff'; // light blue
  let iconColor = '#001b3a'; // Logo blue (Navy)
  let darkBgColor = '#1e3a8a'; // dark blue
  let darkIconColor = '#60a5fa'; // light blue in dark mode
  
  if (nameLower.includes('artificial') || nameLower.includes('ai') || nameLower.includes('intelligence')) {
    iconName = 'hardware-chip-outline';
  } else if (nameLower.includes('computer') || nameLower.includes('software') || nameLower.includes('it') || codeUpper === 'CS' || codeUpper === 'SE') {
    iconName = 'laptop-outline';
  } else if (nameLower.includes('economics') || nameLower.includes('eco')) {
    iconName = 'stats-chart-outline';
  } else if (nameLower.includes('english') || nameLower.includes('lit')) {
    iconName = 'book-outline';
  } else if (nameLower.includes('math') || nameLower.includes('calculation')) {
    iconName = 'calculator-outline';
  } else if (nameLower.includes('pol') || nameLower.includes('political') || nameLower.includes('science')) {
    iconName = 'globe-outline';
  } else if (nameLower.includes('urdu')) {
    iconName = 'language-outline';
  } else if (nameLower.includes('zoology') || nameLower.includes('bio') || nameLower.includes('animal')) {
    iconName = 'paw-outline';
  } else if (codeUpper.includes('EE') || nameLower.includes('electrical')) {
    iconName = 'flash-outline';
  } else if (codeUpper.includes('ME') || nameLower.includes('mechanical')) {
    iconName = 'settings-outline';
  } else if (codeUpper.includes('CE') || nameLower.includes('civil')) {
    iconName = 'construct-outline';
  } else if (codeUpper.includes('BA') || nameLower.includes('business') || nameLower.includes('manage')) {
    iconName = 'briefcase-outline';
  }
  
  return {
    iconName,
    bgColor,
    iconColor,
    darkBgColor,
    darkIconColor
  };
};

export default function AdminHome() {
  const [userData, setUserData] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exitModalVisible, setExitModalVisible] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };
  const greeting = getGreeting();

  // Feedback states removed since feedback has a dedicated page now

  // Notifications states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Notice board states
  const [notices, setNotices] = useState<any[]>([]);
  const [showAddNoticeModal, setShowAddNoticeModal] = useState(false);
  const [showAllNoticesModal, setShowAllNoticesModal] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [noticeTargetRole, setNoticeTargetRole] = useState<'student' | 'teacher' | 'all'>('all');
  const [noticeDept, setNoticeDept] = useState('All');
  const [postingNotice, setPostingNotice] = useState(false);
  const [editingNotice, setEditingNotice] = useState<any>(null);

  // Departments states
  const [departments, setDepartments] = useState<any[]>([]);
  const [showAddDeptModal, setShowAddDeptModal] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [postingDept, setPostingDept] = useState(false);
  const [editingDept, setEditingDept] = useState<any>(null);

  // Department users viewer states
  const [selectedDeptCode, setSelectedDeptCode] = useState('');
  const [selectedDeptName, setSelectedDeptName] = useState('');
  const [deptStudents, setDeptStudents] = useState<any[]>([]);
  const [deptTeachers, setDeptTeachers] = useState<any[]>([]);
  const [loadingDeptUsers, setLoadingDeptUsers] = useState(false);
  const [showDeptDetailsModal, setShowDeptDetailsModal] = useState(false);
  const [deptDetailTab, setDeptDetailTab] = useState<'student' | 'teacher'>('student');

  // Animated values for custom charts
  const studentHeightAnim = useRef(new Animated.Value(0)).current;
  const teacherHeightAnim = useRef(new Animated.Value(0)).current;
  const queriesWidthAnim = useRef(new Animated.Value(0)).current;
  const leavesWidthAnim = useRef(new Animated.Value(0)).current;

  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalSubjects: 0,
    pendingQueries: 0,
    pendingLeaves: 0
  });

  // Feedback helper methods removed since feedback has a dedicated page now

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${CENTRAL_API_URL}/notifications/admin/admin`);
      if (res.ok) setNotifications(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      const res = await fetch(`${CENTRAL_API_URL}/notifications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n._id !== id));
      }
    } catch (e) {
      console.error('Delete notification error:', e);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      const res = await fetch(`${CENTRAL_API_URL}/notifications/clear/admin/admin`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications([]);
      }
    } catch (e) {
      console.error('Clear notifications error:', e);
    }
  };

  const handleNotificationClick = async (item: any) => {
    await handleDeleteNotification(item._id);
    setShowNotifications(false);
    if (item.targetScreen) {
      router.push(item.targetScreen as any);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${CENTRAL_API_URL}/auth/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotices = async () => {
    try {
      const res = await fetch(`${CENTRAL_API_URL}/notices/admin`);
      if (res.ok) {
        setNotices(await res.json());
      }
    } catch (e) {
      console.error('Error fetching notices:', e);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${CENTRAL_API_URL}/departments`);
      if (res.ok) {
        setDepartments(await res.json());
      }
    } catch (e) {
      console.error('Error fetching departments:', e);
    }
  };

  const handleAddNotice = async () => {
    if (!noticeTitle.trim() || !noticeContent.trim()) {
      return Alert.alert('Error', 'Please fill in notice title and content.');
    }
    setPostingNotice(true);
    try {
      const url = editingNotice 
        ? `${CENTRAL_API_URL}/notices/${editingNotice._id}`
        : `${CENTRAL_API_URL}/notices/add`;
      const method = editingNotice ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noticeTitle.trim(),
          content: noticeContent.trim(),
          targetRole: noticeTargetRole,
          department: noticeDept
        })
      });
      if (res.ok) {
        Alert.alert('Success', editingNotice ? 'Notice updated successfully!' : 'Notice published successfully!');
        setShowAddNoticeModal(false);
        setEditingNotice(null);
        setNoticeTitle('');
        setNoticeContent('');
        setNoticeTargetRole('all');
        setNoticeDept('All');
        fetchNotices();
      } else {
        Alert.alert('Error', editingNotice ? 'Failed to update notice.' : 'Failed to publish notice.');
      }
    } catch (e) {
      Alert.alert('Error', 'Network communication failure.');
    } finally {
      setPostingNotice(false);
    }
  };

  const handleEditNoticeTrigger = (notice: any) => {
    setEditingNotice(notice);
    setNoticeTitle(notice.title);
    setNoticeContent(notice.content);
    setNoticeTargetRole(notice.targetRole || 'all');
    setNoticeDept(notice.department || 'All');
    setShowAddNoticeModal(true);
  };

  const handleDeleteNotice = async (noticeId: string) => {
    Alert.alert('Delete Notice', 'Are you sure you want to delete this notice?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${CENTRAL_API_URL}/notices/${noticeId}`, { method: 'DELETE' });
            if (res.ok) {
              fetchNotices();
            }
          } catch (e) {
            Alert.alert('Error', 'Could not delete notice.');
          }
        }
      }
    ]);
  };

  const handleAddDept = async () => {
    if (!deptName.trim()) {
      return Alert.alert('Error', 'Please fill in department name.');
    }

    setPostingDept(true);
    try {
      if (editingDept) {
        // Edit Department (PUT /api/departments/:code)
        const res = await fetch(`${CENTRAL_API_URL}/departments/${editingDept.code}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: deptName.trim() })
        });
        const data = await res.json();
        if (res.ok) {
          Alert.alert('Success', 'Department updated successfully!');
          setShowAddDeptModal(false);
          setEditingDept(null);
          setDeptName('');
          setDeptCode('');
          fetchDepartments();
        } else {
          Alert.alert('Error', data.message || 'Failed to update department.');
        }
      } else {
        // Auto-generate a clean department code from the name
        const words = deptName.trim().split(/\s+/);
        let generatedCode = '';
        if (words.length === 1) {
          generatedCode = words[0].substring(0, 4).toUpperCase();
        } else {
          generatedCode = words.map(w => w[0]).join('').toUpperCase();
        }

        const res = await fetch(`${CENTRAL_API_URL}/departments/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: deptName.trim(),
            code: generatedCode
          })
        });
        const data = await res.json();
        if (res.ok) {
          Alert.alert('Success', 'Department created successfully!');
          setShowAddDeptModal(false);
          setDeptName('');
          setDeptCode('');
          fetchDepartments();
        } else {
          Alert.alert('Error', data.message || 'Failed to create department.');
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Network communication failure.');
    } finally {
      setPostingDept(false);
    }
  };

  const handleEditDeptTrigger = (dept: any) => {
    setEditingDept(dept);
    setDeptName(dept.name || '');
    setShowAddDeptModal(true);
  };

  const handleDeleteDept = (code: string, name: string) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete the ${cleanDeptName(name)} department? This will not delete registered users.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${CENTRAL_API_URL}/departments/${code}`, {
                method: 'DELETE'
              });
              if (res.ok) {
                Alert.alert('Success', 'Department deleted successfully.');
                fetchDepartments();
              } else {
                const err = await res.json();
                Alert.alert('Error', err.message || 'Failed to delete department.');
              }
            } catch (error) {
              Alert.alert('Error', 'Network communication failure.');
            }
          }
        }
      ]
    );
  };

  const handleViewDeptUsers = async (code: string, name: string) => {
    setSelectedDeptCode(code);
    setSelectedDeptName(name);
    setLoadingDeptUsers(true);
    setShowDeptDetailsModal(true);
    setDeptDetailTab('student');
    try {
      const res = await fetch(`${CENTRAL_API_URL}/departments/${code}/users`);
      if (res.ok) {
        const data = await res.json();
        setDeptStudents(data.students || []);
        setDeptTeachers(data.teachers || []);
      }
    } catch (e) {
      console.error('Error fetching department users:', e);
    } finally {
      setLoadingDeptUsers(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadThemeAndData = async () => {
        const theme = await AsyncStorage.getItem('appTheme');
        setIsDarkMode(theme === 'dark');
        
        const data = await AsyncStorage.getItem('userData');
        if (data) setUserData(JSON.parse(data));

        fetchStats();
        fetchNotices();
        fetchDepartments();
        fetchNotifications();
      };
      loadThemeAndData();

      const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);

      const onBackPress = () => {
        setExitModalVisible(true);
        return true;
      };

      const backSubscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        sub.remove();
        backSubscription.remove();
      };
    }, [])
  );

  useEffect(() => {
    if (loading) return;

    // Reset animated values to 0 before starting the animations
    studentHeightAnim.setValue(0);
    teacherHeightAnim.setValue(0);
    queriesWidthAnim.setValue(0);
    leavesWidthAnim.setValue(0);

    const maxUsers = Math.max(stats.totalStudents, stats.totalTeachers, 1);
    
    // Scale vertical bar heights to a maximum of 120px
    const targetStudentHeight = (stats.totalStudents / maxUsers) * 120;
    const targetTeacherHeight = (stats.totalTeachers / maxUsers) * 120;

    // Scale horizontal progress bars relative to a standard threshold (e.g. 10 items is 100% full workload)
    const targetQueryProgress = Math.min((stats.pendingQueries / 10) * 100, 100);
    const targetLeaveProgress = Math.min((stats.pendingLeaves / 10) * 100, 100);

    Animated.parallel([
      Animated.timing(studentHeightAnim, {
        toValue: targetStudentHeight,
        duration: 800,
        useNativeDriver: false,
      }),
      Animated.timing(teacherHeightAnim, {
        toValue: targetTeacherHeight,
        duration: 800,
        useNativeDriver: false,
      }),
      Animated.timing(queriesWidthAnim, {
        toValue: targetQueryProgress,
        duration: 800,
        useNativeDriver: false,
      }),
      Animated.timing(leavesWidthAnim, {
        toValue: targetLeaveProgress,
        duration: 800,
        useNativeDriver: false,
      }),
    ]).start();
  }, [stats, loading]);

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#1e293b' }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.greetingText, isDarkMode && { color: '#94a3b8' }]}>{greeting},</Text>
          <Text style={[styles.nameText, isDarkMode && { color: '#f8fafc' }]}>Admin {userData?.name || ''}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.iconBtn, isDarkMode && { backgroundColor: '#334155' }]} onPress={() => setShowNotifications(!showNotifications)}>
            <Ionicons name={showNotifications ? "notifications" : "notifications-outline"} size={24} color={isDarkMode ? '#f8fafc' : '#0f172a'} />
            {notifications.length > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileAvatar} onPress={() => router.push('/(admin)/profile' as any)}>
            <Ionicons name="person" size={20} color="#001b3a" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 150, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
        {/* Welcome Banner */}
        <View style={[styles.welcomeCard, isDarkMode && { backgroundColor: '#1e293b' }]}>
          <View style={styles.welcomeTop}>
            <View style={styles.welcomeIconBox}>
              <Ionicons name="shield-checkmark" size={20} color="#ffffff" />
            </View>
            <Text style={[styles.welcomeTitle, isDarkMode && { color: '#f8fafc' }]}>ADMINISTRATOR PORTAL</Text>
          </View>
          <Text style={[styles.welcomeText, isDarkMode && { color: '#94a3b8' }]}>
            Department Management System (DMS) Admin Control. Oversee academic structures, manage users, and reply to institutional queries.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#001b3a" style={{ marginVertical: 50 }} />
        ) : (
          <>
            {/* Charts Section */}
            <Text style={[styles.sectionTitle, isDarkMode && { color: '#f8fafc' }, { marginTop: 25 }]}>Analytics Overview</Text>
            
            <View style={styles.chartsContainer}>
              {/* Bar Chart Card */}
              <View style={[styles.chartCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
                <Text style={[styles.chartTitle, isDarkMode && { color: '#f8fafc' }]}>User breakdown</Text>
                
                <View style={styles.barChartWrapper}>
                  {/* Y Axis markings */}
                  <View style={styles.yAxis}>
                    <Text style={styles.yAxisText}>{Math.max(stats.totalStudents, stats.totalTeachers, 1)}</Text>
                    <Text style={styles.yAxisText}>{Math.round(Math.max(stats.totalStudents, stats.totalTeachers, 1) / 2)}</Text>
                    <Text style={styles.yAxisText}>0</Text>
                  </View>

                  <View style={[styles.chartArea, isDarkMode && { borderColor: '#475569' }]}>
                    {/* Horizontal Grid Lines */}
                    <View style={[styles.gridLine, { bottom: '100%' }, isDarkMode && { borderColor: '#334155' }]} />
                    <View style={[styles.gridLine, { bottom: '50%' }, isDarkMode && { borderColor: '#334155' }]} />
                    <View style={[styles.gridLine, { bottom: '0%' }, isDarkMode && { borderColor: '#334155' }]} />

                    {/* Bars */}
                    <View style={styles.barsRow}>
                      {/* Students Bar */}
                      <View style={styles.barContainer}>
                        <Animated.View style={[
                          styles.bar,
                          {
                            backgroundColor: '#3b82f6',
                            height: studentHeightAnim
                          }
                        ]} />
                        <Text style={[styles.barValue, isDarkMode && { color: '#cbd5e1' }]}>{stats.totalStudents}</Text>
                      </View>

                      {/* Teachers Bar */}
                      <View style={styles.barContainer}>
                        <Animated.View style={[
                          styles.bar,
                          {
                            backgroundColor: '#10b981',
                            height: teacherHeightAnim
                          }
                        ]} />
                        <Text style={[styles.barValue, isDarkMode && { color: '#cbd5e1' }]}>{stats.totalTeachers}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* X Axis Labels */}
                <View style={styles.xAxisRow}>
                  <Text style={[styles.xAxisLabel, isDarkMode && { color: '#cbd5e1' }]}>Students</Text>
                  <Text style={[styles.xAxisLabel, isDarkMode && { color: '#cbd5e1' }]}>Teachers</Text>
                </View>
              </View>

              {/* Notice Board Card */}
              <View style={[styles.chartCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                  <Text style={[styles.chartTitle, isDarkMode && { color: '#f8fafc' }, { marginBottom: 0 }]}>Notice Board</Text>
                  <TouchableOpacity style={styles.addNoticeIconBtn} onPress={() => setShowAddNoticeModal(true)}>
                    <Ionicons name="add-circle" size={24} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
                  </TouchableOpacity>
                </View>

                {notices.length === 0 ? (
                  <Text style={[styles.noNoticesText, isDarkMode && { color: '#64748b' }]}>No active notices published.</Text>
                ) : (
                  <View style={{ gap: 10 }}>
                    {notices.slice(0, 3).map((notice) => (
                      <View key={notice._id} style={[styles.noticeItem, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.noticeTitleText, isDarkMode && { color: '#ffffff' }]} numberOfLines={1}>{notice.title}</Text>
                          <Text style={styles.noticeDateText}>{new Date(notice.createdAt).toLocaleDateString()} | Dept: {notice.department} | Target: {notice.targetRole}</Text>
                          <Text style={[styles.noticeContentSnippet, isDarkMode && { color: '#cbd5e1' }]} numberOfLines={2}>{notice.content}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity style={styles.editNoticeBtn} onPress={() => handleEditNoticeTrigger(notice)}>
                            <Ionicons name="create-outline" size={16} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.deleteNoticeBtn} onPress={() => handleDeleteNotice(notice._id)}>
                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    {notices.length > 3 && (
                      <TouchableOpacity style={styles.viewAllNoticeLink} onPress={() => setShowAllNoticesModal(true)}>
                        <Text style={styles.viewAllNoticeLinkText}>View All {notices.length} Notices</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>

            {/* Departments Section */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 15 }}>
              <Text style={[styles.sectionTitle, isDarkMode && { color: '#f8fafc' }, { marginBottom: 0 }]}>Departments</Text>
              <TouchableOpacity style={styles.addDeptIconBtn} onPress={() => setShowAddDeptModal(true)}>
                <Ionicons name="add-circle" size={24} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
              </TouchableOpacity>
            </View>

            {departments.length === 0 ? (
              <Text style={[styles.noNoticesText, isDarkMode && { color: '#64748b' }, { marginBottom: 25 }]}>No departments created yet.</Text>
            ) : (
              <View style={styles.deptsRow}>
                {departments.map((dept) => {
                  const { iconName, bgColor, iconColor, darkBgColor, darkIconColor } = getDeptIconAndColors(dept.code, dept.name);
                  return (
                    <View 
                      key={dept._id} 
                      style={[styles.deptCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}
                    >
                      <TouchableOpacity 
                        style={styles.deptCardClickable}
                        onPress={() => handleViewDeptUsers(dept.code, dept.name)}
                      >
                        <View style={[
                          styles.deptIconBox, 
                          { backgroundColor: bgColor }, 
                          isDarkMode && { backgroundColor: darkBgColor }
                        ]}>
                          <Ionicons 
                            name={iconName} 
                            size={20} 
                            color={isDarkMode ? darkIconColor : iconColor} 
                          />
                        </View>
                        <Text style={[styles.deptNameText, isDarkMode && { color: '#ffffff' }]} numberOfLines={1}>
                          {cleanDeptName(dept.name)}
                        </Text>
                        <Text style={[styles.deptStudentCountText, isDarkMode && { color: '#94a3b8' }]}>
                          {dept.studentCount || 0} Students
                        </Text>
                      </TouchableOpacity>

                      {/* Action buttons (Edit & Delete) */}
                      <View style={[styles.deptActionsRow, isDarkMode && { borderTopColor: '#334155' }]}>
                        <TouchableOpacity style={styles.deptCardActionBtn} onPress={() => handleEditDeptTrigger(dept)}>
                          <Ionicons name="create-outline" size={13} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deptCardActionBtn} onPress={() => handleDeleteDept(dept.code, dept.name)}>
                          <Ionicons name="trash-outline" size={13} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Quick Actions */}
            <Text style={[styles.sectionTitle, isDarkMode && { color: '#f8fafc' }, { marginTop: 25 }]}>Administrative Controls</Text>
            <View style={styles.gridContainer}>
              <TouchableOpacity style={[styles.gridBox, { width: '48%' }, isDarkMode && { backgroundColor: '#1e293b' }]} onPress={() => router.push('/(admin)/queries' as any)}>
                <View style={[styles.gridIconBox, { backgroundColor: '#eff6ff' }, isDarkMode && { backgroundColor: '#1e3a8a' }]}>
                  <Ionicons name="chatbubbles" size={24} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
                </View>
                <Text style={[styles.gridValue, isDarkMode && { color: '#f8fafc' }]}>Review</Text>
                <Text style={[styles.gridTitle, isDarkMode && { color: '#cbd5e1' }]}>Queries</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.gridBox, { width: '48%' }, isDarkMode && { backgroundColor: '#1e293b' }]} onPress={() => router.push('/(admin)/teacher_requests' as any)}>
                <View style={[styles.gridIconBox, { backgroundColor: '#eff6ff' }, isDarkMode && { backgroundColor: '#1e3a8a' }]}>
                  <Ionicons name="people-circle" size={24} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
                </View>
                <Text style={[styles.gridValue, isDarkMode && { color: '#f8fafc' }]}>Teacher</Text>
                <Text style={[styles.gridTitle, isDarkMode && { color: '#cbd5e1' }]}>Requests</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.gridBox, { width: '48%' }, isDarkMode && { backgroundColor: '#1e293b' }]} onPress={() => router.push('/(admin)/feedback' as any)}>
                <View style={[styles.gridIconBox, { backgroundColor: '#eff6ff' }, isDarkMode && { backgroundColor: '#1e3a8a' }]}>
                  <Ionicons name="chatbox-ellipses" size={24} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
                </View>
                <Text style={[styles.gridValue, isDarkMode && { color: '#f8fafc' }]}>Student</Text>
                <Text style={[styles.gridTitle, isDarkMode && { color: '#cbd5e1' }]}>Feedback</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Add Notice Modal */}
      <Modal visible={showAddNoticeModal} transparent animationType="fade" onRequestClose={() => setShowAddNoticeModal(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
          <View style={[styles.modalContent, { borderRadius: 20 }, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>{editingNotice ? 'Edit Announcement' : 'Publish Announcement'}</Text>
              <TouchableOpacity onPress={() => {
                setShowAddNoticeModal(false);
                setEditingNotice(null);
                setNoticeTitle('');
                setNoticeContent('');
                setNoticeTargetRole('all');
                setNoticeDept('All');
              }}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#cbd5e1' : '#0f172a'} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>Notice Title</Text>
                <TextInput style={[styles.input, isDarkMode && { backgroundColor: '#334155', color: '#ffffff', borderColor: '#475569' }]} placeholder="e.g. Midterm Exams Schedule" placeholderTextColor="#64748b" value={noticeTitle} onChangeText={setNoticeTitle} />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>Notice Content</Text>
                <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top', paddingTop: 10 }, isDarkMode && { backgroundColor: '#334155', color: '#ffffff', borderColor: '#475569' }]} placeholder="Type your notice description here..." placeholderTextColor="#64748b" multiline value={noticeContent} onChangeText={setNoticeContent} />
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>Target Audience</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {['all', 'student', 'teacher'].map((r) => (
                    <TouchableOpacity key={r} style={[styles.roleSelectBtn, noticeTargetRole === r && styles.roleSelectBtnActive]} onPress={() => setNoticeTargetRole(r as any)}>
                      <Text style={[styles.roleSelectBtnText, noticeTargetRole === r && { color: '#001b3a' }]}>{r.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.formGroup}>
                <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>Department Filter</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {[{ code: 'All', name: 'All' }, ...departments].map((dept) => (
                    <TouchableOpacity key={dept.code} style={[styles.roleSelectBtn, noticeDept === dept.code && styles.roleSelectBtnActive, { minWidth: 60 }]} onPress={() => setNoticeDept(dept.code)}>
                      <Text style={[styles.roleSelectBtnText, noticeDept === dept.code && { color: '#001b3a' }]}>{dept.code}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <TouchableOpacity style={styles.submitBtn} onPress={handleAddNotice} disabled={postingNotice}>
                {postingNotice ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>{editingNotice ? 'Update Announcement' : 'Post Announcement'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* View All Notices Modal */}
      <Modal visible={showAllNoticesModal} transparent animationType="fade" onRequestClose={() => setShowAllNoticesModal(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
          <View style={[styles.modalContent, { maxHeight: '80%', borderRadius: 20 }, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>All Announcements ({notices.length})</Text>
              <TouchableOpacity onPress={() => setShowAllNoticesModal(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#cbd5e1' : '#0f172a'} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {notices.map((notice) => (
                <View key={notice._id} style={[styles.noticeItem, { marginBottom: 12 }, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.noticeTitleText, isDarkMode && { color: '#ffffff' }]}>{notice.title}</Text>
                    <Text style={styles.noticeDateText}>{new Date(notice.createdAt).toLocaleDateString()} | Dept: {notice.department} | Target: {notice.targetRole}</Text>
                    <Text style={[styles.noticeContentSnippet, { marginTop: 6 }, isDarkMode && { color: '#cbd5e1' }]}>{notice.content}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity style={styles.editNoticeBtn} onPress={() => {
                      setShowAllNoticesModal(false);
                      handleEditNoticeTrigger(notice);
                    }}>
                      <Ionicons name="create-outline" size={16} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteNoticeBtn} onPress={() => handleDeleteNotice(notice._id)}>
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Department Modal */}
      <Modal visible={showAddDeptModal} transparent animationType="fade" onRequestClose={() => setShowAddDeptModal(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
          <View style={[styles.modalContent, { borderRadius: 20 }, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>{editingDept ? 'Edit Department' : 'Create Department'}</Text>
              <TouchableOpacity onPress={() => {
                setShowAddDeptModal(false);
                setEditingDept(null);
                setDeptName('');
                setDeptCode('');
              }}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#cbd5e1' : '#0f172a'} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={[styles.label, isDarkMode && { color: '#cbd5e1' }]}>Department Name</Text>
                <TextInput style={[styles.input, isDarkMode && { backgroundColor: '#334155', color: '#ffffff', borderColor: '#475569' }]} placeholder="e.g. Electrical Engineering" placeholderTextColor="#64748b" value={deptName} onChangeText={setDeptName} />
              </View>
              <TouchableOpacity style={styles.submitBtn} onPress={handleAddDept} disabled={postingDept}>
                {postingDept ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>{editingDept ? 'Update Department' : 'Create Department'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Department Details Modal */}
      <Modal visible={showDeptDetailsModal} transparent animationType="fade" onRequestClose={() => setShowDeptDetailsModal(false)}>
        <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 20 }]}>
          <View style={[styles.modalContent, { maxHeight: '80%', borderRadius: 20 }, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>{cleanDeptName(selectedDeptName)}</Text>
              <TouchableOpacity onPress={() => setShowDeptDetailsModal(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#cbd5e1' : '#0f172a'} />
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={[styles.tabBar, isDarkMode && { borderBottomColor: '#334155' }]}>
              <TouchableOpacity style={[styles.tabItem, deptDetailTab === 'student' && styles.tabItemActive]} onPress={() => setDeptDetailTab('student')}>
                <Text style={[styles.tabItemText, deptDetailTab === 'student' && styles.tabItemTextActive, isDarkMode && { color: '#cbd5e1' }]}>Students ({deptStudents.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabItem, deptDetailTab === 'teacher' && styles.tabItemActive]} onPress={() => setDeptDetailTab('teacher')}>
                <Text style={[styles.tabItemText, deptDetailTab === 'teacher' && styles.tabItemTextActive, isDarkMode && { color: '#cbd5e1' }]}>Teachers ({deptTeachers.length})</Text>
              </TouchableOpacity>
            </View>

            {loadingDeptUsers ? (
              <ActivityIndicator size="large" color="#001b3a" style={{ marginVertical: 35 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {deptDetailTab === 'student' ? (
                  deptStudents.length === 0 ? (
                    <Text style={[styles.noNoticesText, { textAlign: 'center', marginVertical: 30 }]}>No registered students found.</Text>
                  ) : (
                    deptStudents.map((s, idx) => (
                      <View key={idx} style={[styles.userListItem, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]}>
                        <Ionicons name="school" size={20} color={isDarkMode ? '#38bdf8' : '#001b3a'} style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.userListName, isDarkMode && { color: '#ffffff' }]}>{s.name}</Text>
                          <Text style={styles.userListMeta}>{s.email}</Text>
                          <Text style={styles.userListMeta}>Roll: {s.roll_no} | Sem: {s.semester}</Text>
                        </View>
                      </View>
                    ))
                  )
                ) : (
                  deptTeachers.length === 0 ? (
                    <Text style={[styles.noNoticesText, { textAlign: 'center', marginVertical: 30 }]}>No registered teachers found.</Text>
                  ) : (
                    deptTeachers.map((t, idx) => (
                      <View key={idx} style={[styles.userListItem, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]}>
                        <Ionicons name="person" size={20} color={isDarkMode ? '#38bdf8' : '#001b3a'} style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.userListName, isDarkMode && { color: '#ffffff' }]}>{t.name}</Text>
                          <Text style={styles.userListMeta}>{t.email}</Text>
                        </View>
                      </View>
                    ))
                  )
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>



      {/* Notifications Popover */}
      {showNotifications && (
        <View style={[styles.notificationPopover, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
          <View style={styles.popoverHeader}>
            <Text style={[styles.popoverTitle, isDarkMode && { color: '#f8fafc' }]}>Notifications ({notifications.length})</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {notifications.length > 0 && (
                <TouchableOpacity onPress={handleClearAllNotifications}>
                  <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: 'bold' }}>Clear All</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowNotifications(false)}>
                <Ionicons name="close" size={20} color={isDarkMode ? '#cbd5e1' : '#64748b'} />
              </TouchableOpacity>
            </View>
          </View>
          {notifications.length === 0 ? (
            <Text style={{ textAlign: 'center', color: isDarkMode ? '#94a3b8' : '#64748b', paddingVertical: 20 }}>No new notifications</Text>
          ) : (
            <ScrollView style={{ maxHeight: 250 }} showsVerticalScrollIndicator={false}>
              {notifications.map((item: any) => (
                <TouchableOpacity 
                  key={item._id} 
                  style={[styles.notificationItem, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]}
                  onPress={() => handleNotificationClick(item)}
                >
                  <View style={[styles.notiIcon, isDarkMode && { backgroundColor: '#475569' }]}>
                    <Ionicons 
                      name={item.type === 'query' ? 'chatbubbles' : item.type === 'feedback' ? 'chatbox-ellipses' : 'megaphone'} 
                      size={16} 
                      color={isDarkMode ? '#60a5fa' : '#001b3a'} 
                    />
                  </View>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[styles.notiTitle, isDarkMode && { color: '#f8fafc' }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.notiText, isDarkMode && { color: '#cbd5e1' }]} numberOfLines={2}>{item.message}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteNotification(item._id)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
      {/* Custom Exit App Confirmation Modal */}
      <Modal visible={exitModalVisible} transparent animationType="fade" onRequestClose={() => setExitModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModalContent, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            <Text style={[styles.confirmTitle, isDarkMode && { color: '#ffffff' }]}>Exit App</Text>
            <Text style={[styles.confirmMessage, isDarkMode && { color: '#cbd5e1' }]}>Are you sure you want to exit DMS?</Text>
            
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setExitModalVisible(false)}>
                <Text style={styles.confirmCancelText}>Stay</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmSubmitBtn, isDarkMode && { backgroundColor: '#38bdf8' }]} 
                onPress={() => {
                  setExitModalVisible(false);
                  BackHandler.exitApp();
                }}
              >
                <Text style={[styles.confirmSubmitText, isDarkMode && { color: '#001b3a' }]}>Exit</Text>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? 50 : 20, paddingBottom: 20, paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    marginBottom: 20
  },
  headerLeft: {},
  greetingText: { fontSize: 14, color: '#64748b', marginBottom: 4 },
  nameText: { fontSize: 22, fontWeight: 'bold', color: '#001b3a' },
  profileAvatar: {
    width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#e2e8f0',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ffffff'
  },
  welcomeCard: {
    backgroundColor: '#ffffff', padding: 20, borderRadius: 20, marginBottom: 25,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  welcomeTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  welcomeIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#001b3a', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  welcomeTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', letterSpacing: 0.5 },
  welcomeText: { fontSize: 14, color: '#64748b', lineHeight: 22 },
  
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 0.8 },
  
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statsCard: {
    width: '48%', backgroundColor: '#ffffff', padding: 15, borderRadius: 20, marginBottom: 15,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  statsIcon: { marginBottom: 10 },
  statsValue: { fontSize: 22, fontWeight: 'bold', color: '#0f172a' },
  statsLabel: { fontSize: 12, color: '#64748b', marginTop: 2, fontWeight: '500' },

  gridBox: {
    width: '48%', backgroundColor: '#ffffff', padding: 15, borderRadius: 20, marginBottom: 15,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  gridIconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  gridValue: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 },
  gridTitle: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  
  chartsContainer: { marginBottom: 10 },
  chartCard: {
    backgroundColor: '#ffffff', padding: 20, borderRadius: 20, marginBottom: 20,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
  },
  chartTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginBottom: 15, letterSpacing: 0.5 },
  barChartWrapper: { flexDirection: 'row', height: 130, alignItems: 'flex-end', marginTop: 10 },
  yAxis: { width: 30, height: 120, justifyContent: 'space-between', paddingVertical: 5 },
  yAxisText: { fontSize: 10, color: '#94a3b8', textAlign: 'right', paddingRight: 5, fontWeight: '600' },
  chartArea: { flex: 1, height: 120, position: 'relative', borderLeftWidth: 1, borderBottomWidth: 1, borderColor: '#cbd5e1' },
  gridLine: { position: 'absolute', left: 0, right: 0, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  barsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: '100%', paddingHorizontal: 20 },
  barContainer: { alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  bar: { width: 36, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  barValue: { fontSize: 11, fontWeight: 'bold', color: '#64748b', marginTop: 4 },
  xAxisRow: { flexDirection: 'row', justifyContent: 'space-around', paddingLeft: 30, marginTop: 8 },
  xAxisLabel: { fontSize: 12, fontWeight: '600', color: '#64748b', width: 80, textAlign: 'center' },
  
  progressRow: { marginBottom: 15 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  progressLabel: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  progressValText: { fontSize: 12, fontWeight: 'bold' },
  progressTrack: { height: 10, backgroundColor: '#f1f5f9', borderRadius: 5, overflow: 'hidden' },
  progressBar: { height: '100%', borderRadius: 5 },

  // Notice board and departments
  addNoticeIconBtn: { padding: 4 },
  noNoticesText: { fontSize: 14, color: '#94a3b8', textAlign: 'center', paddingVertical: 15 },
  noticeItem: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center' },
  noticeTitleText: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  noticeDateText: { fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  noticeContentSnippet: { fontSize: 12, color: '#64748b', marginTop: 6, lineHeight: 18 },
  deleteNoticeBtn: { padding: 6 },
  editNoticeBtn: { padding: 6 },
  viewAllNoticeLink: { alignItems: 'center', paddingVertical: 6, marginTop: 5 },
  viewAllNoticeLinkText: { fontSize: 13, fontWeight: 'bold', color: '#3b82f6' },

  addDeptIconBtn: { padding: 4 },
  deptsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 25 },
  deptCard: { width: '31%', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, position: 'relative', minHeight: 135, padding: 8, justifyContent: 'space-between' },
  deptCardClickable: { flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%', paddingTop: 4 },
  deptStudentCountText: { fontSize: 10, color: '#64748b', marginTop: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  deptActionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 6, width: '100%', marginTop: 6 },
  deptCardActionBtn: { padding: 2 },
  deptIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  deptCodeText: { fontSize: 14, fontWeight: 'bold', color: '#0f172a', marginBottom: 2 },
  deptNameText: { fontSize: 12, color: '#0f172a', textAlign: 'center', fontWeight: 'bold', marginTop: 4 },

  // Modals overlays
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  formGroup: { marginBottom: 15 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
  feedbackCard: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12
  },
  feedbackCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  feedbackStudentName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  feedbackMetaText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500'
  },
  feedbackMessageText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginTop: 4
  },
  feedbackCardActionBtn: {
    padding: 4
  },
  feedbackDateText: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'right',
    marginTop: 8,
    fontWeight: '600'
  },
  input: { height: 48, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: '#0f172a', backgroundColor: '#f8fafc' },
  roleSelectBtn: { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, alignItems: 'center', backgroundColor: '#f8fafc' },
  roleSelectBtnActive: { backgroundColor: '#eab308', borderColor: '#eab308' },
  roleSelectBtnText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  submitBtn: { height: 48, backgroundColor: '#001b3a', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 20 },
  submitBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },

  // Department users viewer tabs and lists
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', marginBottom: 15 },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: '#001b3a' },
  tabItemText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  tabItemTextActive: { color: '#001b3a', fontWeight: 'bold' },
  userListItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  userListName: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  userListMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },

  // Notification Styles
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center',
  },
  badge: {
    position: 'absolute', top: 8, right: 10,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  notificationPopover: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 130 : 80,
    right: 20,
    width: 260,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 15,
    borderWidth: 1, borderColor: '#e2e8f0',
    zIndex: 9999,
  },
  popoverHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  popoverTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  notificationItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  notiIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  notiTitle: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
  notiText: { fontSize: 11, color: '#64748b', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 25 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 20, padding: 25 },

  // Custom Confirm Dialog Styles
  confirmModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center'
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#001b3a',
    marginBottom: 10
  },
  confirmMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%'
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center'
  },
  confirmCancelText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748b'
  },
  confirmSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#001b3a',
    alignItems: 'center'
  },
  confirmSubmitText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff'
  },
});
