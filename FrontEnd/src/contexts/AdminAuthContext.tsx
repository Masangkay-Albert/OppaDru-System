/* eslint-disable react-refresh/only-export-components */
// src/contexts/AdminAuthContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as adminAuthService from '../services/adminAuthService';
import type { AdminUser } from '../services/adminAuthService';

interface AdminAuthContextType {
  admin: AdminUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshAdmin: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
};

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasStoredSession] = useState(() => Boolean(adminAuthService.getStoredAdminToken()));
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    if (adminAuthService.getStoredAdminToken()) return adminAuthService.getCurrentAdmin();
    adminAuthService.removeCurrentAdmin();
    return null;
  });
  const [isLoading, setIsLoading] = useState(hasStoredSession);

  const refreshAdmin = useCallback(async () => {
    if (!adminAuthService.getStoredAdminToken()) {
      setAdmin(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentAdmin = await adminAuthService.apiGetCurrentAdmin();
      adminAuthService.setCurrentAdmin(currentAdmin);
      setAdmin((previousAdmin) => (
        previousAdmin?.id === currentAdmin.id
        && previousAdmin.fullName === currentAdmin.fullName
        && previousAdmin.email === currentAdmin.email
        && previousAdmin.role === currentAdmin.role
          ? previousAdmin
          : currentAdmin
      ));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown session refresh error.';
      if (message.includes('(401)')) {
        adminAuthService.removeCurrentAdmin();
        setAdmin(null);
      } else {
        console.error('Unable to refresh administrator permissions.', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!admin) return undefined;
    const initialTimeout = window.setTimeout(() => { void refreshAdmin(); }, 0);
    const intervalId = window.setInterval(() => { void refreshAdmin(); }, 30_000);
    const onFocus = () => { void refreshAdmin(); };
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(initialTimeout);
      window.removeEventListener('focus', onFocus);
    };
  }, [admin, refreshAdmin]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const res = await adminAuthService.apiAdminLogin(email, password);
      const rawAdmin = res.admin;
      const token = res.token;
      if (rawAdmin) {
        const normalizedAdmin: AdminUser = {
          id: String(rawAdmin.id ?? 'admin-001'),
          fullName: rawAdmin.full_name || rawAdmin.fullName || rawAdmin.name || email.split('@')[0] || 'Admin',
          email: rawAdmin.email || email,
          role: rawAdmin.role === 'system_administrator' ? 'system_administrator' : 'admin',
        };
        adminAuthService.setCurrentAdmin(normalizedAdmin);
        if (token) {
          adminAuthService.setStoredAdminToken(token);
          localStorage.setItem('adminToken', token);
        }
        setAdmin(normalizedAdmin);
        setIsLoading(false);
        return true;
      }
    } catch {
      setIsLoading(false);
      return false;
    }
    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setAdmin(null);
    adminAuthService.removeCurrentAdmin();
    localStorage.removeItem('adminToken');
  };

  return (
    <AdminAuthContext.Provider value={{ admin, isLoading, login, logout, refreshAdmin }}>
      {children}
    </AdminAuthContext.Provider>
  );
};
