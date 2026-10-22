import React, { useEffect, useState } from 'react';
import {
  franchiseApplicantAuthService,
  type FranchiseApplicant,
} from '../services/franchiseApplicantAuthService';
import { FranchiseApplicantAuthContext } from './franchiseApplicantAuth';

export const FranchiseApplicantAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [applicant, setApplicant] = useState<FranchiseApplicant | null>(() => {
    if (franchiseApplicantAuthService.getToken()) return franchiseApplicantAuthService.getApplicant();
    franchiseApplicantAuthService.clearAuth();
    return null;
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const token = franchiseApplicantAuthService.getToken();
    if (!token) return;

    franchiseApplicantAuthService.getAuthenticatedApplicant()
      .then((verifiedApplicant) => {
        if (!active) return;
        if (franchiseApplicantAuthService.getToken() !== token) {
          setApplicant(null);
        } else if (verifiedApplicant) {
          setApplicant(verifiedApplicant);
        }
      })
      .catch((error: unknown) => {
        if (active) console.error('Unable to verify the cached applicant session.', error);
      });
    return () => {
      active = false;
    };
  }, []);

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
