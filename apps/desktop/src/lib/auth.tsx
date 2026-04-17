import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@smartlaw/shared';
import { api } from './api';

interface AuthContextType {
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
        setIsLoading(false);
        return;
      }

      try {
        const res = await api.auth.me.$get();
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          logout();
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        // Don't logout on network error, but maybe show indicator
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
