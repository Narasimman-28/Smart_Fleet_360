import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
  isImpersonating: boolean;
  logoutMessage: string | null;
  clearLogoutMessage: () => void;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: {
    name?: string;
    phone?: string;
    mobile?: string;
    avatar_url?: string;
    profileImage?: string;
    currentPassword?: string;
    newPassword?: string;
    role?: string;
  }) => Promise<void>;
  switchRole: (role: string) => Promise<void>;
  restoreSuperAdmin: () => Promise<void>;
  hasPermission: (allowedRoles: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('smartfleet_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [logoutMessage, setLogoutMessage] = useState<string | null>(null);

  // Authenticate session on initial mount / reload
  useEffect(() => {
    let isMounted = true;
    const initializeAuth = async () => {
      const savedToken = localStorage.getItem('smartfleet_token');
      if (!savedToken) {
        if (isMounted) {
          setToken(null);
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      try {
        const res = await api.getMe();
        if (isMounted) {
          if (res?.user) {
            setUser(res.user);
            setToken(savedToken);
          } else {
            localStorage.removeItem('smartfleet_token');
            sessionStorage.removeItem('smartfleet_token');
            setToken(null);
            setUser(null);
          }
        }
      } catch (err) {
        console.warn('Session verification failed, clearing auth session:', err);
        if (isMounted) {
          localStorage.removeItem('smartfleet_token');
          sessionStorage.removeItem('smartfleet_token');
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for unauthorized 401 event dispatched by API client
    const handleUnauthorized = () => {
      if (isMounted) {
        localStorage.removeItem('smartfleet_token');
        sessionStorage.removeItem('smartfleet_token');
        setToken(null);
        setUser(null);
        setLogoutMessage('Your session has expired. Please sign in again.');
      }
    };

    window.addEventListener('smartfleet:unauthorized', handleUnauthorized);

    return () => {
      isMounted = false;
      window.removeEventListener('smartfleet:unauthorized', handleUnauthorized);
    };
  }, []);

  const clearLogoutMessage = () => {
    setLogoutMessage(null);
  };

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    setLogoutMessage(null);
    try {
      const res = await api.login({ email, password: pass });
      if (res?.token && res?.user) {
        localStorage.setItem('smartfleet_token', res.token);
        setToken(res.token);
        setUser(res.user);
      } else {
        throw new Error('Invalid authentication response from server.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await api.logout().catch(() => {});
      }
    } finally {
      localStorage.removeItem('smartfleet_token');
      sessionStorage.removeItem('smartfleet_token');
      setToken(null);
      setUser(null);
      setLogoutMessage('Logged out successfully.');
      window.dispatchEvent(new CustomEvent('smartfleet:logout'));
    }
  };

  const updateUserProfile = async (data: {
    name?: string;
    phone?: string;
    mobile?: string;
    avatar_url?: string;
    profileImage?: string;
    currentPassword?: string;
    newPassword?: string;
    role?: string;
  }) => {
    const res = await api.updateProfile(data);
    if (res?.user) {
      setUser(res.user);
    }
  };

  const switchRole = async (role: string) => {
    try {
      const res = await api.switchRole(role);
      if (res?.user && res?.token) {
        setUser(res.user);
        setToken(res.token);
        localStorage.setItem('smartfleet_token', res.token);
      }
    } catch (err) {
      console.error('Role switch failed:', err);
      throw err;
    }
  };

  const restoreSuperAdmin = async () => {
    await switchRole('Super Admin');
  };

  const isSuperAdmin = Boolean(
    user && (user.actualRole === 'Super Admin' || user.role === 'Super Admin')
  );

  const isImpersonating = Boolean(
    user && user.actualRole === 'Super Admin' && user.role !== 'Super Admin'
  );

  const hasPermission = (allowedRoles: string[]) => {
    if (!user) return false;
    if (user.role === 'Super Admin') return true;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        isSuperAdmin,
        isImpersonating,
        logoutMessage,
        clearLogoutMessage,
        login,
        logout,
        updateUserProfile,
        switchRole,
        restoreSuperAdmin,
        hasPermission
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthContext;
