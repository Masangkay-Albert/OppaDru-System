import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useFranchiseApplicantAuth } from '../../../contexts/franchiseApplicantAuth';
import { getMyFranchiseApplications } from '../../../services/franchiseApplicationService';

const ProtectedFranchiseApplicantRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { applicant, isLoading, authError } = useFranchiseApplicantAuth();
  const location = useLocation();
  const [checkingApplication, setCheckingApplication] = useState(location.pathname === '/franchise/apply');
  const [hasOpenApplication, setHasOpenApplication] = useState(false);
  const [applicationCheckError, setApplicationCheckError] = useState('');

  useEffect(() => {
    if (!applicant?.email_verified_at || location.pathname !== '/franchise/apply') {
      setCheckingApplication(false);
      setHasOpenApplication(false);
      setApplicationCheckError('');
      return;
    }

    let active = true;
    setCheckingApplication(true);
    setApplicationCheckError('');
    getMyFranchiseApplications()
      .then((applications) => {
        if (active) {
          setHasOpenApplication(applications.some((application) => !['rejected', 'withdrawn'].includes(application.status)));
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setApplicationCheckError(error instanceof Error ? error.message : 'Unable to check your existing franchise applications.');
        }
      })
      .finally(() => {
        if (active) setCheckingApplication(false);
      });

    return () => {
      active = false;
    };
  }, [applicant, location.pathname]);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--oppa-text-muted)]">Loading...</div>;
  }

  if (authError) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--oppa-cream)] p-5"><div role="alert" className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center text-sm text-red-700"><p>{authError}</p><button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-[var(--oppa-green)] px-4 py-2 font-semibold text-white">Try again</button></div></div>;
  }

  if (location.pathname === '/franchise/apply' && checkingApplication) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--oppa-text-muted)]">Checking your existing applications…</div>;
  }

  if (applicationCheckError) {
    return <div className="flex min-h-screen items-center justify-center bg-[var(--oppa-cream)] p-5"><div role="alert" className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center text-sm text-red-700"><p>{applicationCheckError}</p><button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-[var(--oppa-green)] px-4 py-2 font-semibold text-white">Try again</button></div></div>;
  }

  if (location.pathname === '/franchise/apply' && hasOpenApplication) {
    return <Navigate to="/franchise/my-applications" replace />;
  }

  if (!applicant?.email_verified_at) {
    const returnTo = location.pathname === '/franchise/my-applications' ? location.pathname : '/franchise/apply';
    return <Navigate to={`/franchise/applicant-login?returnTo=${encodeURIComponent(returnTo)}`} replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default ProtectedFranchiseApplicantRoute;
