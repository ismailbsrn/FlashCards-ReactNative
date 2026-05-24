import { Stack, Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import './globals.css';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { LanguageProvider } from '@/context/LanguageContext';

function RootLayoutNav() {
  const { token, isLoading, isEmailVerified } = useAuth();
  const { isDark, colors } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!token) {
    return (
      <>
        <StatusBar style="light" />
        <Redirect href="/(auth)/login" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="collection/[id]" />
          <Stack.Screen name="card-editor" />
          <Stack.Screen name="study-select" />
          <Stack.Screen name="study-session" />
        </Stack>
      </>
    );
  }

  if (!isEmailVerified) {
    return (
      <>
        <StatusBar style="light" />
        <Redirect href="/(auth)/verify-email" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="collection/[id]" />
          <Stack.Screen name="card-editor" />
          <Stack.Screen name="study-select" />
          <Stack.Screen name="study-session" />
        </Stack>
      </>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="collection/[id]" />
        <Stack.Screen name="card-editor" />
        <Stack.Screen name="study-select" />
        <Stack.Screen name="study-session" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutNav />
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
