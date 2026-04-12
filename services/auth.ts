const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export interface UserResponse {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
  last_sync_at: string | null;
  is_deleted: boolean;
  version: number;
  is_email_verified: boolean;
}

export interface TokenWithUser {
  access_token: string;
  refresh_token: string;
  token_type: string;
  email_verified: boolean;
  message: string | null;
  user: UserResponse;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

interface TokenManager {
  getRefreshToken: () => string | null;
  onTokensRefreshed: (pair: TokenPair) => Promise<void>;
  onLogout: () => Promise<void>;
}

export let tokenManager: TokenManager | null = null;

export function setTokenManager(manager: TokenManager) {
  tokenManager = manager;
}

let pendingRefresh: Promise<string> | null = null;

export async function attemptTokenRefresh(): Promise<string> {
  if (pendingRefresh) return pendingRefresh;

  pendingRefresh = (async () => {
    try {
      const raw = tokenManager?.getRefreshToken();
      if (!raw) throw new Error('no_refresh_token');

      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: raw }),
      });

      if (!res.ok) {
        await tokenManager?.onLogout();
        throw new Error('refresh_failed');
      }

      const pair: TokenPair = await res.json();
      await tokenManager?.onTokensRefreshed(pair);
      return pair.access_token;
    } finally {
      pendingRefresh = null;
    }
  })();

  return pendingRefresh;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  _isRetry = false
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (
    response.status === 401 &&
    !_isRetry &&
    tokenManager &&
    !endpoint.includes('/refresh') &&
    !endpoint.includes('/login') &&
    !endpoint.includes('/register')
  ) {
    try {
      const newAccessToken = await attemptTokenRefresh();
      return request<T>(
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
      throw new Error('Session expired. Please sign in again.');
    }
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail ?? 'An unexpected error occurred');
  }

  return data as T;
}


export const authService = {
  register: (email: string, password: string, displayName?: string) =>
    request<TokenWithUser>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name: displayName ?? null }),
    }),

  login: (email: string, password: string) =>
    request<TokenWithUser>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  refresh: (refreshToken: string) =>
    request<TokenPair>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  logout: (refreshToken: string) =>
    request<{ message: string }>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),

  me: (token: string) =>
    request<UserResponse>('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  resendVerification: (email: string) =>
    request<{ message: string }>(
      `/api/auth/resend-verification?email=${encodeURIComponent(email)}`,
      { method: 'POST' }
    ),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  updateProfile: (token: string, data: { display_name?: string | null; email?: string }) =>
    request<UserResponse>('/api/auth/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    }),

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),

  deleteAccount: (token: string, password: string) =>
    request<{ message: string }>(`/api/auth/me?password=${encodeURIComponent(password)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),

  logoutAll: (token: string) =>
    request<{ message: string }>('/api/auth/logout-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
};
