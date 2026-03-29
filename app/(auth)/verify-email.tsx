import { useAuth } from '@/context/AuthContext';
import { authService } from '@/services/auth';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VerifyEmailScreen() {
  const { user, logout } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleResend = async () => {
    if (!user?.email) return;

    setError('');
    setResendSuccess(false);
    setIsResending(true);

    try {
      await authService.resendVerification(user.email);
      setResendSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleDoneVerifying = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030014' }}>
      <View pointerEvents="none" style={{ position: 'absolute', top: -40, left: '50%', marginLeft: -120, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(109, 40, 217, 0.2)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 80, right: -60, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(79, 70, 229, 0.1)' }} />

      <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' }}>

        {/* Icon */}
        <View style={{
          width: 100, height: 100, borderRadius: 50,
          backgroundColor: 'rgba(139, 92, 246, 0.15)',
          borderWidth: 1.5, borderColor: 'rgba(139, 92, 246, 0.4)',
          alignItems: 'center', justifyContent: 'center',
          marginBottom: 32,
        }}>
          <Ionicons name="mail" size={46} color="#8B5CF6" />
        </View>

        {/* Heading */}
        <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 }}>
          Verify your email
        </Text>
        <Text style={{ color: '#6B7280', fontSize: 15, textAlign: 'center', marginTop: 12, lineHeight: 22, maxWidth: 300 }}>
          We sent a verification link to
        </Text>
        <View style={{
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8,
          marginTop: 8, marginBottom: 12,
        }}>
          <Text style={{ color: '#A78BFA', fontSize: 15, fontWeight: '600' }}>
            {user?.email ?? 'your email address'}
          </Text>
        </View>
        <Text style={{ color: '#6B7280', fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 300 }}>
          Click the link in the email to activate your account. Check your spam folder if you don't see it.
        </Text>

        {/* Error / success messages */}
        {error ? (
          <View style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
            borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
            marginTop: 20, width: '100%',
          }}>
            <Text style={{ color: '#F87171', fontSize: 13, textAlign: 'center' }}>{error}</Text>
          </View>
        ) : null}

        {resendSuccess ? (
          <View style={{
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)',
            borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
            marginTop: 20, width: '100%',
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
            <Text style={{ color: '#4ADE80', fontSize: 13 }}>Verification email sent!</Text>
          </View>
        ) : null}

        {/* Action buttons */}
        <View style={{ width: '100%', marginTop: 36, gap: 12 }}>
          <TouchableOpacity
            onPress={handleDoneVerifying}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#7C3AED',
              borderRadius: 14, height: 56,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35, shadowRadius: 16, elevation: 8,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
              I've verified my email
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleResend}
            disabled={isResending}
            activeOpacity={0.7}
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
              borderRadius: 14, height: 56,
              alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 8,
              opacity: isResending ? 0.6 : 1,
            }}
          >
            {isResending ? (
              <ActivityIndicator color="#9CA3AF" size="small" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color="#9CA3AF" />
                <Text style={{ color: '#9CA3AF', fontSize: 15, fontWeight: '500' }}>Resend email</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Back to login */}
        <TouchableOpacity
          onPress={handleDoneVerifying}
          hitSlop={8}
          style={{ marginTop: 24 }}
        >
          <Text style={{ color: '#6B7280', fontSize: 14 }}>
            Back to <Text style={{ color: '#8B5CF6', fontWeight: '500' }}>login</Text>
          </Text>
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}
