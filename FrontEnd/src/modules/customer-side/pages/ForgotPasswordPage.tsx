import React, { useState } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, Mail, Phone, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoginBrandPanel from "../../../components/LoginBrandPanel";
import { useToast } from "../components/ToastProvider";
import { authService } from "../../../services/authService";

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

  const inputClassName = "min-h-11 w-full rounded-xl border border-[var(--oppa-border)] px-3.5 py-2.5 text-sm transition-colors placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20";
  const passwordValid = passwordRules.every((rule) => rule.test(password));

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] text-[var(--oppa-text)] lg:grid lg:grid-cols-2">
      <LoginBrandPanel title="Recover Your Account" description="Verify your identity and get back to enjoying your favorites." />

      <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-md rounded-2xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <div className="mb-3 inline-flex size-11 items-center justify-center rounded-xl bg-[var(--oppa-green-soft)] text-[var(--oppa-green)]">
              {step === 1 ? <ShieldCheck className="size-5" aria-hidden="true" /> : <KeyRound className="size-5" aria-hidden="true" />}
            </div>
            <h1 className="font-serif text-3xl font-semibold text-[var(--oppa-green)]">
              {step === 1 ? "Verify identity" : "Set a new password"}
            </h1>
            <p className="mt-2 text-sm text-[var(--oppa-text-muted)]">
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
              <div className="mb-5 rounded-xl bg-gray-100 p-1" role="group" aria-label="Verification method">
                <span className="flex min-h-10 w-1/2 items-center justify-center rounded-lg bg-white px-2 text-sm font-medium text-[var(--oppa-green)] shadow-sm">
                  Phone number
                </span>
              </div>
              <form onSubmit={handleVerify} className="space-y-4" aria-busy={isSubmitting}>
                <div>
                  <label htmlFor="recovery-email" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                    Account email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input
                      id="recovery-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      disabled={isSubmitting}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className={`${inputClassName} pl-10`}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="recovery-phone" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                    Registered phone number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                    <input
                      id="recovery-phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      disabled={isSubmitting}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className={`${inputClassName} pl-10`}
                      placeholder="09XXXXXXXXX"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-11 w-full rounded-xl bg-[var(--oppa-green)] py-3 font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Verifying..." : "Verify identity"}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800" role="status">
                This reset session lasts 10 minutes.
              </p>
              <form onSubmit={handleComplete} className="space-y-4" aria-busy={isSubmitting}>
                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      disabled={isSubmitting}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
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
                    <input
                      id="confirm-new-password"
                      name="password_confirmation"
                      type={showConfirmation ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      disabled={isSubmitting}
                      value={passwordConfirmation}
                      onChange={(event) => setPasswordConfirmation(event.target.value)}
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
                  {passwordConfirmation && password !== passwordConfirmation && (
                    <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !passwordValid || password !== passwordConfirmation}
                  className="min-h-11 w-full rounded-xl bg-[var(--oppa-green)] py-3 font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Updating password..." : "Update password"}
                </button>
              </form>
            </>
          )}

          {step === 1 && (
            <p className="mt-4 text-center text-xs text-[var(--oppa-text-muted)]">
              Don&apos;t have a phone number saved? Contact support.
            </p>
          )}

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--oppa-green)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
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
