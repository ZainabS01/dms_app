import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  DeviceEventEmitter, ActivityIndicator, Alert, SafeAreaView, Platform 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { API_URL } from '@/config/api';

export default function TeacherAttendance() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState<'attendance' | 'leaves'>('attendance');
  
  const [students, setStudents] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  // Attendance records state: { [studentId]: 'present' | 'absent' | 'leave' }
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  
  const [date] = useState(new Date().toISOString().split('T')[0]);

  // Semester dropdown selector
  const [selectedSemester, setSelectedSemester] = useState('1');
  const [showDropdown, setShowDropdown] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadThemeAndData = async () => {
        const theme = await AsyncStorage.getItem('appTheme');
        setIsDarkMode(theme === 'dark');
        const dataStr = await AsyncStorage.getItem('userData');
        if (dataStr) {
          const user = JSON.parse(dataStr);
          setUserData(user);
          if (user.department) {
            fetchData(user.department, selectedSemester);
            fetchLeaves(user.department, selectedSemester);
          }
        }
      };
      loadThemeAndData();
      const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
      return () => sub.remove();
    }, [selectedSemester])
  );

  const fetchData = async (department: string, semester: string) => {
    setLoading(true);
    try {
      const studsRes = await fetch(`${API_URL}/attendance/students/${encodeURIComponent(department)}/${encodeURIComponent(semester)}`);
      
      if (studsRes.ok) {
        const studsData = await studsRes.json();
        setStudents(studsData);
        
        // Initialize all students as 'present' by default
        const initAtt: Record<string, string> = {};
        studsData.forEach((s: any) => {
          initAtt[s._id] = 'present';
        });
        setAttendance(initAtt);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to fetch students roster');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaves = async (department: string, semester: string) => {
    try {
      const res = await fetch(`${API_URL}/attendance/leave/class/${encodeURIComponent(department)}/${encodeURIComponent(semester)}`);
      if (res.ok) {
        setLeaves(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAttendance = async () => {
    if (!userData?.department) return;
    setSaving(true);
    try {
      const records = students.map(s => ({
        studentId: s._id,
        status: attendance[s._id] || 'present'
      }));
      
      const res = await fetch(`${API_URL}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: userData.department,
          semester: selectedSemester,
          date: date,
          records
        })
      });
      
      if (res.ok) {
        Alert.alert('Success', 'Attendance saved successfully');
      } else {
        const data = await res.json();
        Alert.alert('Error', data.message || 'Failed to save attendance');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLeave = async (leaveId: string, status: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`${API_URL}/attendance/leave/${leaveId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        Alert.alert('Success', `Leave application ${status}`);
        fetchLeaves(userData.department, selectedSemester);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update leave status');
    }
  };

  const handleDownloadSemesterReport = async () => {
    if (!userData?.department) return;
    
    setExporting(true);
    try {
      // 1. Fetch all attendance sheets for the class
      const res = await fetch(`${API_URL}/attendance/class/${encodeURIComponent(userData.department)}/${encodeURIComponent(selectedSemester)}`);
      if (!res.ok) {
        throw new Error('Failed to retrieve class attendance history.');
      }
      const records = await res.json();

      // 2. Accumulate attendance per student
      const summaries: Record<string, { name: string; roll: string; present: number; absent: number; leave: number; total: number }> = {};
      
      // Initialize with active class students to ensure they are on the sheet even if they have 0 records
      students.forEach(s => {
        summaries[s._id] = {
          name: s.name,
          roll: s.roll_no || 'N/A',
          present: 0,
          absent: 0,
          leave: 0,
          total: 0
        };
      });

      records.forEach((day: any) => {
        day.records.forEach((rec: any) => {
          const studentId = rec.studentId?._id || rec.studentId;
          if (!studentId || !summaries[studentId]) return;
          
          summaries[studentId].total += 1;
          if (rec.status === 'present') summaries[studentId].present += 1;
          else if (rec.status === 'absent') summaries[studentId].absent += 1;
          else if (rec.status === 'leave') summaries[studentId].leave += 1;
        });
      });

      // 3. Generate HTML rows
      const rows = Object.values(summaries).map((s: any) => {
        const percent = s.total > 0 ? Math.round((s.present / s.total) * 100) : 100;
        const lowAttendanceClass = percent < 75 ? 'low-attendance' : '';
        return `
          <tr>
            <td>${s.roll}</td>
            <td>${s.name}</td>
            <td>${s.present}</td>
            <td>${s.absent}</td>
            <td>${s.leave}</td>
            <td>${s.total}</td>
            <td class="percentage ${lowAttendanceClass}">${percent}%</td>
          </tr>
        `;
      }).join('');

      // 4. Build complete HTML Template
      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 25px; color: #1e293b; }
              .header { text-align: center; border-bottom: 2px solid #001b3a; padding-bottom: 15px; margin-bottom: 25px; }
              .title { font-size: 24px; font-weight: bold; color: #001b3a; margin-bottom: 5px; }
              .subtitle { font-size: 14px; color: #64748b; }
              .meta-box { background: #f8fafc; padding: 15px; border-radius: 10px; margin-bottom: 25px; border: 1px solid #e2e8f0; }
              .meta-box p { margin: 6px 0; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 13px; }
              th { background-color: #001b3a; color: #ffffff; font-weight: bold; }
              tr:nth-child(even) { background-color: #f8fafc; }
              .percentage { font-weight: bold; }
              .low-attendance { color: #dc2626; font-weight: bold; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">Class Attendance Summary Report</div>
              <div class="subtitle">Official Academic Record</div>
            </div>
            <div class="meta-box">
              <p><strong>Department:</strong> ${userData.department}</p>
              <p><strong>Semester:</strong> Semester ${selectedSemester}</p>
              <p><strong>Report Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Leave</th>
                  <th>Total Days</th>
                  <th>Attendance %</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="7" style="text-align:center;">No student attendance data found.</td></tr>'}
              </tbody>
            </table>
          </body>
        </html>
      `;

      // 5. Generate and View/Save PDF
      try {
        await Print.printAsync({ html });
      } catch (printErr) {
        console.warn('Native printing failed, falling back to sharing:', printErr);
        const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });
        if (await Sharing.isAvailableAsync()) {
          try {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: `Semester_${selectedSemester}_Attendance_Report`,
              UTI: 'com.adobe.pdf'
            });
          } catch (shareErr) {
            console.log('Sharing dismissed:', shareErr);
          }
        } else {
          Alert.alert('Success', 'Report compiled successfully.');
        }
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Export Failed', err.message || 'Failed to download attendance sheet.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#ffffff' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>Attendance Hub</Text>
      </View>

      {/* Semester Dropdown Selector */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 15, zIndex: 10 }}>
        <Text style={[styles.dropdownLabel, isDarkMode && { color: '#cbd5e1' }]}>Select Semester</Text>
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

      {/* Tabs */}
      <View style={[styles.tabContainer, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'attendance' && styles.activeTab, isDarkMode && activeTab === 'attendance' && { borderBottomColor: '#38bdf8' }]} 
          onPress={() => setActiveTab('attendance')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'attendance' && styles.activeTabText, 
            isDarkMode && activeTab === 'attendance' && { color: '#38bdf8' },
            isDarkMode && activeTab !== 'attendance' && { color: '#94a3b8' }
          ]}>
            Mark Daily
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'leaves' && styles.activeTab, isDarkMode && activeTab === 'leaves' && { borderBottomColor: '#38bdf8' }]} 
          onPress={() => setActiveTab('leaves')}
        >
          <Text style={[
            styles.tabText, 
            activeTab === 'leaves' && styles.activeTabText, 
            isDarkMode && activeTab === 'leaves' && { color: '#38bdf8' },
            isDarkMode && activeTab !== 'leaves' && { color: '#94a3b8' }
          ]}>
            Leave Requests
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 150 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#001b3a" style={{ marginTop: 50 }} />
        ) : activeTab === 'attendance' ? (
          <>
            <View style={styles.dateHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { marginBottom: 4 }, isDarkMode && { color: '#e2e8f0' }]}>
                  {userData?.department}
                </Text>
                <Text style={[styles.subText, isDarkMode && { color: '#94a3b8' }]}>Class Roster (Semester {selectedSemester})</Text>
              </View>
              <View style={[styles.dateBadge, isDarkMode && { backgroundColor: '#1e293b' }]}>
                <Ionicons name="calendar-outline" size={16} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
                <Text style={[styles.dateText, isDarkMode && { color: '#cbd5e1' }]}>{date}</Text>
              </View>
            </View>

            {/* Semester Report Download Row */}
            {students.length > 0 && (
              <TouchableOpacity 
                style={[styles.downloadReportBtn, exporting && { opacity: 0.7 }]} 
                onPress={handleDownloadSemesterReport}
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="cloud-download-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.downloadReportBtnText}>Download Semester Report</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {students.length === 0 ? (
              <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }]}>No students found in this class.</Text>
            ) : (
              students.map((student) => (
                <View key={student._id} style={[styles.studentCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
                  <View style={styles.studentInfo}>
                    <View style={[styles.avatar, isDarkMode && { backgroundColor: '#334155' }]}>
                      <Text style={[styles.avatarText, isDarkMode && { color: '#cbd5e1' }]}>
                        {student.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.studentName, isDarkMode && { color: '#f8fafc' }]}>{student.name}</Text>
                      <Text style={[styles.studentRoll, isDarkMode && { color: '#94a3b8' }]}>{student.roll_no || student.rollNo || 'No Roll No'}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={[styles.attBtn, attendance[student._id] === 'present' ? styles.btnPresent : (isDarkMode ? styles.attBtnDark : styles.attBtnLight)]}
                      onPress={() => setAttendance({...attendance, [student._id]: 'present'})}
                    >
                      <Text style={[styles.attBtnText, attendance[student._id] === 'present' ? {color: '#fff'} : (isDarkMode ? {color: '#94a3b8'} : {color: '#64748b'})]}>P</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.attBtn, attendance[student._id] === 'absent' ? styles.btnAbsent : (isDarkMode ? styles.attBtnDark : styles.attBtnLight)]}
                      onPress={() => setAttendance({...attendance, [student._id]: 'absent'})}
                    >
                      <Text style={[styles.attBtnText, attendance[student._id] === 'absent' ? {color: '#fff'} : (isDarkMode ? {color: '#94a3b8'} : {color: '#64748b'})]}>A</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.attBtn, attendance[student._id] === 'leave' ? styles.btnLeave : (isDarkMode ? styles.attBtnDark : styles.attBtnLight)]}
                      onPress={() => setAttendance({...attendance, [student._id]: 'leave'})}
                    >
                      <Text style={[styles.attBtnText, attendance[student._id] === 'leave' ? {color: '#fff'} : (isDarkMode ? {color: '#94a3b8'} : {color: '#64748b'})]}>L</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
            
            <TouchableOpacity 
              style={[styles.saveBtn, students.length === 0 && { opacity: 0.5 }]} 
              onPress={handleSaveAttendance}
              disabled={saving || students.length === 0}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Save Attendance</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            {leaves.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-done-circle-outline" size={60} color={isDarkMode ? '#334155' : '#cbd5e1'} />
                <Text style={[styles.emptyText, isDarkMode && { color: '#94a3b8' }]}>No pending leave requests.</Text>
              </View>
            ) : (
              leaves.map(leave => (
                <View key={leave._id} style={[styles.leaveCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
                  <View style={styles.leaveHeader}>
                    <View>
                      <Text style={[styles.studentName, isDarkMode && { color: '#f8fafc' }]}>{leave.studentId?.name || 'Unknown'}</Text>
                      <Text style={[styles.studentRoll, isDarkMode && { color: '#94a3b8' }]}>{leave.studentId?.roll_no || leave.studentId?.rollNo || 'Unknown'}</Text>
                    </View>
                    <View style={[styles.statusBadge, 
                      leave.status === 'approved' ? { backgroundColor: '#dcfce7' } : 
                      leave.status === 'rejected' ? { backgroundColor: '#fee2e2' } : { backgroundColor: '#fef3c7' }
                    ]}>
                      <Text style={[styles.statusText, 
                        leave.status === 'approved' ? { color: '#16a34a' } : 
                        leave.status === 'rejected' ? { color: '#dc2626' } : { color: '#d97706' }
                      ]}>{leave.status.toUpperCase()}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.leaveDetails}>
                    <Text style={[styles.leaveReasonTitle, isDarkMode && { color: '#cbd5e1' }]}>Reason:</Text>
                    <Text style={[styles.leaveReasonText, isDarkMode && { color: '#94a3b8' }]}>{leave.reason}</Text>
                    
                    <Text style={[styles.leaveDates, isDarkMode && { color: '#cbd5e1' }]}>
                      {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                    </Text>
                  </View>

                  {leave.status === 'pending' && (
                    <View style={styles.leaveActions}>
                      <TouchableOpacity 
                        style={[styles.leaveActionBtn, { backgroundColor: '#ef4444', marginRight: 10 }]}
                        onPress={() => handleUpdateLeave(leave._id, 'rejected')}
                      >
                        <Text style={styles.leaveActionText}>Reject</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.leaveActionBtn, { backgroundColor: '#10b981' }]}
                        onPress={() => handleUpdateLeave(leave._id, 'approved')}
                      >
                        <Text style={styles.leaveActionText}>Approve</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    flexDirection: 'row', alignItems: 'center', 
    paddingTop: Platform.OS === 'android' ? 50 : 20, paddingBottom: 15, paddingHorizontal: 15, 
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' 
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#001b3a' },
  
  // Dropdown styles
  dropdownLabel: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6 },
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

  // Tabs
  tabContainer: { flexDirection: 'row', backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: '#001b3a' },
  tabText: { fontSize: 16, fontWeight: '600', color: '#64748b' },
  activeTabText: { color: '#001b3a' },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  subText: { fontSize: 14, color: '#64748b' },
  
  dateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10 },
  dateBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  dateText: { marginLeft: 6, fontSize: 13, color: '#001b3a', fontWeight: '600' },
  
  downloadReportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#001b3a', paddingVertical: 12, borderRadius: 12,
    marginBottom: 20
  },
  downloadReportBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },

  // Cards
  studentCard: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#ffffff', padding: 15, borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#e2e8f0'
  },
  studentInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontWeight: 'bold', color: '#64748b' },
  studentName: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  studentRoll: { fontSize: 13, color: '#64748b', marginTop: 2 },
  
  actionButtons: { flexDirection: 'row', gap: 8 },
  attBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  attBtnLight: { backgroundColor: '#f1f5f9' },
  attBtnDark: { backgroundColor: '#334155' },
  btnPresent: { backgroundColor: '#10b981' }, 
  btnAbsent: { backgroundColor: '#ef4444' }, 
  btnLeave: { backgroundColor: '#f59e0b' }, 
  attBtnText: { fontSize: 14, fontWeight: 'bold' },
  
  saveBtn: { backgroundColor: '#001b3a', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 20, marginBottom: 20 },
  saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  
  leaveCard: { backgroundColor: '#ffffff', padding: 16, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  leaveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  leaveDetails: { backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 15 },
  leaveReasonTitle: { fontSize: 13, fontWeight: 'bold', color: '#334155', marginBottom: 4 },
  leaveReasonText: { fontSize: 14, color: '#475569', marginBottom: 8 },
  leaveDates: { fontSize: 13, color: '#3b82f6', fontWeight: '500' },
  
  leaveActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  leaveActionBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  leaveActionText: { color: '#ffffff', fontWeight: 'bold', fontSize: 14 },
  
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 20, fontSize: 16 }
});
