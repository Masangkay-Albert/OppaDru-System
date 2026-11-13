import React, { useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, Mail, Phone, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import { authService } from "../../../services/authService";
import LoginBrandPanel from "../../../components/LoginBrandPanel";
import { INPUT_LIMITS } from "../../../constants/inputLimits";
import { LimitedInput } from "../../../components/ui/LimitedInput";
import { ValidatedForm } from '../../../components/ui/FormValidation';

const passwordRules = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "At least one uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "At least one lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "At least one number", test: (value: string) => /[0-9]/.test(value) },
  { label: "At least one special character", test: (value: string) => /[!@#$%^&*(),.?":{}|<>]/.test(value) },
];

const INVALID_RESET_MESSAGE = "This reset session is invalid or has expired. Start again.";

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (confirmPasswordRef.current && passwordConfirmation) {
      confirmPasswordRef.current.setCustomValidity(passwordConfirmation !== val ? "Passwords do not match." : "");
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPasswordConfirmation(val);
    e.target.setCustomValidity(val !== password ? "Passwords do not match." : "");
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      const token = await authService.verifyPasswordReset({
        email: email.trim(),
        phone,
      });
      setResetToken(token);
      setStep(2);
    } catch (verifyError: unknown) {
      setError(verifyError instanceof Error ? verifyError.message : "Unable to verify your account details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }

    if (!passwordRules.every((rule) => rule.test(password))) {
      setError("Please meet all password requirements.");
      return;
    }

    setIsSubmitting(true);
    try {
      const message = await authService.completePasswordReset({
        email: email.trim(),
        reset_token: resetToken,
        password,
        password_confirmation: passwordConfirmation,
      });
      showToast(message, "success");
      navigate("/login", { replace: true, state: { passwordResetSuccess: true } });
    } catch (completeError: unknown) {
      const message = completeError instanceof Error ? completeError.message : "Unable to update your password.";
      if (message === INVALID_RESET_MESSAGE) {
        setResetToken("");
        setStep(1);
        setNotice("Your reset session expired. Verify your identity again to continue.");
        setPassword("");
        setPasswordConfirmation("");
      } else {
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClassName = "min-h-12 w-full rounded-xl border border-[var(--oppa-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--oppa-text)] transition-colors placeholder:text-gray-400 hover:border-[var(--oppa-green)]/45 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-4 focus:ring-[var(--oppa-green)]/10 disabled:cursor-not-allowed disabled:bg-gray-50";

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] text-[var(--oppa-text)] lg:grid lg:grid-cols-2">
      <LoginBrandPanel title="Let's get you back in." description="Verify your account and choose a new password securely." />

      <main className="relative flex min-h-screen items-center justify-center px-5 py-8 sm:px-10 lg:px-12">
        <div className="w-full max-w-[430px] rounded-2xl border border-[var(--oppa-border)] bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-7 text-center">
            <div className="mb-3 inline-flex size-12 items-center justify-center rounded-full bg-[var(--oppa-green-soft)] text-[var(--oppa-green)] ring-4 ring-[var(--oppa-green-soft)]/40">
              {step === 1 ? <ShieldCheck className="size-5" aria-hidden="true" /> : <KeyRound className="size-5" aria-hidden="true" />}
            </div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--oppa-text-muted)]">
              Account recovery
            </p>
            <h1 className="font-serif text-3xl font-semibold tracking-tight text-[var(--oppa-green)]">
              {step === 1 ? "Verify identity" : "Set a new password"}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--oppa-text-muted)]">
              {step === 1
                ? "Confirm your account email and registered phone."
                : "Choose a strong password for your account."}
            </p>
          </div>

          {(error || notice) && (
            <div
              className={`mb-4 rounded-xl border p-3.5 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}
              role={error ? "alert" : "status"}
              aria-live={error ? "assertive" : "polite"}
            >
              {error || notice}
            </div>
          )}

          {step === 1 ? (
            <>
              <ValidatedForm onSubmit={handleVerify} className="space-y-5" aria-busy={isSubmitting}>
                <div>
                  <label htmlFor="recovery-email" className="mb-2 block text-sm font-semibold text-[var(--oppa-text)]">
                    Account email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--oppa-text-muted)]" aria-hidden="true" />
                    <LimitedInput
                      id="recovery-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={INPUT_LIMITS.email.max}
                      disabled={isSubmitting}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className={`${inputClassName} pl-10`}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="recovery-phone" className="mb-2 block text-sm font-semibold text-[var(--oppa-text)]">
                    Registered phone number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--oppa-text-muted)]" aria-hidden="true" />
                    <LimitedInput
                      id="recovery-phone"
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      pattern="(\+?63|0)?9\d{9}"
                      maxLength={13}
                      inputFilter="phone"
                      disabled={isSubmitting}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className={`${inputClassName} pl-10`}
                      placeholder="09XXXXXXXXX"
                      title="09XXXXXXXXX"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-1 min-h-12 w-full rounded-xl bg-[var(--oppa-green)] py-3 font-semibold text-white shadow-sm transition hover:bg-[var(--oppa-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Verifying..." : "Verify identity"}
                </button>
              </ValidatedForm>
            </>
          ) : (
            <>
              <p className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800" role="status">
                This reset session lasts 10 minutes.
              </p>
              <ValidatedForm onSubmit={handleComplete} className="space-y-4" aria-busy={isSubmitting}>
                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                    New password
                  </label>
                  <div className="relative">
                    <LimitedInput
                      id="new-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={INPUT_LIMITS.password.min}
                      maxLength={INPUT_LIMITS.password.max}
                      disabled={isSubmitting}
                      value={password}
                      onChange={(event) => handlePasswordChange(event.target.value)}
                      className={`${inputClassName} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? "Hide new password" : "Show new password"}
                      aria-pressed={showPassword}
                      className="absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:text-[var(--oppa-green)] focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1" aria-label="Password requirements">
                    {passwordRules.map((rule) => {
                      const valid = rule.test(password);
                      return (
                        <li key={rule.label} className={`text-xs ${valid ? "text-green-600" : "text-gray-500"}`}>
                          {valid ? "✓" : "○"} {rule.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div>
                  <label htmlFor="confirm-new-password" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <LimitedInput
                      id="confirm-new-password"
                      ref={confirmPasswordRef}
                      name="password_confirmation"
                      type={showConfirmation ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      maxLength={INPUT_LIMITS.password.max}
                      disabled={isSubmitting}
                      value={passwordConfirmation}
                      onChange={handleConfirmPasswordChange}
                      className={`${inputClassName} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmation((visible) => !visible)}
                      aria-label={showConfirmation ? "Hide password confirmation" : "Show password confirmation"}
                      aria-pressed={showConfirmation}
                      className="absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:text-[var(--oppa-green)] focus-visible:outline-2 focus-visible:outline-[var(--oppa-green)]"
                    >
                      {showConfirmation ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-11 w-full rounded-xl bg-[var(--oppa-green)] py-3 font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Updating password..." : "Update password"}
                </button>
              </ValidatedForm>
            </>
          )}

          {step === 1 && (
            <p className="mt-5 text-center text-xs leading-5 text-[var(--oppa-text-muted)]">
              Don&apos;t have a phone number saved? Contact support.
            </p>
          )}

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-[var(--oppa-green)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to login
          </button>
        </div>
      </main>
    </div>
  );
};

export default ForgotPasswordPage;
