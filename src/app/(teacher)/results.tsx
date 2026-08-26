import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  DeviceEventEmitter, ActivityIndicator, Alert, SafeAreaView, Platform, 
  TextInput, Modal 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { API_URL } from '@/config/api';

export default function TeacherResults() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  const [students, setStudents] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  
  // Semester Dropdown state
  const [selectedSemester, setSelectedSemester] = useState('1');
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Bulk inputs state
  const [gpas, setGpas] = useState<Record<string, string>>({});
  const [cgpas, setCgpas] = useState<Record<string, string>>({});
  
  // Modals state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [editGpa, setEditGpa] = useState('');
  const [editCgpa, setEditCgpa] = useState('');

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addStudentId, setAddStudentId] = useState('');
  const [addGpa, setAddGpa] = useState('');
  const [addCgpa, setAddCgpa] = useState('');
  const [showStudentSelectDropdown, setShowStudentSelectDropdown] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const loadThemeAndData = async () => {
      const theme = await AsyncStorage.getItem('appTheme');
      setIsDarkMode(theme === 'dark');
      const dataStr = await AsyncStorage.getItem('userData');
      if (dataStr) {
        const user = JSON.parse(dataStr);
        setUserData(user);
        if (user.department) {
          fetchResults(user.department, selectedSemester);
          fetchRoster(user.department, selectedSemester);
        }
      }
    };
    loadThemeAndData();
  }, [selectedSemester]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
    return () => sub.remove();
  }, []);

  const fetchResults = async (department: string, semester: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/results/class/${encodeURIComponent(department)}/${encodeURIComponent(semester)}`);
      if (res.ok) {
        setResults(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoster = async (department: string, semester: string) => {
    setLoadingStudents(true);
    try {
      const res = await fetch(`${API_URL}/results/students/${encodeURIComponent(department)}/${encodeURIComponent(semester)}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
        
        // Populate inputs state
        const initialGpas: Record<string, string> = {};
        const initialCgpas: Record<string, string> = {};
        data.forEach((s: any) => {
          initialGpas[s._id] = s.gpa || '';
          initialCgpas[s._id] = s.cgpa || '';
        });
        setGpas(initialGpas);
        setCgpas(initialCgpas);
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to fetch student roster');
    } finally {
      setLoadingStudents(false);
    }
  };

  const handlePublishResults = async () => {
    if (students.length === 0) return Alert.alert('Error', 'No students found to publish results.');
    
    setSaving(true);
    try {
      const records = students.map(s => ({
        studentId: s._id,
        gpa: parseFloat(gpas[s._id]) || 0,
        cgpa: parseFloat(cgpas[s._id]) || 0
      }));
      
      const res = await fetch(`${API_URL}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: userData.department,
          semester: selectedSemester,
          records
        })
      });

      if (res.ok) {
        Alert.alert('Success', 'Results published successfully');
        fetchResults(userData.department, selectedSemester);
        fetchRoster(userData.department, selectedSemester);
      } else {
        const data = await res.json();
        Alert.alert('Error', data.message || 'Failed to publish results');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setSaving(false);
    }
  };

  // Delete individual result record
  const handleDeleteResult = async (studentId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this student\'s result?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/results/record/${encodeURIComponent(userData.department)}/${encodeURIComponent(selectedSemester)}/${studentId}`, {
                method: 'DELETE'
              });
              if (res.ok) {
                Alert.alert('Success', 'Result deleted successfully');
                fetchResults(userData.department, selectedSemester);
                fetchRoster(userData.department, selectedSemester);
              } else {
                const data = await res.json();
                Alert.alert('Error', data.message || 'Failed to delete result');
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

  // Open edit modal
  const handleEditPress = (resItem: any) => {
    setSelectedStudent(resItem);
    setEditGpa(resItem.gpa !== undefined ? resItem.gpa.toString() : '');
    setEditCgpa(resItem.cgpa !== undefined ? resItem.cgpa.toString() : '');
    setEditModalVisible(true);
  };

  // Save edit modal changes
  const handleSaveEditResult = async () => {
    if (!selectedStudent) return;
    if (!editGpa || !editCgpa) {
      Alert.alert('Error', 'Please enter both GPA and CGPA');
      return;
    }

    const gpaVal = parseFloat(editGpa);
    const cgpaVal = parseFloat(editCgpa);

    if (isNaN(gpaVal) || gpaVal < 0 || gpaVal > 4) {
      Alert.alert('Error', 'GPA must be a number between 0.0 and 4.0');
      return;
    }
    if (isNaN(cgpaVal) || cgpaVal < 0 || cgpaVal > 4) {
      Alert.alert('Error', 'CGPA must be a number between 0.0 and 4.0');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/results/record`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: userData.department,
          semester: selectedSemester,
          studentId: selectedStudent.studentId,
          gpa: gpaVal,
          cgpa: cgpaVal
         })
      });

      if (res.ok) {
        Alert.alert('Success', 'Result updated successfully');
        setEditModalVisible(false);
        setSelectedStudent(null);
        fetchResults(userData.department, selectedSemester);
        fetchRoster(userData.department, selectedSemester);
      } else {
        const data = await res.json();
        Alert.alert('Error', data.message || 'Failed to update result');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setSaving(false);
    }
  };

  // Save add modal result
  const handleSaveAddResult = async () => {
    if (!addStudentId) {
      Alert.alert('Error', 'Please select a student');
      return;
    }
    if (!addGpa || !addCgpa) {
      Alert.alert('Error', 'Please enter both GPA and CGPA');
      return;
    }

    const gpaVal = parseFloat(addGpa);
    const cgpaVal = parseFloat(addCgpa);

    if (isNaN(gpaVal) || gpaVal < 0 || gpaVal > 4) {
      Alert.alert('Error', 'GPA must be a number between 0.0 and 4.0');
      return;
    }
    if (isNaN(cgpaVal) || cgpaVal < 0 || cgpaVal > 4) {
      Alert.alert('Error', 'CGPA must be a number between 0.0 and 4.0');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/results/record`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department: userData.department,
          semester: selectedSemester,
          studentId: addStudentId,
          gpa: gpaVal,
          cgpa: cgpaVal
        })
      });

      if (res.ok) {
        Alert.alert('Success', 'Result added successfully');
        setAddModalVisible(false);
        setAddStudentId('');
        setAddGpa('');
        setAddCgpa('');
        fetchResults(userData.department, selectedSemester);
        fetchRoster(userData.department, selectedSemester);
      } else {
        const data = await res.json();
        Alert.alert('Error', data.message || 'Failed to add result');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Network error occurred');
    } finally {
      setSaving(false);
    }
  };

  // Download combined PDF report of all semesters
  const handleDownloadAllSemestersReport = async () => {
    if (!userData?.department) return;
    setExporting(true);
    try {
      const res = await fetch(`${API_URL}/results/department/${encodeURIComponent(userData.department)}`);
      if (!res.ok) {
        throw new Error('Failed to retrieve department results history.');
      }
      const allResults = await res.json();

      if (!allResults || allResults.length === 0) {
        Alert.alert('Info', 'No results published yet for this department.');
        setExporting(false);
        return;
      }

      // Sort results by semester numerically
      allResults.sort((a: any, b: any) => {
        return parseInt(a.semester) - parseInt(b.semester);
      });

      let semestersHtml = '';
      allResults.forEach((semDoc: any) => {
        const recordsHtml = semDoc.records.map((rec: any) => {
          const student = rec.studentId || {};
          const roll = student.roll_no || student.rollNo || 'N/A';
          const name = student.name || 'Unknown';
          return `
            <tr>
              <td>${roll}</td>
              <td>${name}</td>
              <td>${rec.gpa !== undefined ? rec.gpa.toFixed(2) : 'N/A'}</td>
              <td>${rec.cgpa !== undefined ? rec.cgpa.toFixed(2) : 'N/A'}</td>
            </tr>
          `;
        }).join('');

        semestersHtml += `
          <div class="semester-section">
            <div class="semester-title">Semester ${semDoc.semester}</div>
            <table>
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>GPA</th>
                  <th>CGPA</th>
                </tr>
              </thead>
              <tbody>
                ${recordsHtml || '<tr><td colspan="4" style="text-align:center;">No student results found for this semester.</td></tr>'}
              </tbody>
            </table>
          </div>
        `;
      });

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
              .semester-section { margin-bottom: 30px; page-break-inside: avoid; }
              .semester-title { font-size: 18px; font-weight: bold; color: #001b3a; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 13px; }
              th { background-color: #001b3a; color: #ffffff; font-weight: bold; }
              tr:nth-child(even) { background-color: #f8fafc; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">Department Results Report</div>
              <div class="subtitle">Official Academic Record</div>
            </div>
            <div class="meta-box">
              <p><strong>Department:</strong> ${userData.department}</p>
              <p><strong>Report Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            ${semestersHtml}
          </body>
        </html>
      `;

      try {
        await Print.printAsync({ html });
      } catch (printErr) {
        console.warn('Native printing failed, falling back to sharing:', printErr);
        const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });
        if (await Sharing.isAvailableAsync()) {
          try {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: `${userData.department}_All_Semesters_Results_Report`,
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
      Alert.alert('Export Failed', err.message || 'Failed to download results report.');
    } finally {
      setExporting(false);
    }
  };

  const unpublishedStudents = students.filter(s => 
    !results.some(r => r.studentId === s._id)
  );

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#1e293b' }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#f8fafc' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>Results Hub</Text>
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

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 150 }} keyboardShouldPersistTaps="handled">
        {/* PDF Download All Semesters */}
        <TouchableOpacity 
          style={[styles.downloadReportBtn, exporting && { opacity: 0.7 }]} 
          onPress={handleDownloadAllSemestersReport}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="cloud-download-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.downloadReportBtnText}>Download All Semesters Report (PDF)</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={[styles.uploadCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
          <Text style={[styles.cardTitle, isDarkMode && { color: '#f8fafc' }]}>Enter Student Results (Bulk)</Text>
          
          <Text style={[styles.label, isDarkMode && { color: '#94a3b8' }]}>Department</Text>
          <View style={[styles.readonlyInput, isDarkMode && { backgroundColor: '#334155' }]}>
            <Text style={[styles.readonlyText, isDarkMode && { color: '#f8fafc' }]}>{userData?.department}</Text>
          </View>

          {loadingStudents ? (
            <ActivityIndicator size="small" color="#3b82f6" style={{ marginVertical: 20 }} />
          ) : students.length === 0 ? (
            <Text style={[styles.emptyText, { marginVertical: 20 }]}>No students found in this class.</Text>
          ) : (
            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.label, { marginBottom: 15 }, isDarkMode && { color: '#e2e8f0' }]}>Class Roster ({students.length} Students)</Text>
              
              {students.map((student) => (
                <View key={student._id} style={[styles.studentRow, isDarkMode && { borderColor: '#334155' }]}>
                  <View style={{ flex: 1.5, justifyContent: 'center' }}>
                    <Text style={[styles.studentName, isDarkMode && { color: '#ffffff' }]} numberOfLines={1}>{student.name}</Text>
                    <Text style={styles.studentRoll}>{student.rollNo || student.roll_no}</Text>
                  </View>
                  
                  <View style={{ flex: 1, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabelSmall, isDarkMode && { color: '#94a3b8' }]}>GPA</Text>
                      <TextInput 
                        style={[styles.smallInput, isDarkMode && { backgroundColor: '#334155', color: '#f8fafc', borderColor: '#475569' }]} 
                        placeholder="GPA"
                        placeholderTextColor={isDarkMode ? '#94a3b8' : '#cbd5e1'}
                        value={gpas[student._id] || ''} 
                        onChangeText={(val) => setGpas(prev => ({ ...prev, [student._id]: val }))}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.inputLabelSmall, isDarkMode && { color: '#94a3b8' }]}>CGPA</Text>
                      <TextInput 
                        style={[styles.smallInput, isDarkMode && { backgroundColor: '#334155', color: '#f8fafc', borderColor: '#475569' }]} 
                        placeholder="CGPA"
                        placeholderTextColor={isDarkMode ? '#94a3b8' : '#cbd5e1'}
                        value={cgpas[student._id] || ''} 
                        onChangeText={(val) => setCgpas(prev => ({ ...prev, [student._id]: val }))}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              ))}
              
              <TouchableOpacity 
                style={[styles.saveBtn, { marginTop: 25 }]} 
                onPress={handlePublishResults}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>Publish Results</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Section Header with Add Result Button */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }, isDarkMode && { color: '#e2e8f0' }]}>Published Results</Text>
          <TouchableOpacity 
            style={styles.addResultBtn} 
            onPress={() => setAddModalVisible(true)}
          >
            <Ionicons name="add-circle-outline" size={18} color="#ffffff" style={{ marginRight: 4 }} />
            <Text style={styles.addResultBtnText}>Add Result</Text>
          </TouchableOpacity>
        </View>

        {loading && results.length === 0 ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 20 }} />
        ) : results.length === 0 ? (
          <Text style={[styles.emptyText, isDarkMode && { color: '#64748b' }]}>No results published yet.</Text>
        ) : (
          results.map(res => (
            <View key={res._id} style={[styles.resultItem, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
              <View style={[styles.resultIconBox, { backgroundColor: isDarkMode ? '#334155' : 'rgba(0, 27, 58, 0.1)' }]}>
                <Ionicons name="trophy-outline" size={24} color={isDarkMode ? '#ffffff' : '#001b3a'} />
              </View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={[styles.resultTerm, isDarkMode && { color: '#f8fafc' }]}>{res.name || res.rollNo}</Text>
                <Text style={[styles.resultDate, isDarkMode && { color: '#94a3b8' }]}>
                  CGPA: {res.cgpa !== undefined ? res.cgpa : 'N/A'} • GPA: {res.gpa !== undefined ? res.gpa : 'N/A'}
                </Text>
              </View>
              
              {/* Edit and Delete Actions */}
              <View style={styles.actionIconsRow}>
                <TouchableOpacity onPress={() => handleEditPress(res)} style={styles.actionIconBtn}>
                  <Ionicons name="create-outline" size={16} color={isDarkMode ? '#60a5fa' : '#001b3a'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteResult(res.studentId)} style={styles.actionIconBtn}>
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Edit Result Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>Edit Result</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#cbd5e1' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, isDarkMode && { color: '#cbd5e1' }]}>Student</Text>
            <Text style={[styles.modalStudentName, isDarkMode && { color: '#ffffff' }]}>
              {selectedStudent?.name} ({selectedStudent?.rollNo})
            </Text>

            <View style={{ marginVertical: 10 }}>
              <Text style={[styles.modalLabel, isDarkMode && { color: '#cbd5e1' }]}>GPA</Text>
              <TextInput 
                style={[styles.modalInput, isDarkMode && { backgroundColor: '#334155', color: '#ffffff', borderColor: '#475569' }]}
                value={editGpa}
                onChangeText={setEditGpa}
                keyboardType="numeric"
                placeholder="e.g. 3.75"
                placeholderTextColor={isDarkMode ? '#94a3b8' : '#cbd5e1'}
              />

              <Text style={[styles.modalLabel, { marginTop: 15 }, isDarkMode && { color: '#cbd5e1' }]}>CGPA</Text>
              <TextInput 
                style={[styles.modalInput, isDarkMode && { backgroundColor: '#334155', color: '#ffffff', borderColor: '#475569' }]}
                value={editCgpa}
                onChangeText={setEditCgpa}
                keyboardType="numeric"
                placeholder="e.g. 3.65"
                placeholderTextColor={isDarkMode ? '#94a3b8' : '#cbd5e1'}
              />
            </View>

            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveEditResult} disabled={saving}>
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.modalSaveBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Result Modal */}
      <Modal
        visible={addModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>Add Student Result</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#cbd5e1' : '#64748b'} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalLabel, isDarkMode && { color: '#cbd5e1' }]}>Select Student</Text>
            <TouchableOpacity 
              style={[styles.modalDropdownBtn, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]}
              onPress={() => setShowStudentSelectDropdown(!showStudentSelectDropdown)}
            >
              <Text style={[styles.modalDropdownBtnText, isDarkMode && { color: '#ffffff' }]}>
                {addStudentId ? (students.find(s => s._id === addStudentId)?.name || 'Select Student') : 'Select Student'}
              </Text>
              <Ionicons name={showStudentSelectDropdown ? "chevron-up" : "chevron-down"} size={20} color={isDarkMode ? '#ffffff' : '#001b3a'} />
            </TouchableOpacity>

            {showStudentSelectDropdown && (
              <View style={[styles.modalDropdownList, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]}>
                <ScrollView style={{ maxHeight: 150 }} keyboardShouldPersistTaps="handled">
                  {unpublishedStudents.map((s) => (
                    <TouchableOpacity
                      key={s._id}
                      style={styles.modalDropdownItem}
                      onPress={() => {
                        setAddStudentId(s._id);
                        setShowStudentSelectDropdown(false);
                      }}
                    >
                      <Text style={[styles.modalDropdownItemText, isDarkMode && { color: '#ffffff' }]}>
                        {s.name} ({s.rollNo || s.roll_no})
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {unpublishedStudents.length === 0 && (
                    <Text style={{ textAlign: 'center', padding: 10, color: '#64748b' }}>All students have results.</Text>
                  )}
                </ScrollView>
              </View>
            )}

            <View style={{ marginVertical: 10 }}>
              <Text style={[styles.modalLabel, isDarkMode && { color: '#cbd5e1' }]}>GPA</Text>
              <TextInput 
                style={[styles.modalInput, isDarkMode && { backgroundColor: '#334155', color: '#ffffff', borderColor: '#475569' }]}
                value={addGpa}
                onChangeText={setAddGpa}
                keyboardType="numeric"
                placeholder="e.g. 3.75"
                placeholderTextColor={isDarkMode ? '#94a3b8' : '#cbd5e1'}
              />

              <Text style={[styles.modalLabel, { marginTop: 15 }, isDarkMode && { color: '#cbd5e1' }]}>CGPA</Text>
              <TextInput 
                style={[styles.modalInput, isDarkMode && { backgroundColor: '#334155', color: '#ffffff', borderColor: '#475569' }]}
                value={addCgpa}
                onChangeText={setAddCgpa}
                keyboardType="numeric"
                placeholder="e.g. 3.65"
                placeholderTextColor={isDarkMode ? '#94a3b8' : '#cbd5e1'}
              />
            </View>

            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveAddResult} disabled={saving}>
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.modalSaveBtnText}>Add Result</Text>}
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
    flexDirection: 'row', alignItems: 'center', 
    paddingTop: Platform.OS === 'android' ? 50 : 20, paddingBottom: 20, paddingHorizontal: 24, 
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' 
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#001b3a' },
  
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

  downloadReportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#001b3a', paddingVertical: 12, borderRadius: 12,
    marginBottom: 20
  },
  downloadReportBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },

  uploadCard: { backgroundColor: '#ffffff', padding: 20, borderRadius: 16, marginBottom: 30, borderWidth: 1, borderColor: '#e2e8f0' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#64748b', marginBottom: 8 },
  
  readonlyInput: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, marginBottom: 15 },
  readonlyText: { fontSize: 16, color: '#334155', fontWeight: '500' },
  
  saveBtn: { backgroundColor: '#001b3a', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 10 },
  
  resultItem: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffffff', 
    padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0' 
  },
  resultIconBox: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  resultTerm: { fontSize: 16, fontWeight: 'bold', color: '#0f172a', flex: 1 },
  resultDate: { fontSize: 13, color: '#64748b', marginTop: 4 },

  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10
  },
  studentName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  studentRoll: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  inputLabelSmall: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
    textAlign: 'center'
  },
  smallInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
    color: '#0f172a'
  },

  addResultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#001b3a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },
  addResultBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },

  actionIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 10
  },
  actionIconBtn: {
    padding: 6
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '100%',
    maxWidth: 400,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    marginBottom: 15
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a'
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6
  },
  modalStudentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 15
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#f8fafc'
  },
  modalSaveBtn: {
    backgroundColor: '#001b3a',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20
  },
  modalSaveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold'
  },

  // Modal selector dropdown styles
  modalDropdownBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 10
  },
  modalDropdownBtnText: {
    fontSize: 15,
    color: '#0f172a'
  },
  modalDropdownList: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingVertical: 4,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3
  },
  modalDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  modalDropdownItemText: {
    fontSize: 14,
    color: '#334155'
  }
});

