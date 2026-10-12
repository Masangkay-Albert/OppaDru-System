import React from 'react';
import { ArrowLeft, ArrowRight, BriefcaseBusiness, CheckCircle2, ClipboardCheck, LockKeyhole, UserPlus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useFranchiseApplicantAuth } from '../../../contexts/franchiseApplicantAuth';

const FranchiseApplicantAccessPage: React.FC = () => {
  const location = useLocation();
  const { applicant, isLoading } = useFranchiseApplicantAuth();
  const search = new URLSearchParams(location.search);
  const requestedReturnTo = search.get('returnTo');
  const returnTo = requestedReturnTo === '/franchise/my-applications'
    ? '/franchise/my-applications'
    : '/franchise/apply';
  const returnToQuery = `?returnTo=${encodeURIComponent(returnTo)}`;
  const verifiedApplicant = Boolean(applicant?.email_verified_at);
  const primaryActionClass = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--oppa-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] active:scale-[.99]';
  const secondaryActionClass = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--oppa-border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--oppa-text)] transition-colors hover:border-[var(--oppa-green)]/40 hover:bg-[var(--oppa-cream)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] active:scale-[.99]';

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--oppa-cream)] lg:grid lg:grid-cols-[.9fr_1.1fr]">
      <section className="relative isolate flex min-h-56 flex-col justify-between overflow-hidden bg-[var(--oppa-green)] px-6 py-7 text-white sm:min-h-64 sm:px-10 sm:py-9 lg:min-h-screen lg:px-14 lg:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full border border-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-44 -left-28 size-96 rounded-full border border-white/10" />
        <Link to="/franchise-opportunities" className="relative inline-flex min-h-9 w-fit items-center gap-2 rounded-md text-sm text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          <ArrowLeft size={16} aria-hidden="true" /> Back to opportunities
        </Link>
        <div className="relative my-8 max-w-xl lg:my-auto">
          <div className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white shadow-sm">
            <BriefcaseBusiness size={25} strokeWidth={1.7} aria-hidden="true" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[.2em] text-white/70">Oppa Dru · Franchise Partner Portal</p>
          <h2 className="mt-4 max-w-lg font-serif text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">Build your next opportunity with us.</h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-white/80 sm:text-base sm:leading-7">A clear path from your first application to a supported franchise launch.</p>
          <ul className="mt-8 space-y-4 text-sm text-white/90">
            <li className="flex items-center gap-3"><CheckCircle2 size={18} className="shrink-0 text-white/80" aria-hidden="true" /> Securely manage your application</li>
            <li className="flex items-center gap-3"><ClipboardCheck size={18} className="shrink-0 text-white/80" aria-hidden="true" /> Follow review steps and updates</li>
          </ul>
        </div>
        <p className="relative hidden text-xs text-white/60 lg:block">OPPA DRU KOREAN FRIED CHICKEN</p>
      </section>

      <section className="flex min-h-[34rem] items-center justify-center px-4 py-10 sm:px-8 lg:min-h-screen lg:px-12">
        <div className="w-full max-w-xl">
          <div className="mb-5 text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--oppa-green)]">Get started</p>
            <h1 className="mt-2 font-serif text-3xl font-bold leading-tight tracking-tight text-[var(--oppa-text)] sm:text-4xl">Access Your Franchise Application</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--oppa-text-muted)] sm:text-base sm:leading-7">
              Sign in or create an Oppa Dru account to apply for a franchise opportunity and manage your application. Track your application status, review required next steps, and stay updated throughout the evaluation process.
            </p>
          </div>

          <div className="rounded-3xl border border-[var(--oppa-border)] bg-white p-5 shadow-lg shadow-[var(--oppa-text)]/5 sm:p-7">
            <div className="mb-5 flex items-center gap-3 border-b border-[var(--oppa-border)] pb-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]">
                <BriefcaseBusiness size={19} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--oppa-text)]">{verifiedApplicant ? 'Welcome back' : 'Applicant account'}</p>
                <p className="mt-0.5 text-xs text-[var(--oppa-text-muted)]">{verifiedApplicant ? 'Continue where you left off.' : 'Your account keeps your application in one place.'}</p>
              </div>
            </div>

            {isLoading ? (
              <p role="status" className="py-4 text-sm text-[var(--oppa-text-muted)]">Checking your account…</p>
            ) : verifiedApplicant ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Link to="/franchise/apply" className={primaryActionClass}>Continue to application <ArrowRight size={17} aria-hidden="true" /></Link>
                <Link to="/franchise/my-applications" className={secondaryActionClass}>My Applications</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Link to={`/franchise/applicant-login${returnToQuery}`} className={primaryActionClass}><LockKeyhole size={17} strokeWidth={1.8} aria-hidden="true" /> Sign in</Link>
                <Link to={`/franchise/applicant-register${returnToQuery}`} className={secondaryActionClass}><UserPlus size={17} strokeWidth={1.8} aria-hidden="true" /> Create an account</Link>
              </div>
            )}
          </div>
          <p className="mt-5 text-center text-xs leading-5 text-[var(--oppa-text-muted)]">Your application details are available only after signing in to your verified account.</p>
        </div>
      </section>
    </main>
  );
};

export default FranchiseApplicantAccessPage;
