import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@smartlaw/shared';
import { api } from './api';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('smartlaw_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        console.log('No token found, skipping auth check');
        setIsLoading(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        console.log('Checking auth with token...');
        const res = await api.auth.me.$get({}, { init: { signal: controller.signal } });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const data = await res.json();
          console.log('Auth check successful:', data.user.email);
          setUser(data.user);
        } else {
          console.warn('Auth check failed with status:', res.status);
          logout();
        }
      } catch (err) {
        console.error('Auth check error:', err);
        // On network error or timeout, we should probably still stop loading
        // but maybe not logout immediately if it's just a transient network issue
        if (err instanceof Error && err.name === 'AbortError') {
           console.error('Auth check timed out');
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('smartlaw_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('smartlaw_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isLoading,
        isAuthenticated: !!token && !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
