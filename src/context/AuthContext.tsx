import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, SchoolYear, SystemCustomization, LoginCustomization, FooterCustomization } from '../types/index.ts';

interface AuthContextType {
  user: User | null;
  token: string | null;
  activeSchoolYear: SchoolYear | null;
  systemConfig: SystemCustomization | null;
  loginConfig: LoginCustomization | null;
  footerConfig: FooterCustomization | null;
  isLoading: boolean;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshCustomization: () => Promise<void>;
  apiFetch: (endpoint: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('sbm_token'));
  const [activeSchoolYear, setActiveSchoolYear] = useState<SchoolYear | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemCustomization | null>(null);
  const [loginConfig, setLoginConfig] = useState<LoginCustomization | null>(null);
  const [footerConfig, setFooterConfig] = useState<FooterCustomization | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Authenticated fetch wrapper
  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    const currentToken = token || localStorage.getItem('sbm_token');
    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(endpoint, {
      ...options,
      headers,
    });
  };

  const refreshCustomization = async () => {
    try {
      const res = await fetch('/api/customization/public');
      if (res.ok) {
        const data = await res.json();
        setSystemConfig(data.system);
        setLoginConfig(data.login);
        setFooterConfig(data.footer);
      }
    } catch (err) {
      console.error('Failed to load customization:', err);
    }
  };

  const refreshProfile = async () => {
    const currentToken = localStorage.getItem('sbm_token');
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setActiveSchoolYear(data.activeSchoolYear);
        setToken(currentToken);
      } else {
        localStorage.removeItem('sbm_token');
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshCustomization();
    refreshProfile();
  }, []);

  const login = async (newToken: string) => {
    localStorage.setItem('sbm_token', newToken);
    setToken(newToken);
    await refreshProfile();
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      // ignore
    }
    localStorage.removeItem('sbm_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeSchoolYear,
        systemConfig,
        loginConfig,
        footerConfig,
        isLoading,
        loading: isLoading,
        login,
        logout,
        refreshProfile,
        refreshCustomization,
        apiFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
