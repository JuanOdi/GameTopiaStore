import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/hooks/use-auth';
import { changePassword, logOut } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { C, F, R } from '@/lib/theme';
import { onValue, ref } from 'firebase/database';

type UserProfile = {
  email: string;
  role: string;
  createdAt: number;
};

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    const userRef = ref(db, `users/${user.uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) setProfile(snapshot.val());
    });
    return () => unsubscribe();
  }, [user]);

  async function handleLogOut() {
    await logOut();
    router.replace('/(auth)/login');
  }

  async function handleChangePassword() {
    if (!newPassword || !currentPassword) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters.');
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert('Success', 'Password updated successfully.');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setChangingPassword(false);
    }
  }

  const username = profile?.email?.split('@')[0] ?? '...';
  const joined = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '...';

  const isAdmin = profile?.role === 'admin';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Text style={styles.headerSub}>@{username}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.logoutBtn, pressed && styles.pressed]}
          onPress={handleLogOut}>
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </View>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{username.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.username}>{username}</Text>
        <View style={[styles.roleBadge, isAdmin && styles.roleBadgeAdmin]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons
              name={isAdmin ? 'flash' : 'person'}
              size={12}
              color={isAdmin ? C.amber : C.muted}
            />
            <Text style={[styles.roleText, isAdmin && styles.roleTextAdmin]}>
              {isAdmin ? 'Admin' : 'User'}
            </Text>
          </View>
        </View>
      </View>

      {/* Info Card */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Info</Text>
        <View style={styles.card}>
          {[
            { label: 'Email',        value: profile?.email ?? '...' },
            { label: 'Username',     value: username },
            { label: 'Role',         value: profile?.role ?? '...' },
            { label: 'Member since', value: joined },
          ].map((item, i, arr) => (
            <View key={item.label}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowValue} numberOfLines={1}>{item.value}</Text>
              </View>
              {i < arr.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>
      </View>

      {/* Security */}
      <View style={[styles.section, { marginTop: 24 }]}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => setShowChangePassword(true)}>
            <Ionicons name="lock-closed-outline" size={16} color={C.muted} style={{ marginRight: 4 }} />
            <Text style={styles.rowLabel}>Change Password</Text>
            <Text style={styles.rowChevron}>›</Text>
          </Pressable>
        </View>
      </View>

      {/* Change Password Modal */}
      <Modal visible={showChangePassword} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Change Password</Text>

              <TextInput
                style={styles.input}
                placeholder="Current password"
                placeholderTextColor={C.muted2}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor={C.muted2}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={C.muted2}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />

              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={handleChangePassword}
                disabled={changingPassword}>
                {changingPassword ? (
                  <ActivityIndicator color="#0f0e0d" />
                ) : (
                  <Text style={styles.buttonText}>Update Password</Text>
                )}
              </Pressable>

              <Pressable onPress={() => { setShowChangePassword(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  content: { padding: 20, paddingTop: 56, paddingBottom: 120 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  headerLeft: { gap: 2 },
  headerTitle: { color: C.text, fontSize: 28, fontFamily: F.extraBold },
  headerSub: { color: C.muted2, fontSize: 13, fontFamily: F.medium },
  logoutBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: R.chip,
    borderWidth: 1,
    borderColor: C.coral,
    backgroundColor: 'transparent',
  },
  logoutText: { color: C.coral, fontSize: 13, fontFamily: F.semiBold },
  pressed: { opacity: 0.7 },

  avatarSection: { alignItems: 'center', paddingVertical: 32, gap: 10 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: C.amber,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#0f0e0d', fontSize: 38, fontFamily: F.extraBold },
  username: { color: C.text, fontSize: 22, fontFamily: F.extraBold },
  roleBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: R.chip,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.line,
  },
  roleBadgeAdmin: { borderColor: C.amber, backgroundColor: C.amber + '1A' },
  roleText: { color: C.muted, fontSize: 13, fontFamily: F.semiBold },
  roleTextAdmin: { color: C.amber },

  section: { gap: 10 },
  sectionTitle: {
    color: C.muted2,
    fontSize: 11,
    fontFamily: F.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: R.card,
    borderWidth: 1,
    borderColor: C.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: { backgroundColor: C.surface2 },
  rowLabel: { color: C.muted, fontSize: 15, fontFamily: F.medium },
  rowValue: { color: C.text, fontSize: 15, fontFamily: F.semiBold, maxWidth: '60%', textAlign: 'right' },
  divider: { height: 1, backgroundColor: C.line, marginHorizontal: 16 },
  rowChevron: { color: C.muted2, fontSize: 22 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
  },
  modalTitle: { color: C.text, fontSize: 18, fontFamily: F.extraBold, marginBottom: 4 },
  input: {
    backgroundColor: C.surface2,
    borderRadius: R.input,
    padding: 14,
    color: C.text,
    fontSize: 15,
    fontFamily: F.medium,
    borderWidth: 1,
    borderColor: C.line,
  },
  button: {
    backgroundColor: C.amber,
    borderRadius: R.btn,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#0f0e0d', fontFamily: F.bold, fontSize: 15 },
  cancelText: { color: C.muted2, textAlign: 'center', fontSize: 14, fontFamily: F.medium, paddingVertical: 8 },

});
