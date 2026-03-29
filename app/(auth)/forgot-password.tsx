import { authService } from '@/services/auth';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await authService.forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#030014' }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: -60, left: '30%', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(109, 40, 217, 0.18)' }} />
        <View pointerEvents="none" style={{ position: 'absolute', bottom: 60, right: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(79, 70, 229, 0.1)' }} />

        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' }}>
          {/* Success icon */}
          <View style={{
            width: 100, height: 100, borderRadius: 50,
            backgroundColor: 'rgba(34, 197, 94, 0.12)',
            borderWidth: 1.5, borderColor: 'rgba(34, 197, 94, 0.35)',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 32,
          }}>
            <Ionicons name="checkmark-circle" size={52} color="#22C55E" />
          </View>

          <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 }}>
            Check your inbox
          </Text>
          <Text style={{ color: '#6B7280', fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 22, maxWidth: 300 }}>
            If an account exists for{' '}
            <Text style={{ color: '#A78BFA', fontWeight: '500' }}>{email}</Text>
            , you'll receive a password reset link shortly.
          </Text>

          <Text style={{ color: '#4B5563', fontSize: 13, textAlign: 'center', marginTop: 16, lineHeight: 20, maxWidth: 280 }}>
            Didn't receive it? Check your spam folder or try again in a few minutes.
          </Text>

          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#7C3AED',
              borderRadius: 14, height: 56, width: '100%',
              alignItems: 'center', justifyContent: 'center',
              marginTop: 40,
              shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Back to Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSubmitted(false)}
            hitSlop={8}
            style={{ marginTop: 20 }}
          >
            <Text style={{ color: '#6B7280', fontSize: 14 }}>
              Try a different <Text style={{ color: '#8B5CF6', fontWeight: '500' }}>email</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030014' }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: -40, right: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(109, 40, 217, 0.16)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 100, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(79, 70, 229, 0.1)' }} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24 }}>

          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={8}
            style={{ marginBottom: 36, width: 40 }}
          >
            <Ionicons name="arrow-back" size={24} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Icon */}
          <View style={{
            width: 72, height: 72, borderRadius: 22,
            backgroundColor: 'rgba(139, 92, 246, 0.15)',
            borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
          }}>
            <Ionicons name="key-outline" size={34} color="#8B5CF6" />
          </View>

          {/* Heading */}
          <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700', letterSpacing: -0.5 }}>
            Forgot password?
          </Text>
          <Text style={{ color: '#6B7280', fontSize: 15, marginTop: 10, lineHeight: 22 }}>
            No worries. Enter your email and we'll send you a reset link.
          </Text>

          <View style={{ marginTop: 36 }}>
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
            <Text style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 8, marginLeft: 2 }}>Email</Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
              borderRadius: 14, paddingHorizontal: 16, height: 56,
              marginBottom: 24,
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
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </View>

            {/* Submit button */}
            <TouchableOpacity
              onPress={handleSubmit}
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
                : <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Send Reset Link</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Back to login */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 28 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Ionicons name="arrow-back-outline" size={16} color="#8B5CF6" />
              <Text style={{ color: '#8B5CF6', fontSize: 14, fontWeight: '500' }}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
