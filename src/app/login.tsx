import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, Image, Alert, ActivityIndicator, Modal, BackHandler
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL as CENTRAL_API_URL } from '@/config/api';
const API_URL = `${CENTRAL_API_URL}/auth`;

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  // Custom Pickers State
  const [departmentsList, setDepartmentsList] = useState<any[]>([]);
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showSemPicker, setShowSemPicker] = useState(false);
  const [exitModalVisible, setExitModalVisible] = useState(false);

  const semestersList = [
    '1st Sem', '2nd Sem', '3rd Sem', '4th Sem',
    '5th Sem', '6th Sem', '7th Sem', '8th Sem'
  ];

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        setExitModalVisible(true);
        return true;
      };

      const backSubscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => backSubscription.remove();
    }, [])
  );

  useEffect(() => {
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
    fetchDepartments();
  }, []);
  
  // Navigation States
  const [isLogin, setIsLogin] = useState(true);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false); // After Registration
  const [isForgotPassword, setIsForgotPassword] = useState(false); // Forgot Password Initial Step
  const [isResettingPassword, setIsResettingPassword] = useState(false); // Forgot Password OTP Step
  
  // Form Data
  const [role, setRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [department, setDepartment] = useState('');
  const [semester, setSemester] = useState('');
  
  // OTP Data
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);

  // --- 1. Login / Register ---
  const handleAuth = async () => {
    const isPasswordRequired = !(isLogin && role === 'admin');

    if (!email.trim() || (isPasswordRequired && !password.trim())) {
      Alert.alert('Error', isPasswordRequired ? 'Please enter both email and password.' : 'Please enter your email.');
      return;
    }

    if (!isLogin && !fullName.trim()) {
      Alert.alert('Error', 'Please enter your full name.');
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? '/login' : '/register';
      const payload: any = { email: email.trim().toLowerCase(), password };

      if (!isLogin) {
        payload.name = fullName;
        payload.role = role;
        payload.department = department;
        payload.semester = semester;
        if (role === 'student') payload.roll_no = rollNo.toUpperCase();
      }

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        if (isLogin) {
          // Save the authentication token
          await AsyncStorage.setItem('userToken', data.token);
          await AsyncStorage.setItem('userData', JSON.stringify(data.user));
          
          Alert.alert('Success', `Welcome back, ${data.user.name}!`);
          
          const userRole = data.user.role ? data.user.role.toLowerCase() : '';
          if (userRole === 'student') {
            router.replace('/(student)' as any);
          } else if (userRole === 'teacher') {
            router.replace('/(teacher)' as any);
          } else if (userRole === 'admin') {
            router.replace('/(admin)' as any);
          }
        } else {
          // Success Register -> Go to OTP Verification
          Alert.alert('Success', 'Account created! Please check your email for the OTP.');
          setIsVerifyingOtp(true);
          setPassword(''); // clear for security
        }
      } else {
        if (data.notVerified) {
          Alert.alert(
            'Not Verified',
            'Please verify your email first. Request a new OTP if needed.',
            [
              {
                text: 'Verify Now',
                onPress: () => setIsVerifyingOtp(true)
              },
              {
                text: 'Cancel',
                style: 'cancel'
              }
            ]
          );
        } else {
          Alert.alert('Failed', data.message || 'Something went wrong.');
        }
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Verify Registration OTP ---
  const handleVerifyOtp = async () => {
    if (otp.length !== 4) return Alert.alert('Error', 'Please enter a valid 4-digit OTP.');
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp })
      });
      const data = await response.json();

      if (response.ok) {
        Alert.alert('Verified!', 'Your account is now active. Please login.');
        setIsVerifyingOtp(false);
        setIsLogin(true);
        setOtp('');
      } else {
        Alert.alert('Failed', data.message);
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  // --- 3. Send Forgot Password OTP ---
  const handleSendResetOtp = async () => {
    if (!email.trim()) return Alert.alert("Error", "Please enter your email address.");
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() })
      });
      const data = await response.json();

      if (response.ok) {
        Alert.alert("Email Sent!", "We have sent a 4-digit OTP to your email.");
        setIsForgotPassword(false);
        setIsResettingPassword(true);
      } else {
        Alert.alert('Failed', data.message);
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  // --- 4. Reset Password ---
  const handleResetPassword = async () => {
    if (otp.length !== 4 || !newPassword) return Alert.alert('Error', 'Please enter the 4-digit OTP and a new password.');
    
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp, newPassword })
      });
      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success!', 'Password reset successful. You can now login.');
        setIsResettingPassword(false);
        setIsLogin(true);
        setOtp('');
        setNewPassword('');
        setPassword('');
      } else {
        Alert.alert('Failed', data.message);
      }
    } catch (error) {
      Alert.alert('Network Error', 'Could not connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>
              {isVerifyingOtp ? 'Verify Account' : 
               isForgotPassword ? 'Reset Password' : 
               isResettingPassword ? 'Create New Password' :
               isLogin ? 'Welcome Back!' : 'Create an Account'}
            </Text>
            <Text style={styles.subtitle}>
              {isVerifyingOtp ? 'Enter the 4-digit OTP sent to your email.' : 
               isForgotPassword ? 'Enter email to receive OTP.' : 
               isResettingPassword ? 'Enter OTP and your new password.' :
               isLogin ? 'Login to access your dashboard.' : 'Register to manage your academic journey.'}
            </Text>
          </View>

          {/* ----- SCENARIO 1: OTP VERIFICATION (REGISTRATION) ----- */}
          {isVerifyingOtp && (
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>4-Digit OTP</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="keypad-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="1234" keyboardType="numeric" maxLength={4} value={otp} onChangeText={setOtp} />
                </View>
              </View>
              <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleVerifyOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Verify OTP</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{alignItems: 'center', marginTop: 20}} onPress={() => { setIsVerifyingOtp(false); setIsLogin(true); }}>
                <Text style={styles.toggleLink}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ----- SCENARIO 2: FORGOT PASSWORD (EMAIL STEP) ----- */}
          {isForgotPassword && (
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="example@gmail.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                </View>
              </View>
              <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleSendResetOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Send OTP</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{alignItems: 'center', marginTop: 20}} onPress={() => setIsForgotPassword(false)}>
                <Text style={styles.toggleLink}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ----- SCENARIO 3: RESET PASSWORD (OTP STEP) ----- */}
          {isResettingPassword && (
            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>4-Digit OTP</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="keypad-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="1234" keyboardType="numeric" maxLength={4} value={otp} onChangeText={setOtp} />
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="••••••••" secureTextEntry={!showPassword} value={newPassword} onChangeText={setNewPassword} />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleResetPassword} disabled={loading}>
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>Reset Password</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={{alignItems: 'center', marginTop: 20}} onPress={() => { setIsResettingPassword(false); setIsLogin(true); }}>
                <Text style={styles.toggleLink}>Cancel & Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ----- SCENARIO 4: STANDARD LOGIN / REGISTER ----- */}
          {!isVerifyingOtp && !isForgotPassword && !isResettingPassword && (
            <View style={styles.formContainer}>
              <View style={styles.roleContainer}>
                <Text style={styles.label}>{role === 'admin' ? 'I am an:' : 'I am a:'}</Text>
                <View style={styles.roleButtonsRow}>
                  <TouchableOpacity style={[styles.roleBtn, role === 'student' && styles.roleBtnActive]} onPress={() => setRole('student')}>
                    <MaterialCommunityIcons name="school" size={16} color={role === 'student' ? '#001b3a' : '#64748b'} />
                    <Text style={[styles.roleBtnText, role === 'student' && styles.roleBtnTextActive]}>Student</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.roleBtn, role === 'teacher' && styles.roleBtnActive]} onPress={() => setRole('teacher')}>
                    <MaterialCommunityIcons name="human-male-board" size={16} color={role === 'teacher' ? '#001b3a' : '#64748b'} />
                    <Text style={[styles.roleBtnText, role === 'teacher' && styles.roleBtnTextActive]}>Teacher</Text>
                  </TouchableOpacity>
                  {isLogin && (
                    <TouchableOpacity style={[styles.roleBtn, role === 'admin' && styles.roleBtnActive]} onPress={() => setRole('admin')}>
                      <MaterialCommunityIcons name="shield-account" size={16} color={role === 'admin' ? '#001b3a' : '#64748b'} />
                      <Text style={[styles.roleBtnText, role === 'admin' && styles.roleBtnTextActive]}>Admin</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {!isLogin && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Full Name</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="person-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                      <TextInput style={styles.input} placeholder="John Doe" value={fullName} onChangeText={setFullName} />
                    </View>
                  </View>
                  {role === 'student' && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Roll Number</Text>
                      <View style={styles.inputContainer}>
                        <Ionicons name="id-card-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                        <TextInput style={styles.input} placeholder="e.g. 101" keyboardType="numeric" value={rollNo} onChangeText={setRollNo} />
                      </View>
                    </View>
                  )}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Department</Text>
                    <TouchableOpacity style={styles.inputContainer} onPress={() => setShowDeptPicker(true)}>
                      <Ionicons name="business-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                      <Text style={{ flex: 1, fontSize: 14, color: department ? '#0f172a' : '#94a3b8' }}>
                        {department ? departmentsList.find(d => d.code === department || d.name === department)?.name || department : 'Select Department'}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                  {role === 'student' && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Semester</Text>
                      <TouchableOpacity style={styles.inputContainer} onPress={() => setShowSemPicker(true)}>
                        <Ionicons name="calendar-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                        <Text style={{ flex: 1, fontSize: 14, color: semester ? '#0f172a' : '#94a3b8' }}>
                          {semester ? (semester.includes('Sem') ? semester : (semester === '1' ? '1st Sem' : semester === '2' ? '2nd Sem' : semester === '3' ? '3rd Sem' : `${semester}th Sem`)) : 'Select Semester'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                  <TextInput style={styles.input} placeholder="example@gmail.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
                </View>
              </View>

              {!(isLogin && role === 'admin') && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="••••••••" secureTextEntry={!showPassword} value={password} onChangeText={setPassword} />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                  {isLogin && (
                    <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: 10 }} onPress={() => setIsForgotPassword(true)}>
                      <Text style={styles.forgotPassword}>Forgot Password?</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.7 }]} onPress={handleAuth} disabled={loading}>
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitBtnText}>{isLogin ? 'Login' : 'Register'}</Text>}
              </TouchableOpacity>

              <View style={styles.toggleContainer}>
                <Text style={styles.toggleText}>{isLogin ? "Don't have an account? " : "Already have an account? "}</Text>
                <TouchableOpacity onPress={() => {
                  const nextIsLogin = !isLogin;
                  setIsLogin(nextIsLogin);
                  if (!nextIsLogin && role === 'admin') {
                    setRole('student');
                  }
                }}>
                  <Text style={styles.toggleLink}>{isLogin ? 'Register Here' : 'Login Here'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Department Picker Modal */}
      <Modal visible={showDeptPicker} transparent animationType="fade" onRequestClose={() => setShowDeptPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Department</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              {departmentsList.map((dept) => (
                <TouchableOpacity 
                  key={dept.code} 
                  style={styles.pickerItem} 
                  onPress={() => {
                    setDepartment(dept.name);
                    setShowDeptPicker(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>{dept.name} ({dept.code})</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closePickerBtn} onPress={() => setShowDeptPicker(false)}>
              <Text style={styles.closePickerText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom Exit App Confirmation Modal */}
      <Modal visible={exitModalVisible} transparent animationType="fade" onRequestClose={() => setExitModalVisible(false)}>
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmTitle}>Exit App</Text>
            <Text style={styles.confirmMessage}>Are you sure you want to exit DMS?</Text>
            
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setExitModalVisible(false)}>
                <Text style={styles.confirmCancelText}>Stay</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmSubmitBtn} onPress={() => {
                setExitModalVisible(false);
                BackHandler.exitApp();
              }}>
                <Text style={styles.confirmSubmitText}>Exit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Semester Picker Modal */}
      <Modal visible={showSemPicker} transparent animationType="fade" onRequestClose={() => setShowSemPicker(false)}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Semester</Text>
            <ScrollView style={{ maxHeight: 250 }}>
              {semestersList.map((sem) => (
                <TouchableOpacity 
                  key={sem} 
                  style={styles.pickerItem} 
                  onPress={() => {
                    const match = sem.match(/\d+/);
                    setSemester(match ? match[0] : sem);
                    setShowSemPicker(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>{sem}</Text>
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
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  header: { alignItems: 'center', marginBottom: 12 },
  logo: { width: 140, height: 140, marginBottom: -15 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#001b3a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', paddingHorizontal: 10 },
  formContainer: { backgroundColor: '#ffffff', padding: 20, borderRadius: 24 },
  roleContainer: { marginBottom: 15 },
  roleButtonsRow: { flexDirection: 'row', gap: 15, marginTop: 10 },
  roleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  roleBtnActive: { backgroundColor: '#eab308', borderColor: '#eab308' },
  roleBtnText: { marginLeft: 8, fontSize: 14, fontWeight: '600', color: '#64748b' },
  roleBtnTextActive: { color: '#001b3a' },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginBottom: 5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 15, height: 46 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 14, color: '#0f172a' },
  forgotPassword: { fontSize: 12, color: '#001b3a', fontWeight: '600' },
  submitBtn: { backgroundColor: '#001b3a', height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10, flexDirection: 'row' },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  toggleContainer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  toggleText: { fontSize: 13, color: '#64748b' },
  toggleLink: { fontSize: 13, color: '#eab308', fontWeight: 'bold' },

  // Dropdown Picker Styles
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 30 },
  pickerContent: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  pickerTitle: { fontSize: 16, fontWeight: 'bold', color: '#001b3a', marginBottom: 15, textAlign: 'center' },
  pickerItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pickerItemText: { fontSize: 14, color: '#334155', fontWeight: '500' },
  closePickerBtn: { marginTop: 15, paddingVertical: 12, backgroundColor: '#001b3a', borderRadius: 10, alignItems: 'center' },
  closePickerText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },

  // Custom Confirm Dialog Styles
  confirmModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
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
