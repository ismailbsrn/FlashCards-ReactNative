import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function AuthLayout() {
  const { token, isLoading, isEmailVerified } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#030014', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#8B5CF6" size="large" />
      </View>
    );
  }

  if (token && isEmailVerified) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
  );
}
