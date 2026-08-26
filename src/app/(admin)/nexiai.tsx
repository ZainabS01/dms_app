import { API_URL } from '@/config/api';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, DeviceEventEmitter, TextInput, 
  TouchableOpacity, KeyboardAvoidingView, Platform, FlatList, 
  Keyboard, SafeAreaView, Image, Modal, Alert, Animated, Dimensions, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';

const { width, height } = Dimensions.get('window');

const INITIAL_MESSAGES = [
  { id: '1', text: 'Hello! I am Nexi, your intelligent administration assistant. How can I help you manage department schedules or policies today?', sender: 'bot', time: '10:00 AM' }
];

export default function AdminNexiAIScreen() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [messages, setMessages] = useState<any[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // History States
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuLayout, setMenuLayout] = useState({ y: 0, isUser: false });
  
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const viewShotRef = useRef<any>(null);
  
  // Sidebar states
  const [showSidebar, setShowSidebar] = useState(false); // logical state
  const [isSidebarMounted, setIsSidebarMounted] = useState(false); // physical modal state
  const slideAnim = useRef(new Animated.Value(-width)).current;
  
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow',
      () => {
        setKeyboardVisible(true);
        setShowAttachMenu(false);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const loadTheme = async () => {
        const theme = await AsyncStorage.getItem('appTheme');
        setIsDarkMode(theme === 'dark');
      };
      loadTheme();
      const sub = DeviceEventEmitter.addListener('themeChanged', setIsDarkMode);
      return () => sub.remove();
    }, [])
  );

  // LOAD HISTORY ON MOUNT
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem('nexi_admin_chat_history');
        if (stored) setChatSessions(JSON.parse(stored));
      } catch (e) {}
    };
    loadHistory();
  }, []);

  const saveHistory = async (sessions: any[]) => {
    setChatSessions(sessions);
    try {
      await AsyncStorage.setItem('nexi_admin_chat_history', JSON.stringify(sessions));
    } catch (e) {}
  };

  // AUTO-SAVE CURRENT SESSION
  useEffect(() => {
    if (messages.length <= 1) return; // Only 1 msg means it's just the initial greeting

    const userMessage = messages.find(m => m.sender === 'user');
    if (!userMessage) return;

    if (!currentSessionId) {
      // Start a new session automatically
      const title = userMessage.text.substring(0, 25) + '...';
      const newSession = {
        id: Date.now().toString(),
        title,
        isPinned: false,
        timestamp: Date.now(),
        messages
      };
      setCurrentSessionId(newSession.id);
      saveHistory([newSession, ...chatSessions]);
    } else {
      // Update existing session
      const updatedSessions = chatSessions.map(session => 
        session.id === currentSessionId ? { ...session, messages, timestamp: Date.now() } : session
      );
      saveHistory(updatedSessions);
    }
  }, [messages, currentSessionId]);

  const toggleSidebar = (show: boolean) => {
    if (show) {
      setIsSidebarMounted(true);
      setShowSidebar(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250, 
        useNativeDriver: true,
      }).start();
    } else {
      setShowSidebar(false);
      Animated.timing(slideAnim, {
        toValue: -width,
        duration: 250, 
        useNativeDriver: true,
      }).start(() => {
        setIsSidebarMounted(false);
      });
    }
  };

  const startNewChat = () => {
    setMessages(INITIAL_MESSAGES);
    setCurrentSessionId(null);
    setSelectedMessage(null);
    toggleSidebar(false);
  };

  const loadChatSession = (session: any) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setSelectedMessage(null);
    toggleSidebar(false);
  };

  const togglePin = (sessionId: string) => {
    const updated = chatSessions.map(s => s.id === sessionId ? { ...s, isPinned: !s.isPinned } : s);
    saveHistory(updated);
  };

  const deleteChatHistory = (sessionId: string) => {
    const updated = chatSessions.filter(s => s.id !== sessionId);
    saveHistory(updated);
    if (currentSessionId === sessionId) {
      setMessages(INITIAL_MESSAGES);
      setCurrentSessionId(null);
    }
  };

  const sendMessage = async () => {
    if (inputText.trim() === '') return;
    
    if (editingId) {
      setMessages(prev => prev.map(msg => 
        msg.id === editingId ? { ...msg, text: inputText.trim() } : msg
      ));
      setEditingId(null);
      setInputText('');
      Keyboard.dismiss();
      return;
    }

    const newUserMsg = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setInputText('');
    
    setIsTyping(true);

    try {
      const response = await fetch(`${API_URL}/chat/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: inputText.trim(), role: 'admin' }),
      });

      const data = await response.json();
      
      const botMsg = { 
        id: (Date.now() + 1).toString(), 
        text: data.reply || "No response received.", 
        sender: 'bot', 
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        replyToId: newUserMsg.id
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error("AI Error:", error);
      const errorMsg = { 
        id: (Date.now() + 1).toString(), 
        text: "Sorry, I am having trouble connecting to my server right now.", 
        sender: 'bot', 
        time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        replyToId: newUserMsg.id
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCopy = async () => {
    if (selectedMessage) {
      await Clipboard.setStringAsync(selectedMessage.text);
    }
    setSelectedMessage(null);
  };

  const handleEdit = () => {
    if (selectedMessage && selectedMessage.sender === 'user') {
      setInputText(selectedMessage.text);
      setEditingId(selectedMessage.id);
    }
    setSelectedMessage(null);
  };

  const handleExportPDF = async () => {
    if (!selectedMessage) return;
    try {
      const htmlContent = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; }
              .header { border-bottom: 2px solid #001b3a; padding-bottom: 10px; margin-bottom: 30px; display: flex; align-items: center; }
              .title { font-size: 24px; color: #001b3a; font-weight: bold; margin: 0; }
              .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
              .message { font-size: 16px; line-height: 1.6; white-space: pre-wrap; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; }
              .meta { margin-top: 40px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <p class="title">Nexi AI</p>
                <p class="subtitle">Message from ${selectedMessage.sender === 'bot' ? 'Nexi Admin Assistant' : 'You'} - ${selectedMessage.time}</p>
              </div>
            </div>
            <div class="message">${selectedMessage.text.replace(/\n/g, '<br/>')}</div>
            <div class="meta">Generated by DMS Nexi AI Admin Partner</div>
          </body>
        </html>
      `;
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      }
    } catch (error) {}
    setSelectedMessage(null);
  };

  const handleExportImage = async () => {
    if (!selectedMessage || !viewShotRef.current) return;
    try {
      setTimeout(async () => {
        try {
          const uri = await viewShotRef.current.capture();
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(uri, { UTI: '.png', mimeType: 'image/png' });
          }
        } catch (e) {}
        setSelectedMessage(null);
      }, 300);
    } catch (error) {
      setSelectedMessage(null);
    }
  };

  const handleDelete = () => {
    if (selectedMessage) {
      if (selectedMessage.sender === 'user') {
        setMessages(prev => prev.filter(m => m.id !== selectedMessage.id && m.replyToId !== selectedMessage.id));
      } else {
        setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
      }
    }
    setSelectedMessage(null);
  };

  const pickDocument = async () => {
    setShowAttachMenu(false);
    try {
      await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    } catch (error) {}
  };

  const pickImage = async () => {
    setShowAttachMenu(false);
    try {
      await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1 });
    } catch (error) {}
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isUser = item.sender === 'user';
    const isSelected = selectedMessage?.id === item.id;

    return (
      <View style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowBot]}>
        {!isUser && (
          <View style={styles.avatarBox}>
            <Image source={require('../../../assets/images/nexi.png')} style={{width: 36, height: 36, resizeMode: 'cover'}} />
          </View>
        )}
        
        <View style={{ flex: 1, alignItems: isUser ? 'flex-end' : 'flex-start' }}>
          <TouchableOpacity 
            onLongPress={() => {
              setSelectedMessage(item);
              Keyboard.dismiss();
            }}
            onPress={() => {
              if (selectedMessage) setSelectedMessage(null);
            }}
            delayLongPress={400}
            activeOpacity={0.8}
            style={[
              styles.messageBubble, 
              isUser ? styles.userBubble : [styles.botBubble, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]
            ]}
          >
            <Text style={[styles.messageText, isUser ? styles.userMessageText : [styles.botMessageText, isDarkMode && { color: '#f8fafc' }]]}>
              {item.text}
            </Text>
            <Text style={[styles.timeText, isUser ? { color: 'rgba(255,255,255,0.7)' } : { color: '#94a3b8' }]}>
              {item.time}
            </Text>
          </TouchableOpacity>

          {isSelected && (
            <View style={[
              styles.inlineToolbar,
              isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' },
            ]}>
              <TouchableOpacity style={styles.toolbarBtn} onPress={handleCopy}>
                <Ionicons name="copy-outline" size={15} color={isDarkMode ? '#f8fafc' : '#0f172a'} />
              </TouchableOpacity>
              
              {!isUser && (
                <>
                  <View style={styles.toolbarDivider} />
                  <TouchableOpacity style={styles.toolbarBtn} onPress={handleExportPDF}>
                    <Ionicons name="document-text-outline" size={15} color={isDarkMode ? '#60a5fa' : '#3b82f6'} />
                  </TouchableOpacity>
                  <View style={styles.toolbarDivider} />
                  <TouchableOpacity style={styles.toolbarBtn} onPress={handleExportImage}>
                    <Ionicons name="image-outline" size={15} color={isDarkMode ? '#34d399' : '#10b981'} />
                  </TouchableOpacity>
                </>
              )}

              {isUser && (
                <>
                  <View style={styles.toolbarDivider} />
                  <TouchableOpacity style={styles.toolbarBtn} onPress={handleEdit}>
                    <Ionicons name="pencil-outline" size={15} color={isDarkMode ? '#f8fafc' : '#0f172a'} />
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.toolbarDivider} />
              <TouchableOpacity style={styles.toolbarBtn} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={15} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#0f172a' }]}>
      
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'android' ? 20 : 0}
      >
        
        {/* Header */}
        <View style={[styles.header, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
          <View style={styles.headerTitleContainer}>
            <TouchableOpacity style={styles.headerIconLeft} onPress={() => toggleSidebar(true)}>
              <Ionicons name="menu-outline" size={32} color={isDarkMode ? '#cbd5e1' : '#0f172a'} />
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              <Image source={require('../../../assets/images/nexi.png')} style={{width: 50, height: 50, resizeMode: 'cover'}} />
            </View>
            <View>
              <Text style={[styles.headerTitle, isDarkMode && { color: '#ffffff' }]}>Nexi AI</Text>
              <Text style={styles.statusText}>Your Intelligent Admin Partner</Text>
            </View>
          </View>
        </View>

        {/* Chat List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          extraData={selectedMessage}
          keyExtractor={item => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContainer}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        />

        {isTyping && (
          <View style={styles.typingContainer}>
            <Text style={[styles.typingText, isDarkMode && { color: '#94a3b8' }]}>Nexi is typing...</Text>
          </View>
        )}

        <View style={styles.inputContainerWrapper}>
          <View style={[
            styles.inputContainer, 
            isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }
          ]}>
            {editingId && (
              <View style={styles.editingBanner}>
                <Text style={styles.editingText}>Editing message...</Text>
                <TouchableOpacity onPress={() => { setEditingId(null); setInputText(''); }}>
                  <Ionicons name="close-circle" size={20} color="#64748b" />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.inputWrapper}>
              <View style={{ position: 'relative', zIndex: 10 }}>
                {showAttachMenu && (
                  <View style={[styles.attachPopover, isDarkMode && { backgroundColor: '#1e293b', borderColor: '#334155' }]}>
                    <View style={styles.popoverHeader}>
                      <Text style={[styles.popoverTitle, isDarkMode && { color: '#ffffff' }]}>Attach File</Text>
                      <TouchableOpacity onPress={() => setShowAttachMenu(false)} style={styles.popoverCloseBtn}>
                        <Ionicons name="close" size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.popoverDivider, isDarkMode && { backgroundColor: '#334155' }]} />
                    <TouchableOpacity style={styles.popoverItem} onPress={pickImage}>
                      <Ionicons name="image-outline" size={20} color={isDarkMode ? '#60a5fa' : '#3b82f6'} />
                      <Text style={[styles.popoverText, isDarkMode && { color: '#cbd5e1' }]}>Photo</Text>
                    </TouchableOpacity>
                    <View style={[styles.popoverDivider, isDarkMode && { backgroundColor: '#334155' }]} />
                    <TouchableOpacity style={styles.popoverItem} onPress={pickDocument}>
                      <Ionicons name="document-text-outline" size={20} color={isDarkMode ? '#f87171' : '#ef4444'} />
                      <Text style={[styles.popoverText, isDarkMode && { color: '#cbd5e1' }]}>Document</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity style={styles.attachBtn} onPress={() => { Keyboard.dismiss(); setShowAttachMenu(!showAttachMenu); }}>
                  <Ionicons name={showAttachMenu ? "close" : "add"} size={30} color={isDarkMode ? '#94a3b8' : '#64748b'} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, isDarkMode && { backgroundColor: '#334155', color: '#ffffff' }]}
                placeholder="Ask Nexi anything..."
                placeholderTextColor={isDarkMode ? '#94a3b8' : '#64748b'}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                onFocus={() => { setShowAttachMenu(false); setSelectedMessage(null); }}
              />
              <TouchableOpacity 
                style={[styles.sendBtn, inputText.trim() === '' ? { backgroundColor: '#cbd5e1' } : { backgroundColor: '#001b3a' }]} 
                onPress={sendMessage}
                disabled={inputText.trim() === ''}
              >
                <Ionicons name={editingId ? "checkmark" : "send"} size={16} color="#ffffff" style={{ marginLeft: editingId ? 0 : 3 }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* SPACING: Guarantees gap from keyboard (5px) and floating nav bar (110px) */}
        <View style={{ height: isKeyboardVisible ? 5 : 110 }} />
      </KeyboardAvoidingView>

      {/* Hidden ViewShot strictly for Image Exporting */}
      {selectedMessage && selectedMessage.sender === 'bot' && (
        <View style={{ position: 'absolute', top: -10000, left: -10000 }}>
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
            <View style={{ backgroundColor: '#ffffff', padding: 25, borderRadius: 16, width: 320, borderWidth: 1, borderColor: '#e2e8f0' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                <Image source={require('../../../assets/images/nexi.png')} style={{width: 36, height: 36, borderRadius: 18, marginRight: 12, borderWidth: 1, borderColor: '#e2e8f0'}} />
                <View>
                  <Text style={{ fontWeight: 'bold', color: '#0f172a', fontSize: 16 }}>Nexi AI Admin Assistant</Text>
                  <Text style={{ fontSize: 12, color: '#64748b' }}>{selectedMessage.time}</Text>
                </View>
              </View>
              <View style={{ backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#f1f5f9' }}>
                <Text style={{ color: '#0f172a', fontSize: 15, lineHeight: 24 }}>{selectedMessage.text}</Text>
              </View>
              <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 15, textAlign: 'right', fontWeight: '500' }}>Generated by DMS Nexi Admin</Text>
            </View>
          </ViewShot>
        </View>
      )}

      {/* FULL SCREEN MODAL SIDEBAR (Hides Tab Bar Natively) */}
      {isSidebarMounted && (
        <Modal transparent visible={true} animationType="none" onRequestClose={() => toggleSidebar(false)}>
          <View style={styles.sidebarOverlay}>
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => toggleSidebar(false)} />
            <Animated.View style={[
              styles.innovativeSidebar, 
              isDarkMode && { backgroundColor: '#1e293b' },
              { transform: [{ translateX: slideAnim }] }
            ]}>
              
              <View style={[styles.sidebarHeaderBrand, isDarkMode && { backgroundColor: '#1e293b', borderBottomColor: '#334155' }]}>
                <View style={styles.sidebarHeaderTop}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.brandIconBox}>
                      <Image source={require('../../../assets/images/nexi.png')} style={{width: 32, height: 32, resizeMode: 'cover'}} />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={[styles.sidebarTitleBrand, isDarkMode && { color: '#ffffff' }]}>Nexi AI</Text>
                      <Text style={styles.sidebarSubtitleBrand}>Your Intelligent Admin Partner</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.closeSidebarBtnBrand} onPress={() => toggleSidebar(false)}>
                    <Ionicons name="close" size={22} color={isDarkMode ? '#ffffff' : '#0f172a'} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView style={styles.sidebarContentBrand} showsVerticalScrollIndicator={false}>
                <TouchableOpacity 
                  style={[styles.historyItemBrand, { borderBottomWidth: 0, paddingVertical: 18, marginBottom: 15 }]} 
                  onPress={startNewChat}
                >
                  <Ionicons name="add-circle-outline" size={26} color="#0f172a" />
                  <Text style={[styles.historyItemTextBrand, { color: '#0f172a', fontWeight: 'bold', fontSize: 16 }]}>
                    Start New Chat
                  </Text>
                </TouchableOpacity>
                
                <Text style={styles.historyLabelBrand}>Recent Conversations</Text>
                
                {chatSessions
                  .sort((a, b) => {
                    if (a.isPinned === b.isPinned) return b.timestamp - a.timestamp;
                    return a.isPinned ? -1 : 1;
                  })
                  .map((item) => (
                  <TouchableOpacity key={item.id} style={[styles.historyItemBrand, isDarkMode && { borderBottomColor: '#334155' }]} onPress={() => loadChatSession(item)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Ionicons name={item.isPinned ? "bookmark" : "chatbox-outline"} size={20} color={item.isPinned ? "#eab308" : "#94a3b8"} />
                      <Text style={[styles.historyItemTextBrand, isDarkMode && { color: '#cbd5e1' }]} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity onPress={() => togglePin(item.id)} style={{ padding: 6 }}>
                        <Ionicons name={item.isPinned ? "bookmark" : "bookmark-outline"} size={18} color={item.isPinned ? "#eab308" : (isDarkMode ? '#94a3b8' : '#64748b')} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteChatHistory(item.id)} style={{ padding: 6, marginLeft: 2 }}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { flex: 1 },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'android' ? 50 : 20,
    paddingBottom: 15,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerIconLeft: { marginRight: 15, padding: 5 },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  logoContainer: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#ffffff',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
    borderWidth: 1, borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  statusText: { fontSize: 12, color: '#64748b', fontWeight: '500', marginTop: 2 },

  chatContainer: { padding: 20, paddingBottom: 20 },
  messageRow: { flexDirection: 'row', marginBottom: 15, alignItems: 'flex-end' },
  messageRowUser: { justifyContent: 'flex-end' },
  messageRowBot: { justifyContent: 'flex-start' },
  
  avatarBox: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 8,
    borderWidth: 1, borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#001b3a',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#ffffff',
    borderWidth: 1, borderColor: '#e2e8f0',
    borderBottomLeftRadius: 4,
  },
  
  messageText: { fontSize: 15, lineHeight: 22 },
  userMessageText: { color: '#ffffff' },
  botMessageText: { color: '#334155' },
  timeText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },

  typingContainer: { paddingHorizontal: 20, paddingBottom: 10 },
  typingText: { fontSize: 12, color: '#64748b' },

  inputContainerWrapper: {
    width: '100%',
  },
  inputContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 24,
    marginHorizontal: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  editingBanner: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#f1f5f9', paddingHorizontal: 20, paddingVertical: 8,
    borderTopLeftRadius: 24, borderTopRightRadius: 24
  },
  editingText: { fontSize: 12, color: '#64748b' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 8,
  },
  attachBtn: {
    width: 44, height: 44,
    justifyContent: 'center', alignItems: 'center',
  },
  
  attachPopover: {
    position: 'absolute', bottom: 55, left: 0,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: 170,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
    borderWidth: 1, borderColor: '#e2e8f0'
  },
  popoverHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 15, paddingVertical: 12,
  },
  popoverTitle: { fontSize: 14, fontWeight: 'bold', color: '#0f172a' },
  popoverCloseBtn: { padding: 4, backgroundColor: '#fef2f2', borderRadius: 12 },
  popoverItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12 },
  popoverText: { fontSize: 15, color: '#334155', marginLeft: 12, fontWeight: '500' },
  popoverDivider: { height: 1, backgroundColor: '#f1f5f9' },
  
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    marginHorizontal: 5,
    color: '#0f172a',
    borderWidth: 1, borderColor: '#f1f5f9'
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  
  inlineToolbar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginTop: 6,
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 3,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  toolbarBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  toolbarDivider: { width: 1, backgroundColor: '#f1f5f9', marginVertical: 6 },

  sidebarOverlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    flexDirection: 'row', zIndex: 100, backgroundColor: 'rgba(0,0,0,0.4)'
  },
  innovativeSidebar: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    width: width * 0.75, 
    backgroundColor: '#ffffff',
    shadowColor: '#000', shadowOffset: { width: 5, height: 0 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 25,
  },
  sidebarHeaderBrand: {
    paddingTop: Platform.OS === 'android' ? 50 : 40, 
    paddingBottom: 25, paddingHorizontal: 25,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
  },
  sidebarHeaderTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15
  },
  brandIconBox: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#ffffff',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#e2e8f0' 
  },
  closeSidebarBtnBrand: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#f1f5f9',
    justifyContent: 'center', alignItems: 'center'
  },
  sidebarTitleBrand: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  sidebarSubtitleBrand: { fontSize: 13, color: '#64748b', marginTop: 4 },
  
  sidebarContentBrand: { flex: 1, padding: 20 },
  
  historyLabelBrand: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  historyItemBrand: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9'
  },
  historyItemTextBrand: { fontSize: 15, color: '#334155', marginLeft: 15, flex: 1, fontWeight: '500' }
});
