import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  DeviceEventEmitter, ActivityIndicator, Modal, TextInput, Alert, 
  Platform, SafeAreaView, KeyboardAvoidingView, Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { API_URL as CENTRAL_API_URL } from '@/config/api';
const API_URL = `${CENTRAL_API_URL}/subjects`;

export default function TeacherSubjects() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Semester selector
  const [selectedSemester, setSelectedSemester] = useState('1');
  const [showDropdown, setShowDropdown] = useState(false);

  // Subject Modals
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [subjectTitle, setSubjectTitle] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectCR, setSubjectCR] = useState('');
  const [subjectSem, setSubjectSem] = useState('1');

  // Directory Browser States
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<Array<{ _id: string; name: string }>>([]);

  // Folder Modals
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');

  useFocusEffect(
    useCallback(() => {
      const loadThemeAndData = async () => {
        const theme = await AsyncStorage.getItem('appTheme');
        setIsDarkMode(theme === 'dark');
        const dataStr = await AsyncStorage.getItem('userData');
        if (dataStr) {
          const user = JSON.parse(dataStr);
          setUserData(user);
        }
      };
      loadThemeAndData();
      const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
      return () => sub.remove();
    }, [])
  );

  const fetchSubjects = async (department: string, semester: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/${encodeURIComponent(department)}/${encodeURIComponent(semester)}`);
      if (res.ok) {
        const data = await res.json();
        setSubjects(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userData?.department) {
      fetchSubjects(userData.department, selectedSemester);
    }
  }, [selectedSemester, userData]);

  const handleAddSubjectTrigger = () => {
    setEditingSubject(null);
    setSubjectTitle('');
    setSubjectCode('');
    setSubjectCR('');
    setSubjectSem(selectedSemester);
    setShowAddSubjectModal(true);
  };

  const handleEditSubjectTrigger = (subject: any) => {
    setEditingSubject(subject);
    setSubjectTitle(subject.title || '');
    setSubjectCode(subject.code || '');
    setSubjectCR(subject.cr || '');
    setSubjectSem(subject.semester || selectedSemester);
    setShowAddSubjectModal(true);
  };

  const handleSaveSubject = async () => {
    if (!userData?.department) return;
    if (!subjectTitle.trim() || !subjectCode.trim() || !subjectCR.trim() || !subjectSem) {
      return Alert.alert('Error', 'Please fill all fields');
    }

    setLoading(true);
    try {
      const payload = {
        department: userData.department,
        semester: subjectSem,
        title: subjectTitle.trim(),
        code: subjectCode.trim().toUpperCase(),
        cr: subjectCR.trim()
      };

      const url = editingSubject ? `${API_URL}/${editingSubject._id}` : `${API_URL}/add`;
      const method = editingSubject ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success', editingSubject ? 'Subject updated successfully' : 'Subject added successfully');
        setShowAddSubjectModal(false);
        fetchSubjects(userData.department, selectedSemester);
      } else {
        Alert.alert('Error', data.message || 'Operation failed');
      }
    } catch (err) {
      Alert.alert('Error', 'Network Error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubject = (id: string, name: string) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete "${name}" and all its subfolders?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
              if (res.ok) {
                Alert.alert('Success', 'Subject deleted successfully');
                if (userData?.department) fetchSubjects(userData.department, selectedSemester);
              } else {
                Alert.alert('Error', 'Failed to delete subject');
              }
            } catch (err) {
              Alert.alert('Error', 'Network Error');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // --- Folder operations ---
  const handleAddFolderTrigger = () => {
    setEditingFolderId(null);
    setFolderName('');
    setShowFolderModal(true);
  };

  const handleEditFolderTrigger = (folderId: string, currentName: string) => {
    setEditingFolderId(folderId);
    setFolderName(currentName);
    setShowFolderModal(true);
  };

  const handleSaveFolder = async () => {
    if (!expandedSubjectId || !folderName.trim()) {
      return Alert.alert('Error', 'Please enter a folder name');
    }

    setLoading(true);
    try {
      const url = editingFolderId 
        ? `${API_URL}/${expandedSubjectId}/folders/${editingFolderId}`
        : `${API_URL}/${expandedSubjectId}/folders/add`;
      const method = editingFolderId ? 'PUT' : 'POST';
      const payload = editingFolderId
        ? { name: folderName.trim() }
        : { name: folderName.trim(), parentId: currentFolderId };

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success', editingFolderId ? 'Folder renamed successfully' : 'Folder created successfully');
        setShowFolderModal(false);
        // Refresh subjects array state locally
        setSubjects(prev => prev.map(s => s._id === expandedSubjectId ? { ...s, folders: data.folders } : s));
      } else {
        Alert.alert('Error', data.message || 'Operation failed');
      }
    } catch (e) {
      Alert.alert('Error', 'Network connection issue');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFolder = (folderId: string, name: string) => {
    Alert.alert(
      'Delete Folder',
      `Are you sure you want to delete folder "${name}"? All subfolders and files inside it will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!expandedSubjectId) return;
            setLoading(true);
            try {
              const res = await fetch(`${API_URL}/${expandedSubjectId}/folders/${folderId}`, {
                method: 'DELETE'
              });
              const data = await res.json();
              if (res.ok) {
                Alert.alert('Deleted', 'Folder deleted successfully.');
                setSubjects(prev => prev.map(s => s._id === expandedSubjectId ? { ...s, folders: data.folders } : s));
                // If we deleted the folder we were currently in, navigate back to root
                if (currentFolderId === folderId) {
                  setCurrentFolderId(null);
                  setFolderPath([]);
                }
              } else {
                Alert.alert('Error', data.message || 'Failed to delete');
              }
            } catch (err) {
              Alert.alert('Error', 'Network Error');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // --- Document pick & upload ---
  const handleUploadDocument = async () => {
    if (!expandedSubjectId || !currentFolderId) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileAsset = result.assets[0];
      setUploading(true);

      // Fetch the file locally as a Blob to fix standard React Native FormData regressions
      const localFileResponse = await fetch(fileAsset.uri);
      const blob = await localFileResponse.blob();

      const formData = new FormData();
      formData.append('file', blob, fileAsset.name || 'document.pdf');

      const uploadUrl = `${API_URL}/${expandedSubjectId}/folders/${currentFolderId}/upload`;
      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success', 'PDF uploaded successfully.');
        setSubjects(prev => prev.map(s => s._id === expandedSubjectId ? { ...s, folders: data.folders } : s));
      } else {
        Alert.alert('Upload Failed', data.message || 'Error occurred during upload.');
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', 'Failed to pick or upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadFile = async (fileUrl: string, fileName: string) => {
    try {
      Alert.alert('Downloading', 'Downloading file, please wait...');
      // Convert static view URL to attachment download URL
      const downloadUrl = fileUrl.replace('/uploads/', '/api/auth/download?file=');
      await Linking.openURL(downloadUrl);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to download file.');
    }
  };

  const handleDeleteFile = (fileId: string, fileName: string) => {
    Alert.alert(
      'Delete File',
      `Are you sure you want to delete "${fileName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!expandedSubjectId || !currentFolderId) return;
            setLoading(true);
            try {
              const res = await fetch(`${API_URL}/${expandedSubjectId}/folders/${currentFolderId}/files/${fileId}`, {
                method: 'DELETE'
              });
              const data = await res.json();
              if (res.ok) {
                Alert.alert('Deleted', 'File deleted successfully.');
                setSubjects(prev => prev.map(s => s._id === expandedSubjectId ? { ...s, folders: data.folders } : s));
              } else {
                Alert.alert('Error', data.message || 'Failed to delete file.');
              }
            } catch (err) {
              Alert.alert('Error', 'Network Error');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Cannot open link'));
  };

  const getSubfoldersAndFiles = (subject: any) => {
    if (!subject) return { subfolders: [], files: [] };
    const folders = subject.folders || [];
    
    if (currentFolderId === null) {
      // Root level folders
      return {
        subfolders: folders.filter((f: any) => f.parentId === null || f.parentId === ''),
        files: []
      };
    } else {
      const activeFolder = folders.find((f: any) => f._id === currentFolderId);
      return {
        subfolders: folders.filter((f: any) => f.parentId === currentFolderId),
        files: activeFolder ? (activeFolder.files || []) : []
      };
    }
  };

  const navigateToFolder = (folder: any) => {
    setCurrentFolderId(folder._id);
    setFolderPath(prev => [...prev, { _id: folder._id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      setCurrentFolderId(null);
      setFolderPath([]);
    } else {
      const pathSegment = folderPath[index];
      setCurrentFolderId(pathSegment._id);
      setFolderPath(folderPath.slice(0, index + 1));
    }
  };

  const handleGoBackFolder = () => {
    if (folderPath.length <= 1) {
      setCurrentFolderId(null);
      setFolderPath([]);
    } else {
      const newPath = folderPath.slice(0, -1);
      setFolderPath(newPath);
      setCurrentFolderId(newPath[newPath.length - 1]._id);
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      {/* Header */}
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#ffffff' : '#001b3a'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>Subjects Directory</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAddSubjectTrigger}>
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
        {loading && subjects.length === 0 ? (
          <ActivityIndicator size="large" color="#001b3a" style={{ marginTop: 50 }} />
        ) : subjects.length === 0 ? (
          <Text style={styles.emptyText}>No subjects added for Semester {selectedSemester}.</Text>
        ) : (
          subjects.map((sub) => {
            const isExpanded = expandedSubjectId === sub._id;
            const { subfolders, files } = getSubfoldersAndFiles(sub);

            return (
              <View key={sub._id} style={[styles.subjectCard, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
                {/* Subject Header */}
                <View style={styles.subHeader}>
                  <TouchableOpacity 
                    style={{ flex: 1 }}
                    onPress={() => {
                      if (expandedSubjectId === sub._id) {
                        setExpandedSubjectId(null);
                        setCurrentFolderId(null);
                        setFolderPath([]);
                      } else {
                        setExpandedSubjectId(sub._id);
                        setCurrentFolderId(null);
                        setFolderPath([]);
                      }
                    }}
                  >
                    <Text style={[styles.subTitle, isDarkMode && { color: '#ffffff' }]}>{sub.title}</Text>
                    <Text style={styles.subText}>{sub.code} | {sub.cr} Credit Hours</Text>
                  </TouchableOpacity>

                  {/* Actions inline */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleEditSubjectTrigger(sub)}>
                      <Ionicons name="create-outline" size={18} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteSubject(sub._id, sub.title)}>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.badge, isDarkMode && { backgroundColor: '#334155' }, {marginLeft: 6}]}
                      onPress={() => {
                        if (expandedSubjectId === sub._id) {
                          setExpandedSubjectId(null);
                          setCurrentFolderId(null);
                          setFolderPath([]);
                        } else {
                          setExpandedSubjectId(sub._id);
                          setCurrentFolderId(null);
                          setFolderPath([]);
                        }
                      }}
                    >
                      <Ionicons 
                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                        size={18} 
                        color={isDarkMode ? '#38bdf8' : '#001b3a'} 
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Expanded Folders & Subfolders Browser */}
                {isExpanded && (
                  <View style={styles.expandedSection}>
                    <View style={styles.divider} />
                    
                    {/* Breadcrumbs Row */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breadcrumbScroll}>
                      <TouchableOpacity onPress={() => navigateToBreadcrumb(-1)} style={styles.breadcrumbItem}>
                        <Ionicons name="home-outline" size={16} color={currentFolderId === null ? '#001b3a' : '#64748b'} />
                      </TouchableOpacity>
                      {folderPath.map((segment, idx) => (
                        <React.Fragment key={segment._id}>
                          <Ionicons name="chevron-forward" size={12} color="#94a3b8" style={{ marginHorizontal: 6 }} />
                          <TouchableOpacity onPress={() => navigateToBreadcrumb(idx)} style={styles.breadcrumbItem}>
                            <Text style={[styles.breadcrumbText, currentFolderId === segment._id && styles.breadcrumbActive]}>
                              {segment.name}
                            </Text>
                          </TouchableOpacity>
                        </React.Fragment>
                      ))}
                    </ScrollView>

                    {/* Subfolders title and Add Folder button */}
                    <View style={styles.sectionHeaderRow}>
                      <Text style={[styles.sectionHeading, isDarkMode && { color: '#cbd5e1' }]}>Folders</Text>
                      <TouchableOpacity style={styles.addFolderBtn} onPress={handleAddFolderTrigger}>
                        <Ionicons name="folder-open" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                        <Text style={styles.addFolderBtnText}>New Folder</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Folders List */}
                    {subfolders.length === 0 ? (
                      <Text style={styles.noSubfoldersText}>No subfolders inside this folder.</Text>
                    ) : (
                      <View style={styles.foldersGrid}>
                        {subfolders.map((folder: any) => (
                          <TouchableOpacity 
                            key={folder._id} 
                            style={[styles.folderCard, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]}
                            onPress={() => navigateToFolder(folder)}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                              <Ionicons name="folder" size={24} color={isDarkMode ? '#38bdf8' : '#001b3a'} style={{ marginRight: 8 }} />
                              <Text style={[styles.folderNameText, isDarkMode && { color: '#ffffff' }]} numberOfLines={1}>
                                {folder.name}
                              </Text>
                            </View>
                            {/* Folder actions */}
                            <View style={{ flexDirection: 'row', gap: 2 }}>
                              <TouchableOpacity style={{ padding: 4 }} onPress={() => handleEditFolderTrigger(folder._id, folder.name)}>
                                <Ionicons name="create-outline" size={14} color="#64748b" />
                              </TouchableOpacity>
                              <TouchableOpacity style={{ padding: 4 }} onPress={() => handleDeleteFolder(folder._id, folder.name)}>
                                <Ionicons name="trash-outline" size={14} color="#ef4444" />
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Files Section (Only visible inside subfolders, not root) */}
                    {currentFolderId !== null && (
                      <>
                        <View style={[styles.sectionHeaderRow, { marginTop: 25 }]}>
                          <Text style={[styles.sectionHeading, isDarkMode && { color: '#cbd5e1' }]}>Files</Text>
                          <TouchableOpacity 
                            style={[styles.uploadFileBtn, uploading && { opacity: 0.7 }]} 
                            onPress={handleUploadDocument}
                            disabled={uploading}
                          >
                            {uploading ? (
                              <ActivityIndicator size="small" color="#ffffff" />
                            ) : (
                              <>
                                <Ionicons name="cloud-upload" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                                <Text style={styles.uploadFileBtnText}>Upload PDF</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>

                        {files.length === 0 ? (
                          <Text style={styles.noFilesText}>No files uploaded here yet.</Text>
                        ) : (
                          <View style={styles.filesList}>
                            {files.map((file: any) => (
                              <View 
                                key={file._id} 
                                style={[styles.fileItem, isDarkMode && { backgroundColor: '#334155', borderColor: '#475569' }]}
                              >
                                <TouchableOpacity 
                                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                                  onPress={() => openUrl(file.fileUrl)}
                                >
                                  <Ionicons name="document-text" size={20} color="#ef4444" style={{ marginRight: 10 }} />
                                  <Text style={[styles.fileName, isDarkMode && { color: '#f8fafc' }]} numberOfLines={1}>
                                    {file.fileName}
                                  </Text>
                                </TouchableOpacity>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                  <TouchableOpacity style={{ padding: 6 }} onPress={() => openUrl(file.fileUrl)}>
                                    <Ionicons name="eye-outline" size={18} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
                                  </TouchableOpacity>
                                  <TouchableOpacity style={{ padding: 6 }} onPress={() => handleDownloadFile(file.fileUrl, file.fileName)}>
                                    <Ionicons name="download-outline" size={18} color="#3b82f6" />
                                  </TouchableOpacity>
                                  <TouchableOpacity style={{ padding: 6 }} onPress={() => handleDeleteFile(file._id, file.fileName)}>
                                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add / Edit Subject Modal */}
      <Modal
        visible={showAddSubjectModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowAddSubjectModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            <View style={[styles.modalHeader, isDarkMode && { borderBottomColor: '#334155' }]}>
              <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>
                {editingSubject ? 'Edit Subject' : 'Add Subject'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddSubjectModal(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#ffffff' : '#001b3a'} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm}>
              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>Subject Title</Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && { color: '#ffffff', borderColor: '#334155', backgroundColor: '#0f172a' }]}
                value={subjectTitle}
                onChangeText={setSubjectTitle}
                placeholder="e.g. Data Structures"
                placeholderTextColor="#94a3b8"
              />

              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>Course Code</Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && { color: '#ffffff', borderColor: '#334155', backgroundColor: '#0f172a' }]}
                value={subjectCode}
                onChangeText={setSubjectCode}
                placeholder="e.g. CSC-201"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
              />

              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>Credit Hours</Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && { color: '#ffffff', borderColor: '#334155', backgroundColor: '#0f172a' }]}
                value={subjectCR}
                onChangeText={setSubjectCR}
                placeholder="e.g. 3"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
              />

              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>Semester</Text>
              <View style={styles.semesterGrid}>
                {['1', '2', '3', '4', '5', '6', '7', '8'].map((sem) => (
                  <TouchableOpacity
                    key={sem}
                    style={[
                      styles.semChip,
                      subjectSem === sem ? styles.semChipActive : (isDarkMode ? { backgroundColor: '#0f172a', borderColor: '#334155' } : {}),
                    ]}
                    onPress={() => setSubjectSem(sem)}
                  >
                    <Text style={[
                      styles.semChipText,
                      subjectSem === sem ? styles.semChipTextActive : (isDarkMode ? { color: '#cbd5e1' } : {}),
                    ]}>
                      Sem {sem}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                onPress={handleSaveSubject}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingSubject ? 'Update Subject' : 'Add Subject'}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add / Edit Folder Modal */}
      <Modal
        visible={showFolderModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowFolderModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            <View style={[styles.modalHeader, isDarkMode && { borderBottomColor: '#334155' }]}>
              <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>
                {editingFolderId ? 'Rename Folder' : 'New Folder'}
              </Text>
              <TouchableOpacity onPress={() => setShowFolderModal(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#ffffff' : '#001b3a'} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <Text style={[styles.inputLabel, isDarkMode && { color: '#cbd5e1' }]}>Folder Name</Text>
              <TextInput
                style={[styles.modalInput, isDarkMode && { color: '#ffffff', borderColor: '#334155', backgroundColor: '#0f172a' }]}
                value={folderName}
                onChangeText={setFolderName}
                placeholder="e.g. Lectures Unit 1"
                placeholderTextColor="#94a3b8"
                autoFocus={true}
              />

              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                onPress={handleSaveFolder}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {editingFolderId ? 'Rename Folder' : 'Create Folder'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
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
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' 
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 5 },
  addBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#001b3a' },
  emptyText: { textAlign: 'center', marginTop: 50, color: '#64748b', paddingHorizontal: 20 },
  subjectCard: { backgroundColor: '#ffffff', padding: 15, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subTitle: { fontSize: 17, fontWeight: 'bold', color: '#0f172a', marginBottom: 4 },
  badge: { backgroundColor: '#eff6ff', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  subText: { fontSize: 13, color: '#64748b' },
  actionBtn: { padding: 4 },

  expandedSection: { marginTop: 15 },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginBottom: 15 },
  
  // Breadcrumb Path Styles
  breadcrumbScroll: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, marginBottom: 10 },
  breadcrumbItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  breadcrumbText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  breadcrumbActive: { color: '#001b3a', fontWeight: 'bold' },
  goBackDirBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, paddingVertical: 4 },
  goBackDirText: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  // Folder management UI styles
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionHeading: { fontSize: 14, fontWeight: '700', color: '#475569' },
  addFolderBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#001b3a', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addFolderBtnText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  noSubfoldersText: { fontSize: 13, color: '#94a3b8', marginVertical: 10, paddingLeft: 4 },

  foldersGrid: { gap: 8 },
  folderCard: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    paddingVertical: 12, paddingHorizontal: 15, borderRadius: 12 
  },
  folderNameText: { fontSize: 14, fontWeight: '600', color: '#0f172a' },

  // Files management UI styles
  uploadFileBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10b981', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  uploadFileBtnText: { color: '#ffffff', fontSize: 11, fontWeight: 'bold' },
  noFilesText: { fontSize: 13, color: '#94a3b8', marginVertical: 10, paddingLeft: 4 },
  filesList: { gap: 8 },
  fileItem: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', 
    padding: 12, borderRadius: 12 
  },
  fileName: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '500' },

  // Dropdown Filter styling
  dropdownButton: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12, paddingHorizontal: 16, height: 45
  },
  dropdownButtonText: { fontSize: 14, color: '#0f172a', fontWeight: '500' },
  dropdownList: {
    position: 'absolute', top: 60, left: 20, right: 20,
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 5,
    zIndex: 999, paddingVertical: 6
  },
  dropdownItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16
  },
  dropdownItemText: { fontSize: 14, color: '#475569' },

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
    backgroundColor: '#001b3a', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 25
  },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
});
