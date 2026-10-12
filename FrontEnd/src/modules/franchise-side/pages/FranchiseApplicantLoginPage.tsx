import React, { useState } from 'react';
import { BriefcaseBusiness, Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LoginBrandPanel from '../../../components/LoginBrandPanel';
import { useFranchiseApplicantAuth } from '../../../contexts/franchiseApplicantAuth';
import { franchiseApplicantAuthService } from '../../../services/franchiseApplicantAuthService';

const FranchiseApplicantLoginPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useFranchiseApplicantAuth();
  const search = new URLSearchParams(location.search);
  const requestedReturnTo = search.get('returnTo');
  const returnTo = requestedReturnTo === '/franchise/apply' || requestedReturnTo === '/franchise/my-applications'
    ? requestedReturnTo
    : '/franchise/apply';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const isVerificationError = error === 'Please verify your email address before logging in.';
  const registeredMessage = search.get('registered') === '1'
    ? 'Account created. Check your email to verify your account before signing in.'
    : search.get('verified') === '1'
      ? 'Email verified. You can now sign in.'
      : '';
  const signOutError = typeof location.state === 'object' && location.state !== null
    && 'signOutError' in location.state && typeof location.state.signOutError === 'string'
    ? location.state.signOutError
    : '';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setResendMessage('');
    setIsLoading(true);
    try {
      await login(email, password);
      navigate(returnTo, { replace: true });
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setIsResending(true);
    setResendMessage('');
    try {
      setResendMessage(await franchiseApplicantAuthService.resendVerification(email));
    } catch (resendError: unknown) {
      setResendMessage(resendError instanceof Error ? resendError.message : 'Unable to resend the verification email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] text-[var(--oppa-text)] lg:grid lg:grid-cols-2">
      <LoginBrandPanel title="Franchise Applicant Portal" description="Track your application status, next steps, and interview updates." />

      <main className="relative flex min-h-screen items-center justify-center px-5 py-8 sm:px-10 lg:px-12">
        <div className="w-full max-w-[430px] rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm sm:p-7">
          <header className="mb-6 text-center sm:mb-7">
            <div className="mb-4 flex items-center justify-center gap-2.5 text-[var(--oppa-green)]">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--oppa-green-soft)]">
                <BriefcaseBusiness className="size-5" aria-hidden="true" />
              </span>
              <span className="text-xl font-semibold">Oppa Dru</span>
            </div>
            <h1 className="mb-1.5 font-serif text-3xl font-semibold text-[var(--oppa-green)]">Franchise Applicant Portal</h1>
            <p className="text-sm text-[var(--oppa-text-muted)]">Sign in to view and manage your application</p>
          </header>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700" role="alert" aria-live="assertive">
              {error}
              {isVerificationError && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={!email || isResending}
                  className="mt-2 block font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                >
                  {isResending ? 'Sending…' : 'Resend verification email'}
                </button>
              )}
            </div>
          )}

          {registeredMessage && <p role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3.5 text-sm text-green-800">{registeredMessage}</p>}
          {signOutError && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">{signOutError} Your local session was cleared; sign in again to continue.</p>}
          {resendMessage && <p role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3.5 text-sm text-green-800">{resendMessage}</p>}

          <form onSubmit={handleSubmit} aria-busy={isLoading} className="space-y-4">
            <label htmlFor="franchise-applicant-email" className="block text-sm font-medium text-[var(--oppa-green)]">
              Email Address
              <span className="relative mt-1.5 block">
                <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="franchise-applicant-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(error)}
                  className="min-h-11 w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20"
                  placeholder="you@example.com"
                />
              </span>
            </label>

            <label htmlFor="franchise-applicant-password" className="block text-sm font-medium text-[var(--oppa-green)]">
              Password
              <span className="relative mt-1.5 block">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="franchise-applicant-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={Boolean(error)}
                  className="min-h-11 w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-12 text-sm placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:text-[var(--oppa-green)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--oppa-green)]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            <button type="submit" disabled={isLoading} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--oppa-green)] py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:cursor-not-allowed disabled:opacity-60">
              <LogIn size={16} aria-hidden="true" />{isLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-[var(--oppa-text-muted)]">
            Don&apos;t have an account?{' '}
            <Link to={`/franchise/applicant-register?returnTo=${encodeURIComponent(returnTo)}`} className="font-semibold text-[var(--oppa-green)] hover:underline">Create account</Link>
          </p>

        </div>
      </main>
    </div>
  );
};

export default FranchiseApplicantLoginPage;
