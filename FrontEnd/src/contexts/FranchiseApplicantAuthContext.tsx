import React, { useState } from 'react';
import {
  franchiseApplicantAuthService,
  type FranchiseApplicant,
} from '../services/franchiseApplicantAuthService';
import { FranchiseApplicantAuthContext } from './franchiseApplicantAuth';

export const FranchiseApplicantAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [applicant, setApplicant] = useState<FranchiseApplicant | null>(() => {
    const token = franchiseApplicantAuthService.getToken();
    const storedApplicant = franchiseApplicantAuthService.getApplicant();
    if (token && storedApplicant) return storedApplicant;
    franchiseApplicantAuthService.clearAuth();
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      setApplicant(await franchiseApplicantAuthService.login(email, password));
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await franchiseApplicantAuthService.logout();
    } finally {
      setApplicant(null);
    }
  };

  return (
    <FranchiseApplicantAuthContext.Provider value={{ applicant, isLoading, login, logout }}>
      {children}
    </FranchiseApplicantAuthContext.Provider>
  );
};
