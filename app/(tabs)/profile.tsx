import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function Sheet({
  visible, title, onClose, children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY          = useRef(new Animated.Value(600)).current;

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1, duration: 180, useNativeDriver: true,
        }),
        Animated.spring(sheetY, {
          toValue: 0, damping: 22, stiffness: 280, mass: 0.7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0, duration: 140, useNativeDriver: true,
        }),
        Animated.timing(sheetY, {
          toValue: 600, duration: 180, useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            opacity: backdropOpacity,
          }}
        >
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={{ flex: 1 }} />
          </TouchableWithoutFeedback>
        </Animated.View>

        <View style={{ flex: 1 }} pointerEvents="none" />

        <Animated.View style={{ transform: [{ translateY: sheetY }] }}>
          <View style={{
            backgroundColor: colors.sheetBg,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            borderWidth: 1, borderColor: colors.surfaceBorder,
            paddingHorizontal: 24, paddingTop: 16, paddingBottom: 36,
          }}>
            <View style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: colors.divider,
              alignSelf: 'center', marginBottom: 20,
            }} />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 24 }}>
              {title}
            </Text>
            {children}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}


function SheetInput({
  label, value, onChangeText, placeholder, secure, keyboardType, autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  secure?: boolean;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'words';
}) {
  const { colors } = useTheme();
  const [show, setShow] = useState(false);
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8, marginLeft: 2 }}>{label}</Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.inputBg,
        borderWidth: 1, borderColor: colors.inputBorder,
        borderRadius: 14, paddingHorizontal: 16, height: 52,
      }}>
        <TextInput
          style={{ flex: 1, color: colors.text, fontSize: 15 }}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && !show}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'none'}
          autoCorrect={false}
        />
        {secure && (
          <TouchableOpacity onPress={() => setShow(v => !v)} hitSlop={8}>
            <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function PrimaryBtn({
  label, onPress, loading, danger,
}: {
  label: string; onPress: () => void; loading?: boolean; danger?: boolean;
}) {
  const { colors } = useTheme();
  const bg = danger ? '#DC2626' : colors.accent;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
      style={{
        backgroundColor: bg, borderRadius: 14, height: 52,
        alignItems: 'center', justifyContent: 'center', marginTop: 8,
        shadowColor: bg, shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading
        ? <ActivityIndicator color="#fff" />
        : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{label}</Text>
      }
    </TouchableOpacity>
  );
}


function Row({
  icon, label, value, onPress, danger, right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16 }}>
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: danger ? colors.dangerIconBg : colors.rowIconBg,
        alignItems: 'center', justifyContent: 'center', marginRight: 14,
      }}>
        <Ionicons name={icon} size={18} color={danger ? '#F87171' : colors.accentLight} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? '#F87171' : colors.text, fontSize: 15, fontWeight: '500' }}>{label}</Text>
        {value ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 1 }}>{value}</Text> : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={16} color={danger ? '#F87171' : colors.textMuted} />}
    </View>
  );

  if (!onPress) return content;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {content}
    </TouchableOpacity>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.divider, marginHorizontal: 16 }} />;
}

function SectionCard({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{
      backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.surfaceBorder,
      borderRadius: 18, overflow: 'hidden', marginBottom: 16,
    }}>
      {children}
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{
      color: colors.sectionLabel, fontSize: 11, fontWeight: '700',
      letterSpacing: 0.9, textTransform: 'uppercase',
      marginBottom: 8, marginLeft: 4,
    }}>
      {label}
    </Text>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <View style={{
      backgroundColor: 'rgba(239,68,68,0.1)',
      borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
      borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
    }}>
      <Text style={{ color: '#F87171', fontSize: 13 }}>{msg}</Text>
    </View>
  );
}


export default function ProfileScreen() {
  const { user, logout, logoutAll, updateProfile, changePassword, deleteAccount } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();

  const [showName, setShowName]         = useState(false);
  const [showEmail, setShowEmail]       = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showDelete, setShowDelete]     = useState(false);

  const [nameVal, setNameVal]   = useState('');
  const [emailVal, setEmailVal] = useState('');
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');
  const [deletePw, setDeletePw]     = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const initials = user?.display_name
    ? user.display_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() ?? '??';

  function openSheet(sheet: 'name' | 'email' | 'password' | 'delete') {
    setError('');
    if (sheet === 'name')     { setNameVal(user?.display_name ?? '');  setShowName(true); }
    if (sheet === 'email')    { setEmailVal(user?.email ?? '');         setShowEmail(true); }
    if (sheet === 'password') { setCurrentPw(''); setNewPw(''); setConfirmPw(''); setShowPassword(true); }
    if (sheet === 'delete')   { setDeletePw('');                        setShowDelete(true); }
  }

  async function saveName() {
    setSaving(true); setError('');
    try {
      await updateProfile({ display_name: nameVal.trim() || null });
      setShowName(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally { setSaving(false); }
  }

  async function saveEmail() {
    if (!emailVal.trim()) { setError('Email cannot be empty'); return; }
    setSaving(true); setError('');
    try {
      await updateProfile({ email: emailVal.trim().toLowerCase() });
      setShowEmail(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('verify') || msg.includes('403')) {
        setShowEmail(false);
        Alert.alert('Verify your new email', 'Check your inbox for a verification link, then sign in again.');
      } else {
        setError(msg || 'Failed to update email');
      }
    } finally { setSaving(false); }
  }

  async function savePassword() {
    if (!currentPw || !newPw || !confirmPw) { setError('All fields are required'); return; }
    if (newPw !== confirmPw)                { setError('New passwords do not match'); return; }
    if (newPw.length < 6)                  { setError('Password must be at least 6 characters'); return; }
    setSaving(true); setError('');
    try {
      await changePassword(currentPw, newPw);
      setShowPassword(false);
      Alert.alert('Password changed', 'You have been signed out from all devices.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to change password');
    } finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deletePw) { setError('Enter your password to confirm'); return; }
    setSaving(true); setError('');
    try {
      await deleteAccount(deletePw);
      setShowDelete(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete account');
    } finally { setSaving(false); }
  }

  function handleLogout() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  }

  function handleLogoutAll() {
    Alert.alert('Sign out everywhere', 'This will sign you out from all devices.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out all', style: 'destructive', onPress: logoutAll },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Background glows */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -60, right: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: isDark ? 'rgba(109,40,217,0.15)' : 'rgba(139,92,246,0.07)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 80, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: isDark ? 'rgba(79,70,229,0.1)' : 'rgba(99,102,241,0.05)' }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* ── Avatar / header ── */}
        <View style={{ alignItems: 'center', paddingTop: 32, paddingBottom: 28 }}>
          <View style={{
            width: 88, height: 88, borderRadius: 44,
            backgroundColor: colors.accentSoft,
            borderWidth: 2, borderColor: colors.accentBorder,
            alignItems: 'center', justifyContent: 'center', marginBottom: 14,
          }}>
            <Text style={{ color: colors.accentLight, fontSize: 30, fontWeight: '700' }}>{initials}</Text>
          </View>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}>
            {user?.display_name ?? 'No name set'}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>{user?.email}</Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
            backgroundColor: 'rgba(34,197,94,0.1)',
            borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
            borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
          }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' }} />
            <Text style={{ color: '#4ADE80', fontSize: 12, fontWeight: '600' }}>Verified</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16 }}>

          {/* ── Account ── */}
          <SectionLabel label="Account" />
          <SectionCard>
            <Row icon="person-outline"      label="Display Name"   value={user?.display_name ?? 'Not set'} onPress={() => openSheet('name')} />
            <Divider />
            <Row icon="mail-outline"        label="Email Address"  value={user?.email}                     onPress={() => openSheet('email')} />
            <Divider />
            <Row icon="lock-closed-outline" label="Change Password"                                         onPress={() => openSheet('password')} />
          </SectionCard>

          {/* ── Appearance ── */}
          <SectionLabel label="Appearance" />
          <SectionCard>
            <Row
              icon={isDark ? 'moon' : 'sunny'}
              label={isDark ? 'Dark Mode' : 'Light Mode'}
              right={
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: isDark ? '#374151' : '#D1D5DB', true: 'rgba(139,92,246,0.5)' }}
                  thumbColor={isDark ? colors.accentLight : '#fff'}
                  ios_backgroundColor={isDark ? '#374151' : '#D1D5DB'}
                />
              }
            />
          </SectionCard>

          {/* ── Sessions ── */}
          <SectionLabel label="Sessions" />
          <SectionCard>
            <Row icon="log-out-outline"        label="Sign Out"             onPress={handleLogout} />
            <Divider />
            <Row icon="phone-portrait-outline" label="Sign Out All Devices" onPress={handleLogoutAll} />
          </SectionCard>

          {/* ── Danger zone ── */}
          <SectionLabel label="Danger Zone" />
          <SectionCard>
            <Row icon="trash-outline" label="Delete Account" onPress={() => openSheet('delete')} danger />
          </SectionCard>

        </View>
      </ScrollView>

      {/* ── Edit Display Name ── */}
      <Sheet visible={showName} title="Display Name" onClose={() => setShowName(false)}>
        <ErrorBanner msg={error} />
        <SheetInput label="Name" value={nameVal} onChangeText={setNameVal} placeholder="Your name" autoCapitalize="words" />
        <PrimaryBtn label="Save" onPress={saveName} loading={saving} />
      </Sheet>

      {/* ── Edit Email ── */}
      <Sheet visible={showEmail} title="Email Address" onClose={() => setShowEmail(false)}>
        <ErrorBanner msg={error} />
        <View style={{
          flexDirection: 'row', alignItems: 'flex-start', gap: 10,
          backgroundColor: 'rgba(245,158,11,0.08)',
          borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)',
          borderRadius: 12, padding: 12, marginBottom: 16,
        }}>
          <Ionicons name="warning-outline" size={16} color="#FBBF24" style={{ marginTop: 1 }} />
          <Text style={{ color: '#FCD34D', fontSize: 13, flex: 1, lineHeight: 18 }}>
            Changing your email requires re-verification. You'll be signed out after saving.
          </Text>
        </View>
        <SheetInput label="New Email" value={emailVal} onChangeText={setEmailVal} placeholder="new@email.com" keyboardType="email-address" />
        <PrimaryBtn label="Save & Re-verify" onPress={saveEmail} loading={saving} />
      </Sheet>

      {/* ── Change Password ── */}
      <Sheet visible={showPassword} title="Change Password" onClose={() => setShowPassword(false)}>
        <ErrorBanner msg={error} />
        <SheetInput label="Current Password"     value={currentPw}  onChangeText={setCurrentPw}  placeholder="••••••••" secure />
        <SheetInput label="New Password"         value={newPw}      onChangeText={setNewPw}      placeholder="Min. 6 characters" secure />
        <SheetInput label="Confirm New Password" value={confirmPw}  onChangeText={setConfirmPw}  placeholder="Re-enter new password" secure />
        <PrimaryBtn label="Update Password" onPress={savePassword} loading={saving} />
      </Sheet>

      {/* ── Delete Account ── */}
      <Sheet visible={showDelete} title="Delete Account" onClose={() => setShowDelete(false)}>
        <ErrorBanner msg={error} />
        <View style={{
          flexDirection: 'row', alignItems: 'flex-start', gap: 10,
          backgroundColor: 'rgba(220,38,38,0.08)',
          borderWidth: 1, borderColor: 'rgba(220,38,38,0.25)',
          borderRadius: 12, padding: 12, marginBottom: 16,
        }}>
          <Ionicons name="alert-circle-outline" size={16} color="#F87171" style={{ marginTop: 1 }} />
          <Text style={{ color: '#FCA5A5', fontSize: 13, flex: 1, lineHeight: 18 }}>
            This permanently deletes your account and all data. This cannot be undone.
          </Text>
        </View>
        <SheetInput label="Confirm Password" value={deletePw} onChangeText={setDeletePw} placeholder="Enter your password" secure />
        <PrimaryBtn label="Delete My Account" onPress={confirmDelete} loading={saving} danger />
      </Sheet>

    </SafeAreaView>
  );
}
