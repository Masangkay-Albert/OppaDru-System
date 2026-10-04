import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as franchiseAuthService from '../services/franchiseAuthService';
import type { FranchiseUser } from '../services/franchiseAuthService';

interface FranchiseAuthContextType {
  franchiseUser: FranchiseUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const FranchiseAuthContext = createContext<FranchiseAuthContextType | undefined>(undefined);

export const useFranchiseAuth = () => {
  const context = useContext(FranchiseAuthContext);
  if (!context) {
    throw new Error('useFranchiseAuth must be used within FranchiseAuthProvider');
  }
  return context;
};

export const FranchiseAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [franchiseUser, setFranchiseUser] = useState<FranchiseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initializeFranchiseUser = useCallback(() => {
    const current = franchiseAuthService.getCurrentFranchiseUser();
    setFranchiseUser(current);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    initializeFranchiseUser();
  }, [initializeFranchiseUser]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);

    try {
      const response = await franchiseAuthService.apiFranchiseLogin(email, password);
      const rawUser = response.franchise_user ?? response.data ?? response.user;
      const token = response.token;

      if (!rawUser || !token) {
        return false;
      }

      const normalizedUser: FranchiseUser = {
        id: rawUser.id ?? rawUser.franchise_id ?? 'franchise-user-1',
        full_name: rawUser.full_name || rawUser.fullName || rawUser.name || rawUser.email?.split('@')[0] || 'Franchise Manager',
        email: rawUser.email || email,
        phone: rawUser.phone,
        franchise_id: rawUser.franchise_id,
        is_active: rawUser.is_active,
        can_process_pos: Boolean(rawUser.can_process_pos),
        franchise: rawUser.franchise,
        token,
      };

      franchiseAuthService.setCurrentFranchiseUser(normalizedUser);
      franchiseAuthService.setStoredFranchiseToken(token);
      setFranchiseUser(normalizedUser);
      return true;
    } catch {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setFranchiseUser(null);
    franchiseAuthService.removeCurrentFranchiseUser();
  };

  return (
    <FranchiseAuthContext.Provider value={{ franchiseUser, isLoading, login, logout }}>
      {children}
    </FranchiseAuthContext.Provider>
  );
};
