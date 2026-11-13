import React, { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, XCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import LoginBrandPanel from "../../../components/LoginBrandPanel";
import { useToast } from "../components/ToastProvider";
import { authService } from "../../../services/authService";
import { validatePasswordComplexity } from "../../../utils/passwordValidation";
import { INPUT_LIMITS } from "../../../constants/inputLimits";
import { LimitedInput } from "../../../components/ui/LimitedInput";

const ResetPasswordPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const params = new URLSearchParams(location.search);
  const token = params.get("token");
  const email = params.get("email");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const passwordValidation = useMemo(() => validatePasswordComplexity(password), [password]);
  const passwordMismatch = passwordConfirmation.length > 0 && password !== passwordConfirmation;

  if (!token || !email) {
    return (
      <div className="min-h-screen bg-[var(--oppa-cream)] text-[var(--oppa-text)] lg:grid lg:grid-cols-2">
        <LoginBrandPanel title="Reset Your Password" description="Use the link from your email to continue." />

        <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-md rounded-2xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm sm:p-8">
            <div className="space-y-4 text-center">
              <h1 className="font-serif text-3xl font-semibold text-[var(--oppa-green)]">Invalid link</h1>
              <p className="text-sm text-[var(--oppa-text-muted)]">
                This password reset link is missing information or has expired.
              </p>

              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--oppa-green)] px-5 py-3 font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)]"
              >
                Request a new link
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!password || !passwordConfirmation) {
      setError("Please enter and confirm your new password.");
      return;
    }

    if (!passwordValidation.isValid) {
      setError("Your password must include uppercase, lowercase, a number, and a special character.");
      return;
    }

    if (password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      await authService.resetPassword({
        token,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });

      showToast("Password reset successful. Please sign in.", "success");
      navigate("/login?reset=1", { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "We couldn't reset your password.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const checklistItems = [
    { label: "At least 8 characters", valid: passwordValidation.isLongEnough },
    { label: "One uppercase letter", valid: passwordValidation.hasUpperCase },
    { label: "One lowercase letter", valid: passwordValidation.hasLowerCase },
    { label: "One number", valid: passwordValidation.hasNumber },
    { label: "One special character", valid: passwordValidation.hasSpecialChar },
  ];

  return (
    <div className="min-h-screen bg-[var(--oppa-cream)] text-[var(--oppa-text)] lg:grid lg:grid-cols-2">
      <LoginBrandPanel title="Create a New Password" description="Choose a strong password to secure your account." />

      <main className="flex min-h-screen items-center justify-center px-5 py-8 sm:px-8">
        <div className="w-full max-w-md rounded-2xl border border-[var(--oppa-border)] bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <h1 className="font-serif text-3xl font-semibold text-[var(--oppa-green)]">Reset Password</h1>
            <p className="mt-2 text-sm text-[var(--oppa-text-muted)]">Set a new password for {email}</p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700" role="alert" aria-live="assertive">
              {error}
              {error.includes("expired") || error.includes("invalid") ? (
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="mt-2 block font-semibold underline underline-offset-2"
                >
                  Request a new link
                </button>
              ) : null}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isLoading}>
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  minLength={INPUT_LIMITS.password.min}
                  maxLength={INPUT_LIMITS.password.max}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-12 text-sm transition-colors placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20"
                  placeholder="Enter a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:text-[var(--oppa-green)]"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-new-password" className="mb-1.5 block text-sm font-medium text-[var(--oppa-green)]">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <LimitedInput
                  id="confirm-new-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  maxLength={INPUT_LIMITS.password.max}
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[var(--oppa-border)] py-2.5 pl-10 pr-12 text-sm transition-colors placeholder:text-gray-400 focus:border-[var(--oppa-green)] focus:outline-none focus:ring-2 focus:ring-[var(--oppa-green)]/20"
                  placeholder="Confirm your new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  className="absolute right-2.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition-colors hover:text-[var(--oppa-green)]"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--oppa-border)] bg-[var(--oppa-green-soft)]/30 p-3.5" aria-live="polite">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--oppa-green)]">Password requirements</p>
              <ul className="space-y-2 text-sm">
                {checklistItems.map((item) => {
                  const Icon = item.valid ? CheckCircle2 : XCircle;
                  return (
                    <li key={item.label} className="flex items-center gap-2 text-[var(--oppa-text-muted)]">
                      <Icon className={`size-4 ${item.valid ? "text-green-600" : "text-gray-400"}`} aria-hidden="true" />
                      <span className={item.valid ? "text-green-700" : ""}>{item.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {passwordMismatch && (
              <p className="text-sm text-red-600" role="alert" aria-live="assertive">Passwords do not match.</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="min-h-11 w-full rounded-xl bg-[var(--oppa-green)] py-3 font-semibold text-white transition-colors hover:bg-[var(--oppa-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--oppa-green)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Updating password..." : "Reset password"}
            </button>
          </form>

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

export default ResetPasswordPage;
