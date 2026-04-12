import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignupScreen() {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async () => {
    if (!email.trim() || !password || !confirmPassword) {
      setError('Please fill in all required fields');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await register(
        email.trim().toLowerCase(),
        password,
        displayName.trim() || undefined
      );
      if (!result.email_verified) {
        router.replace('/(auth)/verify-email');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = {
    flex: 1, color: '#FFFFFF' as const, marginLeft: 12, fontSize: 15,
  };

  const inputContainerStyle = {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14, paddingHorizontal: 16, height: 56,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030014' }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: -40, right: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(109, 40, 217, 0.16)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 120, left: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(79, 70, 229, 0.1)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 60, left: 20, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(124, 58, 237, 0.1)' }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 }}>

            {/* Back button */}
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={8}
              style={{ marginBottom: 24, width: 40 }}
            >
              <Ionicons name="arrow-back" size={24} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Heading */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 30, fontWeight: '700', letterSpacing: -0.5 }}>
                Create account
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 15, marginTop: 8 }}>
                Start your learning journey today
              </Text>
            </View>

            {/* Error banner */}
            {error ? (
              <View style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
                borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
                marginBottom: 20,
              }}>
                <Text style={{ color: '#F87171', fontSize: 13 }}>{error}</Text>
              </View>
            ) : null}

            {/* Display Name */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginLeft: 2 }}>
                <Text style={{ color: '#9CA3AF', fontSize: 13 }}>Display Name</Text>
                <Text style={{ color: '#4B5563', fontSize: 11, marginLeft: 6 }}>(optional)</Text>
              </View>
              <View style={inputContainerStyle}>
                <Ionicons name="person-outline" size={20} color="#6B7280" />
                <TextInput
                  style={inputStyle}
                  placeholder="John Doe"
                  placeholderTextColor="#4B5563"
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Email */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 8, marginLeft: 2 }}>Email</Text>
              <View style={inputContainerStyle}>
                <Ionicons name="mail-outline" size={20} color="#6B7280" />
                <TextInput
                  style={inputStyle}
                  placeholder="your@email.com"
                  placeholderTextColor="#4B5563"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 8, marginLeft: 2 }}>Password</Text>
              <View style={inputContainerStyle}>
                <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
                <TextInput
                  style={inputStyle}
                  placeholder="Min. 8 characters"
                  placeholderTextColor="#4B5563"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              {password.length > 0 && password.length < 6 && (
                <Text style={{ color: '#F87171', fontSize: 12, marginTop: 6, marginLeft: 2 }}>
                  Password is too short
                </Text>
              )}
            </View>

            {/* Confirm Password */}
            <View style={{ marginBottom: 8 }}>
              <Text style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 8, marginLeft: 2 }}>Confirm Password</Text>
              <View style={inputContainerStyle}>
                <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
                <TextInput
                  style={inputStyle}
                  placeholder="Re-enter password"
                  placeholderTextColor="#4B5563"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSignup}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(v => !v)} hitSlop={8}>
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Sign up button */}
            <TouchableOpacity
              onPress={handleSignup}
              disabled={isLoading}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#7C3AED',
                borderRadius: 14, height: 56,
                alignItems: 'center', justifyContent: 'center',
                marginTop: 24,
                shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Create Account</Text>
              }
            </TouchableOpacity>

            {/* Sign in link */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 28 }}>
              <Text style={{ color: '#6B7280', fontSize: 14 }}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')} hitSlop={8}>
                <Text style={{ color: '#8B5CF6', fontSize: 14, fontWeight: '600' }}>Sign in</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
