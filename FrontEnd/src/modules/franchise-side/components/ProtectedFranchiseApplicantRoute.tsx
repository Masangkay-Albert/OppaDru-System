import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useFranchiseApplicantAuth } from '../../../contexts/franchiseApplicantAuth';

const ProtectedFranchiseApplicantRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { applicant, isLoading } = useFranchiseApplicantAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--oppa-text-muted)]">Loading...</div>;
  }

  if (!applicant?.email_verified_at) {
    return <Navigate to="/franchise/applicant-access?returnTo=%2Ffranchise%2Fapply" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default ProtectedFranchiseApplicantRoute;
