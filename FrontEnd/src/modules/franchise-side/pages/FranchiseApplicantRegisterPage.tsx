import React, { useRef, useState } from 'react';
import { ArrowLeft, BriefcaseBusiness, Eye, EyeOff, Lock, Mail, Phone, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LoginBrandPanel from '../../../components/LoginBrandPanel';
import { franchiseApplicantAuthService } from '../../../services/franchiseApplicantAuthService';
import { INPUT_LIMITS } from '../../../constants/inputLimits';
import { LimitedInput } from '../../../components/ui/LimitedInput';
import { ValidatedForm } from '../../../components/ui/FormValidation';

const FranchiseApplicantRegisterPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const params = new URLSearchParams(location.search);
  const requestedReturnTo = params.get('returnTo');
  const returnTo = requestedReturnTo === '/franchise/apply' || requestedReturnTo === '/franchise/my-applications'
    ? requestedReturnTo
    : '/franchise/apply';

  const handlePhoneChange = (value: string) => {
    setPhone(value.replace(/\D/g, '').slice(0, 11));
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (confirmPasswordRef.current && passwordConfirmation) {
      confirmPasswordRef.current.setCustomValidity(passwordConfirmation !== val ? 'Passwords do not match.' : '');
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPasswordConfirmation(val);
    e.target.setCustomValidity(val !== password ? 'Passwords do not match.' : '');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await franchiseApplicantAuthService.register({
        full_name: fullName,
        email,
        phone,
        password,
        password_confirmation: passwordConfirmation,
      });
      franchiseApplicantAuthService.clearAuth();
      navigate(`/franchise/applicant-login?registered=1&returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    } catch (registrationError: unknown) {
      setError(registrationError instanceof Error ? registrationError.message : 'Unable to create your applicant account.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] text-[var(--oppa-text)] lg:grid lg:grid-cols-2">
      <LoginBrandPanel title="Franchise Applicant Portal" description="Create a dedicated account to apply and follow your franchise application." />
      <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-10 lg:px-12">
        <section className="w-full max-w-[430px] rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm sm:p-7">
          <Link to={`/franchise/applicant-login?returnTo=${encodeURIComponent(returnTo)}`} className="mb-5 inline-flex min-h-9 items-center gap-2 rounded text-sm text-[var(--oppa-text-muted)] hover:text-[var(--oppa-green)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]">
            <ArrowLeft size={16} aria-hidden="true" /> Back to sign in
          </Link>
          <header className="mb-6 text-center">
            <div className="mb-4 flex items-center justify-center gap-2.5 text-[var(--oppa-green)]">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--oppa-green-soft)]"><BriefcaseBusiness className="size-5" aria-hidden="true" /></span>
              <span className="text-xl font-semibold">Oppa Dru</span>
            </div>
            <h1 className="font-serif text-3xl font-semibold text-[var(--oppa-green)]">Create applicant account</h1>
            <p className="mt-1.5 text-sm text-[var(--oppa-text-muted)]">Use a separate account to manage your franchise application.</p>
          </header>
          {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">{error}</p>}
          <ValidatedForm onSubmit={handleSubmit} className="space-y-4" aria-busy={isLoading}>
            <label className="block text-sm font-medium text-[var(--oppa-green)]">
              Full name
              <span className="relative mt-1.5 block">
                <UserRound className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput required minLength={INPUT_LIMITS.personName.min} maxLength={INPUT_LIMITS.personName.max} inputFilter="personName" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} className="min-h-11 w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20" placeholder="e.g. Juan dela Cruz" />
              </span>
            </label>
            <label className="block text-sm font-medium text-[var(--oppa-green)]">
              Email
              <span className="relative mt-1.5 block">
                <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput required type="email" maxLength={INPUT_LIMITS.email.max} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11 w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20" placeholder="applicant@example.com" />
              </span>
            </label>
            <label className="block text-sm font-medium text-[var(--oppa-green)]">
              Mobile number
              <span className="relative mt-1.5 block">
                <Phone className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput required type="tel" inputMode="numeric" pattern="09\d{9}" maxLength={11} inputFilter="digits" autoComplete="tel-national" value={phone} onChange={(event) => handlePhoneChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20" placeholder="e.g. 09171234567" title="09XXXXXXXXX" />
              </span>
            </label>
            <label className="block text-sm font-medium text-[var(--oppa-green)]">
              Password
              <span className="relative mt-1.5 block">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput required minLength={INPUT_LIMITS.password.min} maxLength={INPUT_LIMITS.password.max} type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => handlePasswordChange(event.target.value)} className="min-h-11 w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-11 text-sm placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20" placeholder="At least 8 characters" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]">
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </span>
            </label>
            <label className="block text-sm font-medium text-[var(--oppa-green)]">
              Confirm password
              <span className="relative mt-1.5 block">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput ref={confirmPasswordRef} required minLength={INPUT_LIMITS.password.min} maxLength={INPUT_LIMITS.password.max} type={showPasswordConfirmation ? 'text' : 'password'} autoComplete="new-password" value={passwordConfirmation} onChange={handleConfirmPasswordChange} className="min-h-11 w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-11 text-sm placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20" placeholder="Re-enter your password" />
                <button type="button" onClick={() => setShowPasswordConfirmation((visible) => !visible)} aria-label={showPasswordConfirmation ? 'Hide confirm password' : 'Show confirm password'} aria-pressed={showPasswordConfirmation} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]">
                  {showPasswordConfirmation ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </span>
            </label>
            <button type="submit" disabled={isLoading} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--oppa-green)] py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:cursor-not-allowed disabled:opacity-60">
              {isLoading ? 'Creating account…' : 'Create applicant account'}
            </button>
          </ValidatedForm>
          <p className="mt-5 text-center text-sm text-[var(--oppa-text-muted)]">
            Already registered? <Link className="font-semibold text-[var(--oppa-green)] underline-offset-2 hover:underline" to={`/franchise/applicant-login?returnTo=${encodeURIComponent(returnTo)}`}>Sign in</Link>
          </p>
        </section>
      </main>
    </div>
  );
};

export default FranchiseApplicantRegisterPage;
