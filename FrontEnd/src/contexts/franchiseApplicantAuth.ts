import { createContext, useContext } from 'react';
import type { FranchiseApplicant } from '../services/franchiseApplicantAuthService';

export interface FranchiseApplicantAuthContextValue {
  applicant: FranchiseApplicant | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const FranchiseApplicantAuthContext = createContext<FranchiseApplicantAuthContextValue | undefined>(undefined);

export const useFranchiseApplicantAuth = (): FranchiseApplicantAuthContextValue => {
  const context = useContext(FranchiseApplicantAuthContext);
  if (!context) {
    throw new Error('useFranchiseApplicantAuth must be used within FranchiseApplicantAuthProvider');
  }
  return context;
};
