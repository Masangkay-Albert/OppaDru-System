import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useFranchiseApplicantAuth } from '../../../contexts/franchiseApplicantAuth';
import { getMyFranchiseApplications } from '../../../services/franchiseApplicationService';

const ProtectedFranchiseApplicantRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { applicant, isLoading } = useFranchiseApplicantAuth();
  const location = useLocation();
  const [retryCount, setRetryCount] = useState(0);
  const [applicationCheck, setApplicationCheck] = useState<{
    locationKey: string;
    hasOpenApplication: boolean;
    error?: string;
  } | null>(null);
  const isApplyRoute = location.pathname === '/franchise/apply';
  const hasCurrentCheck = applicationCheck?.locationKey === location.key;
  const checkingApplication = isApplyRoute && !!applicant?.email_verified_at && !hasCurrentCheck;

  useEffect(() => {
    if (!applicant?.email_verified_at || !isApplyRoute) return;

    let active = true;
    getMyFranchiseApplications()
      .then((applications) => {
        if (active) {
          setApplicationCheck({
            locationKey: location.key,
            hasOpenApplication: applications.some((application) => !['rejected', 'withdrawn'].includes(application.status)),
          });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setApplicationCheck({
            locationKey: location.key,
            hasOpenApplication: false,
            error: error instanceof Error ? error.message : 'Unable to check your existing franchise applications.',
          });
        }
      })

    return () => {
      active = false;
    };
  }, [applicant, isApplyRoute, location.key, retryCount]);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-[var(--oppa-text-muted)]">Loading...</div>;
  }

  if (isApplyRoute && hasCurrentCheck && applicationCheck?.hasOpenApplication) {
    return <Navigate to="/franchise/my-applications" replace />;
  }

  if (!applicant?.email_verified_at) {
    const returnTo = location.pathname === '/franchise/my-applications' ? location.pathname : '/franchise/apply';
    return <Navigate to={`/franchise/applicant-login?returnTo=${encodeURIComponent(returnTo)}`} replace state={{ from: location }} />;
  }

  return (
    <>
      {isApplyRoute && checkingApplication && (
        <p role="status" aria-live="polite" className="mx-auto max-w-7xl px-5 pt-3 text-xs text-[var(--oppa-text-muted)]">
          Checking your existing applications…
        </p>
      )}
      {isApplyRoute && hasCurrentCheck && applicationCheck?.error && (
        <div role="alert" className="mx-auto mt-3 flex max-w-7xl flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>We couldn’t verify existing applications. The server will prevent duplicate submissions.</span>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="font-semibold underline">
            Try again
          </button>
        </div>
      )}
      {children}
    </>
  );
};

export default ProtectedFranchiseApplicantRoute;
