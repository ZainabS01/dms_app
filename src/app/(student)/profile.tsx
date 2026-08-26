import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Switch, Alert, Platform, Modal, DeviceEventEmitter, TextInput, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen() {
  const [userData, setUserData] = useState<any>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  
  // Settings States
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isAppLockEnabled, setIsAppLockEnabled] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  
  // Inline Editing State
  const [singleEditField, setSingleEditField] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', roll_no: '', department: '', semester: '' });

  useEffect(() => {
    const loadPreferences = async () => {
      const data = await AsyncStorage.getItem('userData');
      if (data) {
        const parsed = JSON.parse(data);
        setUserData(parsed);
        
        // Load persistent profile image for this specific user
        const savedImage = await AsyncStorage.getItem(`profileImage_${parsed.role}_${parsed.id || parsed._id || parsed.email}`);
        if (savedImage) {
          setProfileImage(savedImage);
        } else if (parsed.profileImage) {
          setProfileImage(parsed.profileImage);
        }
      }
      
      const theme = await AsyncStorage.getItem('appTheme');
      if (theme === 'dark') setIsDarkMode(true);
      
      const lock = await AsyncStorage.getItem('appLock');
      if (lock === 'enabled') setIsAppLockEnabled(true);

      const compatible = await LocalAuthentication.hasHardwareAsync();
      setIsBiometricSupported(compatible);
    };
    loadPreferences();
  }, []);

  // --- Image Picker & Cropper ---
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Perfect square for circular cropping
      quality: 0.5,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setProfileImage(uri);
      
      if (userData) {
        const userKey = `profileImage_${userData.role}_${userData.id || userData._id || userData.email}`;
        await AsyncStorage.setItem(userKey, uri);
        
        const updatedData = { ...userData, profileImage: uri };
        setUserData(updatedData);
        await AsyncStorage.setItem('userData', JSON.stringify(updatedData));
      }
    }
  };

  const deleteImage = async () => {
    setProfileImage(null);
    if (userData) {
      const userKey = `profileImage_${userData.role}_${userData.id || userData._id || userData.email}`;
      await AsyncStorage.removeItem(userKey);
      
      const updatedData = { ...userData, profileImage: null };
      setUserData(updatedData);
      await AsyncStorage.setItem('userData', JSON.stringify(updatedData));
    }
  };

  const handleImagePress = () => {
    if (profileImage) {
      Alert.alert(
        'Profile Picture',
        'Choose an option:',
        [
          { text: 'Change Photo', onPress: pickImage },
          { text: 'Delete Photo', onPress: deleteImage, style: 'destructive' },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } else {
      pickImage();
    }
  };

  const toggleAppLock = async (value: boolean) => {
    if (!isBiometricSupported) {
      Alert.alert('Unsupported', 'Your device does not support Biometrics/FaceID/PIN lock.');
      return;
    }

    if (value) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to enable App Lock',
        fallbackLabel: 'Use PIN',
      });
      if (result.success) {
        setIsAppLockEnabled(true);
        await AsyncStorage.setItem('appLock', 'enabled');
        Alert.alert('Secured', 'App Lock has been enabled successfully.');
      } else {
        setIsAppLockEnabled(false);
      }
    } else {
      setIsAppLockEnabled(false);
      await AsyncStorage.setItem('appLock', 'disabled');
    }
  };

  const saveProfileField = async (field: string, value: string) => {
    const updatedData = { ...userData, [field]: value };
    setUserData(updatedData);
    await AsyncStorage.setItem('userData', JSON.stringify(updatedData));
    setSingleEditField(null); // Close inline edit
    // In a real app, you would make an API call here to update the backend.
  };

  const handleLogout = async () => {
    setLogoutModalVisible(true);
  };

  const renderEditableRow = (field: string, label: string, iconName: any, iconColor: string, iconBg: string, isLast = false) => {
    const isEditing = singleEditField === field;
    return (
      <TouchableOpacity 
        style={[styles.modernRow, isDarkMode && { backgroundColor: '#0f172a' }, isLast && { marginBottom: 0 }]} 
        onPress={() => {
          if (!isEditing) {
            setSingleEditField(field);
            setEditForm({ ...editForm, [field]: userData?.[field] || '' });
          }
        }}
        activeOpacity={0.7}
      >
        <View style={[styles.modernIcon, { backgroundColor: iconBg }, isDarkMode && { backgroundColor: '#1e293b' }]}>
          <Ionicons name={iconName} size={20} color={isDarkMode ? '#38bdf8' : iconColor} />
        </View>
        <View style={styles.modernTextContainer}>
          <Text style={[styles.modernLabel, isDarkMode && { color: '#94a3b8' }]}>{label}</Text>
          {isEditing ? (
            <TextInput 
              style={[styles.inlineInput, isDarkMode && { color: '#ffffff' }]} 
              value={(editForm as any)[field]} 
              onChangeText={(t) => setEditForm({...editForm, [field]: t})} 
              autoFocus 
              onBlur={() => setSingleEditField(null)} // optional: cancel on blur
              onSubmitEditing={() => saveProfileField(field, (editForm as any)[field])}
            />
          ) : (
            <Text style={[styles.modernValue, isDarkMode && { color: '#f8fafc' }]}>{userData?.[field] || 'Not Set'}</Text>
          )}
        </View>
        {isEditing ? (
          <TouchableOpacity onPress={() => saveProfileField(field, (editForm as any)[field])} hitSlop={{top:10, bottom:10, left:10, right:10}}>
            <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
          </TouchableOpacity>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={isDarkMode ? '#475569' : '#cbd5e1'} />
        )}
      </TouchableOpacity>
    );
  };

  const renderReadOnlyRow = (label: string, value: string, iconName: any, iconColor: string, iconBg: string, isLast = false) => {
    return (
      <View style={[styles.modernRow, isDarkMode && { backgroundColor: '#0f172a' }, isLast && { marginBottom: 0 }]}>
        <View style={[styles.modernIcon, { backgroundColor: iconBg }, isDarkMode && { backgroundColor: '#1e293b' }]}>
          <Ionicons name={iconName} size={20} color={isDarkMode ? '#38bdf8' : iconColor} />
        </View>
        <View style={styles.modernTextContainer}>
          <Text style={[styles.modernLabel, isDarkMode && { color: '#94a3b8' }]}>{label}</Text>
          <Text style={[styles.modernValue, isDarkMode && { color: '#f8fafc' }]}>{value}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]}>
      <View style={[styles.header, { flexDirection: 'row', alignItems: 'center' }, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#1e293b' }]}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 15 }}>
          <Ionicons name="arrow-back" size={24} color={isDarkMode ? '#f8fafc' : '#001b3a'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDarkMode && { color: '#f8fafc' }]}>My Profile</Text>
      </View>
      <ScrollView 
        style={[styles.container, isDarkMode && { backgroundColor: '#0f172a' }]} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 }}
      >
      {/* Header Profile Section - Identity Card */}
      <View style={[styles.identityCard, isDarkMode && { backgroundColor: '#1e293b' }]}>
        <View style={styles.identityCardBanner} />
        
        <View style={styles.identityContent}>
          <TouchableOpacity style={styles.imageContainer} onPress={handleImagePress} activeOpacity={0.8}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImg} />
            ) : (
              <Ionicons name="person" size={50} color="#cbd5e1" />
            )}
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={14} color="#001b3a" />
            </View>
          </TouchableOpacity>
          
          <Text style={[styles.userName, isDarkMode && { color: '#ffffff' }]}>{userData?.name || 'Student Name'}</Text>
          
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{(userData?.role || 'Student').toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Details Card */}
      <View style={[styles.card, isDarkMode && { backgroundColor: '#1e293b' }]}>
        <Text style={[styles.cardTitle, isDarkMode && { color: '#ffffff' }]}>Profile Details</Text>

        {renderEditableRow('name', 'Full Name', 'person', '#001b3a', 'rgba(0, 27, 58, 0.08)')}
        {renderEditableRow('roll_no', 'Roll Number', 'id-card', '#001b3a', 'rgba(0, 27, 58, 0.08)')}
        {renderEditableRow('department', 'Department', 'school', '#001b3a', 'rgba(0, 27, 58, 0.08)')}
        {renderEditableRow('semester', 'Semester', 'calendar', '#001b3a', 'rgba(0, 27, 58, 0.08)')}
        {renderEditableRow('email', 'Email Address', 'mail', '#001b3a', 'rgba(0, 27, 58, 0.08)', true)}
      </View>

      {/* Settings Card */}
      <View style={[styles.card, isDarkMode && { backgroundColor: '#1e293b' }]}>
        <Text style={[styles.cardTitle, isDarkMode && { color: '#ffffff' }]}>Preferences & Security</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(0, 27, 58, 0.08)' }, isDarkMode && { backgroundColor: '#1e293b' }]}>
              <Ionicons name="moon" size={18} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
            </View>
            <Text style={[styles.settingText, isDarkMode && { color: '#f8fafc' }]}>Dark Mode</Text>
          </View>
          <Switch 
            value={isDarkMode} 
            onValueChange={async (val) => {
              setIsDarkMode(val);
              await AsyncStorage.setItem('appTheme', val ? 'dark' : 'light');
              DeviceEventEmitter.emit('themeChanged', val);
            }} 
            trackColor={{ false: '#cbd5e1', true: '#001b3a' }}
            thumbColor={'#ffffff'}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(0, 27, 58, 0.08)' }, isDarkMode && { backgroundColor: '#1e293b' }]}>
              <Ionicons name="finger-print" size={18} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
            </View>
            <Text style={[styles.settingText, isDarkMode && { color: '#f8fafc' }]}>App Lock</Text>
          </View>
          <Switch 
            value={isAppLockEnabled} 
            onValueChange={toggleAppLock} 
            trackColor={{ false: '#cbd5e1', true: '#001b3a' }}
            thumbColor={'#ffffff'}
          />
        </View>
      </View>

      {/* Support & Feedback */}
      <View style={[styles.card, isDarkMode && { backgroundColor: '#1e293b' }]}>
        <Text style={[styles.cardTitle, isDarkMode && { color: '#ffffff' }]}>Support & Feedback</Text>
        <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/(student)/feedback' as any)}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(0, 27, 58, 0.08)' }, isDarkMode && { backgroundColor: '#1e293b' }]}>
              <Ionicons name="chatbubbles-outline" size={18} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
            </View>
            <Text style={[styles.settingText, isDarkMode && { color: '#f8fafc' }]}>Send Feedback</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={isDarkMode ? '#475569' : '#cbd5e1'} />
        </TouchableOpacity>
      </View>

      {/* About App */}
      <TouchableOpacity style={[styles.card, isDarkMode && { backgroundColor: '#1e293b' }]} onPress={() => setShowAbout(true)}>
        <View style={styles.detailRow}>
          <Text style={[styles.cardTitle, isDarkMode && { color: '#ffffff' }, { marginBottom: 0 }]}>About DMS</Text>
          <Ionicons name="information-circle-outline" size={20} color={isDarkMode ? '#94a3b8' : '#64748b'} />
        </View>
      </TouchableOpacity>

      {/* Account / Logout Section */}
      <View style={[styles.card, isDarkMode && { backgroundColor: '#1e293b' }]}>
        <Text style={[styles.cardTitle, isDarkMode && { color: '#ffffff' }]}>Account</Text>
        <TouchableOpacity style={styles.settingRow} onPress={handleLogout}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: isDarkMode ? 'rgba(56, 189, 248, 0.1)' : 'rgba(0, 27, 58, 0.08)' }]}>
              <Ionicons name="log-out-outline" size={18} color={isDarkMode ? '#38bdf8' : '#001b3a'} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: isDarkMode ? '#38bdf8' : '#001b3a' }}>Logout</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={isDarkMode ? '#475569' : '#cbd5e1'} />
        </TouchableOpacity>
      </View>
      
      <View style={{ height: 40 }} />

      {/* Custom Logout Confirmation Modal */}
      <Modal visible={logoutModalVisible} transparent animationType="fade" onRequestClose={() => setLogoutModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModalContent, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
            <Text style={[styles.confirmTitle, isDarkMode && { color: '#ffffff' }]}>Logout</Text>
            <Text style={[styles.confirmMessage, isDarkMode && { color: '#cbd5e1' }]}>Are you sure you want to logout?</Text>
            
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setLogoutModalVisible(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.confirmSubmitBtn, isDarkMode && { backgroundColor: '#38bdf8' }]} 
                onPress={async () => {
                  setLogoutModalVisible(false);
                  await AsyncStorage.removeItem('userToken');
                  await AsyncStorage.removeItem('userData');
                  router.replace('/login' as any);
                }}
              >
                <Text style={[styles.confirmSubmitText, isDarkMode && { color: '#001b3a' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* About Modal */}
      <Modal visible={showAbout} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && { backgroundColor: '#1e293b' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, isDarkMode && { color: '#ffffff' }]}>About DMS</Text>
              <TouchableOpacity onPress={() => setShowAbout(false)}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#cbd5e1' : '#64748b'} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={[styles.aboutText, isDarkMode && { color: '#94a3b8' }]}>
                Department Management System (DMS) is designed to streamline academic workflows and centralize communication. It serves as a unified digital platform connecting students, teachers, and administrators to make educational management efficient, organized, and transparent.
              </Text>
              <Text style={[styles.aboutText, isDarkMode && { color: '#cbd5e1' }, { marginTop: 12, fontWeight: 'bold' }]}>
                Key Purpose:
              </Text>
              <Text style={[styles.aboutText, isDarkMode && { color: '#94a3b8' }, { marginTop: 4 }]}>
                • Manage and track academic schedules and events{"\n"}
                • Simplify attendance tracking and grade reports{"\n"}
                • Provide real-time updates and announcements{"\n"}
                • Facilitate direct requests and support queries
              </Text>
              <Text style={[styles.aboutText, isDarkMode && { color: '#cbd5e1' }, { marginTop: 20, fontWeight: 'bold', textAlign: 'center' }]}>
                Version 1.0.0
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { 
    paddingHorizontal: 24, 
    paddingTop: Platform.OS === 'android' ? 50 : 20, 
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#001b3a' },
  identityCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    borderRadius: 24,
    borderWidth: 1, borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  identityCardBanner: {
    height: 100,
    backgroundColor: '#001b3a',
    width: '100%',
  },
  identityContent: {
    alignItems: 'center',
    paddingBottom: 25,
  },
  imageContainer: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#ffffff',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 4, borderColor: '#ffffff',
    marginTop: -55,
  },
  profileImg: { width: '100%', height: '100%', borderRadius: 55 },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#eab308',
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#ffffff',
  },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#001b3a', marginTop: 12 },
  userEmail: { fontSize: 14, color: '#64748b', marginTop: 4 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  roleBadgeText: { color: '#001b3a', fontSize: 13, fontWeight: '700' },
  
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20, marginBottom: 15, padding: 20, borderRadius: 20,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#001b3a', marginBottom: 15 },
  
  modernRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12, borderRadius: 16, marginBottom: 10
  },
  modernIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 15
  },
  modernTextContainer: { flex: 1 },
  modernLabel: { fontSize: 13, color: '#64748b', marginBottom: 2 },
  modernValue: { fontSize: 15, fontWeight: 'bold', color: '#0f172a' },
  
  inlineInput: {
    fontSize: 15, fontWeight: 'bold', color: '#0f172a',
    backgroundColor: '#ffffff',
    padding: 0, paddingVertical: 2, paddingHorizontal: 6,
    borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1'
  },
  
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 8 },
  
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  settingLeft: { flexDirection: 'row', alignItems: 'center' },
  settingIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  settingText: { fontSize: 15, color: '#0f172a', fontWeight: '500' },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    backgroundColor: '#ffffff', width: '90%', maxHeight: '80%', borderRadius: 24, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 15,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  aboutText: { fontSize: 14, color: '#475569', lineHeight: 22 },
  sectionTitleText: { fontSize: 13, color: '#64748b', lineHeight: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 5 },
  feedbackInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
    marginBottom: 20
  },
  submitFeedbackBtn: {
    backgroundColor: '#001b3a',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10
  },
  submitFeedbackBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold'
  },

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
