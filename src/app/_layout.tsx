import { Stack } from 'expo-router';
import { Alert, DeviceEventEmitter } from 'react-native';
import { GlobalToast } from '../components/Toast';

// Save original Alert.alert
const originalAlert = Alert.alert;

// Override Alert.alert globally to intercept notifications
(Alert as any).alert = (title: string, message?: string, buttons?: any[], options?: any) => {
  // If it's a confirmation modal with multiple buttons, or has a custom onPress handler
  const hasOnPress = buttons && buttons.length === 1 && buttons[0].onPress;
  if (buttons && (buttons.length > 1 || hasOnPress)) {
    return originalAlert(title, message, buttons, options);
  }

  // Handle simple notifications via Toast
  let msg = message || '';
  if (typeof msg !== 'string' && buttons && buttons.length === 1 && typeof buttons[0].text === 'string') {
    msg = '';
  }

  const lowerTitle = title?.toLowerCase() || '';
  const lowerMsg = typeof msg === 'string' ? msg.toLowerCase() : '';
  const isError = lowerTitle.includes('error') || lowerTitle.includes('fail') || 
                  lowerMsg.includes('error') || lowerMsg.includes('fail') ||
                  lowerTitle.includes('invalid') || lowerMsg.includes('invalid');
                  
  const isInfo = lowerTitle.includes('info') || lowerTitle.includes('note') ||
                 lowerTitle.includes('wait') || lowerMsg.includes('wait') ||
                 lowerTitle.includes('download') || lowerMsg.includes('download');
                 
  const toastType = isError ? 'error' : (isInfo ? 'info' : 'success');

  DeviceEventEmitter.emit('showToast', {
    title: title || 'Notification',
    message: typeof msg === 'string' ? msg : undefined,
    type: toastType
  });
};

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
      </Stack>
      <GlobalToast />
    </>
  );
}
