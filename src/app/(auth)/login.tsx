import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { signIn } from '@/lib/auth';
import { C, F, R } from '@/lib/theme';

const REMEMBER_ME_KEY = 'auth:remember_me_email';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{ visible: boolean; message: string }>({
    visible: false,
    message: '',
  });
  const [serverDown, setServerDown] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(REMEMBER_ME_KEY).then((saved) => {
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    });
  }, []);

  function showError(message: string) {
    setErrorModal({ visible: true, message });
  }

  async function handleSubmit() {
    if (!email || !password) {
      showError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email, password);
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_ME_KEY, email);
      } else {
        await AsyncStorage.removeItem(REMEMBER_ME_KEY);
      }
      router.replace('/(app)/(user)');
    } catch (error: any) {
      console.log('Auth error:', error.code, error.message);
      if (error.code === 'auth/network-request-failed') {
        setServerDown(true);
      } else {
        showError('Incorrect username or password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.form}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={C.muted2}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={C.muted2}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable style={styles.rememberRow} onPress={() => setRememberMe((v) => !v)}>
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.rememberLabel}>Remember me</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#0f0e0d" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </Pressable>

        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={errorModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModal((s) => ({ ...s, visible: false }))}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconWrap}>
              <Text style={styles.modalIcon}>✕</Text>
            </View>
            <Text style={styles.modalTitle}>Login Failed</Text>
            <Text style={styles.modalMessage}>{errorModal.message}</Text>
            <Pressable
              style={({ pressed }) => [styles.modalBtn, pressed && styles.buttonPressed]}
              onPress={() => setErrorModal((s) => ({ ...s, visible: false }))}>
              <Text style={styles.modalBtnText}>Try Again</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={serverDown}
        transparent
        animationType="fade"
        onRequestClose={() => setServerDown(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={[styles.modalIconWrap, styles.serverIconWrap]}>
              <Text style={styles.modalIcon}>⚡</Text>
            </View>
            <Text style={styles.modalTitle}>Server Down</Text>
            <Text style={styles.modalMessage}>
              Unable to reach the server. Please check your internet connection and try again.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.modalBtn, pressed && styles.buttonPressed]}
              onPress={() => setServerDown(false)}>
              <Text style={styles.modalBtnText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  form: {
    gap: 16,
  },
  title: {
    color: C.text,
    fontSize: 30,
    fontFamily: F.extraBold,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: C.muted,
    fontSize: 14,
    fontFamily: F.medium,
    marginTop: -4,
  },
  input: {
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: R.input,
    padding: 16,
    color: C.text,
    fontSize: 15,
    fontFamily: F.medium,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: C.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: C.amber,
    borderColor: C.amber,
  },
  checkmark: {
    color: '#0f0e0d',
    fontSize: 12,
    fontFamily: F.extraBold,
    lineHeight: 16,
  },
  rememberLabel: {
    color: C.muted,
    fontSize: 14,
    fontFamily: F.medium,
  },
  button: {
    backgroundColor: C.amber,
    borderRadius: R.btn,
    padding: 16,
    alignItems: 'center',
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#0f0e0d',
    fontFamily: F.extraBold,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalBox: {
    backgroundColor: C.surface2,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    gap: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  modalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#ef444422',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  serverIconWrap: {
    backgroundColor: '#f9731622',
  },
  modalIcon: {
    color: '#ef4444',
    fontSize: 22,
    fontFamily: F.extraBold,
  },
  modalTitle: {
    color: C.text,
    fontSize: 18,
    fontFamily: F.extraBold,
    letterSpacing: -0.3,
  },
  modalMessage: {
    color: C.muted,
    fontSize: 14,
    fontFamily: F.medium,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalBtn: {
    backgroundColor: C.amber,
    borderRadius: R.btn,
    paddingVertical: 12,
    paddingHorizontal: 32,
    marginTop: 4,
  },
  modalBtnText: {
    color: '#0f0e0d',
    fontFamily: F.extraBold,
    fontSize: 15,
  },
});
