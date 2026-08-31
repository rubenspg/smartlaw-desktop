import React, { createContext, useCallback, useContext, useState, useEffect } from 'react';
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

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('smartlaw_token', newToken);
    setToken(newToken);
    setUser(newUser);
  }, []);

  // Declarado antes do efeito que o utiliza: como `const`, referenciá-lo
  // acima da declaração dependia da ordem de execução em runtime.
  const logout = useCallback(() => {
    localStorage.removeItem('smartlaw_token');
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const checkAuth = async () => {
      try {
        const res = await api.auth.me.$get({}, { init: { signal: controller.signal } });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          // 401 significa token inválido ou conta desativada — encerra a sessão.
          logout();
        }
      } catch (err) {
        // Falha de rede ou timeout não derruba a sessão: pode ser transitório.
        if (!(err instanceof Error && err.name === 'AbortError')) {
          console.error('Auth check error:', err);
        }
      } finally {
        clearTimeout(timeoutId);
        setIsLoading(false);
      }
    };

    checkAuth();

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [token, logout]);

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
