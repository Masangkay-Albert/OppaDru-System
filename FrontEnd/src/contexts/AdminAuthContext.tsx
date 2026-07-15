// src/contexts/AdminAuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initializeAdmin = useCallback(() => {
    const current = adminAuthService.getCurrentAdmin();
    if (current) setAdmin(current);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    initializeAdmin();
  }, [initializeAdmin]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    const validAdmin = adminAuthService.validateAdminCredentials(email, password);
    if (validAdmin) {
      setAdmin(validAdmin);
      adminAuthService.setCurrentAdmin(validAdmin);
      setIsLoading(false);
      return true;
    }
    setIsLoading(false);
    return false;
  };

  const logout = () => {
    setAdmin(null);
    adminAuthService.removeCurrentAdmin();
  };

  return (
    <AdminAuthContext.Provider value={{ admin, isLoading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
};
