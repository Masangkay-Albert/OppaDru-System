// src/contexts/AdminAuthContext.tsx
import React, { createContext, useContext, useState } from 'react';
import * as adminAuthService from '../services/adminAuthService';
import type { AdminUser } from '../services/adminAuthService';

interface AdminAuthContextType {
  admin: AdminUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
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
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    if (adminAuthService.getStoredAdminToken()) return adminAuthService.getCurrentAdmin();
    adminAuthService.removeCurrentAdmin();
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);

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
          role: 'admin',
        };
        const adminWithToken = token ? { ...normalizedAdmin, token } : normalizedAdmin;
        adminAuthService.setCurrentAdmin(adminWithToken as any);
        if (token) {
          adminAuthService.setStoredAdminToken(token);
          localStorage.setItem('adminToken', token);
        }
        setAdmin(normalizedAdmin);
        setIsLoading(false);
        return true;
      }
    } catch (err) {
      // fallthrough
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
    <AdminAuthContext.Provider value={{ admin, isLoading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
};
