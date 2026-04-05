import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
const ACCESS_TOKEN_KEY = 'auth_access_token';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  _isRetry = false
): Promise<T> {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) ?? {}),
    },
    ...options,
  });

  if (response.status === 401 && !_isRetry) {
    try {
      const { attemptTokenRefresh, tokenManager } = require('./auth');
      const newAccessToken = await attemptTokenRefresh();
      return apiRequest<T>(
        endpoint,
        {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${newAccessToken}`,
          },
        },
        true
      );
    } catch {
      const { tokenManager } = require('./auth');
      await tokenManager?.onLogout();
      throw new Error('Session expired. Please sign in again.');
    }
  }

  if (!response.ok) {
    if (response.status === 204) return {} as T;

    let detail = 'An unexpected error occurred';
    try {
      const data = await response.json();
      if (data.detail) {
        detail = typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
      }
    } catch {}
    throw new Error(detail);
  }

  if (response.status === 204) return {} as T;

  return (await response.json()) as T;
}
