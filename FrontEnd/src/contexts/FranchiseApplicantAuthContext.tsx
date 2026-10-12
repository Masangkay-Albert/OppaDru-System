import React, { useEffect, useState } from 'react';
import {
  franchiseApplicantAuthService,
  type FranchiseApplicant,
} from '../services/franchiseApplicantAuthService';
import { FranchiseApplicantAuthContext } from './franchiseApplicantAuth';

export const FranchiseApplicantAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [applicant, setApplicant] = useState<FranchiseApplicant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let active = true;
    franchiseApplicantAuthService.getAuthenticatedApplicant()
      .then((verifiedApplicant) => {
        if (active) setApplicant(verifiedApplicant);
      })
      .catch((error: unknown) => {
        if (active) {
          setAuthError(error instanceof Error ? error.message : 'Unable to verify your applicant sign-in.');
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    setAuthError('');
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
      setAuthError('');
    }
  };

  return (
    <FranchiseApplicantAuthContext.Provider value={{ applicant, isLoading, authError, login, logout }}>
      {children}
    </FranchiseApplicantAuthContext.Provider>
  );
};
