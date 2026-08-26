import { API_URL } from '@/config/api';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, DeviceEventEmitter, SafeAreaView, Platform, Alert, BackHandler, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function TeacherHome() {
  const [userData, setUserData] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notices, setNotices] = useState<any[]>([]);
  const [exitModalVisible, setExitModalVisible] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<any>(null);
  const [showNoticeModal, setShowNoticeModal] = useState(false);

  // Teacher dashboard metrics stats
  const [stats, setStats] = useState({
    subjectsCount: 0,
    pendingQueriesCount: 0,
    pendingLeavesCount: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);

  const handleNoticePress = (notice: any) => {
    setSelectedNotice(notice);
    setShowNoticeModal(true);
  };

  const fetchStats = async (user: any) => {
    try {
      setLoadingStats(true);
      const userId = user.id || user._id;
      const dept = user.department || '';
      const sem = user.semester || '';

      // 1. Fetch Subjects count
      let subjectsLen = 0;
      if (dept) {
        const semToFetch = sem || '8';
        const res = await fetch(`${API_URL}/subjects/${encodeURIComponent(dept)}/${encodeURIComponent(semToFetch)}`);
        if (res.ok) {
          const d = await res.json();
          if (Array.isArray(d)) {
            subjectsLen = d.length;
          }
        }
      }

      // 2. Fetch Pending Queries count for teacher
      let pendingQueries = 0;
      if (userId) {
        const res = await fetch(`${API_URL}/queries/teacher/${userId}`);
        if (res.ok) {
          const d = await res.json();
          if (Array.isArray(d)) {
            pendingQueries = d.filter((q: any) => q.status === 'PENDING').length;
          }
        }
      }

      // 3. Fetch Pending Leave Applications count for teacher
      let pendingLeaves = 0;
      if (userId) {
        const res = await fetch(`${API_URL}/applications/teacher/${userId}`);
        if (res.ok) {
          const d = await res.json();
          if (Array.isArray(d)) {
            pendingLeaves = d.filter((app: any) => app.status === 'PENDING').length;
          }
        }
      }

      setStats({
        subjectsCount: subjectsLen,
        pendingQueriesCount: pendingQueries,
        pendingLeavesCount: pendingLeaves
      });
    } catch (e) {
      console.error('Error fetching teacher stats:', e);
    } finally {
      setLoadingStats(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadThemeAndData = async () => {
        const theme = await AsyncStorage.getItem('appTheme');
        setIsDarkMode(theme === 'dark');
        
        const data = await AsyncStorage.getItem('userData');
        if (data) {
          const user = JSON.parse(data);
          setUserData(user);
          fetchNotifications(user.id || user._id);
          fetchStats(user); // Fetch real-time stats for the teacher
          
          // Fetch Notices
          fetch(`${API_URL}/notices/view/teacher/${encodeURIComponent(user.department || 'All')}`)
            .then(r => r.json())
            .then(d => {
              if (Array.isArray(d)) {
                setNotices(d);
              }
            }).catch(console.error);
        }
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

  const fetchNotifications = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/notifications/${userId}/teacher`);
      if (res.ok) setNotifications(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/notifications/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n._id !== id));
      }
    } catch (e) {
      console.error('Delete notification error:', e);
    }
  };

  const handleClearAllNotifications = async () => {
    try {
      const userId = userData?.id || userData?._id;
      if (!userId) return;
      const res = await fetch(`${API_URL}/notifications/clear/${userId}/teacher`, { method: 'DELETE' });
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
      if (item.targetScreen.startsWith('notice:')) {
        const noticeId = item.targetScreen.split(':')[1];
        try {
          const res = await fetch(`${API_URL}/notices/${noticeId}`);
          if (res.ok) {
            const notice = await res.json();
            setSelectedNotice(notice);
            setShowNoticeModal(true);
          }
        } catch (err) {
          console.error('Fetch notice details error:', err);
        }
      } else {
        router.push(item.targetScreen as any);
      }
    }
  };

  const handleDeleteNotice = async (noticeId: string) => {
    Alert.alert(
      'Delete Announcement',
      'Are you sure you want to delete this announcement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/notices/${noticeId}`, { method: 'DELETE' });
              if (res.ok) {
                const data = await AsyncStorage.getItem('userData');
                if (data) {
                  const user = JSON.parse(data);
                  fetch(`${API_URL}/notices/view/teacher/${encodeURIComponent(user.department || 'All')}`)
                    .then(r => r.json())
                    .then(d => {
                      if (Array.isArray(d)) setNotices(d);
                    });
                }
              } else {
                Alert.alert('Error', 'Failed to delete announcement');
              }
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'Network error');
            }
          }
        }
      ]
    );
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };
  const greeting = getGreeting();

  const gridActions = [
    {
      title: 'Subjects',
      desc: 'Manage materials',
      screen: '/(teacher)/subjects',
      icon: 'library-outline',
      color: '#001b3a',
      bgColor: 'rgba(0, 27, 58, 0.1)',
    },
    {
      title: 'Attendance',
      desc: 'Mark presence',
      screen: '/(teacher)/attendance',
      icon: 'checkmark-done-circle-outline',
      color: '#001b3a',
      bgColor: 'rgba(0, 27, 58, 0.1)',
    },
    {
      title: 'Results',
      desc: 'Upload grades',
      screen: '/(teacher)/results',
      icon: 'trophy-outline',
      color: '#001b3a',
      bgColor: 'rgba(0, 27, 58, 0.1)',
    },
    {
      title: 'Tasks',
      desc: 'Assign homework',
      screen: '/(teacher)/tasks',
      icon: 'create-outline',
      color: '#001b3a',
      bgColor: 'rgba(0, 27, 58, 0.1)',
    },
    {
      title: 'Timetable',
      desc: 'Publish schedule',
      screen: '/(teacher)/timetable',
      icon: 'calendar-outline',
      color: '#001b3a',
      bgColor: 'rgba(0, 27, 58, 0.1)',
    },
    {
      title: 'Reply Queries',
      desc: 'Answer students',
      screen: '/(teacher)/queries',
      icon: 'chatbubbles-outline',
      color: '#001b3a',
      bgColor: 'rgba(0, 27, 58, 0.1)',
    },
    {
      title: 'Student Approval',
      desc: 'Manage students',
      screen: '/(teacher)/student_approval',
      icon: 'people-outline',
      color: '#001b3a',
      bgColor: 'rgba(0, 27, 58, 0.1)',
    },
  ];

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      {/* Flat White/Slate Header Bar (Consistent with student/original teacher layout) */}
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.greetingText, isDarkMode && { color: '#94a3b8' }]}>{greeting},</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={[styles.nameText, isDarkMode && { color: '#f8fafc' }]}>Teacher {userData?.name || ''}</Text>
            {userData?.isHOD && (
              <View style={styles.hodBadge}>
                <Ionicons name="shield-checkmark" size={11} color="#ffffff" style={{ marginRight: 3 }} />
                <Text style={styles.hodBadgeText}>HOD</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={[styles.iconBtn, isDarkMode && { backgroundColor: '#334155' }]} 
            onPress={() => setShowNotifications(!showNotifications)}
          >
            <Ionicons 
              name={showNotifications ? "notifications" : "notifications-outline"} 
              size={22} 
              color={isDarkMode ? '#ffffff' : '#001b3a'} 
            />
            {notifications.length > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.profileAvatar, isDarkMode && { borderColor: '#475569', backgroundColor: '#334155' }]} 
            onPress={() => router.push('/(teacher)/profile' as any)}
          >
            <Ionicons name="person" size={18} color={isDarkMode ? '#ffffff' : '#001b3a'} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={{ paddingBottom: 150 }} 
        showsVerticalScrollIndicator={false}
      >
        {/* Unified Premium Deep Blue Welcome Card (Logo Blue Theme) */}
        <View style={[styles.logoBlueBanner, isDarkMode && { backgroundColor: '#1e293b' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={[styles.deptBadge, isDarkMode && { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
              <Ionicons name="school" size={12} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.deptBadgeText}>{(userData?.department || 'My Department')}</Text>
            </View>
            {userData?.isHOD && (
              <View style={styles.bannerHodBadge}>
                <MaterialCommunityIcons name="shield-check" size={12} color="#fbbf24" style={{ marginRight: 4 }} />
                <Text style={styles.bannerHodBadgeText}>HOD DASHBOARD</Text>
              </View>
            )}
          </View>
          <Text style={styles.bannerSub}>
            Manage your courses, coordinate schedules, check leave requests and reply to student queries.
          </Text>
        </View>

        {/* Dashboard Overlapping Metrics Row */}
        <View style={styles.statsRow}>
          {/* Active Subjects Stat */}
          <View style={[styles.statCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            <View style={[styles.statIconBox, { backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(0, 27, 58, 0.1)' }]}>
              <Ionicons name="library-outline" size={18} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
            </View>
            <Text style={[styles.statVal, isDarkMode && { color: '#f8fafc' }]}>
              {stats.subjectsCount}
            </Text>
            <Text style={[styles.statLbl, isDarkMode && { color: '#94a3b8' }]}>Active Subjects</Text>
          </View>

          {/* Pending Queries Stat */}
          <TouchableOpacity 
            style={[styles.statCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}
            onPress={() => router.push('/(teacher)/queries' as any)}
          >
            <View style={[styles.statIconBox, { backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(0, 27, 58, 0.1)' }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
            </View>
            <Text style={[styles.statVal, isDarkMode && { color: '#f8fafc' }]}>
              {stats.pendingQueriesCount}
            </Text>
            <Text style={[styles.statLbl, isDarkMode && { color: '#94a3b8' }]}>Pending Queries</Text>
          </TouchableOpacity>

          {/* Pending Leaves Stat */}
          <TouchableOpacity 
            style={[styles.statCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}
            onPress={() => router.push('/(teacher)/applications' as any)}
          >
            <View style={[styles.statIconBox, { backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.15)' : 'rgba(0, 27, 58, 0.1)' }]}>
              <Ionicons name="document-text-outline" size={18} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
            </View>
            <Text style={[styles.statVal, isDarkMode && { color: '#f8fafc' }]}>
              {stats.pendingLeavesCount}
            </Text>
            <Text style={[styles.statLbl, isDarkMode && { color: '#94a3b8' }]}>Pending Leaves</Text>
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* Classroom Tools / Quick Actions Grid */}
          <Text style={[styles.gridTitleSection, isDarkMode && { color: '#f8fafc' }]}>Teacher Workspace</Text>
          <View style={styles.gridContainer}>
            {gridActions.map((action, index) => (
              <TouchableOpacity 
                key={index} 
                style={[styles.newGridBox, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]} 
                onPress={() => router.push(action.screen as any)}
              >
                <View style={[styles.gridActionIconBox, { backgroundColor: action.bgColor }]}>
                  <Ionicons name={action.icon as any} size={22} color={action.color} />
                </View>
                <Text style={[styles.newGridTitle, isDarkMode && { color: '#f8fafc' }]}>{action.title}</Text>
                <Text style={[styles.newGridDesc, isDarkMode && { color: '#94a3b8' }]} numberOfLines={2}>{action.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Announcements Section */}
          <Text style={[styles.sectionTitle, isDarkMode && { color: '#f8fafc' }, { marginTop: 10, marginBottom: 15 }]}>Announcements</Text>
          {notices.length === 0 ? (
            <Text style={{ fontSize: 13, color: '#94a3b8', paddingVertical: 10 }}>No announcements from department admin.</Text>
          ) : (
            <View style={{ gap: 12, marginBottom: 20 }}>
              {notices.map((notice) => (
                <TouchableOpacity 
                  key={notice._id} 
                  style={[
                    styles.announcementCard, 
                    isDarkMode && { 
                      backgroundColor: '#1e293b', 
                      borderColor: '#334155',
                      borderLeftColor: '#3b82f6' 
                    }
                  ]} 
                  onPress={() => handleNoticePress(notice)}
                >
                  <View style={[styles.announcementIcon, isDarkMode && { backgroundColor: '#3b82f620' }]}>
                    <Ionicons name="megaphone" size={22} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.announcementTitle, isDarkMode && { color: '#ffffff' }]}>{notice.title}</Text>
                    <Text style={[styles.announcementText, isDarkMode && { color: '#94a3b8' }]} numberOfLines={2}>{notice.content}</Text>
                    <Text style={styles.announcementDate}>{new Date(notice.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => handleDeleteNotice(notice._id)} 
                    style={{ padding: 8, justifyContent: 'center' }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

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
                      color={isDarkMode ? '#38bdf8' : '#001b3a'} 
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

      {/* Notice Detail Modal */}
      <Modal visible={showNoticeModal} transparent animationType="fade" onRequestClose={() => setShowNoticeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { borderRadius: 20, padding: 24, width: '85%', maxHeight: '70%' }, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <Text style={[styles.popoverTitle, { fontSize: 18 }, isDarkMode && { color: '#ffffff' }]}>Announcement</Text>
              <TouchableOpacity onPress={() => setShowNoticeModal(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#cbd5e1' : '#0f172a'} />
              </TouchableOpacity>
            </View>
            {selectedNotice && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: isDarkMode ? '#ffffff' : '#001b3a', marginBottom: 8 }}>
                  {selectedNotice.title}
                </Text>
                <Text style={{ fontSize: 11, color: '#94a3b8', marginBottom: 15, fontWeight: '600' }}>
                  Posted: {new Date(selectedNotice.createdAt).toLocaleString()}
                </Text>
                <Text style={{ fontSize: 14, color: isDarkMode ? '#cbd5e1' : '#334155', lineHeight: 22 }}>
                  {selectedNotice.content}
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  hodBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hodBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
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
    borderWidth: 1.5, borderColor: '#ffffff',
  },
  profileAvatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#e2e8f0',
    overflow: 'hidden'
  },
  
  // Custom Premium Deep Blue Banner (Matches logo colors and student homepage styling layout)
  logoBlueBanner: {
    backgroundColor: '#001b3a',
    padding: 20,
    paddingBottom: 20,
    borderRadius: 24,
    marginHorizontal: 20,
    marginBottom: 0,
    shadowColor: '#001b3a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  deptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  deptBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  bannerHodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  bannerHodBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  bannerSub: {
    fontSize: 13,
    color: '#eff6ff',
    lineHeight: 20,
    opacity: 0.9,
    marginTop: 8,
  },

  // Stats Dashboard Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  statCard: {
    width: '31%',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  statIconBox: {
    width: 36, height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statVal: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#001b3a',
    marginTop: 4,
  },
  statLbl: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },

  // Grid Actions
  gridTitleSection: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#001b3a',
    marginTop: 10,
    marginBottom: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  newGridBox: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 2,
  },
  gridActionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  newGridTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  newGridDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 14,
  },

  // AI Assistant Banner
  aiBanner: {
    flexDirection: 'row',
    backgroundColor: '#001b3a',
    borderRadius: 22,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#1e3a8a',
    shadowColor: '#001b3a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  aiBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  aiIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  aiBannerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  aiBannerText: {
    fontSize: 11,
    color: '#93c5fd',
    lineHeight: 15,
  },
  aiBannerBtn: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiBannerBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#001b3a',
  },

  // Notice Board / Announcements
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#001b3a',
    marginBottom: 12,
  },
  announcementCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    borderLeftColor: '#001b3a',
    marginBottom: 12,
    alignItems: 'center',
  },
  announcementIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  announcementTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  announcementText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  announcementDate: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 6,
    fontWeight: '500',
  },

  // Notifications Popover & Modals
  notificationPopover: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 110 : 80,
    right: 20,
    width: 280,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  popoverHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  popoverTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  notificationItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  notiIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  notiTitle: { fontSize: 13, fontWeight: 'bold', color: '#1e293b' },
  notiText: { fontSize: 11, color: '#64748b', marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 24, padding: 24, maxHeight: '90%' },

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
