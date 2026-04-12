import { authService, setTokenManager, TokenPair, TokenWithUser, UserResponse } from '@/services/auth';
import * as db from '@/services/database';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

interface AuthState {
  token: string | null;
  user: UserResponse | null;
  isLoading: boolean;
  isEmailVerified: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<TokenWithUser>;
  register: (email: string, password: string, displayName?: string) => Promise<TokenWithUser>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: { display_name?: string | null; email?: string }) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    isLoading: true,
    isEmailVerified: false,
  });

  const refreshTokenRef = useRef<string | null>(null);

  const saveTokens = async (accessToken: string, refreshToken: string, user: UserResponse) => {
    refreshTokenRef.current = refreshToken;
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);
  };

  const clearStorage = async () => {
    refreshTokenRef.current = null;
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
    // TODO - dev only. will be removed.
    try {
      await db.clearAllData();
    } catch {}
  };

  const logout = async () => {
    const refreshToken = refreshTokenRef.current;
    await clearStorage();
    setState({ token: null, user: null, isLoading: false, isEmailVerified: false });

    if (refreshToken) {
      authService.logout(refreshToken).catch(() => { });
    }
  };


  useEffect(() => {
    setTokenManager({
      getRefreshToken: () => refreshTokenRef.current,

      onTokensRefreshed: async (pair: TokenPair) => {
        refreshTokenRef.current = pair.refresh_token;
        const userJson = await SecureStore.getItemAsync(USER_KEY);
        const user = userJson ? (JSON.parse(userJson) as UserResponse) : state.user;
        await Promise.all([
          SecureStore.setItemAsync(ACCESS_TOKEN_KEY, pair.access_token),
          SecureStore.setItemAsync(REFRESH_TOKEN_KEY, pair.refresh_token),
        ]);
        setState(prev => ({ ...prev, token: pair.access_token }));
        if (user) setState(prev => ({ ...prev, user }));
      },

      onLogout: logout,
    });
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [accessToken, refreshToken, userJson] = await Promise.all([
          SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
          SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);

        if (accessToken && refreshToken && userJson) {
          const user = JSON.parse(userJson) as UserResponse;
          refreshTokenRef.current = refreshToken;
          setState({
            token: accessToken,
            user,
            isLoading: false,
            isEmailVerified: user.is_email_verified,
          });
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    await saveTokens(result.access_token, result.refresh_token, result.user);
    setState({
      token: result.access_token,
      user: result.user,
      isLoading: false,
      isEmailVerified: result.email_verified,
    });
    return result;
  };

  const register = async (email: string, password: string, displayName?: string) => {
    const result = await authService.register(email, password, displayName);
    await saveTokens(result.access_token, result.refresh_token, result.user);
    setState({
      token: result.access_token,
      user: result.user,
      isLoading: false,
      isEmailVerified: result.email_verified,
    });
    return result;
  };

  const refreshUser = async () => {
    if (!state.token) return;
    try {
      const user = await authService.me(state.token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
      setState(prev => ({ ...prev, user, isEmailVerified: user.is_email_verified }));
    } catch {
      // if we reach here the token is truly unrecoverable.
    }
  };

  const logoutAll = async () => {
    if (state.token) {
      await authService.logoutAll(state.token).catch(() => { });
    }
    await clearStorage();
    setState({ token: null, user: null, isLoading: false, isEmailVerified: false });
  };

  const updateProfile = async (data: { display_name?: string | null; email?: string }) => {
    if (!state.token) throw new Error('Not authenticated');
    const updated = await authService.updateProfile(state.token, data);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(updated));
    setState(prev => ({ ...prev, user: updated }));
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!state.token) throw new Error('Not authenticated');
    await authService.changePassword(state.token, currentPassword, newPassword);
    await clearStorage();
    setState({ token: null, user: null, isLoading: false, isEmailVerified: false });
  };

  const deleteAccount = async (password: string) => {
    if (!state.token) throw new Error('Not authenticated');
    await authService.deleteAccount(state.token, password);
    await clearStorage();
    setState({ token: null, user: null, isLoading: false, isEmailVerified: false });
  };

  return (
    <AuthContext.Provider value={{
      ...state,
      login, register, logout, logoutAll,
      refreshUser, updateProfile, changePassword, deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
