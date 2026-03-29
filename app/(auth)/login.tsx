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

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await login(email.trim().toLowerCase(), password);
      if (!result.email_verified) {
        router.replace('/(auth)/verify-email');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030014' }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: -60, left: -60, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(109, 40, 217, 0.18)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 40, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(79, 70, 229, 0.12)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 100, right: -80, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(109, 40, 217, 0.08)' }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 48, paddingBottom: 32 }}>

            {/* Logo & heading */}
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
              <View style={{
                width: 80, height: 80, borderRadius: 24,
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 24,
              }}>
                <Ionicons name="layers" size={38} color="#8B5CF6" />
              </View>
              <Text style={{ color: '#FFFFFF', fontSize: 32, fontWeight: '700', letterSpacing: -0.5 }}>
                Welcome back
              </Text>
              <Text style={{ color: '#6B7280', fontSize: 15, marginTop: 8 }}>
                Sign in to continue learning
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

            {/* Email field */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 8, marginLeft: 2 }}>Email</Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: 14, paddingHorizontal: 16, height: 56,
              }}>
                <Ionicons name="mail-outline" size={20} color="#6B7280" />
                <TextInput
                  style={{ flex: 1, color: '#FFFFFF', marginLeft: 12, fontSize: 15 }}
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

            {/* Password field */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 8, marginLeft: 2 }}>Password</Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                borderRadius: 14, paddingHorizontal: 16, height: 56,
              }}>
                <Ionicons name="lock-closed-outline" size={20} color="#6B7280" />
                <TextInput
                  style={{ flex: 1, color: '#FFFFFF', marginLeft: 12, fontSize: 15 }}
                  placeholder="••••••••"
                  placeholderTextColor="#4B5563"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot password */}
            <View style={{ alignItems: 'flex-end', marginBottom: 28 }}>
              <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} hitSlop={8}>
                <Text style={{ color: '#8B5CF6', fontSize: 13, fontWeight: '500' }}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            {/* Sign in button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#7C3AED',
                borderRadius: 14, height: 56,
                alignItems: 'center', justifyContent: 'center',
                shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Sign In</Text>
              }
            </TouchableOpacity>

            {/* Sign up link */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 32 }}>
              <Text style={{ color: '#6B7280', fontSize: 14 }}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/signup')} hitSlop={8}>
                <Text style={{ color: '#8B5CF6', fontSize: 14, fontWeight: '600' }}>Sign up</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
