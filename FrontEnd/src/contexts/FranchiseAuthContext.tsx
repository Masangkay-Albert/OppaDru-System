import React, { createContext, useContext, useEffect, useState } from 'react';
import * as franchiseAuthService from '../services/franchiseAuthService';
import type { FranchiseUser } from '../services/franchiseAuthService';

interface FranchiseAuthContextType {
  franchiseUser: FranchiseUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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
  const [franchiseUser, setFranchiseUser] = useState<FranchiseUser | null>(() => {
    if (franchiseAuthService.getStoredFranchiseToken()) return franchiseAuthService.getCurrentFranchiseUser();
    franchiseAuthService.removeCurrentFranchiseUser();
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const token = franchiseAuthService.getStoredFranchiseToken();
    if (!token) return;

    franchiseAuthService.getAuthenticatedFranchiseUser()
      .then((user) => {
        if (!active) return;
        if (franchiseAuthService.getStoredFranchiseToken() !== token) {
          setFranchiseUser(null);
        } else if (user) {
          setFranchiseUser(user);
          franchiseAuthService.setCurrentFranchiseUser(user);
        }
      })
      .catch((error: unknown) => {
        if (active) console.error('Unable to verify the cached franchise session.', error);
      });
    return () => { active = false; };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);

    try {
      const response = await franchiseAuthService.apiFranchiseLogin(email, password);
      const rawUser = response.franchise_user ?? response.data ?? response.user;

      if (!rawUser) {
        throw new Error('The franchise sign-in response was incomplete.');
      }
      if (typeof response.token !== 'string' || response.token.length === 0) {
        throw new Error('The franchise sign-in response did not include an authentication token.');
      }

      const normalizedUser: FranchiseUser = {
        id: rawUser.id ?? rawUser.franchise_id ?? 'franchise-user-1',
        full_name: rawUser.full_name || rawUser.fullName || rawUser.name || rawUser.email?.split('@')[0] || 'Franchise Manager',
        email: rawUser.email || email,
        phone: rawUser.phone,
        franchise_id: rawUser.franchise_id,
        is_active: rawUser.is_active,
        can_process_pos: Boolean(rawUser.can_process_pos),
        role: rawUser.role || 'owner',
        branch_id: rawUser.branch_id ?? rawUser.franchise_id,
        branch: rawUser.branch,
        franchise: rawUser.franchise,
        token: response.token,
      };

      franchiseAuthService.removeCurrentFranchiseUser();
      franchiseAuthService.setCurrentFranchiseUser(normalizedUser);
      franchiseAuthService.setStoredFranchiseToken(response.token);
      setFranchiseUser(normalizedUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await franchiseAuthService.apiFranchiseLogout();
    } finally {
      setFranchiseUser(null);
      franchiseAuthService.removeCurrentFranchiseUser();
    }
  };

  return (
    <FranchiseAuthContext.Provider value={{ franchiseUser, isLoading, login, logout }}>
      {children}
    </FranchiseAuthContext.Provider>
  );
};
