import { API_URL } from '@/config/api';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Modal, Platform, Image, DeviceEventEmitter, Alert, BackHandler, TextInput } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
export default function StudentDashboardHome() {
  const [userData, setUserData] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [greeting, setGreeting] = useState('Welcome');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const router = useRouter();

  const [attSummary, setAttSummary] = useState({ present: 0, total: 0 });
  const [resSummary, setResSummary] = useState({ topGrade: '--' });
  const [tasksSummary, setTasksSummary] = useState({ count: 0 });
  const [queriesSummary, setQueriesSummary] = useState({ pending: 0 });
  const [notices, setNotices] = useState<any[]>([]);
  const [exitModalVisible, setExitModalVisible] = useState(false);

  // (Notice management states removed - students can only view admin announcements)

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');

    const loadData = async () => {
      const data = await AsyncStorage.getItem('userData');
      if (data) {
        const user = JSON.parse(data);
        setUserData(user);
        
        // Fetch daily attendance stats
        fetch(`${API_URL}/attendance/student/${user.id || user._id}`)
          .then(r => r.json())
          .then(d => {
            setAttSummary({ present: d.present || 0, total: d.total || 0 });
          }).catch(console.error);
          
        // Fetch published results for this student (using rollNo)
        if (user.roll_no) {
          fetch(`${API_URL}/results/student/${encodeURIComponent(user.roll_no)}`)
            .then(r => r.json())
            .then(d => {
              if (d.length > 0) {
                // Show latest CGPA or GPA
                const latest = d[0];
                setResSummary({ topGrade: latest.cgpa ? `${latest.cgpa} CGPA` : (latest.gpa ? `${latest.gpa} GPA` : 'Published') });
              } else {
                setResSummary({ topGrade: 'No Results' });
              }
            }).catch(console.error);

          // Fetch queries
          fetch(`${API_URL}/queries/student/${encodeURIComponent(user.roll_no)}`)
            .then(r => r.json())
            .then(d => {
              const pending = d.filter((q: any) => q.status === 'PENDING').length;
              setQueriesSummary({ pending });
            }).catch(console.error);
        }

        // Fetch Tasks
        fetch(`${API_URL}/tasks/class/${encodeURIComponent(user.department)}/${encodeURIComponent(user.semester)}`)
          .then(r => r.json())
          .then(d => {
            setTasksSummary({ count: d.length });
          }).catch(console.error);

        // Fetch Notices
        fetchNotices(user.department);
      }
    };
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadThemeAndUser = async () => {
        const theme = await AsyncStorage.getItem('appTheme');
        setIsDarkMode(theme === 'dark');
        
        const data = await AsyncStorage.getItem('userData');
        if (data) {
          const user = JSON.parse(data);
          const savedImage = await AsyncStorage.getItem(`profileImage_${user.role}_${user.id || user._id || user.email}`);
          if (savedImage) {
            user.profileImage = savedImage;
          }
          setUserData(user);
          fetchNotifications(user.id || user._id);
          fetchNotices(user.department);
        }
      };
      loadThemeAndUser();
      
      const sub = DeviceEventEmitter.addListener('themeChanged', (isDark) => {
        setIsDarkMode(isDark);
      });

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
      const res = await fetch(`${API_URL}/notifications/${userId}/student`);
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
      const res = await fetch(`${API_URL}/notifications/clear/${userId}/student`, { method: 'DELETE' });
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

  const fetchNotices = async (dept?: string) => {
    try {
      const d = dept || userData?.department || 'All';
      const res = await fetch(`${API_URL}/notices/view/student/${encodeURIComponent(d)}`);
      if (res.ok) {
        setNotices(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  // (Notice management methods removed - students can only view admin announcements)

  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<any>(null);
  const [showNoticeModal, setShowNoticeModal] = useState(false);

  const handleDeleteNotice = async (noticeId: string) => {
    Alert.alert('Delete Notice', 'Are you sure you want to delete this notice?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${API_URL}/notices/${noticeId}`, { method: 'DELETE' });
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

  const handleNoticePress = (notice: any) => {
    setSelectedNotice(notice);
    setShowNoticeModal(true);
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#0f172a' }]}>
      
      {/* Header Section */}
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b' }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.greetingText, isDarkMode && { color: '#94a3b8' }]}>{greeting},</Text>
          <Text style={[styles.nameText, isDarkMode && { color: '#f8fafc' }]}>{userData?.name || 'Student'}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={[styles.iconBtn, isDarkMode && { backgroundColor: '#334155' }]} onPress={() => setShowNotifications(!showNotifications)}>
            <Ionicons name={showNotifications ? "notifications" : "notifications-outline"} size={24} color={isDarkMode ? '#f8fafc' : '#0f172a'} />
            {notifications.length > 0 && <View style={styles.badge} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.profileAvatar} onPress={() => router.push('/profile' as any)}>
            {userData?.profileImage ? (
              <Image source={{ uri: userData.profileImage }} style={styles.profileImg} />
            ) : (
              <Ionicons name="person" size={20} color="#001b3a" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]} 
        showsVerticalScrollIndicator={false}
        bounces={true}
        overScrollMode="never"
        decelerationRate="normal"
        contentContainerStyle={{ paddingBottom: 150, paddingHorizontal: 20 }}
      >
        
        {/* Department Banner (Top Welcome Card) */}
        <View style={[styles.welcomeCard, isDarkMode && { backgroundColor: '#1e293b' }]}>
          <View style={styles.welcomeTop}>
            <View style={styles.welcomeIconBox}>
              <Ionicons name="school" size={20} color="#ffffff" />
            </View>
            <Text style={[styles.welcomeTitle, isDarkMode && { color: '#f8fafc' }]}>{(userData?.department || 'My Department').toUpperCase()}</Text>
          </View>
          <Text style={[styles.welcomeText, isDarkMode && { color: '#94a3b8' }]}>
            Access your course materials, notes, and past papers organized by department.
          </Text>
        </View>

        {/* Academic Overview Grid */}
        <View style={styles.gridContainer}>
          {/* Attendance */}
          <TouchableOpacity style={[styles.gridBox, isDarkMode && { backgroundColor: '#1e293b' }]} onPress={() => router.push('/(student)/attendance' as any)}>
            <View style={[styles.gridIconBox, { backgroundColor: '#eff6ff' }, isDarkMode && { backgroundColor: '#1e3a8a' }]}>
              <MaterialCommunityIcons name="calendar-check" size={24} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
            </View>
            <Text style={[styles.gridValue, isDarkMode && { color: '#f8fafc' }]}>{attSummary.total > 0 ? `${attSummary.present}/${attSummary.total}` : '--/--'}</Text>
            <Text style={[styles.gridTitle, isDarkMode && { color: '#cbd5e1' }]}>Attendance</Text>
            <Text style={[styles.gridSub, isDarkMode && { color: '#64748b' }]}>Daily</Text>
          </TouchableOpacity>
          
          {/* Results */}
          <TouchableOpacity style={[styles.gridBox, isDarkMode && { backgroundColor: '#1e293b' }]} onPress={() => router.push('/(student)/results' as any)}>
            <View style={[styles.gridIconBox, { backgroundColor: '#eff6ff' }, isDarkMode && { backgroundColor: '#1e3a8a' }]}>
              <Ionicons name="school" size={24} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
            </View>
            <Text style={[styles.gridValue, isDarkMode && { color: '#f8fafc' }]}>{resSummary.topGrade}</Text>
            <Text style={[styles.gridTitle, isDarkMode && { color: '#cbd5e1' }]}>Results</Text>
            <Text style={[styles.gridSub, isDarkMode && { color: '#64748b' }]}>Semester</Text>
          </TouchableOpacity>

          {/* Tasks */}
          <TouchableOpacity style={[styles.gridBox, isDarkMode && { backgroundColor: '#1e293b' }]} onPress={() => router.push('/(student)/tasks' as any)}>
            <View style={[styles.gridIconBox, { backgroundColor: '#eff6ff' }, isDarkMode && { backgroundColor: '#1e3a8a' }]}>
              <MaterialCommunityIcons name="clipboard-text-clock" size={24} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
            </View>
            <Text style={[styles.gridValue, isDarkMode && { color: '#f8fafc' }]}>{tasksSummary.count}</Text>
            <Text style={[styles.gridTitle, isDarkMode && { color: '#cbd5e1' }]}>Tasks</Text>
            <Text style={[styles.gridSub, isDarkMode && { color: '#64748b' }]}>Assigned</Text>
          </TouchableOpacity>
          
          {/* Queries */}
          <TouchableOpacity style={[styles.gridBox, isDarkMode && { backgroundColor: '#1e293b' }]} onPress={() => router.push('/(student)/queries' as any)}>
            <View style={[styles.gridIconBox, { backgroundColor: '#eff6ff' }, isDarkMode && { backgroundColor: '#1e3a8a' }]}>
              <Ionicons name="chatbubbles" size={24} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
            </View>
            <Text style={[styles.gridValue, isDarkMode && { color: '#f8fafc' }]}>{queriesSummary.pending > 0 ? queriesSummary.pending : 'All'}</Text>
            <Text style={[styles.gridTitle, isDarkMode && { color: '#cbd5e1' }]}>Queries</Text>
            <Text style={[styles.gridSub, isDarkMode && { color: '#64748b' }]}>{queriesSummary.pending > 0 ? 'Pending' : 'Resolved'}</Text>
          </TouchableOpacity>
          
          {/* Timetable */}
          <TouchableOpacity style={[styles.gridBox, isDarkMode && { backgroundColor: '#1e293b' }]} onPress={() => router.push('/(student)/timetable' as any)}>
            <View style={[styles.gridIconBox, { backgroundColor: '#eff6ff' }, isDarkMode && { backgroundColor: '#1e3a8a' }]}>
              <Ionicons name="document-text" size={24} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
            </View>
            <Text style={[styles.gridValue, isDarkMode && { color: '#f8fafc' }]}>View</Text>
            <Text style={[styles.gridTitle, isDarkMode && { color: '#cbd5e1' }]}>Timetable</Text>
            <Text style={[styles.gridSub, isDarkMode && { color: '#64748b' }]}>Schedule</Text>
          </TouchableOpacity>

          {/* Applications */}
          <TouchableOpacity style={[styles.gridBox, isDarkMode && { backgroundColor: '#1e293b' }]} onPress={() => router.push('/(student)/applications' as any)}>
            <View style={[styles.gridIconBox, { backgroundColor: '#eff6ff' }, isDarkMode && { backgroundColor: '#1e3a8a' }]}>
              <Ionicons name="mail" size={24} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
            </View>
            <Text style={[styles.gridValue, isDarkMode && { color: '#f8fafc' }]}>Leave</Text>
            <Text style={[styles.gridTitle, isDarkMode && { color: '#cbd5e1' }]}>Applications</Text>
            <Text style={[styles.gridSub, isDarkMode && { color: '#64748b' }]}>Under review</Text>
          </TouchableOpacity>
        </View>

        {/* Announcements Section */}
        <View style={styles.historySection}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={[styles.sectionTitle, isDarkMode && { color: '#f8fafc' }, { marginBottom: 0 }]}>Announcements</Text>
          </View>
          {notices.length === 0 ? (
            <Text style={{ fontSize: 13, color: '#94a3b8', paddingVertical: 10 }}>No announcements from department admin.</Text>
          ) : (
            notices.map((notice) => (
              <TouchableOpacity key={notice._id} style={[styles.announcementCard, { marginBottom: 10 }, isDarkMode && { backgroundColor: '#1e293b' }]} onPress={() => handleNoticePress(notice)}>
                <View style={[styles.announcementIcon, isDarkMode && { backgroundColor: '#3b82f620' }]}>
                  <Ionicons name="megaphone" size={24} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.announcementTitle, isDarkMode && { color: '#ffffff' }]}>{notice.title}</Text>
                  <Text style={[styles.announcementText, isDarkMode && { color: '#94a3b8' }]} numberOfLines={2}>{notice.content}</Text>
                  <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, fontWeight: '500' }}>{new Date(notice.createdAt).toLocaleDateString()}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteNotice(notice._id)} style={{ padding: 4 }} hitSlop={{top:10,bottom:10,left:10,right:10}}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
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

      {/* (Add/Edit Notice Modal removed - students can only view admin announcements) */}
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
  safeArea: { flex: 1, backgroundColor: '#f8fafc' }, // Match container bg for smoother bounce
  container: { flex: 1, backgroundColor: '#f8fafc' },
  
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 50 : 20,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    zIndex: 10,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  headerLeft: { flex: 1 },
  greetingText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  nameText: { fontSize: 20, fontWeight: 'bold', color: '#001b3a', marginTop: 2 },
  
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
  profileAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#e2e8f0',
    overflow: 'hidden'
  },
  profileImg: { width: '100%', height: '100%' },

  welcomeCard: {
    backgroundColor: '#001b3a', // Deep blue
    borderRadius: 20,
    padding: 20,
    marginTop: 15,
    marginBottom: 25,
  },
  welcomeTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  welcomeIconBox: { width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  welcomeTitle: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
  welcomeText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, justifyContent: 'space-between', marginBottom: 25 },
  gridBox: {
    width: '47%', 
    padding: 16, 
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  gridIconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  gridValue: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  gridTitle: { fontSize: 13, color: '#1e293b', fontWeight: '600', marginTop: 4 },
  gridSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  historySection: { marginBottom: 25 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', marginBottom: 12 },
  historyScroll: { gap: 15 },
  historyCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#e2e8f0',
    padding: 12, borderRadius: 16, width: 130,
  },
  historyIconBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10
  },
  historyTitle: { fontSize: 13, fontWeight: '600', color: '#1e293b', marginBottom: 4 },
  historyTime: { fontSize: 11, color: '#94a3b8' },
  
  // Announcement Styles
  announcementCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff',
    padding: 15, borderRadius: 16, marginTop: 5,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  announcementIcon: {
    width: 45, height: 45, borderRadius: 12, backgroundColor: '#eff6ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 15
  },
  announcementTitle: { fontSize: 15, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  announcementText: { fontSize: 13, color: '#64748b', lineHeight: 18 },

  // Popover Styles
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
