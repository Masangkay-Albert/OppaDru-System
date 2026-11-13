import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/Authcontext";
import { UserPlus, Eye, EyeOff, Phone, Mail, Lock, User } from "lucide-react";
import LoginBrandPanel from "../../../components/LoginBrandPanel";
import { INPUT_LIMITS, normalizePhilippinePhone } from "../../../constants/inputLimits";
import { LimitedInput } from "../../../components/ui/LimitedInput";
import { FormAlert, ValidatedForm } from '../../../components/ui/FormValidation';

const RegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const returnTo = new URLSearchParams(location.search).get("returnTo");
    if (returnTo && returnTo.startsWith("/franchise")) {
      navigate(`/franchise/register?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    }
  }, [location.search, navigate]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(e.currentTarget.value.replace(/\D/g, "").slice(0, 11));
  };

  const handlePhonePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    const normalized = digits.startsWith("63") && digits.length === 12
      ? `0${digits.slice(2)}`
      : digits.slice(0, 11);
    setPhone(normalized);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (confirmPasswordRef.current && passwordConfirmation) {
      confirmPasswordRef.current.setCustomValidity(passwordConfirmation !== value ? "Passwords do not match" : "");
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPasswordConfirmation(value);
    e.target.setCustomValidity(value !== password ? "Passwords do not match" : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const success = await register({
        full_name: fullName,
        email,
        phone: normalizePhilippinePhone(phone),
        password,
        password_confirmation: passwordConfirmation,
      });

      if (success) {
        navigate("/login?registered=1");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to register. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const inputBaseClass =
    "min-h-11 w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-4 text-sm transition-colors placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20";

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] lg:grid lg:grid-cols-2">
      <LoginBrandPanel title="Join Oppa Dru" description="Sauced, tossed, and straight-up obsessed." />

      <div className="flex min-h-screen items-center justify-center bg-[var(--oppa-cream)] px-4 py-4 sm:py-6">
        <div className="w-full max-w-md">
          <div className="mb-4 flex flex-col items-center gap-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <UserPlus className="size-7 text-[var(--oppa-green)]" />
              <span className="text-2xl font-semibold text-[var(--oppa-green)]">
                Oppa Dru
              </span>
            </div>
            <h1 className="text-2xl font-semibold text-[var(--oppa-green)]">
              Create Account
            </h1>
            <p className="text-sm text-[var(--oppa-text-muted)]">
              Sign up to get started
            </p>
          </div>

          {error && (
            <FormAlert className="p-4">
              {error}
            </FormAlert>
          )}

          <ValidatedForm
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-[var(--oppa-border)] bg-[var(--oppa-surface)] p-5 shadow-lg sm:p-6"
          >
            <div>
              <label htmlFor="registration-full-name" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Full Name <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput
                  id="registration-full-name"
                  name="full_name"
                  type="text"
                  required
                  minLength={INPUT_LIMITS.personName.min}
                  maxLength={INPUT_LIMITS.personName.max}
                  inputFilter="personName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputBaseClass}
                  placeholder="Juan Dela Cruz"
                />
              </div>
            </div>

            <div>
              <label htmlFor="registration-email" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Email Address <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput
                  id="registration-email"
                  name="email"
                  type="email"
                  required
                  maxLength={INPUT_LIMITS.registrationEmail.max}
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  autoComplete="email"
                  className={inputBaseClass}
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="registration-phone" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Phone Number <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput
                  id="registration-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  pattern="(\+?63|0)?9\d{9}"
                  maxLength={11}
                  inputFilter="digits"
                  value={phone}
                  onChange={handlePhoneChange}
                  onPaste={handlePhonePaste}
                  className={inputBaseClass}
                  placeholder="09123456789"
                  title="09XX XXX XXXX"
                />
              </div>
            </div>

            <div>
              <label htmlFor="registration-password" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Password <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput
                  id="registration-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={INPUT_LIMITS.password.min}
                  maxLength={INPUT_LIMITS.password.max}
                  autoComplete="new-password"
                  value={password}
                  onChange={handlePasswordChange}
                  className={`${inputBaseClass} pr-12`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:text-[var(--oppa-green)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--oppa-green)]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="registration-password-confirmation" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Confirm Password <span className="text-red-600" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput
                  id="registration-password-confirmation"
                  ref={confirmPasswordRef}
                  name="password_confirmation"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  maxLength={INPUT_LIMITS.password.max}
                  autoComplete="new-password"
                  value={passwordConfirmation}
                  onChange={handleConfirmPasswordChange}
                  className={`${inputBaseClass} pr-12`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  aria-pressed={showConfirmPassword}
                  className="absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:text-[var(--oppa-green)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--oppa-green)]"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isLoading}
                className="min-h-12 w-full rounded-xl bg-[var(--oppa-green)] py-3 font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Creating Account..." : "Sign Up"}
              </button>
            </div>
          </ValidatedForm>

          <div className="mt-4 flex flex-col gap-3">
            <p className="text-center text-sm text-[var(--oppa-text-muted)]">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="text-[var(--oppa-green)] font-semibold hover:underline"
              >
                Sign In
              </button>
            </p>

            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full text-sm text-[var(--oppa-text-muted)] transition-colors hover:text-[var(--oppa-green)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationPage;
