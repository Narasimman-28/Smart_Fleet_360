import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { NotificationItem } from '../types';
import { api } from '../services/api';

import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  runComplianceScan: () => Promise<void>;
  isScanning: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const refreshNotifications = useCallback(async () => {
    const savedToken = localStorage.getItem('smartfleet_token');
    if (!savedToken) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const res = await api.getNotifications();
      if (res?.notifications) {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      // Quiet fail if unauthenticated or network failure
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    refreshNotifications();
    // Periodic refresh every 30 seconds while authenticated
    const interval = setInterval(refreshNotifications, 30000);

    const handleLogout = () => {
      setNotifications([]);
      setUnreadCount(0);
    };

    window.addEventListener('smartfleet:logout', handleLogout);

    return () => {
      clearInterval(interval);
      window.removeEventListener('smartfleet:logout', handleLogout);
    };
  }, [isAuthenticated, token, refreshNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const runComplianceScan = async () => {
    setIsScanning(true);
    try {
      await api.evaluateCompliance();
      await refreshNotifications();
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      refreshNotifications,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      runComplianceScan,
      isScanning
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
